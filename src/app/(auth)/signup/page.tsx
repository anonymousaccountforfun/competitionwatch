"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Loader2, Check } from "lucide-react"

const features = [
  "Automatic website monitoring",
  "AI-powered change analysis",
  "Email & Slack notifications",
  "Unlimited competitors",
]

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    workspaceName: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()

      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            workspace_name: formData.workspaceName,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If email confirmation is required
      if (data.user && !data.session) {
        setSuccess(true)
        return
      }

      // Create workspace
      if (data.session) {
        const workspaceRes = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formData.workspaceName }),
        })

        if (!workspaceRes.ok) {
          console.error("Failed to create workspace")
        }

        router.push("/dashboard")
        router.refresh()
      }
    } catch (err) {
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-0 shadow-none lg:shadow lg:border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Check className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Check your email</CardTitle>
          <CardDescription>
            We've sent you a confirmation link to <strong>{formData.email}</strong>.
            Click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Back to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-none lg:shadow lg:border">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Zap className="h-7 w-7 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Start monitoring your competitors in minutes
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="workspace">Company / Workspace Name</Label>
            <Input
              id="workspace"
              placeholder="Acme Inc"
              value={formData.workspaceName}
              onChange={(e) =>
                setFormData({ ...formData, workspaceName: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              minLength={8}
              required
            />
          </div>

          <div className="pt-2 space-y-2">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-neutral-600">
                <Check className="h-4 w-4 text-green-500" />
                {feature}
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-center text-neutral-500">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-center text-neutral-400">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
