import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { alertPreferencesSchema } from "@/lib/types"

// GET /api/settings/alerts - Get alert preferences
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

    const preferences = await prisma.alertPreference.findMany({
      where: {
        workspaceId: membership.workspaceId,
        userId: user.id,
      },
    })

    return NextResponse.json(preferences)
  } catch (error) {
    console.error("Error fetching alert preferences:", error)
    return NextResponse.json(
      { error: "Failed to fetch alert preferences" },
      { status: 500 }
    )
  }
}

// POST /api/settings/alerts - Create or update alert preferences
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
    const validation = alertPreferencesSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { channel, frequency, minConfidence, changeTypes, slackWebhookUrl, isActive } =
      validation.data

    // Upsert preference for this channel
    const existing = await prisma.alertPreference.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        userId: user.id,
        channel,
      },
    })

    let preference
    if (existing) {
      preference = await prisma.alertPreference.update({
        where: { id: existing.id },
        data: {
          frequency,
          minConfidence,
          changeTypes,
          slackWebhookUrl: slackWebhookUrl || null,
          isActive,
        },
      })
    } else {
      preference = await prisma.alertPreference.create({
        data: {
          workspaceId: membership.workspaceId,
          userId: user.id,
          channel,
          frequency,
          minConfidence,
          changeTypes,
          slackWebhookUrl: slackWebhookUrl || null,
          isActive,
        },
      })
    }

    return NextResponse.json(preference)
  } catch (error) {
    console.error("Error updating alert preferences:", error)
    return NextResponse.json(
      { error: "Failed to update alert preferences" },
      { status: 500 }
    )
  }
}
