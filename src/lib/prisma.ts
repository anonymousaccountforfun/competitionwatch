// Prisma client singleton
// In demo mode, this exports a null placeholder since we use mock data instead

const isDemoMode = process.env.DEMO_MODE === "true"

// Only import and instantiate Prisma if not in demo mode
let prisma: any = null

if (!isDemoMode) {
  try {
    const { PrismaClient } = require("@prisma/client")

    const globalForPrisma = globalThis as unknown as {
      prisma: typeof PrismaClient | undefined
    }

    prisma =
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      })

    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
  } catch (error) {
    console.warn("Prisma client not available - running in demo mode or Prisma not generated")
    prisma = null
  }
}

export { prisma }
export default prisma
