import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { updateMonitoredUrlSchema } from "@/lib/types"

// GET /api/urls/[id] - Get monitored URL details
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

    const url = await prisma.monitoredUrl.findFirst({
      where: { id },
      include: {
        competitor: {
          select: { id: true, name: true, workspaceId: true },
        },
        snapshots: {
          orderBy: { capturedAt: "desc" },
          take: 20,
        },
      },
    })

    if (!url || url.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    return NextResponse.json(url)
  } catch (error) {
    console.error("Error fetching monitored URL:", error)
    return NextResponse.json(
      { error: "Failed to fetch monitored URL" },
      { status: 500 }
    )
  }
}

// PUT /api/urls/[id] - Update monitored URL
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

    const existing = await prisma.monitoredUrl.findFirst({
      where: { id },
      include: {
        competitor: { select: { workspaceId: true } },
      },
    })

    if (!existing || existing.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateMonitoredUrlSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const url = await prisma.monitoredUrl.update({
      where: { id },
      data: validation.data,
    })

    return NextResponse.json(url)
  } catch (error) {
    console.error("Error updating monitored URL:", error)
    return NextResponse.json(
      { error: "Failed to update monitored URL" },
      { status: 500 }
    )
  }
}

// DELETE /api/urls/[id] - Remove monitored URL
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

    const existing = await prisma.monitoredUrl.findFirst({
      where: { id },
      include: {
        competitor: { select: { workspaceId: true } },
      },
    })

    if (!existing || existing.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "URL not found" }, { status: 404 })
    }

    // Soft delete
    await prisma.monitoredUrl.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting monitored URL:", error)
    return NextResponse.json(
      { error: "Failed to delete monitored URL" },
      { status: 500 }
    )
  }
}
