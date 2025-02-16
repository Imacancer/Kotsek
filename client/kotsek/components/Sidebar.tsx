"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Home,
  Car,
  Settings,
  Users,
  HelpCircle,
  Cog,
  ChartNoAxesCombined,
  AlertTriangleIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Analytics", icon: ChartNoAxesCombined, href: "/analytics" },
    { name: "Detect", icon: Car, href: "/detect" },
    { name: "Login", icon: Users, href: "/login" },
    { name: "Report", icon: AlertTriangleIcon, href: "/report" },
  ];

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col backdrop-blur-lg transition-all duration-300 ${
        isExpanded
          ? "w-64 bg-yellow-200/75 text-black"
          : "w-16 bg-gray-700/30 text-white"
      }`}
    >
      <div className="flex h-14 items-center justify-center border-b border-yellow-500">
        <Link href="/" className="flex items-center gap-2">
          {isExpanded ? (
            <span className="text-lg font-semibold">
              Ko<span className="text-yellow-600">Tsek</span>
            </span>
          ) : (
            <span className="text-lg font-semibold">K</span>
          )}
        </Link>
      </div>

      <nav className="flex flex-col gap-2 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center rounded-lg p-2 transition-all ${
                isExpanded ? "justify-start gap-3" : "justify-center tex"
              } ${
                isActive
                  ? "bg-white text-black"
                  : `text-gray-800 hover:bg-yellow-500/20 ${
                      !isExpanded && "text-white"
                    }`
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive
                    ? "text-black"
                    : isExpanded
                    ? "text-gray-800"
                    : "text-white"
                }`}
              />
              {isExpanded && (
                <span
                  className={`font-medium transition-all ${
                    isActive ? "text-black" : "text-gray-800"
                  }`}
                >
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
