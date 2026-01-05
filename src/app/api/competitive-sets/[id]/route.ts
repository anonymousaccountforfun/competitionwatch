import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

// GET /api/competitive-sets/[id] - Get competitive set details
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

    const set = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
      include: {
        members: {
          include: {
            competitor: {
              include: {
                monitoredUrls: {
                  where: { isActive: true, urlType: "pricing" },
                  select: { id: true, url: true },
                },
                changes: {
                  where: { isMaterial: true },
                  orderBy: { detectedAt: "desc" },
                  take: 5,
                  select: {
                    id: true,
                    changeType: true,
                    summary: true,
                    detectedAt: true,
                  },
                },
                _count: {
                  select: { changes: true, announcements: true },
                },
              },
            },
          },
        },
      },
    })

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 })
    }

    return NextResponse.json(set)
  } catch (error) {
    console.error("Error fetching competitive set:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitive set" },
      { status: 500 }
    )
  }
}

// PUT /api/competitive-sets/[id] - Update competitive set
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

    const existing = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 })
    }

    const body = await request.json()
    const { name } = body

    const set = await prisma.competitiveSet.update({
      where: { id },
      data: { name },
    })

    return NextResponse.json(set)
  } catch (error) {
    console.error("Error updating competitive set:", error)
    return NextResponse.json(
      { error: "Failed to update competitive set" },
      { status: 500 }
    )
  }
}

// DELETE /api/competitive-sets/[id] - Delete competitive set
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

    const existing = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 })
    }

    await prisma.competitiveSet.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting competitive set:", error)
    return NextResponse.json(
      { error: "Failed to delete competitive set" },
      { status: 500 }
    )
  }
}
