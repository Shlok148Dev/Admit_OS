"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Radar, 
  Compass, 
  GitBranch, 
  MessageSquare, 
  Bell,
  Sparkles
} from "lucide-react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems: SidebarItem[] = [
    { name: "Home", href: "/", icon: Home },
    { name: "Rank Radar", href: "/rank-radar", icon: Radar },
    { name: "Compass", href: "/counsel", icon: Compass },
    { name: "Branch", href: "/branch", icon: GitBranch },
    { name: "ARIA", href: "/chat", icon: MessageSquare, badge: "AI" },
    { name: "Alerts", href: "#alerts", icon: Bell },
  ];

  return (
    <aside className="hidden md:flex md:w-16 xl:w-[240px] flex-col bg-[#111118] text-slate-300 border-r border-[#2A2A38] fixed left-0 top-0 h-screen z-40 transition-all duration-300">
      {/* Brand logo area */}
      <div className="flex h-16 items-center px-4 xl:px-6 border-b border-[#2A2A38]">
        <Link href="/" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white font-extrabold flex-shrink-0">
            A
          </div>
          <span className="text-lg font-extrabold tracking-tight text-[#F8FAFC] xl:block hidden">
            ADMIT<span className="text-[#10B981] ml-0.5">OS</span>
          </span>
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all group relative ${
                isActive
                  ? "bg-brand/10 text-brand border-l-4 border-brand -ml-2 rounded-l-none pl-2.5"
                  : "hover:bg-slate-900 hover:text-[#F8FAFC] border-l-4 border-transparent"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-brand" : "text-slate-400 group-hover:text-[#F8FAFC]"}`} />
              
              {/* Text label: hidden on collapsed screen width */}
              <span className="xl:block hidden truncate">{item.name}</span>

              {/* Badge (e.g. AI badge for ARIA) */}
              {item.badge && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-brand/20 text-brand text-[9px] font-extrabold px-1.5 py-0.5 rounded xl:block hidden">
                  {item.badge}
                </span>
              )}

              {/* Hover Tooltip for collapsed mode */}
              <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-[#1A1A24] text-[#F8FAFC] text-xs font-bold px-2 py-1 rounded shadow-lg border border-[#2A2A38] hidden group-hover:block xl:group-hover:hidden whitespace-nowrap z-50">
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer / User info or status indicator */}
      <div className="p-4 border-t border-[#2A2A38] flex items-center gap-2.5 overflow-hidden whitespace-nowrap">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-300 font-extrabold text-xs">
          ST
        </div>
        <div className="xl:flex flex-col hidden overflow-hidden text-left">
          <span className="text-xs font-bold text-[#F8FAFC] truncate">Student Dashboard</span>
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse"></span>
            DPDP Verified
          </span>
        </div>
      </div>
    </aside>
  );
}
