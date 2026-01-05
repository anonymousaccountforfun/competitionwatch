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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import {
  Plus,
  ExternalLink,
  Link as LinkIcon,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Clock,
  Globe,
} from "lucide-react"
import { formatRelativeTime, formatDateTime } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant, urlTypeLabel, URL_TYPES, CHECK_FREQUENCIES } from "@/lib/types"

interface CompetitorDetail {
  id: string
  name: string
  primaryUrl: string
  logoUrl?: string
  description?: string
  createdAt: string
  monitoredUrls: Array<{
    id: string
    url: string
    urlType: string
    checkFrequency: string
    isActive: boolean
    lastCheckedAt?: string
  }>
  changes: Array<{
    id: string
    changeType: string
    summary: string
    detectedAt: string
    isRead: boolean
    beforeSnapshot: { screenshotPath?: string; capturedAt: string }
    afterSnapshot: { screenshotPath?: string; capturedAt: string }
  }>
  announcements: Array<{
    id: string
    title: string
    sourceType: string
    publishedAt?: string
    capturedAt: string
    aiSummary?: string
    isRead: boolean
  }>
  _count: {
    changes: number
    announcements: number
    monitoredUrls: number
  }
}

export default function CompetitorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [competitor, setCompetitor] = useState<CompetitorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [urlForm, setUrlForm] = useState({
    url: "",
    urlType: "landing_page" as string,
    checkFrequency: "daily" as string,
  })
  const [submitting, setSubmitting] = useState(false)
  const [triggeringSnapshot, setTriggeringSnapshot] = useState<string | null>(null)

  useEffect(() => {
    fetchCompetitor()
  }, [params.id])

  async function fetchCompetitor() {
    try {
      const res = await fetch(`/api/competitors/${params.id}`)
      if (!res.ok) {
        router.push("/competitors")
        return
      }
      const data = await res.json()
      setCompetitor(data)
    } catch (error) {
      console.error("Error fetching competitor:", error)
      router.push("/competitors")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch(`/api/competitors/${params.id}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(urlForm),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add URL")
      }

      setUrlDialogOpen(false)
      setUrlForm({ url: "", urlType: "landing_page", checkFrequency: "daily" })
      fetchCompetitor()
      toast({
        title: "URL added",
        description: "The URL is now being monitored.",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add URL",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteUrl(urlId: string) {
    if (!confirm("Remove this monitored URL?")) return

    try {
      const res = await fetch(`/api/urls/${urlId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")

      fetchCompetitor()
      toast({
        title: "URL removed",
        description: "The URL is no longer being monitored.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove URL",
        variant: "destructive",
      })
    }
  }

  async function triggerSnapshot(urlId: string) {
    setTriggeringSnapshot(urlId)
    try {
      const res = await fetch(`/api/snapshots/trigger/${urlId}`, {
        method: "POST",
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to capture snapshot")

      toast({
        title: "Snapshot captured",
        description: data.change
          ? "A change was detected and analyzed!"
          : "No significant changes detected.",
        variant: data.change ? "success" : "default",
      })
      fetchCompetitor()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to capture snapshot",
        variant: "destructive",
      })
    } finally {
      setTriggeringSnapshot(null)
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

  if (!competitor) {
    return null
  }

  return (
    <div>
      <Header
        title={competitor.name}
        description={competitor.description || competitor.primaryUrl}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <a href={competitor.primaryUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Website
              </Button>
            </a>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Competitor Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={competitor.logoUrl} />
                <AvatarFallback className="text-2xl">
                  {competitor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{competitor.name}</h2>
                <a
                  href={competitor.primaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  {competitor.primaryUrl}
                </a>
                {competitor.description && (
                  <p className="text-neutral-600 mt-2">{competitor.description}</p>
                )}
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{competitor._count.monitoredUrls}</div>
                  <div className="text-sm text-neutral-500">URLs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{competitor._count.changes}</div>
                  <div className="text-sm text-neutral-500">Changes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{competitor._count.announcements}</div>
                  <div className="text-sm text-neutral-500">Announcements</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="urls">Monitored URLs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-4">
            {competitor.changes.length === 0 && competitor.announcements.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-neutral-500">
                  <p>No activity detected yet.</p>
                  <p className="text-sm mt-2">
                    Changes will appear here when we detect updates on monitored URLs.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {competitor.changes.map((change) => (
                  <Card key={change.id} className={change.isRead ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
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
                            <span className="text-sm text-neutral-500">
                              {formatRelativeTime(change.detectedAt)}
                            </span>
                          </div>
                          <p className="mt-2">{change.summary}</p>
                        </div>
                        <Link href={`/changes/${change.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {competitor.announcements.map((announcement) => (
                  <Card key={announcement.id} className={announcement.isRead ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{announcement.sourceType}</Badge>
                            <span className="text-sm text-neutral-500">
                              {formatRelativeTime(announcement.publishedAt || announcement.capturedAt)}
                            </span>
                          </div>
                          <h4 className="font-medium mt-2">{announcement.title}</h4>
                          {announcement.aiSummary && (
                            <p className="text-sm text-neutral-600 mt-1">
                              {announcement.aiSummary}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="urls" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Monitored URLs</CardTitle>
                <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add URL
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleAddUrl}>
                      <DialogHeader>
                        <DialogTitle>Add Monitored URL</DialogTitle>
                        <DialogDescription>
                          Add a new URL to monitor for this competitor.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="url">URL *</Label>
                          <Input
                            id="url"
                            type="url"
                            value={urlForm.url}
                            onChange={(e) =>
                              setUrlForm({ ...urlForm, url: e.target.value })
                            }
                            placeholder="https://example.com/pricing"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="urlType">URL Type</Label>
                          <Select
                            value={urlForm.urlType}
                            onValueChange={(v) => setUrlForm({ ...urlForm, urlType: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {URL_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {urlTypeLabel[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="frequency">Check Frequency</Label>
                          <Select
                            value={urlForm.checkFrequency}
                            onValueChange={(v) =>
                              setUrlForm({ ...urlForm, checkFrequency: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHECK_FREQUENCIES.map((freq) => (
                                <SelectItem key={freq} value={freq}>
                                  {freq.charAt(0).toUpperCase() + freq.slice(1).replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setUrlDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? "Adding..." : "Add URL"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {competitor.monitoredUrls.length === 0 ? (
                  <p className="text-center text-neutral-500 py-8">
                    No URLs being monitored yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {competitor.monitoredUrls.map((url) => (
                      <div
                        key={url.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <LinkIcon className="h-4 w-4 text-neutral-400" />
                          <div>
                            <a
                              href={url.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:text-blue-600 hover:underline"
                            >
                              {url.url}
                            </a>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {urlTypeLabel[url.urlType as keyof typeof urlTypeLabel]}
                              </Badge>
                              <span className="text-xs text-neutral-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {url.checkFrequency}
                              </span>
                              {url.lastCheckedAt && (
                                <span className="text-xs text-neutral-400">
                                  Last checked: {formatRelativeTime(url.lastCheckedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => triggerSnapshot(url.id)}
                            disabled={triggeringSnapshot === url.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${
                                triggeringSnapshot === url.id ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUrl(url.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Competitor Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500">
                  Settings for this competitor will be available soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
