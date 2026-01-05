import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

// GET /api/changes/[id] - Get change details
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

    const change = await prisma.change.findFirst({
      where: { id },
      include: {
        competitor: {
          select: { id: true, name: true, logoUrl: true, workspaceId: true },
        },
        monitoredUrl: {
          select: { url: true, urlType: true },
        },
        beforeSnapshot: true,
        afterSnapshot: true,
      },
    })

    if (!change || change.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 })
    }

    return NextResponse.json(change)
  } catch (error) {
    console.error("Error fetching change:", error)
    return NextResponse.json(
      { error: "Failed to fetch change" },
      { status: 500 }
    )
  }
}

// PUT /api/changes/[id] - Update change (mark as read)
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

    const existing = await prisma.change.findFirst({
      where: { id },
      include: {
        competitor: { select: { workspaceId: true } },
      },
    })

    if (!existing || existing.competitor.workspaceId !== membership.workspaceId) {
      return NextResponse.json({ error: "Change not found" }, { status: 404 })
    }

    const body = await request.json()
    const { isRead } = body

    const change = await prisma.change.update({
      where: { id },
      data: { isRead: isRead ?? true },
    })

    return NextResponse.json(change)
  } catch (error) {
    console.error("Error updating change:", error)
    return NextResponse.json(
      { error: "Failed to update change" },
      { status: 500 }
    )
  }
}
