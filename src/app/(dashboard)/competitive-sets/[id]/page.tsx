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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  BarChart3,
  ExternalLink,
  FileText,
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"
import { changeTypeLabel, changeTypeVariant } from "@/lib/types"

interface CompetitiveSetDetail {
  id: string
  name: string
  createdAt: string
  members: Array<{
    competitor: {
      id: string
      name: string
      logoUrl?: string
      primaryUrl: string
      monitoredUrls: Array<{ id: string; url: string }>
      changes: Array<{
        id: string
        changeType: string
        summary: string
        detectedAt: string
      }>
      _count: {
        changes: number
        announcements: number
      }
    }
  }>
}

interface Competitor {
  id: string
  name: string
  logoUrl?: string
}

export default function CompetitiveSetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [set, setSet] = useState<CompetitiveSetDetail | null>(null)
  const [allCompetitors, setAllCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [params.id])

  async function fetchData() {
    try {
      const [setRes, competitorsRes] = await Promise.all([
        fetch(`/api/competitive-sets/${params.id}`),
        fetch("/api/competitors"),
      ])

      if (!setRes.ok) {
        router.push("/competitive-sets")
        return
      }

      const setData = await setRes.json()
      const competitorsData = await competitorsRes.json()

      setSet(setData)
      setAllCompetitors(Array.isArray(competitorsData) ? competitorsData : [])
    } catch (error) {
      console.error("Error fetching data:", error)
      router.push("/competitive-sets")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCompetitor(competitorId: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/competitive-sets/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to add competitor")
      }

      fetchData()
      setAddDialogOpen(false)
      toast({
        title: "Competitor added",
        description: "The competitor has been added to this set.",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add competitor",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveCompetitor(competitorId: string, competitorName: string) {
    if (!confirm(`Remove ${competitorName} from this set?`)) return

    try {
      const res = await fetch(`/api/competitive-sets/${params.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorId }),
      })

      if (!res.ok) throw new Error("Failed to remove")

      fetchData()
      toast({
        title: "Competitor removed",
        description: `${competitorName} has been removed from this set.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove competitor",
        variant: "destructive",
      })
    }
  }

  async function downloadReport(format: "json" | "markdown") {
    setDownloading(true)
    try {
      const res = await fetch(
        `/api/reports/competitive-set/${params.id}?format=${format}&days=30`
      )

      if (!res.ok) throw new Error("Failed to generate report")

      if (format === "markdown") {
        const text = await res.text()
        const blob = new Blob([text], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${set?.name.toLowerCase().replace(/\s+/g, "-")}-report.md`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${set?.name.toLowerCase().replace(/\s+/g, "-")}-report.json`
        a.click()
        URL.revokeObjectURL(url)
      }

      toast({
        title: "Report downloaded",
        description: `Your ${format.toUpperCase()} report has been downloaded.`,
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const memberIds = set?.members.map((m) => m.competitor.id) || []
  const availableCompetitors = allCompetitors.filter(
    (c) => !memberIds.includes(c.id)
  )

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

  if (!set) return null

  return (
    <div>
      <Header
        title={set.name}
        description={`${set.members.length} competitor${set.members.length !== 1 ? "s" : ""} in this set`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Link href={`/compare?setId=${set.id}`}>
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Compare
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => downloadReport("markdown")}
              disabled={downloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Generating..." : "Export Report"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Members List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Competitors in Set</CardTitle>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Competitor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Competitor to Set</DialogTitle>
                  <DialogDescription>
                    Select a competitor to add to this competitive set.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  {availableCompetitors.length === 0 ? (
                    <p className="text-center text-neutral-500 py-8">
                      All competitors are already in this set.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableCompetitors.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleAddCompetitor(c.id)}
                          disabled={submitting}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-neutral-50 transition-colors text-left"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={c.logoUrl} />
                            <AvatarFallback>
                              {c.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {set.members.length === 0 ? (
              <p className="text-center text-neutral-500 py-8">
                No competitors in this set yet. Add some to start comparing.
              </p>
            ) : (
              <div className="space-y-4">
                {set.members.map((member) => (
                  <div
                    key={member.competitor.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.competitor.logoUrl} />
                      <AvatarFallback>
                        {member.competitor.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/competitors/${member.competitor.id}`}
                          className="font-semibold hover:text-blue-600"
                        >
                          {member.competitor.name}
                        </Link>
                        <a
                          href={member.competitor.primaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-neutral-500">
                        <span>{member.competitor._count.changes} changes</span>
                        <span>{member.competitor._count.announcements} announcements</span>
                        <span>{member.competitor.monitoredUrls.length} URLs monitored</span>
                      </div>
                      {member.competitor.changes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-neutral-400 uppercase font-medium">
                            Recent Changes
                          </p>
                          {member.competitor.changes.slice(0, 2).map((change) => (
                            <div
                              key={change.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Badge
                                variant={
                                  changeTypeVariant[
                                    change.changeType as keyof typeof changeTypeVariant
                                  ] as "feature" | "messaging" | "pricing" | "partnership" | "minor"
                                }
                                className="text-xs"
                              >
                                {changeTypeLabel[
                                  change.changeType as keyof typeof changeTypeLabel
                                ] || change.changeType}
                              </Badge>
                              <span className="text-neutral-600 truncate">
                                {change.summary}
                              </span>
                              <span className="text-neutral-400 text-xs whitespace-nowrap">
                                {formatRelativeTime(change.detectedAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleRemoveCompetitor(
                          member.competitor.id,
                          member.competitor.name
                        )
                      }
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link href={`/compare?setId=${set.id}`}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Side-by-Side Comparison</h3>
                  <p className="text-sm text-neutral-500">
                    Compare positioning and recent activity
                  </p>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => downloadReport("markdown")}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Generate Report</h3>
                <p className="text-sm text-neutral-500">
                  Export a detailed comparison report
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
