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
  BarChart,
  Bar,
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
  const [hourlyPrediction, setHourlyPrediction] = useState<
    { hour_group: string; predicted_entries: number }[]
  >([]);
  const [turnoverTrend, setTurnoverTrend] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<
    Record<string, Record<string, number>>
  >({});

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
  const fetchHourlyPrediction = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      const response = await fetch(`${SERVER_URL}/reg/traffic/arima-forecast`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setHourlyPrediction(data);
      console.log("Hourly ARIMA data:", data);
    } catch (error) {
      console.error("Failed to fetch hourly prediction", error);
    }
  };

  useEffect(() => {
    fetchHourlyPrediction();
  }, []);

  const fetchHeatmap = async () => {
    const token = sessionStorage.getItem("access_token");
    const res = await fetch(`${SERVER_URL}/reg/heatmap`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setHeatmapData(data);
  };

  const fetchTurnoverTrend = async () => {
    const token = sessionStorage.getItem("access_token");
    const res = await fetch(`${SERVER_URL}/reg/turnover/trend`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTurnoverTrend(data);
  };

  useEffect(() => {
    fetchHeatmap();
    fetchTurnoverTrend();
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
    const graphData = data.data.map((item) => ({
      timestamp: `${item.date} ${String(item.hour).padStart(2, "0")}:00`,
      entries: item.entries,
      exits: item.exits,
    }));

    return (
      <div className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={graphData}
            margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              label={{ value: "Vehicles", angle: -90, position: "insideLeft" }}
            />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#4ade80"
              name="Entries"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="exits"
              stroke="#f87171"
              name="Exits"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* <Card>
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
          {trafficPrediction && (
            <div className="mt-4 h-[300px] md:h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderTrafficGraph(trafficPrediction)}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* Predictions Section */}
      {predictions && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">
            Parking Analytics Predictions
          </h3>
          <p className="text-sm md:text-base">
            View and analyze parking traffic patterns for {currentMonth}
          </p>
          {/* Hourly Traffic Prediction */}
          <Card>
            <CardHeader>
              <CardTitle>Predicted Hourly Traffic</CardTitle>
              <CardDescription>
                Estimated average number of entries per hour (6 AM - 10 PM)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={hourlyPrediction.filter((item) =>
                    [
                      "06:00–09:00",
                      "09:00–12:00",
                      "12:00–15:00",
                      "15:00–18:00",
                      "18:00–21:00",
                    ].includes(item.hour_group)
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour_group"
                    label={{
                      value: "Time Range",
                      position: "insideBottom",
                      offset: -5,
                    }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tickFormatter={(value) => Math.floor(value).toString()}
                    allowDecimals={false}
                    label={{
                      value: "Predicted Entries",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(val: number) => [
                      `${val.toFixed(2)} vehicles`,
                      "Predicted",
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="predicted_entries"
                    stroke="#4f46e5"
                    name="Predicted Entries"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* heat */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic Heatmap</CardTitle>
              <CardDescription>
                Vehicle entries per hour across days
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs border border-gray-300">
                <thead>
                  <tr>
                    <th className="p-1 border">Day/Hour</th>
                    {Array.from({ length: 24 }, (_, h) => (
                      <th key={h} className="p-1 border">
                        {String(h).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(heatmapData).map(([day, hours]) => {
                    const hourData = hours as Record<string, number>;

                    // Get the max value for this row to normalize color intensity
                    const max = Math.max(...Object.values(hourData), 1); // prevent divide-by-zero

                    return (
                      <tr key={day}>
                        <td className="p-1 border">{day}</td>
                        {Array.from({ length: 24 }, (_, h) => {
                          const count = hourData[h.toString()] ?? 0;

                          // Normalize between 0–1 for opacity or color scale
                          const intensity = Math.min(count / max, 1);

                          const bgColor = `rgba(34, 197, 94, ${intensity})`; // greenish gradient

                          return (
                            <td
                              key={h}
                              title={`${count} entries`}
                              className="p-1 border text-center"
                              style={{ backgroundColor: bgColor }}
                            >
                              &nbsp;
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {Object.keys(heatmapData).length > 0 &&
                (() => {
                  const maxCount = Math.max(
                    ...Object.values(heatmapData).flatMap((d) =>
                      Object.values(d as Record<string, number>)
                    )
                  );

                  return (
                    <div className="mt-4">
                      <p className="text-xs text-gray-600 mb-1">
                        Legend (Entries per hour):
                      </p>
                      <div className="relative h-4 w-full max-w-md bg-gradient-to-r from-green-100 to-green-600 rounded">
                        <div className="absolute left-0 -bottom-5 text-[10px] text-gray-700">
                          0
                        </div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-5 text-[10px] text-gray-700">
                          {Math.round(maxCount / 2)}
                        </div>
                        <div className="absolute right-0 -bottom-5 text-[10px] text-gray-700">
                          {maxCount}
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={Object.entries(predictions.availability).map(
                    ([key, value]) => ({
                      timeframe: key.replace("_", " "),
                      occupancy: value.occupancy_rate,
                      confidence: (value.confidence * 100).toFixed(0),
                    })
                  )}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeframe" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      if (name === "Occupancy %") {
                        const confidence = props.payload.confidence;
                        return [
                          `${value}% (Conf: ${confidence}%)`,
                          "Occupancy",
                        ];
                      }
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="occupancy" fill="#34d399" name="Occupancy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Turnover Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Turnover Rate Trend</CardTitle>
              <CardDescription>
                How quickly slots become available each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={turnoverTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_turnover_time"
                    stroke="#6366f1"
                    name="Avg Time (hrs)"
                  />
                  <Line
                    type="monotone"
                    dataKey="turnover_rate"
                    stroke="#22c55e"
                    name="Rate per Day"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
