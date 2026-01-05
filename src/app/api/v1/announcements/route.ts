import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateApiKey, hasPermission, ApiAuthResult } from "@/lib/api-auth"

// GET /api/v1/announcements - List announcements
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request)
  if (authResult instanceof NextResponse) return authResult

  const auth = authResult as ApiAuthResult

  if (!hasPermission(auth, "read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")
    const competitorId = searchParams.get("competitor_id")
    const sourceType = searchParams.get("source_type")
    const since = searchParams.get("since") // ISO date string

    const where = {
      competitor: { workspaceId: auth.workspaceId },
      ...(competitorId && { competitorId }),
      ...(sourceType && { sourceType }),
      ...(since && { capturedAt: { gte: new Date(since) } }),
    }

    const announcements = await prisma.announcement.findMany({
      where,
      select: {
        id: true,
        sourceType: true,
        sourceUrl: true,
        title: true,
        content: true,
        publishedAt: true,
        capturedAt: true,
        aiSummary: true,
        changeType: true,
        competitor: {
          select: { id: true, name: true, primaryUrl: true },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await prisma.announcement.count({ where })

    return NextResponse.json({
      data: announcements,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + announcements.length < total,
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
