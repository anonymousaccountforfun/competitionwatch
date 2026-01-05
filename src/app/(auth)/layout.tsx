import { Zap } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">CompetitorPulse</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Your Competitive Intelligence Analyst, Working 24/7
          </h1>
          <p className="text-lg text-blue-100">
            Monitor competitors' websites, track messaging changes, analyze pricing updates,
            and receive AI-powered insights — all automatically.
          </p>
        </div>

        <div className="text-sm text-blue-200">
          Trusted by Product Marketing teams worldwide
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
