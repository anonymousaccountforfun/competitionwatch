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
import { Building2, Bell, Slack, Mail, Save, TestTube, Key, Webhook, Copy, Trash2, Plus, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  key?: string // Only present on creation
}

interface WebhookConfig {
  id: string
  name: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggeredAt: string | null
  failureCount: number
  createdAt: string
  secret?: string
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [alertPreferences, setAlertPreferences] = useState<AlertPreference[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newApiKey, setNewApiKey] = useState<ApiKey | null>(null)
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null)

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
      const [workspaceRes, alertsRes, apiKeysRes, webhooksRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch("/api/settings/alerts"),
        fetch("/api/api-keys"),
        fetch("/api/webhooks"),
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

      if (apiKeysRes.ok) {
        const apiKeysData = await apiKeysRes.json()
        setApiKeys(Array.isArray(apiKeysData) ? apiKeysData : [])
      }

      if (webhooksRes.ok) {
        const webhooksData = await webhooksRes.json()
        setWebhooks(Array.isArray(webhooksData) ? webhooksData : [])
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

  async function createApiKey(name: string, permissions: string[]) {
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      })

      if (!res.ok) throw new Error("Failed to create API key")

      const newKey = await res.json()
      setNewApiKey(newKey)
      setApiKeys([newKey, ...apiKeys])
      toast({
        title: "API key created",
        description: "Copy the key now - it won't be shown again!",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      })
    }
  }

  async function deleteApiKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API key?")) return

    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error("Failed to delete")

      setApiKeys(apiKeys.filter((k) => k.id !== id))
      toast({
        title: "API key revoked",
        description: "The key can no longer be used.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      })
    }
  }

  async function createWebhook(name: string, url: string, events: string[]) {
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, events }),
      })

      if (!res.ok) throw new Error("Failed to create webhook")

      const newWebhook = await res.json()
      setNewWebhookSecret(newWebhook.secret)
      setWebhooks([newWebhook, ...webhooks])
      toast({
        title: "Webhook created",
        description: "Copy the signing secret now - it won't be shown again!",
        variant: "success",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create webhook",
        variant: "destructive",
      })
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return

    try {
      const res = await fetch("/api/webhooks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error("Failed to delete")

      setWebhooks(webhooks.filter((w) => w.id !== id))
      toast({
        title: "Webhook deleted",
        description: "The webhook has been removed.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete webhook",
        variant: "destructive",
      })
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    })
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
            <TabsTrigger value="api-keys">
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks">
              <Webhook className="h-4 w-4 mr-2" />
              Webhooks
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

          <TabsContent value="api-keys" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for programmatic access to your data
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    const name = prompt("Enter a name for this API key:")
                    if (name) createApiKey(name, ["read"])
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {newApiKey?.key && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      New API Key Created - Copy it now!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-white rounded border text-sm font-mono">
                        {newApiKey.key}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newApiKey.key!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      This key won't be shown again. Store it securely.
                    </p>
                  </div>
                )}

                {apiKeys.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">
                    No API keys yet. Create one to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{key.name}</span>
                            <Badge variant="outline">{key.permissions.join(", ")}</Badge>
                          </div>
                          <p className="text-sm text-neutral-500 mt-1">
                            <code className="bg-neutral-100 px-1 rounded">{key.keyPrefix}...</code>
                            {" "}&middot;{" "}
                            {key.lastUsedAt
                              ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                              : "Never used"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteApiKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-2">API Documentation</h4>
                  <p className="text-sm text-neutral-600 mb-3">
                    Use these endpoints with your API key in the Authorization header:
                  </p>
                  <div className="space-y-2 text-sm font-mono bg-neutral-50 p-4 rounded-lg">
                    <p>GET /api/v1/competitors</p>
                    <p>GET /api/v1/changes</p>
                    <p>GET /api/v1/announcements</p>
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Header: Authorization: Bearer cp_live_xxxxx
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>
                      Receive real-time notifications when events occur
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    const name = prompt("Enter a name for this webhook:")
                    const url = name ? prompt("Enter the webhook URL:") : null
                    if (name && url) createWebhook(name, url, ["change.detected"])
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Webhook
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {newWebhookSecret && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      Webhook Signing Secret - Copy it now!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-white rounded border text-sm font-mono">
                        {newWebhookSecret}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(newWebhookSecret)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      Use this to verify webhook signatures. It won't be shown again.
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      onClick={() => setNewWebhookSecret(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}

                {webhooks.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">
                    No webhooks configured. Add one to receive event notifications.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{webhook.name}</span>
                            {webhook.isActive ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                            {webhook.failureCount > 0 && (
                              <Badge variant="destructive">{webhook.failureCount} failures</Badge>
                            )}
                          </div>
                          <p className="text-sm text-neutral-500 mt-1 truncate max-w-md">
                            {webhook.url}
                          </p>
                          <div className="flex gap-1 mt-2">
                            {webhook.events.map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-2">Supported Events</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-neutral-50 rounded">
                      <code>change.detected</code>
                      <p className="text-xs text-neutral-500">When a material change is detected</p>
                    </div>
                    <div className="p-2 bg-neutral-50 rounded">
                      <code>announcement.new</code>
                      <p className="text-xs text-neutral-500">When a new announcement is captured</p>
                    </div>
                    <div className="p-2 bg-neutral-50 rounded">
                      <code>competitor.created</code>
                      <p className="text-xs text-neutral-500">When a new competitor is added</p>
                    </div>
                    <div className="p-2 bg-neutral-50 rounded">
                      <code>competitor.updated</code>
                      <p className="text-xs text-neutral-500">When a competitor is updated</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
