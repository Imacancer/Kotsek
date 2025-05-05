"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL;

// Define types for our data
interface ParkingSpot {
  slot_id: string;
  slot_number: number;
  slot_name: string;
  section: string;
  lot_id: string;
  lot_name: string;
  vehicle_type: string;
  total_duration_minutes: number;
  total_duration_hours: number;
  formatted_duration: string;
}

interface TopSpot extends ParkingSpot {}

interface ParkingDataResponse {
  time_period: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  top_spots: ParkingSpot[];
  top_three: ParkingSpot[];
}

const ParkingChart = () => {
  const [selectedView, setSelectedView] = useState<"day" | "week" | "month">(
    "day"
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [parkingData, setParkingData] = useState<ParkingSpot[]>([]);
  const [topSpots, setTopSpots] = useState<TopSpot[]>([]);

  useEffect(() => {
    fetchParkingData();
  }, [selectedView]);

  const fetchParkingData = async (): Promise<void> => {
    try {
      setLoading(true);

      // Fetch data from the new endpoint
      const response = await axios.get<ParkingDataResponse>(
        `${API_URL}/analytics/parking-spots/top-duration?time_period=${selectedView}`
      );

      // Set the data from the response
      setParkingData(response.data.top_spots);

      // Set top 3 spots for the leaderboard
      setTopSpots(response.data.top_three);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching parking data:", err);
      setError("Failed to load parking data. Please try again later.");
      setLoading(false);
    }
  };

  // Function to customize the tooltip content
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ParkingSpot;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-bold text-sm">
            {data.slot_name} - Section {data.section}
          </p>
          <p className="text-xs text-gray-600">Lot: {data.lot_name}</p>
          <p className="text-xs text-gray-600">
            Vehicle Type: {data.vehicle_type}
          </p>
          <p className="font-bold text-blue-500 mt-1">
            {data.formatted_duration}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Top Parking Spots by Duration</h2>
        <Select
          value={selectedView}
          onValueChange={(value: "day" | "week" | "month") =>
            setSelectedView(value)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[500px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex justify-center items-center h-[500px] text-red-500">
          {error}
        </div>
      ) : (
        <>
          <div className="h-[500px]">
            <ScrollArea className="h-full w-full">
              <ResponsiveContainer
                width="100%"
                height={Math.max(500, parkingData.length * 40)}
              >
                <BarChart
                  data={parkingData}
                  layout="vertical"
                  margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    label={{
                      value: "Duration (hours)",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    dataKey="slot_name"
                    type="category"
                    width={80}
                    tickFormatter={(value) =>
                      `${value} (${
                        parkingData.find((spot) => spot.slot_name === value)
                          ?.section || ""
                      })`
                    }
                  />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Bar
                    dataKey="total_duration_hours"
                    name="Total Parking Duration"
                    fill="#3b82f6"
                  />
                </BarChart>
              </ResponsiveContainer>
            </ScrollArea>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Top 3 Most Used Parking Spots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topSpots.map((spot, index) => (
                    <div
                      key={spot.slot_id}
                      className="flex items-center justify-between border-b pb-3 last:border-b-0"
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                            index === 0
                              ? "bg-yellow-400"
                              : index === 1
                              ? "bg-gray-300"
                              : "bg-amber-700"
                          }`}
                        >
                          <span className="font-bold text-white">
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {spot.slot_name} - Section {spot.section}
                          </p>
                          <p className="text-sm text-gray-500">
                            {spot.lot_name} | {spot.vehicle_type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{spot.formatted_duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default ParkingChart;
