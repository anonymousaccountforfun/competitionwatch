import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateApiKey, hasPermission, ApiAuthResult } from "@/lib/api-auth"

// GET /api/v1/changes - List changes
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
    const changeType = searchParams.get("change_type")
    const materialOnly = searchParams.get("material_only") === "true"
    const since = searchParams.get("since") // ISO date string

    const where = {
      competitor: { workspaceId: auth.workspaceId },
      ...(competitorId && { competitorId }),
      ...(changeType && { changeType }),
      ...(materialOnly && { isMaterial: true }),
      ...(since && { detectedAt: { gte: new Date(since) } }),
    }

    const changes = await prisma.change.findMany({
      where,
      select: {
        id: true,
        detectedAt: true,
        changeType: true,
        summary: true,
        analysis: true,
        confidence: true,
        affectedAreas: true,
        isMaterial: true,
        competitor: {
          select: { id: true, name: true, primaryUrl: true },
        },
        monitoredUrl: {
          select: { id: true, url: true, urlType: true },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: limit,
      skip: offset,
    })

    const total = await prisma.change.count({ where })

    return NextResponse.json({
      data: changes,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + changes.length < total,
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
