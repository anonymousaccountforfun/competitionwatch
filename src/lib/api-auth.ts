import prisma from "@/lib/prisma"
import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

export interface ApiAuthResult {
  workspaceId: string
  apiKeyId: string
  permissions: string[]
}

export async function validateApiKey(
  request: NextRequest
): Promise<ApiAuthResult | NextResponse> {
  const authHeader = request.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    )
  }

  const apiKey = authHeader.slice(7)

  if (!apiKey.startsWith("cp_live_")) {
    return NextResponse.json(
      { error: "Invalid API key format" },
      { status: 401 }
    )
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex")

  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      workspaceId: true,
      permissions: true,
      isActive: true,
      expiresAt: true,
    },
  })

  if (!key) {
    return NextResponse.json(
      { error: "Invalid API key" },
      { status: 401 }
    )
  }

  if (!key.isActive) {
    return NextResponse.json(
      { error: "API key has been revoked" },
      { status: 401 }
    )
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "API key has expired" },
      { status: 401 }
    )
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    workspaceId: key.workspaceId,
    apiKeyId: key.id,
    permissions: key.permissions,
  }
}

export function hasPermission(
  auth: ApiAuthResult,
  required: "read" | "write" | "admin"
): boolean {
  if (auth.permissions.includes("admin")) return true
  if (required === "write" && auth.permissions.includes("write")) return true
  if (required === "read" && (auth.permissions.includes("read") || auth.permissions.includes("write"))) return true
  return false
}
