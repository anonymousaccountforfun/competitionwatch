import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"

// GET /api/workspaces - Get current user's workspace
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
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                competitors: { where: { isActive: true } },
                members: true,
              },
            },
          },
        },
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 })
    }

    return NextResponse.json({
      ...membership.workspace,
      role: membership.role,
    })
  } catch (error) {
    console.error("Error fetching workspace:", error)
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    )
  }
}

// POST /api/workspaces - Create a new workspace (for new users)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user already has a workspace
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: "User already has a workspace" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      )
    }

    // Create workspace and add user as owner
    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
      include: {
        members: true,
      },
    })

    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    console.error("Error creating workspace:", error)
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    )
  }
}

// PUT /api/workspaces - Update workspace settings
export async function PUT(request: NextRequest) {
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

    // Check if user is owner or admin
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can update workspace settings" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, settings } = body

    const workspace = await prisma.workspace.update({
      where: { id: membership.workspaceId },
      data: {
        ...(name && { name }),
        ...(settings && { settings }),
      },
    })

    return NextResponse.json(workspace)
  } catch (error) {
    console.error("Error updating workspace:", error)
    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    )
  }
}
