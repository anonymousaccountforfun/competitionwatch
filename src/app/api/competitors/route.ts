import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { createCompetitorSchema } from "@/lib/types"
import { isDemoMode } from "@/lib/demo-auth"
import { getMockCompetitors } from "@/lib/mock-data"

// GET /api/competitors - List all competitors for the workspace
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return mock data
    if (isDemoMode()) {
      return NextResponse.json(getMockCompetitors())
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get("includeInactive") === "true"

    const competitors = await prisma.competitor.findMany({
      where: {
        workspaceId: membership.workspaceId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        monitoredUrls: {
          where: { isActive: true },
          select: { id: true, url: true, urlType: true, lastCheckedAt: true },
        },
        _count: {
          select: {
            changes: { where: { isRead: false } },
            announcements: { where: { isRead: false } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(competitors)
  } catch (error) {
    console.error("Error fetching competitors:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitors" },
      { status: 500 }
    )
  }
}

// POST /api/competitors - Add a new competitor
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = createCompetitorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, primaryUrl, description, logoUrl } = validation.data

    // Create competitor with default monitored URL (landing page)
    const competitor = await prisma.competitor.create({
      data: {
        workspaceId: membership.workspaceId,
        name,
        primaryUrl,
        description: description || null,
        logoUrl: logoUrl || null,
        monitoredUrls: {
          create: {
            url: primaryUrl,
            urlType: "landing_page",
            checkFrequency: "daily",
          },
        },
      },
      include: {
        monitoredUrls: true,
      },
    })

    return NextResponse.json(competitor, { status: 201 })
  } catch (error) {
    console.error("Error creating competitor:", error)
    return NextResponse.json(
      { error: "Failed to create competitor" },
      { status: 500 }
    )
  }
}
