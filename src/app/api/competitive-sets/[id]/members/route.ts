import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

const addMemberSchema = z.object({
  competitorId: z.string().uuid(),
})

// POST /api/competitive-sets/[id]/members - Add competitor to set
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

    // Verify set belongs to workspace
    const set = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 })
    }

    const body = await request.json()
    const validation = addMemberSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { competitorId } = validation.data

    // Verify competitor belongs to workspace
    const competitor = await prisma.competitor.findFirst({
      where: {
        id: competitorId,
        workspaceId: membership.workspaceId,
      },
    })

    if (!competitor) {
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 })
    }

    // Check if already a member
    const existing = await prisma.competitiveSetMember.findFirst({
      where: {
        setId: id,
        competitorId,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Competitor is already in this set" },
        { status: 409 }
      )
    }

    const member = await prisma.competitiveSetMember.create({
      data: {
        setId: id,
        competitorId,
      },
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryUrl: true,
          },
        },
      },
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error("Error adding member to set:", error)
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    )
  }
}

// DELETE /api/competitive-sets/[id]/members - Remove competitor from set
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

    // Verify set belongs to workspace
    const set = await prisma.competitiveSet.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!set) {
      return NextResponse.json({ error: "Set not found" }, { status: 404 })
    }

    const body = await request.json()
    const { competitorId } = body

    if (!competitorId) {
      return NextResponse.json(
        { error: "competitorId is required" },
        { status: 400 }
      )
    }

    await prisma.competitiveSetMember.delete({
      where: {
        setId_competitorId: {
          setId: id,
          competitorId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member from set:", error)
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    )
  }
}
