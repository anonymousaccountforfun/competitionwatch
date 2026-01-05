import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { generateDigest } from "@/lib/ai/claude"
import { formatDate } from "@/lib/utils"
import { changeTypeLabel } from "@/lib/types"

// GET /api/reports/competitor/[id] - Generate competitor report
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

    const competitor = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
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
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Generate AI summary
    const aiDigest = await generateDigest({
      changes: competitor.changes.map((c) => ({
        competitorName: competitor.name,
        changeType: c.changeType || "unknown",
        summary: c.summary || "",
        detectedAt: formatDate(c.detectedAt),
      })),
      announcements: competitor.announcements.map((a) => ({
        competitorName: competitor.name,
        title: a.title || "",
        sourceType: a.sourceType,
        publishedAt: formatDate(a.publishedAt || a.capturedAt),
      })),
    })

    const report = {
      competitor: {
        id: competitor.id,
        name: competitor.name,
        primaryUrl: competitor.primaryUrl,
        logoUrl: competitor.logoUrl,
        description: competitor.description,
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(new Date()),
        days,
      },
      summary: {
        totalChanges: competitor.changes.length,
        totalAnnouncements: competitor.announcements.length,
        monitoredUrls: competitor.monitoredUrls.length,
        aiSummary: aiDigest,
      },
      changes: competitor.changes.map((c) => ({
        id: c.id,
        type: c.changeType,
        typeLabel: changeTypeLabel[c.changeType as keyof typeof changeTypeLabel] || c.changeType,
        summary: c.summary,
        analysis: c.analysis,
        confidence: c.confidence,
        detectedAt: formatDate(c.detectedAt),
        url: c.monitoredUrl.url,
        urlType: c.monitoredUrl.urlType,
      })),
      announcements: competitor.announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        sourceType: a.sourceType,
        sourceUrl: a.sourceUrl,
        aiSummary: a.aiSummary,
        publishedAt: formatDate(a.publishedAt || a.capturedAt),
      })),
      generatedAt: new Date().toISOString(),
    }

    if (format === "markdown") {
      const markdown = generateMarkdownReport(report)
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${competitor.name.toLowerCase().replace(/\s+/g, "-")}-report.md"`,
        },
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Error generating competitor report:", error)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}

function generateMarkdownReport(report: {
  competitor: { name: string; primaryUrl: string; description?: string | null }
  period: { start: string; end: string; days: number }
  summary: { totalChanges: number; totalAnnouncements: number; monitoredUrls: number; aiSummary: string }
  changes: Array<{ typeLabel: string; summary: string | null; analysis: string | null; detectedAt: string; url: string }>
  announcements: Array<{ title: string | null; sourceType: string; aiSummary: string | null; publishedAt: string }>
  generatedAt: string
}): string {
  return `# Competitive Intelligence Report: ${report.competitor.name}

**Report Period:** ${report.period.start} - ${report.period.end} (${report.period.days} days)
**Generated:** ${report.generatedAt}
**Website:** ${report.competitor.primaryUrl}

---

## Executive Summary

${report.summary.aiSummary}

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Website Changes Detected | ${report.summary.totalChanges} |
| Announcements Captured | ${report.summary.totalAnnouncements} |
| URLs Monitored | ${report.summary.monitoredUrls} |

---

## Website Changes

${
  report.changes.length === 0
    ? "_No significant changes detected during this period._"
    : report.changes
        .map(
          (c) => `### ${c.typeLabel}
**Detected:** ${c.detectedAt}
**URL:** ${c.url}

${c.summary || ""}

${c.analysis ? `**Analysis:** ${c.analysis}` : ""}

---`
        )
        .join("\n\n")
}

## Announcements

${
  report.announcements.length === 0
    ? "_No announcements captured during this period._"
    : report.announcements
        .map(
          (a) => `### ${a.title || "Untitled"}
**Source:** ${a.sourceType} | **Published:** ${a.publishedAt}

${a.aiSummary || ""}

---`
        )
        .join("\n\n")
}

---

*Report generated by CompetitorPulse*
`
}
