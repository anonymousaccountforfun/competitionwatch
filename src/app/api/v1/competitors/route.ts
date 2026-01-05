import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { validateApiKey, hasPermission, ApiAuthResult } from "@/lib/api-auth"

// GET /api/v1/competitors - List competitors
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
    const includeUrls = searchParams.get("include_urls") === "true"

    const competitors = await prisma.competitor.findMany({
      where: {
        workspaceId: auth.workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        primaryUrl: true,
        logoUrl: true,
        description: true,
        createdAt: true,
        ...(includeUrls && {
          monitoredUrls: {
            where: { isActive: true },
            select: {
              id: true,
              url: true,
              urlType: true,
              checkFrequency: true,
              lastCheckedAt: true,
            },
          },
        }),
        _count: {
          select: { changes: true, announcements: true },
        },
      },
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    })

    const total = await prisma.competitor.count({
      where: { workspaceId: auth.workspaceId, isActive: true },
    })

    return NextResponse.json({
      data: competitors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + competitors.length < total,
      },
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/v1/competitors - Create competitor
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request)
  if (authResult instanceof NextResponse) return authResult

  const auth = authResult as ApiAuthResult

  if (!hasPermission(auth, "write")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, primaryUrl, logoUrl, description } = body

    if (!name || !primaryUrl) {
      return NextResponse.json(
        { error: "name and primaryUrl are required" },
        { status: 400 }
      )
    }

    const competitor = await prisma.competitor.create({
      data: {
        workspaceId: auth.workspaceId,
        name,
        primaryUrl,
        logoUrl,
        description,
      },
    })

    return NextResponse.json({ data: competitor }, { status: 201 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
