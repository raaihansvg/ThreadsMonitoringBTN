"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  Activity,
  MessageSquare,
  FolderKanban,
  ShieldAlert,
  Settings,
  ArrowUpRight,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const {
    role,
    openInputModal,
    setTokenModalOpen,
    refreshTrigger,
    showSampleData,
  } = useApp();

  const [draftCount, setDraftCount] = useState<number>(0);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/drafts?includeSample=${showSampleData}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.drafts)) {
          setDraftCount(data.drafts.length);
        }
      })
      .catch(() => setDraftCount(0));

    fetch(`/api/alerts?filter=unread&includeSample=${showSampleData}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.alerts)) {
          setUnreadAlerts(data.alerts.length);
        }
      })
      .catch(() => setUnreadAlerts(0));
  }, [refreshTrigger, showSampleData]);

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: Activity,
      badge: 0,
    },
    {
      label: "Mention",
      href: "/mention",
      icon: MessageSquare,
      badge: 0,
    },
    {
      label: "Draf",
      href: "/draf",
      icon: FolderKanban,
      badge: draftCount,
    },
    {
      label: "Alert",
      href: "/alert",
      icon: ShieldAlert,
      badge: unreadAlerts,
    },
    {
      label: "Topik",
      href: "/topik",
      icon: Settings,
      badge: 0,
    },
  ];

  return (
    <aside className="flex shrink-0 items-center justify-between rounded-[32px] border border-slate-200/60 bg-white p-2.5 shadow-sm md:w-[88px] md:flex-col">
      <div className="flex w-full items-center justify-around gap-1 md:flex-col md:justify-start md:gap-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-pill relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold transition-all md:w-[68px] ${
                isActive
                  ? "bg-[#0055FF] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span className="text-[12px] leading-tight">{item.label}</span>

              {item.badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E60012] px-1 text-xs font-bold text-white shadow">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => {
          if (role === "petugas") {
            openInputModal();
          } else {
            setTokenModalOpen(true);
          }
        }}
        title="Input Cepat Mention"
        className="mt-auto hidden h-11 w-11 items-center justify-center rounded-full bg-[#0A192F] text-white shadow transition hover:bg-[#0055FF] md:flex"
        aria-label="Input Cepat Mention"
      >
        <ArrowUpRight className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </aside>
  );
}
