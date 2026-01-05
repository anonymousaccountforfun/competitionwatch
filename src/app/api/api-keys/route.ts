import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { randomBytes, createHash } from "crypto"
import { z } from "zod"

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(["read", "write", "admin"])).default(["read"]),
  expiresIn: z.number().optional(), // Days until expiration
})

// GET /api/api-keys - List API keys
export async function GET() {
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

    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: membership.workspaceId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(keys)
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    )
  }
}

// POST /api/api-keys - Create new API key
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

    // Check if user has admin role
    if (membership.role !== "admin" && membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only admins can create API keys" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = createKeySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, permissions, expiresIn } = validation.data

    // Generate a secure random API key
    const rawKey = `cp_live_${randomBytes(32).toString("hex")}`
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.slice(0, 16)

    let expiresAt: Date | undefined
    if (expiresIn) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresIn)
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId: membership.workspaceId,
        name,
        keyHash,
        keyPrefix,
        permissions,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Return the full key only once, during creation
    return NextResponse.json({
      ...apiKey,
      key: rawKey, // Only returned on creation!
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    )
  }
}

// DELETE /api/api-keys - Revoke an API key
export async function DELETE(request: NextRequest) {
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

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 })
    }

    // Verify the key belongs to the workspace
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existingKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 })
    }

    await prisma.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting API key:", error)
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    )
  }
}
