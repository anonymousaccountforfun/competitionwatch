import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

// GET /api/timeline - Unified timeline of changes + announcements
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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "30")
    const competitorId = searchParams.get("competitorId")
    const changeTypes = searchParams.get("changeTypes")?.split(",").filter(Boolean)
    const isRead = searchParams.get("isRead")

    const baseWhere = {
      competitor: {
        workspaceId: membership.workspaceId,
        isActive: true,
      },
      ...(competitorId && { competitorId }),
      ...(isRead !== null && { isRead: isRead === "true" }),
    }

    // Fetch changes and announcements
    const [changes, announcements] = await Promise.all([
      prisma.change.findMany({
        where: {
          ...baseWhere,
          isMaterial: true,
          ...(changeTypes && changeTypes.length > 0 && { changeType: { in: changeTypes } }),
        },
        include: {
          competitor: {
            select: { id: true, name: true, logoUrl: true },
          },
          monitoredUrl: {
            select: { url: true, urlType: true },
          },
        },
        orderBy: { detectedAt: "desc" },
        take: limit * 2, // Fetch more to merge
      }),
      prisma.announcement.findMany({
        where: {
          ...baseWhere,
          ...(changeTypes && changeTypes.length > 0 && { changeType: { in: changeTypes } }),
        },
        include: {
          competitor: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
        orderBy: { publishedAt: "desc" },
        take: limit * 2,
      }),
    ])

    // Merge and sort by date
    type TimelineItem = {
      type: "change" | "announcement"
      id: string
      date: Date
      data: typeof changes[0] | typeof announcements[0]
    }

    const timeline: TimelineItem[] = [
      ...changes.map((c) => ({
        type: "change" as const,
        id: c.id,
        date: c.detectedAt,
        data: c,
      })),
      ...announcements.map((a) => ({
        type: "announcement" as const,
        id: a.id,
        date: a.publishedAt || a.capturedAt,
        data: a,
      })),
    ]

    // Sort by date descending
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Paginate
    const start = (page - 1) * limit
    const paginatedTimeline = timeline.slice(start, start + limit)

    return NextResponse.json({
      items: paginatedTimeline,
      pagination: {
        page,
        limit,
        total: timeline.length,
        totalPages: Math.ceil(timeline.length / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching timeline:", error)
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    )
  }
}
