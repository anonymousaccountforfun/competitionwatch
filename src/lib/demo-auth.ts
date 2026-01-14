// Demo mode authentication helper
// When DEMO_MODE=true, bypasses real auth and uses mock data

import { DEMO_WORKSPACE_ID, DEMO_USER_ID } from "./mock-data"

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true"
}

export function getDemoAuth() {
  if (!isDemoMode()) {
    return null
  }

  return {
    userId: DEMO_USER_ID,
    workspaceId: DEMO_WORKSPACE_ID,
  }
}

export function getDemoUser() {
  if (!isDemoMode()) {
    return null
  }

  return {
    id: DEMO_USER_ID,
    email: "demo@example.com",
    user_metadata: {
      full_name: "Demo User",
    },
  }
}
