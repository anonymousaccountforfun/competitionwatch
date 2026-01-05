import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

// GET /api/analytics - Get analytics data
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

    // Base where clause
    const baseWhere = {
      competitor: { workspaceId: membership.workspaceId },
      detectedAt: { gte: startDate },
      ...(competitorId && { competitorId }),
    }

    // Get change velocity (changes per day)
    const changes = await prisma.change.findMany({
      where: baseWhere,
      select: {
        id: true,
        detectedAt: true,
        changeType: true,
        isMaterial: true,
        competitorId: true,
        competitor: { select: { name: true } },
      },
      orderBy: { detectedAt: "asc" },
    })

    // Get announcements
    const announcements = await prisma.announcement.findMany({
      where: {
        competitor: { workspaceId: membership.workspaceId },
        capturedAt: { gte: startDate },
        ...(competitorId && { competitorId }),
      },
      select: {
        id: true,
        capturedAt: true,
        sourceType: true,
        competitorId: true,
        competitor: { select: { name: true } },
      },
      orderBy: { capturedAt: "asc" },
    })

    // Calculate daily activity
    const dailyActivity = calculateDailyActivity(changes, announcements, days)

    // Calculate change type distribution
    const changeTypeDistribution = calculateChangeTypeDistribution(changes)

    // Calculate competitor activity scores
    const competitors = await prisma.competitor.findMany({
      where: { workspaceId: membership.workspaceId, isActive: true },
      select: { id: true, name: true, logoUrl: true },
    })

    const competitorScores = await calculateCompetitorScores(
      competitors,
      membership.workspaceId,
      startDate
    )

    // Calculate trends
    const trends = calculateTrends(changes, announcements, days)

    // Get top changes
    const topChanges = await prisma.change.findMany({
      where: {
        ...baseWhere,
        isMaterial: true,
      },
      include: {
        competitor: { select: { name: true, logoUrl: true } },
        monitoredUrl: { select: { url: true, urlType: true } },
      },
      orderBy: { detectedAt: "desc" },
      take: 10,
    })

    return NextResponse.json({
      period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
      summary: {
        totalChanges: changes.length,
        materialChanges: changes.filter((c) => c.isMaterial).length,
        totalAnnouncements: announcements.length,
        activeCompetitors: new Set(changes.map((c) => c.competitorId)).size,
        avgChangesPerDay: (changes.length / days).toFixed(2),
      },
      dailyActivity,
      changeTypeDistribution,
      competitorScores,
      trends,
      topChanges: topChanges.map((c) => ({
        id: c.id,
        competitor: c.competitor.name,
        competitorLogo: c.competitor.logoUrl,
        changeType: c.changeType,
        summary: c.summary,
        url: c.monitoredUrl?.url,
        urlType: c.monitoredUrl?.urlType,
        detectedAt: c.detectedAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}

function calculateDailyActivity(
  changes: Array<{ detectedAt: Date }>,
  announcements: Array<{ capturedAt: Date }>,
  days: number
) {
  const activity: Record<string, { changes: number; announcements: number }> = {}

  // Initialize all days
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toISOString().split("T")[0]
    activity[key] = { changes: 0, announcements: 0 }
  }

  // Count changes
  for (const change of changes) {
    const key = change.detectedAt.toISOString().split("T")[0]
    if (activity[key]) {
      activity[key].changes++
    }
  }

  // Count announcements
  for (const announcement of announcements) {
    const key = announcement.capturedAt.toISOString().split("T")[0]
    if (activity[key]) {
      activity[key].announcements++
    }
  }

  // Convert to sorted array
  return Object.entries(activity)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function calculateChangeTypeDistribution(
  changes: Array<{ changeType: string | null }>
) {
  const distribution: Record<string, number> = {}

  for (const change of changes) {
    const type = change.changeType || "unknown"
    distribution[type] = (distribution[type] || 0) + 1
  }

  return Object.entries(distribution)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

async function calculateCompetitorScores(
  competitors: Array<{ id: string; name: string; logoUrl: string | null }>,
  workspaceId: string,
  startDate: Date
) {
  const scores = []

  for (const competitor of competitors) {
    const [changes, announcements, urls] = await Promise.all([
      prisma.change.count({
        where: {
          competitorId: competitor.id,
          detectedAt: { gte: startDate },
        },
      }),
      prisma.announcement.count({
        where: {
          competitorId: competitor.id,
          capturedAt: { gte: startDate },
        },
      }),
      prisma.monitoredUrl.count({
        where: {
          competitorId: competitor.id,
          isActive: true,
        },
      }),
    ])

    // Activity score: weighted sum of changes and announcements
    const activityScore = changes * 2 + announcements

    scores.push({
      id: competitor.id,
      name: competitor.name,
      logoUrl: competitor.logoUrl,
      changes,
      announcements,
      monitoredUrls: urls,
      activityScore,
    })
  }

  return scores.sort((a, b) => b.activityScore - a.activityScore)
}

function calculateTrends(
  changes: Array<{ detectedAt: Date; changeType: string | null }>,
  announcements: Array<{ capturedAt: Date }>,
  days: number
) {
  const midpoint = Math.floor(days / 2)
  const midDate = new Date()
  midDate.setDate(midDate.getDate() - midpoint)

  const firstHalfChanges = changes.filter((c) => c.detectedAt < midDate).length
  const secondHalfChanges = changes.filter((c) => c.detectedAt >= midDate).length

  const firstHalfAnnouncements = announcements.filter((a) => a.capturedAt < midDate).length
  const secondHalfAnnouncements = announcements.filter((a) => a.capturedAt >= midDate).length

  const changeTrend = firstHalfChanges > 0
    ? ((secondHalfChanges - firstHalfChanges) / firstHalfChanges) * 100
    : secondHalfChanges > 0 ? 100 : 0

  const announcementTrend = firstHalfAnnouncements > 0
    ? ((secondHalfAnnouncements - firstHalfAnnouncements) / firstHalfAnnouncements) * 100
    : secondHalfAnnouncements > 0 ? 100 : 0

  // Most common change types in recent period
  const recentChangeTypes = changes
    .filter((c) => c.detectedAt >= midDate)
    .reduce((acc, c) => {
      const type = c.changeType || "unknown"
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const trendingChangeTypes = Object.entries(recentChangeTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type)

  return {
    changeVelocity: {
      firstHalf: firstHalfChanges,
      secondHalf: secondHalfChanges,
      percentChange: Math.round(changeTrend),
      direction: changeTrend > 10 ? "increasing" : changeTrend < -10 ? "decreasing" : "stable",
    },
    announcementVelocity: {
      firstHalf: firstHalfAnnouncements,
      secondHalf: secondHalfAnnouncements,
      percentChange: Math.round(announcementTrend),
      direction: announcementTrend > 10 ? "increasing" : announcementTrend < -10 ? "decreasing" : "stable",
    },
    trendingChangeTypes,
  }
}
