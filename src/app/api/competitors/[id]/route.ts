import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { updateCompetitorSchema } from "@/lib/types"

// GET /api/competitors/[id] - Get competitor details
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

    // Verify user has access to this competitor
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    const competitor = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
      include: {
        monitoredUrls: {
          orderBy: { createdAt: "desc" },
        },
        changes: {
          where: { isMaterial: true },
          orderBy: { detectedAt: "desc" },
          take: 10,
          include: {
            beforeSnapshot: { select: { screenshotPath: true, capturedAt: true } },
            afterSnapshot: { select: { screenshotPath: true, capturedAt: true } },
          },
        },
        announcements: {
          orderBy: { publishedAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            changes: true,
            announcements: true,
            monitoredUrls: true,
          },
        },
      },
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    return NextResponse.json(competitor)
  } catch (error) {
    console.error("Error fetching competitor:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitor" },
      { status: 500 }
    )
  }
}

// PUT /api/competitors/[id] - Update competitor
export async function PUT(
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
    const existing = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateCompetitorSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const competitor = await prisma.competitor.update({
      where: { id },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        ...(validation.data.primaryUrl && { primaryUrl: validation.data.primaryUrl }),
        ...(validation.data.description !== undefined && {
          description: validation.data.description || null,
        }),
        ...(validation.data.logoUrl !== undefined && {
          logoUrl: validation.data.logoUrl || null,
        }),
      },
    })

    return NextResponse.json(competitor)
  } catch (error) {
    console.error("Error updating competitor:", error)
    return NextResponse.json(
      { error: "Failed to update competitor" },
      { status: 500 }
    )
  }
}

// DELETE /api/competitors/[id] - Archive competitor (soft delete)
export async function DELETE(
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
    const existing = await prisma.competitor.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Soft delete - set isActive to false
    await prisma.competitor.update({
      where: { id },
      data: { isActive: false },
    })

    // Also deactivate all monitored URLs
    await prisma.monitoredUrl.updateMany({
      where: { competitorId: id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting competitor:", error)
    return NextResponse.json(
      { error: "Failed to delete competitor" },
      { status: 500 }
    )
  }
}
