import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { isDemoMode } from "@/lib/demo-auth"
import { getMockChanges } from "@/lib/mock-data"

// GET /api/changes - List all changes (paginated, filterable)
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return mock data
    if (isDemoMode()) {
      const searchParams = request.nextUrl.searchParams
      const page = parseInt(searchParams.get("page") || "1")
      const limit = parseInt(searchParams.get("limit") || "20")
      const mockChanges = getMockChanges()
      const start = (page - 1) * limit
      const paginatedChanges = mockChanges.slice(start, start + limit)

      return NextResponse.json({
        changes: paginatedChanges,
        pagination: {
          page,
          limit,
          total: mockChanges.length,
          totalPages: Math.ceil(mockChanges.length / limit),
        },
      })
    }

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
    const limit = parseInt(searchParams.get("limit") || "20")
    const competitorId = searchParams.get("competitorId")
    const changeType = searchParams.get("changeType")
    const isRead = searchParams.get("isRead")
    const isMaterial = searchParams.get("isMaterial")

    const where = {
      competitor: {
        workspaceId: membership.workspaceId,
        isActive: true,
      },
      ...(competitorId && { competitorId }),
      ...(changeType && { changeType }),
      ...(isRead !== null && { isRead: isRead === "true" }),
      ...(isMaterial !== null && { isMaterial: isMaterial !== "false" }),
    }

    const [changes, total] = await Promise.all([
      prisma.change.findMany({
        where,
        include: {
          competitor: {
            select: { id: true, name: true, logoUrl: true },
          },
          monitoredUrl: {
            select: { url: true, urlType: true },
          },
          beforeSnapshot: {
            select: { screenshotPath: true, capturedAt: true },
          },
          afterSnapshot: {
            select: { screenshotPath: true, capturedAt: true },
          },
        },
        orderBy: { detectedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.change.count({ where }),
    ])

    return NextResponse.json({
      changes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching changes:", error)
    return NextResponse.json(
      { error: "Failed to fetch changes" },
      { status: 500 }
    )
  }
}
