"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalyticsTab from "@/components/AnalyticsTab";
import UserManagementTab from "@/components/UserManagementTab";
import ControlTab from "@/components/ControlTab";
import SystemLogsTab from "@/components/SystemLogsTab";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      const userData = sessionStorage.getItem("user");

      if (!token || !userData) {
        toast.error("Please login to access this page");
        router.push("/login");
        return;
      }

      const parsedUserData = JSON.parse(userData);
      if (parsedUserData.role !== "Admin") {
        toast.error("You don't have permission to access this page");
        router.push("/detect");
        return;
      }
    } catch (error) {
      console.error("Error in checkAuth:", error);
      toast.error("Failed to verify authentication");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left side - Main Dashboard with Tabs */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold mb-6">
            Admin Dashboard
          </h1>
          <div
            className="overflow-y-auto"
            style={{ height: "calc(100vh - 200px)" }}
          >
            <Tabs defaultValue="management" className="space-y-4">
              <TabsList className="w-full flex flex-wrap">
                <TabsTrigger
                  value="management"
                  className="flex-1 min-w-[120px]"
                >
                  Management
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1 min-w-[120px]">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="control" className="flex-1 min-w-[120px]">
                  Control
                </TabsTrigger>
              </TabsList>

              <TabsContent value="management">
                <UserManagementTab />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsTab />
              </TabsContent>

              <TabsContent value="control">
                <ControlTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right side - System Logs */}
        <div className="w-full lg:w-[350px] xl:w-[400px]">
          <div className="h-[calc(100vh-200px)]">
            <SystemLogsTab />
          </div>
        </div>
      </div>
    </div>
  );
}
