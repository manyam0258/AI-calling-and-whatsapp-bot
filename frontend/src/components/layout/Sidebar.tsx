"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Users,
  KanbanSquare,
  Megaphone,
  Zap,
  Phone,
  PhoneCall,
  Settings,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Bot,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",       label: "Dashboard",    icon: LayoutDashboard },
  { href: "/inbox",           label: "Inbox",        icon: MessageSquare },
  { href: "/contacts",        label: "Contacts",     icon: Users },
  { href: "/pipelines",       label: "Pipelines",    icon: KanbanSquare },
  { href: "/broadcasts",      label: "Broadcasts",   icon: Megaphone },
  { href: "/automations",     label: "Automations",  icon: Zap },
];

const voiceItems = [
  { href: "/voice",           label: "Overview",     icon: Phone },
  { href: "/voice/calls",     label: "Call Logs",    icon: PhoneCall },
  { href: "/voice/make-call", label: "Make a Call",  icon: Bot },
  { href: "/voice/config",    label: "Agent Config", icon: Settings },
  { href: "/voice/analytics", label: "Analytics",    icon: LayoutDashboard },
];

export function Sidebar() {
  const pathname = usePathname();
  const [voiceOpen, setVoiceOpen] = useState(pathname.startsWith("/voice"));

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">AI CRM</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive(href)
                  ? "bg-sidebar-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        {/* Voice section */}
        <div className="mt-4">
          <button
            onClick={() => setVoiceOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">Voice Calls</span>
            {voiceOpen
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
          {voiceOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
              {voiceItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive(href)
                      ? "bg-sidebar-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Settings link */}
      <div className="border-t border-border p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
            isActive("/settings")
              ? "bg-sidebar-primary text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
