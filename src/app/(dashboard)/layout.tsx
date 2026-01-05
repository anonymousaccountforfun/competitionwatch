import { Sidebar } from "@/components/layout/sidebar"
import { ToastProvider } from "@/components/ui/toast"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-neutral-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ToastProvider>
  )
}
