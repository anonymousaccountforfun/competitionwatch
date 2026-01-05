"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import {
  ArrowLeft,
  ExternalLink,
  Check,
  Eye,
  FileText,
  Image as ImageIcon,
} from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant, urlTypeLabel } from "@/lib/types"

interface ChangeDetail {
  id: string
  changeType: string
  summary: string
  analysis: string
  confidence: number
  affectedAreas: string[]
  rawDiff: string
  isMaterial: boolean
  isRead: boolean
  detectedAt: string
  competitor: {
    id: string
    name: string
    logoUrl?: string
    workspaceId: string
  }
  monitoredUrl: {
    url: string
    urlType: string
  }
  beforeSnapshot: {
    id: string
    screenshotPath?: string
    textContent?: string
    metaTags?: Record<string, string>
    capturedAt: string
  }
  afterSnapshot: {
    id: string
    screenshotPath?: string
    textContent?: string
    metaTags?: Record<string, string>
    capturedAt: string
  }
}

export default function ChangeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [change, setChange] = useState<ChangeDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChange()
  }, [params.id])

  async function fetchChange() {
    try {
      const res = await fetch(`/api/changes/${params.id}`)
      if (!res.ok) {
        router.push("/timeline")
        return
      }
      const data = await res.json()
      setChange(data)

      // Mark as read
      if (!data.isRead) {
        await fetch(`/api/changes/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        })
      }
    } catch (error) {
      console.error("Error fetching change:", error)
      router.push("/timeline")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Loading..." />
        <div className="p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!change) {
    return null
  }

  return (
    <div>
      <Header
        title="Change Details"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <a href={change.monitoredUrl.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Page
              </Button>
            </a>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={change.competitor.logoUrl} />
                <AvatarFallback className="text-xl">
                  {change.competitor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/competitors/${change.competitor.id}`}
                    className="text-xl font-bold hover:text-blue-600"
                  >
                    {change.competitor.name}
                  </Link>
                  <Badge
                    variant={
                      changeTypeVariant[
                        change.changeType as keyof typeof changeTypeVariant
                      ] as "feature" | "messaging" | "pricing" | "partnership" | "minor"
                    }
                  >
                    {changeTypeLabel[
                      change.changeType as keyof typeof changeTypeLabel
                    ] || change.changeType}
                  </Badge>
                  {change.isRead && (
                    <Badge variant="secondary">
                      <Check className="h-3 w-3 mr-1" />
                      Read
                    </Badge>
                  )}
                </div>
                <a
                  href={change.monitoredUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                >
                  {change.monitoredUrl.url}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
                  <span>
                    Detected: {formatDateTime(change.detectedAt)}
                  </span>
                  <span>
                    URL Type: {urlTypeLabel[change.monitoredUrl.urlType as keyof typeof urlTypeLabel]}
                  </span>
                  <span>
                    Confidence: {Math.round(change.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-neutral-50 rounded-lg">
              <h3 className="font-medium mb-2">AI Summary</h3>
              <p className="text-neutral-700">{change.summary}</p>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Strategic Analysis</h3>
              <p className="text-blue-800">{change.analysis}</p>
            </div>

            {change.affectedAreas.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-neutral-500 mb-2">
                  Affected Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {change.affectedAreas.map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparison Tabs */}
        <Tabs defaultValue="diff">
          <TabsList>
            <TabsTrigger value="diff">
              <FileText className="h-4 w-4 mr-2" />
              Text Diff
            </TabsTrigger>
            <TabsTrigger value="screenshots">
              <ImageIcon className="h-4 w-4 mr-2" />
              Screenshots
            </TabsTrigger>
            <TabsTrigger value="meta">
              <Eye className="h-4 w-4 mr-2" />
              Meta Tags
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diff" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-neutral-50 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap font-mono">
                  {change.rawDiff || "No text diff available"}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="screenshots" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Before ({formatDateTime(change.beforeSnapshot.capturedAt)})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {change.beforeSnapshot.screenshotPath ? (
                    <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center">
                      <p className="text-neutral-500 text-sm">
                        Screenshot: {change.beforeSnapshot.screenshotPath}
                      </p>
                    </div>
                  ) : (
                    <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center">
                      <p className="text-neutral-500 text-sm">No screenshot available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    After ({formatDateTime(change.afterSnapshot.capturedAt)})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {change.afterSnapshot.screenshotPath ? (
                    <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center">
                      <p className="text-neutral-500 text-sm">
                        Screenshot: {change.afterSnapshot.screenshotPath}
                      </p>
                    </div>
                  ) : (
                    <div className="aspect-video bg-neutral-100 rounded-lg flex items-center justify-center">
                      <p className="text-neutral-500 text-sm">No screenshot available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="meta" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Before</CardTitle>
                </CardHeader>
                <CardContent>
                  {change.beforeSnapshot.metaTags ? (
                    <div className="space-y-2">
                      {Object.entries(change.beforeSnapshot.metaTags).map(
                        ([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-neutral-500">
                              {key}:
                            </span>{" "}
                            <span className="text-neutral-700">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm">No meta tags captured</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">After</CardTitle>
                </CardHeader>
                <CardContent>
                  {change.afterSnapshot.metaTags ? (
                    <div className="space-y-2">
                      {Object.entries(change.afterSnapshot.metaTags).map(
                        ([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-neutral-500">
                              {key}:
                            </span>{" "}
                            <span className="text-neutral-700">{value}</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-sm">No meta tags captured</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
