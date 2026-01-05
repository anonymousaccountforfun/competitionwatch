import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { captureSnapshot, hasSignificantChange, computeDiff } from "@/lib/scraping/puppeteer"
import { analyzeChange } from "@/lib/ai/claude"

// POST /api/snapshots/trigger/[urlId] - Manually trigger a snapshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ urlId: string }> }
) {
  try {
    const { urlId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    // Get the monitored URL
    const monitoredUrl = await prisma.monitoredUrl.findFirst({
      where: { id: urlId },
      include: {
        competitor: {
          select: { id: true, name: true, workspaceId: true },
        },
      },
    })

    if (!monitoredUrl || monitoredUrl.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    // Capture snapshot
    const result = await captureSnapshot(monitoredUrl.url)

    // Store screenshot (in production, upload to S3/Supabase Storage)
    // For now, we'll store a placeholder path
    const screenshotPath = result.screenshot
      ? `/screenshots/${urlId}/${Date.now()}.png`
      : null

    // Create snapshot record
    const snapshot = await prisma.snapshot.create({
      data: {
        monitoredUrlId: urlId,
        screenshotPath,
        htmlContent: result.htmlContent,
        textContent: result.textContent,
        metaTags: result.metaTags,
        contentHash: result.contentHash,
        status: result.status,
      },
    })

    // Update last checked
    await prisma.monitoredUrl.update({
      where: { id: urlId },
      data: { lastCheckedAt: new Date() },
    })

    // Check for changes against previous snapshot
    const previousSnapshot = await prisma.snapshot.findFirst({
      where: {
        monitoredUrlId: urlId,
        id: { not: snapshot.id },
        status: "success",
      },
      orderBy: { capturedAt: "desc" },
    })

    let change = null

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
      // Compute diff
      const rawDiff = computeDiff(
        previousSnapshot.textContent || "",
        result.textContent
      )

      // Analyze with AI
      const analysis = await analyzeChange({
        competitorName: monitoredUrl.competitor.name,
        url: monitoredUrl.url,
        urlType: monitoredUrl.urlType,
        beforeContent: previousSnapshot.textContent || "",
        afterContent: result.textContent,
        beforeDate: previousSnapshot.capturedAt.toISOString(),
        afterDate: snapshot.capturedAt.toISOString(),
      })

      // Create change record
      change = await prisma.change.create({
        data: {
          competitorId: monitoredUrl.competitor.id,
          monitoredUrlId: urlId,
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

    return NextResponse.json({
      snapshot,
      change,
      status: result.status,
      error: result.error,
    })
  } catch (error) {
    console.error("Error triggering snapshot:", error)
    return NextResponse.json(
      { error: "Failed to capture snapshot" },
      { status: 500 }
    )
  }
}
