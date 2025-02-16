"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Camera, Play } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Define interfaces for our data types
interface DailyData {
  time: string;
  volume: number;
}

interface WeeklyData {
  day: string;
  volume: number;
  average: number;
}

interface MonthlyData {
  month: string;
  volume: number;
}

type ViewType = "daily" | "weekly" | "monthly";

const AnalyticsDashboard = () => {
  const [selectedCamera, setSelectedCamera] = useState("camera1");
  const [selectedView, setSelectedView] = useState<ViewType>("daily");

  // Sample daily data
  const dailyData: DailyData[] = [
    { time: "00:00", volume: 20 },
    { time: "04:00", volume: 35 },
    { time: "08:00", volume: 85 },
    { time: "12:00", volume: 65 },
    { time: "16:00", volume: 90 },
    { time: "20:00", volume: 45 },
  ];

  // Sample weekly data
  const weeklyData: WeeklyData[] = [
    { day: "Mon", volume: 450, average: 420 },
    { day: "Tue", volume: 520, average: 480 },
    { day: "Wed", volume: 640, average: 550 },
    { day: "Thu", volume: 580, average: 510 },
    { day: "Fri", volume: 780, average: 650 },
    { day: "Sat", volume: 420, average: 380 },
    { day: "Sun", volume: 320, average: 300 },
  ];

  // Sample monthly data
  const monthlyData: MonthlyData[] = [
    { month: "Jan", volume: 12500 },
    { month: "Feb", volume: 11800 },
    { month: "Mar", volume: 13200 },
    { month: "Apr", volume: 14500 },
    { month: "May", volume: 15800 },
    { month: "Jun", volume: 16200 },
    { month: "Jul", volume: 17500 },
    { month: "Aug", volume: 16800 },
    { month: "Sep", volume: 15500 },
    { month: "Oct", volume: 14200 },
    { month: "Nov", volume: 13800 },
    { month: "Dec", volume: 12900 },
  ];

  // Calculate summary statistics based on selected view
  const calculateStats = () => {
    switch (selectedView) {
      case "weekly":
        const weeklyTotal = weeklyData.reduce(
          (sum, entry) => sum + entry.volume,
          0
        );
        const weeklyAvg = Math.round(weeklyTotal / weeklyData.length);
        const weeklyPeak = Math.max(...weeklyData.map((entry) => entry.volume));
        const weeklyPeakDay = weeklyData.find(
          (entry) => entry.volume === weeklyPeak
        )?.day;
        return {
          totalVolume: weeklyTotal,
          avgVolume: weeklyAvg,
          peakVolume: weeklyPeak,
          peakTime: weeklyPeakDay,
        };

      case "monthly":
        const monthlyTotal = monthlyData.reduce(
          (sum, entry) => sum + entry.volume,
          0
        );
        const monthlyAvg = Math.round(monthlyTotal / monthlyData.length);
        const monthlyPeak = Math.max(
          ...monthlyData.map((entry) => entry.volume)
        );
        const monthlyPeakMonth = monthlyData.find(
          (entry) => entry.volume === monthlyPeak
        )?.month;
        return {
          totalVolume: monthlyTotal,
          avgVolume: monthlyAvg,
          peakVolume: monthlyPeak,
          peakTime: monthlyPeakMonth,
        };

      default:
        const dailyTotal = dailyData.reduce(
          (sum, entry) => sum + entry.volume,
          0
        );
        const dailyAvg = Math.round(dailyTotal / dailyData.length);
        const dailyPeak = Math.max(...dailyData.map((entry) => entry.volume));
        const dailyPeakTime = dailyData.find(
          (entry) => entry.volume === dailyPeak
        )?.time;
        return {
          totalVolume: dailyTotal,
          avgVolume: dailyAvg,
          peakVolume: dailyPeak,
          peakTime: dailyPeakTime,
        };
    }
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[90%] mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <Select
            value={selectedView}
            onValueChange={(value: ViewType) => setSelectedView(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedView.charAt(0).toUpperCase() + selectedView.slice(1)}{" "}
              Traffic Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              {selectedView === "weekly" ? (
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis
                    label={{
                      value: "Volume",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="#9333ea"
                    strokeWidth={2}
                  />
                </LineChart>
              ) : selectedView === "monthly" ? (
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    label={{
                      value: "Volume",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#3b82f6" />
                </BarChart>
              ) : (
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis
                    label={{
                      value: "Volume",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#3b82f6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalVolume}</p>
              <p className="text-sm text-gray-500">
                vehicles this {selectedView.slice(0, -2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.avgVolume}</p>
              <p className="text-sm text-gray-500">
                vehicles per{" "}
                {selectedView === "daily"
                  ? "time slot"
                  : selectedView === "weekly"
                  ? "day"
                  : "month"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.peakVolume}</p>
              <p className="text-sm text-gray-500">
                vehicles {selectedView === "daily" ? "at" : "on"}{" "}
                {stats.peakTime}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
