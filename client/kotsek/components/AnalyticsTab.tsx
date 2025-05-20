"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { format } from "date-fns";

interface TrafficPrediction {
  prediction_type: string;
  start_date: string;
  end_date: string;
  data: Array<{
    date: string;
    hour: number;
    entries: number;
    exits: number;
    net_change: number;
  }>;
}

interface ParkingPredictions {
  turnover_rate: {
    avg_turnover_time_hours: number;
    turnover_rate_per_day: number;
    confidence: number;
  };
  visit_frequency: {
    avg_days_between_visits: number;
    visits_per_month: number;
    confidence: number;
  };
  availability: {
    "30_min": { occupancy_rate: number; confidence: number };
    "1_hour": { occupancy_rate: number; confidence: number };
    "5_hours": { occupancy_rate: number; confidence: number };
  };
  peak_hours: Array<{
    hour: number;
    occupancy_rate: number;
    confidence: number;
  }>;
}

interface TrafficHeatmapData {
  prediction_type: string;
  start_date: string;
  end_date: string;
  data: Array<{
    date: string;
    hour: number;
    entries: number;
    exits: number;
    net_change: number;
  }>;
}

export default function AnalyticsTab() {
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const [trafficPrediction, setTrafficPrediction] =
    useState<TrafficPrediction | null>(null);
  const [selectedLot, setSelectedLot] = useState<string>("all");
  const [predictionDays, setPredictionDays] = useState<number>(7);
  const [predictions, setPredictions] = useState<ParkingPredictions | null>(
    null
  );
  const [currentMonth, setCurrentMonth] = useState<string>("");

  useEffect(() => {
    // Set current month for display
    const now = new Date();
    setCurrentMonth(
      now.toLocaleString("default", { month: "long", year: "numeric" })
    );

    fetchTrafficPrediction();
    fetchPredictions();
  }, []);

  useEffect(() => {
    fetchTrafficPrediction();
  }, [selectedLot, predictionDays]);

  const formatHour = (hour: number) => {
    if (hour === 0) return "00:00";
    if (hour === 12) return "12:00";
    if (hour === 23) return "23:59";
    return "";
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "MMM d");
  };

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  };

  const fetchTrafficPrediction = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) {
        toast.error("No authentication token found");
        return;
      }

      console.log("Fetching traffic prediction...");
      const response = await fetch(
        `${SERVER_URL}/reg/traffic/prediction?days=${predictionDays}${
          selectedLot !== "all" ? `&lot_id=${selectedLot}` : ""
        }`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Traffic prediction error:", errorData);
        throw new Error(
          errorData?.message || "Failed to fetch traffic prediction"
        );
      }

      const data = await response.json();
      console.log("Traffic prediction data:", data);
      setTrafficPrediction(data);
    } catch (error) {
      console.error("Error fetching traffic prediction:", error);
      toast.error("Failed to fetch traffic prediction");
    }
  };

  const fetchPredictions = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) {
        toast.error("No authentication token found");
        return;
      }

      console.log("Fetching predictions...");
      const response = await fetch(`${SERVER_URL}/reg/predictions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("Predictions error:", errorData);
        throw new Error(errorData?.message || "Failed to fetch predictions");
      }

      const data = await response.json();
      console.log("Predictions data:", data);
      setPredictions(data);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      toast.error("Failed to fetch predictions");
    }
  };

  const handleLotChange = (value: string) => {
    setSelectedLot(value);
    fetchTrafficPrediction();
  };

  const renderTrafficGraph = (data: TrafficPrediction) => {
    // Filter data for only 00:00, 12:00, and 23:59
    const filteredData = data.data.filter(
      (item) => item.hour === 0 || item.hour === 12 || item.hour === 23
    );

    // Group data by date and hour
    const dateMap = new Map();
    filteredData.forEach((item) => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, {
          date: item.date,
          "00:00": item.hour === 0 ? item.net_change : null,
          "12:00": item.hour === 12 ? item.net_change : null,
          "23:59": item.hour === 23 ? item.net_change : null,
        });
      } else {
        const dateData = dateMap.get(item.date);
        dateData[formatHour(item.hour)] = item.net_change;
      }
    });

    // Convert to array and sort by date
    const graphData = Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={graphData}
            margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              label={{ value: "Date", position: "bottom", offset: 20 }}
            />
            <YAxis
              label={{ value: "Net Change", angle: -90, position: "left" }}
            />
            <Tooltip
              labelFormatter={formatDate}
              formatter={(value: number) => [`${value} vehicles`, ""]}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ paddingBottom: 20 }}
            />
            <Line
              type="monotone"
              dataKey="00:00"
              stroke="#8884d8"
              name="00:00"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="12:00"
              stroke="#82ca9d"
              name="12:00"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="23:59"
              stroke="#ffc658"
              name="23:59"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">
            Traffic Analytics
          </CardTitle>
          <CardDescription className="text-sm md:text-base">
            View and analyze parking traffic patterns for {currentMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xs md:text-sm text-gray-500 mb-4">
            Data shown is based on current month's statistics (from{" "}
            {new Date().getDate()}{" "}
            {new Date().toLocaleString("default", { month: "long" })})
          </div>

          {/* Traffic Graph */}
          {trafficPrediction && (
            <div className="mt-4 h-[300px] md:h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderTrafficGraph(trafficPrediction)}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predictions Section */}
      {predictions && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">
            Parking Analytics Predictions
          </h3>

          {/* Turnover Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Turnover Rate</CardTitle>
              <CardDescription>
                How quickly spots become available again
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Average Turnover Time:</span>{" "}
                  {predictions.turnover_rate?.avg_turnover_time_hours ?? "N/A"}{" "}
                  hours
                </p>
                <p className="text-sm">
                  <span className="font-medium">Turnover Rate:</span>{" "}
                  {predictions.turnover_rate?.turnover_rate_per_day ?? "N/A"}{" "}
                  spots per day
                </p>
                <p className="text-sm text-gray-500">
                  Confidence:{" "}
                  {predictions.turnover_rate?.confidence
                    ? `${(predictions.turnover_rate.confidence * 100).toFixed(
                        0
                      )}%`
                    : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Visit Frequency */}
          <Card>
            <CardHeader>
              <CardTitle>Visit Frequency</CardTitle>
              <CardDescription>How often customers return</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">
                    Average Days Between Visits:
                  </span>{" "}
                  {predictions.visit_frequency?.avg_days_between_visits ??
                    "N/A"}{" "}
                  days
                </p>
                <p className="text-sm">
                  <span className="font-medium">Visits Per Month:</span>{" "}
                  {predictions.visit_frequency?.visits_per_month ?? "N/A"}{" "}
                  visits
                </p>
                <p className="text-sm text-gray-500">
                  Confidence:{" "}
                  {predictions.visit_frequency?.confidence
                    ? `${(predictions.visit_frequency.confidence * 100).toFixed(
                        0
                      )}%`
                    : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Availability Forecast */}
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Forecast</CardTitle>
              <CardDescription>
                Predicted occupancy rates in the future
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(predictions.availability).map(
                  ([timeframe, data]) => (
                    <div
                      key={timeframe}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm font-medium">{timeframe}:</span>
                      <div className="text-right">
                        <p className="text-sm">
                          {data.occupancy_rate}% occupancy
                        </p>
                        <p className="text-xs text-gray-500">
                          Confidence: {(data.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Peak Hours</CardTitle>
              <CardDescription>
                When lots will be at maximum capacity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {predictions.peak_hours.map((peak, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm font-medium">
                      {formatHour(peak.hour)}:
                    </span>
                    <div className="text-right">
                      <p className="text-sm">
                        {peak.occupancy_rate}% occupancy
                      </p>
                      <p className="text-xs text-gray-500">
                        Confidence: {(peak.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
