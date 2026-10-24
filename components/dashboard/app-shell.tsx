"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import {
  Building2,
  ChevronRight,
  Factory,
  LayoutDashboard,
  Radio,
  FlaskConical,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

/** Shared design system with navigation for the FORMA workspace. */
export function AppShell({
  breadcrumb,
  children,
  overlay,
}: {
  breadcrumb: string[]
  compareCount?: number
  children: React.ReactNode
  overlay?: React.ReactNode
}) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <TooltipProvider>
      <SidebarProvider>
        <a
          href="#main"
          className="sr-only fixed top-3 left-3 z-50 rounded-xl bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only"
        >
          Skip to dashboard
        </a>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-0">
            <div className="flex items-center gap-3 overflow-hidden py-2 group-data-[collapsible=icon]:justify-center">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-semibold tracking-tight">FORMA</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Infrastructure intelligence
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={breadcrumb.at(-1) === "Overview"}
                      tooltip="Overview"
                      render={<Link href="/" />}
                    >
                      <LayoutDashboard />
                      <span>Overview</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={breadcrumb.at(-1) === "Incidents"}
                      tooltip="Incidents"
                      render={<Link href="/incidents" />}
                    >
                      <Radio />
                      <span>Incidents</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={breadcrumb.at(-1) === "Recovery rehearsal"}
                      tooltip="Recovery rehearsal"
                      render={<Link href="/?mode=demo" />}
                    >
                      <FlaskConical />
                      <span>Recovery rehearsal</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={breadcrumb.at(-1) === "Production planning"}
                      tooltip="Production planning"
                      render={<Link href="/planning" />}
                    >
                      <Factory />
                      <span>Production planning</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="gap-4 p-4 group-data-[collapsible=icon]:p-2">
            <div className="flex items-center gap-3 overflow-hidden py-1">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                FM
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-xs font-medium">Procurement workspace</p>
                <p className="mt-1 text-[11px] text-muted-foreground">FORMA</p>
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="size-10" />
              <Separator orientation="vertical" className="mr-1 h-4" />
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-3">
                  {i > 0 && (
                    <ChevronRight className="size-3 text-muted-foreground" />
                  )}
                  <span
                    className={`text-sm ${i < breadcrumb.length - 1 ? "text-muted-foreground" : ""}`}
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Toggle light and dark theme"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                <Sun className="hidden dark:block" />
                <Moon className="dark:hidden" />
              </Button>
            </div>
          </header>
          {children}
        </SidebarInset>
        {overlay}
      </SidebarProvider>
    </TooltipProvider>
  )
}
