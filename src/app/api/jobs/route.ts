import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { captureSnapshot, hasSignificantChange, computeDiff } from "@/lib/scraping/puppeteer"
import { analyzeChange, analyzeAnnouncement } from "@/lib/ai/claude"
import { fetchRSSFeed, fetchiOSAppInfo, extractAppStoreId } from "@/lib/scraping/rss"

// This endpoint is meant to be called by a cron job or job scheduler
// In production, you would use Inngest, Trigger.dev, or similar

// POST /api/jobs - Run scheduled jobs
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (in production, add auth)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { jobType } = body

    switch (jobType) {
      case "capture_snapshots":
        return await runSnapshotJobs()
      case "fetch_rss":
        return await runRSSJobs()
      case "check_app_stores":
        return await runAppStoreJobs()
      default:
        return NextResponse.json(
          { error: "Unknown job type" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Error running jobs:", error)
    return NextResponse.json(
      { error: "Failed to run jobs" },
      { status: 500 }
    )
  }
}

async function runSnapshotJobs() {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Find URLs that need to be checked
  const urlsToCheck = await prisma.monitoredUrl.findMany({
    where: {
      isActive: true,
      urlType: { not: "rss_feed" },
      competitor: { isActive: true },
      OR: [
        // Never checked
        { lastCheckedAt: null },
        // Hourly URLs
        {
          checkFrequency: "hourly",
          lastCheckedAt: { lt: oneHourAgo },
        },
        // Daily URLs
        {
          checkFrequency: "daily",
          lastCheckedAt: { lt: oneDayAgo },
        },
        // Twice daily
        {
          checkFrequency: "twice_daily",
          lastCheckedAt: { lt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
        },
        // Weekly URLs
        {
          checkFrequency: "weekly",
          lastCheckedAt: { lt: oneWeekAgo },
        },
      ],
    },
    include: {
      competitor: {
        select: { id: true, name: true },
      },
    },
    take: 10, // Process in batches
  })

  const results = []

  for (const url of urlsToCheck) {
    try {
      // Add delay between requests to the same domain
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const result = await captureSnapshot(url.url)

      const screenshotPath = result.screenshot
        ? `/screenshots/${url.id}/${Date.now()}.png`
        : null

      const snapshot = await prisma.snapshot.create({
        data: {
          monitoredUrlId: url.id,
          screenshotPath,
          htmlContent: result.htmlContent,
          textContent: result.textContent,
          metaTags: result.metaTags,
          contentHash: result.contentHash,
          status: result.status,
        },
      })

      await prisma.monitoredUrl.update({
        where: { id: url.id },
        data: { lastCheckedAt: new Date() },
      })

      // Check for changes
      const previousSnapshot = await prisma.snapshot.findFirst({
        where: {
          monitoredUrlId: url.id,
          id: { not: snapshot.id },
          status: "success",
        },
        orderBy: { capturedAt: "desc" },
      })

      if (
        previousSnapshot &&
        result.status === "success" &&
        hasSignificantChange(
          previousSnapshot.contentHash || "",
          result.contentHash,
          previousSnapshot.textContent || "",
          result.textContent
        )
      ) {
        const rawDiff = computeDiff(
          previousSnapshot.textContent || "",
          result.textContent
        )

        const analysis = await analyzeChange({
          competitorName: url.competitor.name,
          url: url.url,
          urlType: url.urlType,
          beforeContent: previousSnapshot.textContent || "",
          afterContent: result.textContent,
          beforeDate: previousSnapshot.capturedAt.toISOString(),
          afterDate: snapshot.capturedAt.toISOString(),
        })

        await prisma.change.create({
          data: {
            competitorId: url.competitor.id,
            monitoredUrlId: url.id,
            beforeSnapshotId: previousSnapshot.id,
            afterSnapshotId: snapshot.id,
            changeType: analysis.change_type,
            summary: analysis.summary,
            analysis: analysis.analysis,
            confidence: analysis.confidence,
            affectedAreas: analysis.affected_areas,
            rawDiff,
            isMaterial: analysis.is_material,
          },
        })
      }

      results.push({ urlId: url.id, status: "success" })
    } catch (error) {
      console.error(`Error processing URL ${url.id}:`, error)
      results.push({ urlId: url.id, status: "error", error: String(error) })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}

async function runRSSJobs() {
  const rssFeeds = await prisma.monitoredUrl.findMany({
    where: {
      isActive: true,
      urlType: "rss_feed",
      competitor: { isActive: true },
    },
    include: {
      competitor: {
        select: { id: true, name: true },
      },
    },
  })

  const results = []

  for (const feed of rssFeeds) {
    try {
      const items = await fetchRSSFeed(feed.url)

      for (const item of items.slice(0, 10)) {
        // Check if we already have this announcement
        const existing = await prisma.announcement.findFirst({
          where: {
            competitorId: feed.competitor.id,
            sourceType: "rss",
            OR: [
              { sourceUrl: item.link },
              { title: item.title },
            ],
          },
        })

        if (!existing) {
          const analysis = await analyzeAnnouncement(
            feed.competitor.name,
            item.title,
            item.content,
            "rss"
          )

          await prisma.announcement.create({
            data: {
              competitorId: feed.competitor.id,
              sourceType: "rss",
              sourceUrl: item.link,
              title: item.title,
              content: item.content,
              publishedAt: item.publishedAt,
              aiSummary: analysis.summary,
              aiAnalysis: analysis.analysis,
              changeType: analysis.changeType,
            },
          })
        }
      }

      await prisma.monitoredUrl.update({
        where: { id: feed.id },
        data: { lastCheckedAt: new Date() },
      })

      results.push({ feedId: feed.id, status: "success" })
    } catch (error) {
      console.error(`Error processing RSS feed ${feed.id}:`, error)
      results.push({ feedId: feed.id, status: "error", error: String(error) })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}

async function runAppStoreJobs() {
  const appStoreUrls = await prisma.monitoredUrl.findMany({
    where: {
      isActive: true,
      urlType: "app_store",
      competitor: { isActive: true },
    },
    include: {
      competitor: {
        select: { id: true, name: true },
      },
    },
  })

  const results = []

  for (const url of appStoreUrls) {
    try {
      // Currently only supporting iOS App Store
      const appId = extractAppStoreId(url.url)
      if (!appId) {
        results.push({ urlId: url.id, status: "skipped", reason: "Invalid app store URL" })
        continue
      }

      const appInfo = await fetchiOSAppInfo(appId)
      if (!appInfo) {
        results.push({ urlId: url.id, status: "skipped", reason: "App not found" })
        continue
      }

      // Check if we already have this version
      const existing = await prisma.announcement.findFirst({
        where: {
          competitorId: url.competitor.id,
          sourceType: "app_store_ios",
          metadata: {
            path: ["version"],
            equals: appInfo.version,
          },
        },
      })

      if (!existing && appInfo.releaseNotes) {
        const analysis = await analyzeAnnouncement(
          url.competitor.name,
          `${appInfo.appName} v${appInfo.version}`,
          appInfo.releaseNotes,
          "app_store_ios"
        )

        await prisma.announcement.create({
          data: {
            competitorId: url.competitor.id,
            sourceType: "app_store_ios",
            sourceUrl: url.url,
            title: `${appInfo.appName} v${appInfo.version}`,
            content: appInfo.releaseNotes,
            publishedAt: appInfo.releaseDate,
            aiSummary: analysis.summary,
            aiAnalysis: analysis.analysis,
            changeType: analysis.changeType,
            metadata: { version: appInfo.version },
          },
        })
      }

      await prisma.monitoredUrl.update({
        where: { id: url.id },
        data: { lastCheckedAt: new Date() },
      })

      results.push({ urlId: url.id, status: "success" })
    } catch (error) {
      console.error(`Error processing app store URL ${url.id}:`, error)
      results.push({ urlId: url.id, status: "error", error: String(error) })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}
