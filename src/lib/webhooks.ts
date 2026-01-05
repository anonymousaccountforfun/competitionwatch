import prisma from "@/lib/prisma"
import { createHmac } from "crypto"

type WebhookEvent = "change.detected" | "announcement.new" | "competitor.created" | "competitor.updated"

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

export async function triggerWebhooks(
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      workspaceId,
      isActive: true,
      events: { has: event },
      failureCount: { lt: 5 }, // Don't trigger if too many failures
    },
  })

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const results = await Promise.allSettled(
    webhooks.map((webhook) => sendWebhook(webhook, payload))
  )

  // Update webhook stats
  for (let i = 0; i < webhooks.length; i++) {
    const result = results[i]
    const webhook = webhooks[i]

    if (result.status === "fulfilled" && result.value) {
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: 0, // Reset on success
        },
      })
    } else {
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          failureCount: { increment: 1 },
        },
      })
    }
  }

  return results
}

async function sendWebhook(
  webhook: { id: string; url: string; secret: string | null },
  payload: WebhookPayload
): Promise<boolean> {
  const body = JSON.stringify(payload)

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Webhook-ID": webhook.id,
    "X-Webhook-Event": payload.event,
  }

  // Sign the payload if we have a secret
  if (webhook.secret) {
    const signature = createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex")
    headers["X-Webhook-Signature"] = `sha256=${signature}`
  }

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    return response.ok
  } catch (error) {
    console.error(`Webhook delivery failed for ${webhook.id}:`, error)
    return false
  }
}

export async function testWebhook(webhookId: string, workspaceId: string) {
  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId },
  })

  if (!webhook) {
    throw new Error("Webhook not found")
  }

  const payload: WebhookPayload = {
    event: "change.detected",
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: "This is a test webhook delivery from CompetitorPulse",
    },
  }

  return sendWebhook(webhook, payload)
}
