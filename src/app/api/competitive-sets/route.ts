import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { z } from "zod"

const createSetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  competitorIds: z.array(z.string().uuid()).optional(),
})

// GET /api/competitive-sets - List all competitive sets
export async function GET(request: NextRequest) {
  try {
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

    const sets = await prisma.competitiveSet.findMany({
      where: { workspaceId: membership.workspaceId },
      include: {
        members: {
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
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(sets)
  } catch (error) {
    console.error("Error fetching competitive sets:", error)
    return NextResponse.json(
      { error: "Failed to fetch competitive sets" },
      { status: 500 }
    )
  }
}

// POST /api/competitive-sets - Create a new competitive set
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const validation = createSetSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, competitorIds } = validation.data

    const set = await prisma.competitiveSet.create({
      data: {
        workspaceId: membership.workspaceId,
        name,
        ...(competitorIds && competitorIds.length > 0
          ? {
              members: {
                create: competitorIds.map((competitorId) => ({
                  competitorId,
                })),
              },
            }
          : {}),
      },
      include: {
        members: {
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
        },
      },
    })

    return NextResponse.json(set, { status: 201 })
  } catch (error) {
    console.error("Error creating competitive set:", error)
    return NextResponse.json(
      { error: "Failed to create competitive set" },
      { status: 500 }
    )
  }
}
