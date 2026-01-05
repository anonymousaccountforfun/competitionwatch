"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { Separator } from "@/components/ui/separator"
import { Building2, Bell, Slack, Mail, Save, TestTube } from "lucide-react"
import { CHANGE_TYPES, changeTypeLabel, ALERT_FREQUENCIES } from "@/lib/types"

interface Workspace {
  id: string
  name: string
  _count: {
    competitors: number
    members: number
  }
  role: string
}

interface AlertPreference {
  id: string
  channel: string
  frequency: string
  minConfidence: number
  changeTypes: string[]
  slackWebhookUrl?: string
  isActive: boolean
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [alertPreferences, setAlertPreferences] = useState<AlertPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [emailSettings, setEmailSettings] = useState({
    isActive: false,
    frequency: "daily",
    minConfidence: 0.7,
    changeTypes: [] as string[],
  })

  const [slackSettings, setSlackSettings] = useState({
    isActive: false,
    frequency: "realtime",
    minConfidence: 0.7,
    changeTypes: [] as string[],
    webhookUrl: "",
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const [workspaceRes, alertsRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch("/api/settings/alerts"),
      ])

      if (workspaceRes.ok) {
        const workspaceData = await workspaceRes.json()
        setWorkspace(workspaceData)
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlertPreferences(alertsData)

        // Populate form state from existing preferences
        const emailPref = alertsData.find((p: AlertPreference) => p.channel === "email")
        if (emailPref) {
          setEmailSettings({
            isActive: emailPref.isActive,
            frequency: emailPref.frequency,
            minConfidence: emailPref.minConfidence,
            changeTypes: emailPref.changeTypes || [],
          })
        }

        const slackPref = alertsData.find((p: AlertPreference) => p.channel === "slack")
        if (slackPref) {
          setSlackSettings({
            isActive: slackPref.isActive,
            frequency: slackPref.frequency,
            minConfidence: slackPref.minConfidence,
            changeTypes: slackPref.changeTypes || [],
            webhookUrl: slackPref.slackWebhookUrl || "",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
    } finally {
      setLoading(false)
    }
  }

  async function saveEmailSettings() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          ...emailSettings,
        }),
      })

      if (!res.ok) throw new Error("Failed to save")

      toast({
        title: "Settings saved",
        description: "Your email notification settings have been updated.",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function saveSlackSettings() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "slack",
          ...slackSettings,
          slackWebhookUrl: slackSettings.webhookUrl,
        }),
      })

      if (!res.ok) throw new Error("Failed to save")

      toast({
        title: "Settings saved",
        description: "Your Slack notification settings have been updated.",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  async function testSlackWebhook() {
    if (!slackSettings.webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL first",
        variant: "destructive",
      })
      return
    }

    try {
      const res = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: slackSettings.webhookUrl }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Success",
          description: "Test message sent to Slack!",
          variant: "success",
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send test message",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test webhook",
        variant: "destructive",
      })
    }
  }

  function toggleChangeType(type: string, settings: typeof emailSettings, setSettings: typeof setEmailSettings) {
    const newTypes = settings.changeTypes.includes(type)
      ? settings.changeTypes.filter((t) => t !== type)
      : [...settings.changeTypes, type]
    setSettings({ ...settings, changeTypes: newTypes })
  }

  return (
    <div>
      <Header title="Settings" description="Manage your workspace and notification preferences" />

      <div className="p-6">
        <Tabs defaultValue="workspace">
          <TabsList>
            <TabsTrigger value="workspace">
              <Building2 className="h-4 w-4 mr-2" />
              Workspace
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Details</CardTitle>
                <CardDescription>
                  Manage your workspace settings and members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {workspace ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="workspace-name">Workspace Name</Label>
                      <Input
                        id="workspace-name"
                        value={workspace.name}
                        readOnly
                        className="bg-neutral-50"
                      />
                    </div>
                    <div className="flex gap-8 pt-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {workspace._count.competitors}
                        </div>
                        <div className="text-sm text-neutral-500">Competitors</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {workspace._count.members}
                        </div>
                        <div className="text-sm text-neutral-500">Members</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium capitalize">
                          {workspace.role}
                        </div>
                        <div className="text-sm text-neutral-500">Your Role</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-neutral-500">Loading workspace details...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 space-y-6">
            {/* Email Notifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-neutral-400" />
                    <div>
                      <CardTitle>Email Notifications</CardTitle>
                      <CardDescription>
                        Receive digest emails with competitive updates
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={emailSettings.isActive}
                    onCheckedChange={(checked) =>
                      setEmailSettings({ ...emailSettings, isActive: checked })
                    }
                  />
                </div>
              </CardHeader>
              {emailSettings.isActive && (
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Frequency</Label>
                    <Select
                      value={emailSettings.frequency}
                      onValueChange={(v) =>
                        setEmailSettings({ ...emailSettings, frequency: v })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_FREQUENCIES.filter((f) => f !== "realtime").map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Minimum Confidence ({Math.round(emailSettings.minConfidence * 100)}%)</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={emailSettings.minConfidence}
                      onChange={(e) =>
                        setEmailSettings({
                          ...emailSettings,
                          minConfidence: parseFloat(e.target.value),
                        })
                      }
                      className="w-48"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Change Types (leave empty for all)</Label>
                    <div className="flex flex-wrap gap-2">
                      {CHANGE_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleChangeType(type, emailSettings, setEmailSettings)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            emailSettings.changeTypes.includes(type)
                              ? "bg-blue-100 border-blue-300 text-blue-700"
                              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                          }`}
                        >
                          {changeTypeLabel[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button onClick={saveEmailSettings} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Email Settings"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Slack Notifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Slack className="h-5 w-5 text-neutral-400" />
                    <div>
                      <CardTitle>Slack Notifications</CardTitle>
                      <CardDescription>
                        Get instant alerts in your Slack workspace
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={slackSettings.isActive}
                    onCheckedChange={(checked) =>
                      setSlackSettings({ ...slackSettings, isActive: checked })
                    }
                  />
                </div>
              </CardHeader>
              {slackSettings.isActive && (
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="webhook-url"
                        type="url"
                        value={slackSettings.webhookUrl}
                        onChange={(e) =>
                          setSlackSettings({
                            ...slackSettings,
                            webhookUrl: e.target.value,
                          })
                        }
                        placeholder="https://hooks.slack.com/services/..."
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={testSlackWebhook}
                      >
                        <TestTube className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Create an incoming webhook in your Slack workspace settings
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Frequency</Label>
                    <Select
                      value={slackSettings.frequency}
                      onValueChange={(v) =>
                        setSlackSettings({ ...slackSettings, frequency: v })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_FREQUENCIES.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Minimum Confidence ({Math.round(slackSettings.minConfidence * 100)}%)</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={slackSettings.minConfidence}
                      onChange={(e) =>
                        setSlackSettings({
                          ...slackSettings,
                          minConfidence: parseFloat(e.target.value),
                        })
                      }
                      className="w-48"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Change Types (leave empty for all)</Label>
                    <div className="flex flex-wrap gap-2">
                      {CHANGE_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => toggleChangeType(type, slackSettings, setSlackSettings)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            slackSettings.changeTypes.includes(type)
                              ? "bg-blue-100 border-blue-300 text-blue-700"
                              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                          }`}
                        >
                          {changeTypeLabel[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button onClick={saveSlackSettings} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Saving..." : "Save Slack Settings"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
