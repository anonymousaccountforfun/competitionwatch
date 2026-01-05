import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { randomBytes } from "crypto"
import { z } from "zod"

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(["change.detected", "announcement.new", "competitor.created", "competitor.updated"])).min(1),
})

// GET /api/webhooks - List webhooks
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

    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId: membership.workspaceId },
      orderBy: { createdAt: "desc" },
    })

    // Mask the secrets
    return NextResponse.json(
      webhooks.map((w) => ({
        ...w,
        secret: w.secret ? `${w.secret.slice(0, 8)}...` : null,
      }))
    )
  } catch (error) {
    console.error("Error fetching webhooks:", error)
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 }
    )
  }
}

// POST /api/webhooks - Create webhook
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
    const validation = createWebhookSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { name, url, events } = validation.data

    // Generate a signing secret
    const secret = `whsec_${randomBytes(24).toString("hex")}`

    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: membership.workspaceId,
        name,
        url,
        secret,
        events,
      },
    })

    // Return full secret only once during creation
    return NextResponse.json(webhook, { status: 201 })
  } catch (error) {
    console.error("Error creating webhook:", error)
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 }
    )
  }
}

// PUT /api/webhooks - Update webhook
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

    const body = await request.json()
    const { id, name, url, events, isActive } = body

    if (!id) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 })
    }

    const existing = await prisma.webhook.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(url && { url }),
        ...(events && { events }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
    })

    return NextResponse.json({
      ...webhook,
      secret: webhook.secret ? `${webhook.secret.slice(0, 8)}...` : null,
    })
  } catch (error) {
    console.error("Error updating webhook:", error)
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 }
    )
  }
}

// DELETE /api/webhooks - Delete webhook
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
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 })
    }

    const existing = await prisma.webhook.findFirst({
      where: {
        id,
        workspaceId: membership.workspaceId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    await prisma.webhook.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 }
    )
  }
}
