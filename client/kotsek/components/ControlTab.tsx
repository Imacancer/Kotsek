"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ControlTab() {
  const SERVER_URL =
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8000";
  const [isConfiguringRates, setIsConfiguringRates] = useState(false);
  const [isSettingHours, setIsSettingHours] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);

  const handleConfigureRates = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      // Add your rate configuration logic here
      toast.success("Parking rates updated successfully");
      setIsConfiguringRates(false);
    } catch (error) {
      console.error("Error configuring rates:", error);
      toast.error("Failed to update parking rates");
    }
  };

  const handleSetHours = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      // Add your operating hours configuration logic here
      toast.success("Operating hours updated successfully");
      setIsSettingHours(false);
    } catch (error) {
      console.error("Error setting hours:", error);
      toast.error("Failed to update operating hours");
    }
  };

  const handleMaintenance = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      // Add your maintenance logic here
      toast.success("Maintenance completed successfully");
      setIsMaintenance(false);
    } catch (error) {
      console.error("Error performing maintenance:", error);
      toast.error("Failed to complete maintenance");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">System Control</CardTitle>
        <CardDescription className="text-sm md:text-base">
          Control system settings and configurations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Parking Rates Configuration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base md:text-lg font-medium">
                Parking Rates
              </h3>
              <p className="text-xs md:text-sm text-gray-500">
                Configure parking rates for different vehicle types
              </p>
            </div>
            <Dialog
              open={isConfiguringRates}
              onOpenChange={setIsConfiguringRates}
            >
              <DialogTrigger asChild>
                <Button>Configure Rates</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Parking Rates</DialogTitle>
                  <DialogDescription>
                    Set rates for different vehicle types and time periods
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="car-rate">Car Rate (per hour)</Label>
                    <Input id="car-rate" type="number" min="0" step="0.01" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bike-rate">Bike Rate (per hour)</Label>
                    <Input id="bike-rate" type="number" min="0" step="0.01" />
                  </div>
                  <Button onClick={handleConfigureRates}>Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Operating Hours Configuration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base md:text-lg font-medium">
                Operating Hours
              </h3>
              <p className="text-xs md:text-sm text-gray-500">
                Set operating hours for each parking lot
              </p>
            </div>
            <Dialog open={isSettingHours} onOpenChange={setIsSettingHours}>
              <DialogTrigger asChild>
                <Button>Set Hours</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Operating Hours</DialogTitle>
                  <DialogDescription>
                    Configure opening and closing times for each lot
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="open-time">Opening Time</Label>
                    <Input id="open-time" type="time" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="close-time">Closing Time</Label>
                    <Input id="close-time" type="time" />
                  </div>
                  <Button onClick={handleSetHours}>Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* System Maintenance */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base md:text-lg font-medium">
                System Maintenance
              </h3>
              <p className="text-xs md:text-sm text-gray-500">
                Perform system maintenance tasks
              </p>
            </div>
            <Dialog open={isMaintenance} onOpenChange={setIsMaintenance}>
              <DialogTrigger asChild>
                <Button>Maintenance</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>System Maintenance</DialogTitle>
                  <DialogDescription>
                    Perform maintenance tasks and system checks
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Maintenance Tasks</Label>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full">
                        Clear Cache
                      </Button>
                      <Button variant="outline" className="w-full">
                        Optimize Database
                      </Button>
                      <Button variant="outline" className="w-full">
                        Check System Health
                      </Button>
                    </div>
                  </div>
                  <Button onClick={handleMaintenance}>Run Maintenance</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
