import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { createMonitoredUrlSchema } from "@/lib/types"

// GET /api/competitors/[id]/urls - List monitored URLs for a competitor
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

    // Verify competitor belongs to user's workspace
    const competitor = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    const urls = await prisma.monitoredUrl.findMany({
      where: { competitorId: id },
      include: {
        _count: {
          select: { snapshots: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(urls)
  } catch (error) {
    console.error("Error fetching monitored URLs:", error)
    return NextResponse.json(
      { error: "Failed to fetch monitored URLs" },
      { status: 500 }
    )
  }
}

// POST /api/competitors/[id]/urls - Add a monitored URL
export async function POST(
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

    // Verify competitor belongs to user's workspace
    const competitor = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = createMonitoredUrlSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { url, urlType, checkFrequency } = validation.data

    // Check for duplicate URL
    const existing = await prisma.monitoredUrl.findFirst({
      where: {
        competitorId: id,
        url,
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "This URL is already being monitored" },
        { status: 409 }
      )
    }

    const monitoredUrl = await prisma.monitoredUrl.create({
      data: {
        competitorId: id,
        url,
        urlType,
        checkFrequency,
      },
    })

    return NextResponse.json(monitoredUrl, { status: 201 })
  } catch (error) {
    console.error("Error creating monitored URL:", error)
    return NextResponse.json(
      { error: "Failed to create monitored URL" },
      { status: 500 }
    )
  }
}
