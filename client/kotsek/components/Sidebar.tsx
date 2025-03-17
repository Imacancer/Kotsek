"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Home,
  Car,
  Settings,
  Users,
  HelpCircle,
  Cog,
  ChartNoAxesCombined,
  AlertTriangleIcon,
  Lock,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const Sidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{
    id: number;
    email: string;
    username: string;
    profile_image: string | null;
  } | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Check authentication status when component mounts
  useEffect(() => {
    const checkAuth = () => {
      const token = sessionStorage.getItem("access_token");
      setIsAuthenticated(!!token);

      // Get user data if authenticated
      if (token) {
        const userData = sessionStorage.getItem("user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser({
            id: parsedUser.id,
            email: parsedUser.email,
            username: parsedUser.username,
            // Map image_url to profile_image
            profile_image: parsedUser.image_url || parsedUser.profile_image,
          });
        }
      } else {
        setUser(null);
      }
    };

    // Check initially
    checkAuth();

    // Set up event listener for storage changes
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);

    // Custom event for auth changes
    window.addEventListener("authChange", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("authChange", handleStorageChange);
    };
  }, []);

  // Basic navigation items always visible
  const baseNavItems = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Report", icon: AlertTriangleIcon, href: "/report" },
  ];

  // Protected routes - only visible when authenticated
  const protectedNavItems = [
    { name: "Detect", icon: Car, href: "/detect" },
    { name: "Analytics", icon: ChartNoAxesCombined, href: "/analytics" },
  ];

  // Auth-related navigation
  const authNavItem = isAuthenticated
    ? {
        name: "Logout",
        icon: Users,
        href: "#",
        onClick: () => {
          sessionStorage.removeItem("access_token");
          sessionStorage.removeItem("user");
          sessionStorage.removeItem("auth_provider");
          sessionStorage.removeItem("refresh_token");
          setIsAuthenticated(false);
          setUser(null);
          // Dispatch custom event to notify other components
          window.dispatchEvent(new Event("authChange"));
          toast.success("Logged out successfully");
          router.push("/");
        },
      }
    : { name: "Login", icon: Users, href: "/login" };

  // Combine all navigation items
  const navItems = [
    ...baseNavItems,
    ...(isAuthenticated ? protectedNavItems : []),
    authNavItem,
  ];

  const handleNavItemClick = (item: any) => {
    if (item.href === "/detect" && !isAuthenticated) {
      toast.error("Please login to access the detection feature");
      router.push("/login");
      return false;
    }

    if (item.onClick) {
      item.onClick();
      return false;
    }

    return true;
  };

  // console.log("User:", user);

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

      <nav className="flex flex-col gap-2 p-2 flex-grow">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          // For non-clickable items shown in the nav but that require auth
          const isProtected = item.href === "/detect" && !isAuthenticated;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={(e) => {
                if (!handleNavItemClick(item)) {
                  e.preventDefault();
                }
              }}
              className={`flex items-center rounded-lg p-2 transition-all ${
                isExpanded ? "justify-start gap-3" : "justify-center tex"
              } ${
                isActive
                  ? "bg-white text-black"
                  : `text-gray-800 hover:bg-yellow-500/20 ${
                      !isExpanded && "text-white"
                    }`
              } ${isProtected ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProtected && isExpanded ? (
                <Lock
                  className={`h-4 w-4 mr-1 ${
                    isExpanded ? "text-gray-800" : "text-white"
                  }`}
                />
              ) : (
                <Icon
                  className={`h-5 w-5 ${
                    isActive
                      ? "text-black"
                      : isExpanded
                      ? "text-gray-800"
                      : "text-white"
                  }`}
                />
              )}
              {isExpanded && (
                <span
                  className={`font-medium transition-all ${
                    isActive ? "text-black" : "text-gray-800"
                  }`}
                >
                  {item.name}
                  {isProtected && " (Login Required)"}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile Section at bottom of sidebar */}
      {isAuthenticated && (
        <div
          className={`mt-auto border-t border-yellow-500 p-2 flex items-center ${
            isExpanded ? "justify-start gap-3" : "justify-center"
          }`}
        >
          <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gray-200 flex items-center justify-center">
            {user?.profile_image ? (
              <img
                src={user.profile_image}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-gray-500" />
            )}
          </div>

          {isExpanded && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">
                {user?.username || "User"}
              </span>
              <span className="text-xs text-gray-600 truncate">
                {user?.email || ""}
              </span>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
