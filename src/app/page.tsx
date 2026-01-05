import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Zap,
  Eye,
  Bell,
  TrendingUp,
  Building2,
  CheckCircle,
  ArrowRight,
} from "lucide-react"

const features = [
  {
    icon: Eye,
    title: "Automatic Monitoring",
    description:
      "Track competitors' websites, pricing pages, and marketing copy automatically with scheduled snapshots.",
  },
  {
    icon: Zap,
    title: "AI-Powered Analysis",
    description:
      "Claude AI analyzes every change and provides strategic insights about competitor movements.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description:
      "Get notified via email or Slack when competitors make significant changes to their positioning.",
  },
  {
    icon: TrendingUp,
    title: "Timeline View",
    description:
      "See all competitive activity in a unified timeline. Never miss an important update.",
  },
]

const benefits = [
  "Monitor unlimited competitor URLs",
  "Daily/weekly email digests",
  "Slack integration for real-time alerts",
  "AI classification of change types",
  "Screenshot capture for visual comparisons",
  "RSS feed monitoring",
  "App Store changelog tracking",
  "Export reports for stakeholders",
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">CompetitorPulse</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
            <Building2 className="h-4 w-4" />
            Built for Product Marketing Teams
          </div>
          <h1 className="text-5xl font-bold text-neutral-900 mb-6 leading-tight">
            Your Competitive Intelligence Analyst, Working 24/7
          </h1>
          <p className="text-xl text-neutral-600 mb-8 max-w-2xl mx-auto">
            Automatically monitor competitors' websites, track messaging changes,
            analyze pricing updates, and receive AI-powered insights — so you never
            miss a competitive move.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-neutral-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">
              Everything You Need to Stay Ahead
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              CompetitorPulse gives your Product Marketing team superpowers with
              automated monitoring and AI-powered analysis.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm"
              >
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-neutral-900 mb-6">
                Stop manually checking competitor websites
              </h2>
              <p className="text-lg text-neutral-600 mb-8">
                Let CompetitorPulse do the heavy lifting. We'll monitor your
                competitors around the clock and alert you only when something
                important happens.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-neutral-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">
                How it works
              </h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold">
                    1
                  </span>
                  <div>
                    <div className="font-semibold">Add competitors</div>
                    <div className="text-blue-100">
                      Enter a company name and URL to start monitoring
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold">
                    2
                  </span>
                  <div>
                    <div className="font-semibold">We capture snapshots</div>
                    <div className="text-blue-100">
                      Automated screenshots and content extraction daily
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold">
                    3
                  </span>
                  <div>
                    <div className="font-semibold">AI detects changes</div>
                    <div className="text-blue-100">
                      Claude analyzes and classifies every change
                    </div>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-bold">
                    4
                  </span>
                  <div>
                    <div className="font-semibold">Get notified</div>
                    <div className="text-blue-100">
                      Receive alerts via email or Slack instantly
                    </div>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-neutral-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to stop missing competitor moves?
          </h2>
          <p className="text-lg text-neutral-300 mb-8">
            Join Product Marketing teams who use CompetitorPulse to stay ahead
            of the competition.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">CompetitorPulse</span>
          </div>
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} CompetitorPulse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
