import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { generateDigest } from "@/lib/ai/claude"
import { formatDate } from "@/lib/utils"
import { changeTypeLabel } from "@/lib/types"

// GET /api/reports/competitive-set/[id] - Generate competitive set comparison report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get("format") || "json"
    const days = parseInt(searchParams.get("days") || "30")

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const set = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
      include: {
        members: {
          include: {
            competitor: {
              include: {
                monitoredUrls: {
                  where: { isActive: true },
                },
                changes: {
                  where: {
                    isMaterial: true,
                    detectedAt: { gte: startDate },
                  },
                  orderBy: { detectedAt: "desc" },
                  include: {
                    monitoredUrl: { select: { url: true, urlType: true } },
                  },
                },
                announcements: {
                  where: {
                    capturedAt: { gte: startDate },
                  },
                  orderBy: { publishedAt: "desc" },
                },
              },
            },
          },
        },
      },
    })

    if (!set) {
      return NextResponse.json({ error: "Competitive set not found" }, { status: 404 })
    }

    // Aggregate all changes and announcements for AI summary
    const allChanges = set.members.flatMap((m) =>
      m.competitor.changes.map((c) => ({
        competitorName: m.competitor.name,
        changeType: c.changeType || "unknown",
        summary: c.summary || "",
        detectedAt: formatDate(c.detectedAt),
      }))
    )

    const allAnnouncements = set.members.flatMap((m) =>
      m.competitor.announcements.map((a) => ({
        competitorName: m.competitor.name,
        title: a.title || "",
        sourceType: a.sourceType,
        publishedAt: formatDate(a.publishedAt || a.capturedAt),
      }))
    )

    const aiDigest = await generateDigest({
      changes: allChanges,
      announcements: allAnnouncements,
    })

    const report = {
      competitiveSet: {
        id: set.id,
        name: set.name,
        competitorCount: set.members.length,
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(new Date()),
        days,
      },
      summary: {
        totalChanges: allChanges.length,
        totalAnnouncements: allAnnouncements.length,
        aiSummary: aiDigest,
      },
      competitors: set.members.map((m) => ({
        id: m.competitor.id,
        name: m.competitor.name,
        primaryUrl: m.competitor.primaryUrl,
        logoUrl: m.competitor.logoUrl,
        stats: {
          changes: m.competitor.changes.length,
          announcements: m.competitor.announcements.length,
          monitoredUrls: m.competitor.monitoredUrls.length,
        },
        recentChanges: m.competitor.changes.slice(0, 3).map((c) => ({
          type: c.changeType,
          typeLabel: changeTypeLabel[c.changeType as keyof typeof changeTypeLabel] || c.changeType,
          summary: c.summary,
          detectedAt: formatDate(c.detectedAt),
        })),
        recentAnnouncements: m.competitor.announcements.slice(0, 3).map((a) => ({
          title: a.title,
          sourceType: a.sourceType,
          publishedAt: formatDate(a.publishedAt || a.capturedAt),
        })),
      })),
      changesByType: categorizeChanges(allChanges),
      generatedAt: new Date().toISOString(),
    }

    if (format === "markdown") {
      const markdown = generateComparisonMarkdown(report)
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${set.name.toLowerCase().replace(/\s+/g, "-")}-comparison.md"`,
        },
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Error generating competitive set report:", error)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}

function categorizeChanges(
  changes: Array<{ competitorName: string; changeType: string; summary: string; detectedAt: string }>
) {
  const categories: Record<string, Array<{ competitor: string; summary: string; date: string }>> = {}

  for (const change of changes) {
    if (!categories[change.changeType]) {
      categories[change.changeType] = []
    }
    categories[change.changeType].push({
      competitor: change.competitorName,
      summary: change.summary,
      date: change.detectedAt,
    })
  }

  return categories
}

function generateComparisonMarkdown(report: {
  competitiveSet: { name: string; competitorCount: number }
  period: { start: string; end: string; days: number }
  summary: { totalChanges: number; totalAnnouncements: number; aiSummary: string }
  competitors: Array<{
    name: string
    primaryUrl: string
    stats: { changes: number; announcements: number; monitoredUrls: number }
    recentChanges: Array<{ typeLabel: string; summary: string | null; detectedAt: string }>
  }>
  changesByType: Record<string, Array<{ competitor: string; summary: string; date: string }>>
  generatedAt: string
}): string {
  const competitorTable = report.competitors
    .map((c) => `| ${c.name} | ${c.primaryUrl} | ${c.stats.changes} | ${c.stats.announcements} |`)
    .join("\n")

  const changesByTypeSection = Object.entries(report.changesByType)
    .map(
      ([type, changes]) => `### ${changeTypeLabel[type as keyof typeof changeTypeLabel] || type}

${changes.map((c) => `- **${c.competitor}**: ${c.summary} _(${c.date})_`).join("\n")}`
    )
    .join("\n\n")

  return `# Competitive Set Comparison: ${report.competitiveSet.name}

**Report Period:** ${report.period.start} - ${report.period.end} (${report.period.days} days)
**Generated:** ${report.generatedAt}
**Competitors Tracked:** ${report.competitiveSet.competitorCount}

---

## Executive Summary

${report.summary.aiSummary}

---

## Competitor Overview

| Competitor | Website | Changes | Announcements |
|------------|---------|---------|---------------|
${competitorTable}

---

## Changes by Category

${changesByTypeSection || "_No changes detected during this period._"}

---

## Individual Competitor Highlights

${report.competitors
  .map(
    (c) => `### ${c.name}
**Website:** ${c.primaryUrl}

**Recent Activity:**
${
  c.recentChanges.length > 0
    ? c.recentChanges.map((ch) => `- ${ch.typeLabel}: ${ch.summary} _(${ch.detectedAt})_`).join("\n")
    : "_No recent changes_"
}
`
  )
  .join("\n---\n\n")}

---

*Report generated by CompetitorPulse*
`
}
