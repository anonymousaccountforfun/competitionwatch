import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

// GET /api/insights - Get AI-powered competitive insights
export async function GET(request: NextRequest) {
  try {
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
    const days = parseInt(searchParams.get("days") || "30")
    const competitorId = searchParams.get("competitorId")

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Gather competitive data
    const [competitors, changes, announcements] = await Promise.all([
      prisma.competitor.findMany({
        where: {
          workspaceId: membership.workspaceId,
          isActive: true,
          ...(competitorId && { id: competitorId }),
        },
        select: {
          id: true,
          name: true,
          primaryUrl: true,
          description: true,
        },
      }),
      prisma.change.findMany({
        where: {
          competitor: { workspaceId: membership.workspaceId },
          detectedAt: { gte: startDate },
          isMaterial: true,
          ...(competitorId && { competitorId }),
        },
        select: {
          competitorId: true,
          changeType: true,
          summary: true,
          analysis: true,
          detectedAt: true,
          competitor: { select: { name: true } },
        },
        orderBy: { detectedAt: "desc" },
        take: 50,
      }),
      prisma.announcement.findMany({
        where: {
          competitor: { workspaceId: membership.workspaceId },
          capturedAt: { gte: startDate },
          ...(competitorId && { competitorId }),
        },
        select: {
          competitorId: true,
          title: true,
          aiSummary: true,
          sourceType: true,
          changeType: true,
          publishedAt: true,
          competitor: { select: { name: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 30,
      }),
    ])

    if (competitors.length === 0) {
      return NextResponse.json({
        insights: null,
        message: "No competitors to analyze",
      })
    }

    // Generate AI insights
    const insights = await generateInsights(competitors, changes, announcements, days)

    return NextResponse.json({
      period: { days, startDate: startDate.toISOString() },
      competitorCount: competitors.length,
      changesAnalyzed: changes.length,
      announcementsAnalyzed: announcements.length,
      insights,
    })
  } catch (error) {
    console.error("Error generating insights:", error)
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    )
  }
}

async function generateInsights(
  competitors: Array<{ id: string; name: string; primaryUrl: string; description: string | null }>,
  changes: Array<{
    competitorId: string
    changeType: string | null
    summary: string | null
    analysis: string | null
    detectedAt: Date
    competitor: { name: string }
  }>,
  announcements: Array<{
    competitorId: string
    title: string | null
    aiSummary: string | null
    sourceType: string
    changeType: string | null
    publishedAt: Date | null
    competitor: { name: string }
  }>,
  days: number
) {
  const competitorSummary = competitors
    .map((c) => `- ${c.name} (${c.primaryUrl})${c.description ? `: ${c.description}` : ""}`)
    .join("\n")

  const changesSummary = changes
    .slice(0, 30)
    .map((c) => `- [${c.competitor.name}] ${c.changeType}: ${c.summary}`)
    .join("\n")

  const announcementsSummary = announcements
    .slice(0, 20)
    .map((a) => `- [${a.competitor.name}] ${a.title}: ${a.aiSummary || ""}`)
    .join("\n")

  const prompt = `You are a competitive intelligence analyst. Analyze the following competitive data from the past ${days} days and provide strategic insights.

## Competitors Being Tracked
${competitorSummary}

## Recent Material Changes Detected
${changesSummary || "No significant changes detected."}

## Recent Announcements
${announcementsSummary || "No recent announcements."}

Based on this data, provide a JSON response with the following structure:
{
  "marketTrends": [
    {
      "trend": "Description of market trend",
      "evidence": "What data supports this",
      "impact": "high|medium|low"
    }
  ],
  "competitorMoves": [
    {
      "competitor": "Competitor name",
      "move": "What they're doing",
      "significance": "Why it matters",
      "suggestedResponse": "How to respond"
    }
  ],
  "opportunities": [
    {
      "opportunity": "Description of opportunity",
      "rationale": "Why this is an opportunity",
      "priority": "high|medium|low"
    }
  ],
  "threats": [
    {
      "threat": "Description of threat",
      "source": "Which competitor or trend",
      "severity": "high|medium|low",
      "mitigation": "Suggested mitigation"
    }
  ],
  "strategicRecommendations": [
    {
      "recommendation": "Specific recommendation",
      "rationale": "Why this matters",
      "timeframe": "immediate|short-term|long-term"
    }
  ],
  "executiveSummary": "A 2-3 sentence executive summary of the competitive landscape"
}

Provide actionable, specific insights based on the actual data. If there's limited data, acknowledge this and provide general insights based on what's available.`

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    })

    const content = response.content[0]
    if (content.type === "text") {
      // Extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    }

    return {
      executiveSummary: "Unable to generate insights. Please try again.",
      marketTrends: [],
      competitorMoves: [],
      opportunities: [],
      threats: [],
      strategicRecommendations: [],
    }
  } catch (error) {
    console.error("AI insights generation failed:", error)
    return {
      executiveSummary: "AI analysis temporarily unavailable.",
      marketTrends: [],
      competitorMoves: [],
      opportunities: [],
      threats: [],
      strategicRecommendations: [],
    }
  }
}

// POST /api/insights - Generate specific insight type
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { type, competitorIds, question } = body

    // Custom question feature
    if (type === "custom" && question) {
      const competitors = await prisma.competitor.findMany({
        where: {
          workspaceId: membership.workspaceId,
          isActive: true,
          ...(competitorIds?.length && { id: { in: competitorIds } }),
        },
        include: {
          changes: {
            where: { isMaterial: true },
            orderBy: { detectedAt: "desc" },
            take: 20,
          },
          announcements: {
            orderBy: { publishedAt: "desc" },
            take: 10,
          },
        },
      })

      const context = competitors
        .map(
          (c) =>
            `## ${c.name}\nRecent changes: ${c.changes.map((ch) => ch.summary).join("; ")}\nAnnouncements: ${c.announcements.map((a) => a.title).join("; ")}`
        )
        .join("\n\n")

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Based on this competitive intelligence data:\n\n${context}\n\nAnswer this question: ${question}\n\nProvide a clear, actionable answer based on the available data.`,
          },
        ],
      })

      const content = response.content[0]
      return NextResponse.json({
        question,
        answer: content.type === "text" ? content.text : "Unable to generate answer",
      })
    }

    return NextResponse.json({ error: "Invalid request type" }, { status: 400 })
  } catch (error) {
    console.error("Error processing insight request:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
