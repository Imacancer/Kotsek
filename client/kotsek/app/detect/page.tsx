"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Play, Square, Camera } from "lucide-react";
import { io } from "socket.io-client";

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface Detection {
  label: string;
  confidence: number;
  coordinates: number[][];
  ocr_text: string;
}

interface ParkingSlot {
  id: number;
  status: "available" | "occupied" | "reserved";
}

const SurveillanceInterface = () => {
  const entryVideoRef = useRef<HTMLImageElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("0");
  const [enabled, setEnabled] = useState(false);
  const socket = useRef<any>(null);

  // Parking monitoring state static lang
  const [parkingData, setParkingData] = useState<ParkingSlot[]>([]);

  const [entryDetectionData, setEntryDetectionData] = useState({
    vehicleType: "",
    plateNumber: "",
    carBrand: "",
    ocrText: "",
    annotationLabel: 0,
  });

  const [debugInfo, setDebugInfo] = useState({
    lastDetection: null as Detection | null,
    receivedFrame: false,
    error: "",
  });

  const determineVehicleType = (label: string | number): string => {
    const numericLabel = typeof label === "string" ? parseInt(label) : label;

    if (numericLabel === 5 || numericLabel === 15) {
      return "Car";
    } else if (numericLabel === 10) {
      return "Motorcycle";
    } else {
      return "Bicycle";
    }
  };

  // Calculate parking summary statistics
  const totalSpaces = parkingData.length;
  const occupiedSpaces = parkingData.filter(
    (slot) => slot.status === "occupied"
  ).length;
  const reservedSpaces = parkingData.filter(
    (slot) => slot.status === "reserved"
  ).length;
  const vacantSpaces = totalSpaces - occupiedSpaces - reservedSpaces;
  const capacityStatus =
    occupiedSpaces === totalSpaces
      ? "Full Capacity"
      : occupiedSpaces > totalSpaces * 0.8
      ? "Near Full"
      : "Available";

  const ParkingSlot = ({
    id,
    status,
  }: {
    id: number;
    status: "available" | "occupied" | "reserved";
  }) => (
    <div
      className={`
        w-24 h-32 border-2 rounded-md flex items-center justify-center font-bold
        ${
          status === "occupied"
            ? "bg-red-200 border-red-500"
            : status === "reserved"
            ? "bg-yellow-200 border-yellow-500"
            : "bg-green-200 border-green-500"
        }
      `}
    >
      {id}
    </div>
  );

  useEffect(() => {
    const initialData = Array(15)
      .fill(null)
      .map((_, index) => ({
        id: index + 1,
        status: ["available", "occupied", "reserved"][
          Math.floor(Math.random() * 3)
        ] as "available" | "occupied" | "reserved",
      }));
    setParkingData(initialData);
  }, []);

  const fetchCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: index.toString(),
          label: device.label || `Camera ${index + 1}`,
        }));
      setDevices(videoDevices);
    } catch (err) {
      console.error("Error fetching cameras:", err);
      setDebugInfo((prev) => ({
        ...prev,
        error: "Camera fetch error: " + err,
      }));
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const startVideo = () => {
    try {
      socket.current = io("http://localhost:5001", {
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      socket.current.on("connect", () => {
        console.log("Socket connected successfully");
        socket.current.emit("start_video", { camera_index: selectedCamera });
      });

      socket.current.on("connect_error", (error: any) => {
        console.error("Socket connection error:", error);
        setDebugInfo((prev) => ({
          ...prev,
          error: "Connection error: " + error,
        }));
      });

      socket.current.on(
        "video_frame",
        (data: {
          entrance_frame: string;
          entrance_detections: Detection[];
        }) => {
          if (!data) {
            console.error("No data received");
            return;
          }

          // Assign entrance frame
          if (data.entrance_frame && entryVideoRef.current) {
            entryVideoRef.current.src = `data:image/jpeg;base64,${data.entrance_frame}`;
          }

          // Process entrance detections
          if (data.entrance_detections?.length > 0) {
            const mostConfidentDetection = data.entrance_detections.reduce(
              (prev, current) =>
                current.confidence > prev.confidence ? current : prev
            );

            setEntryDetectionData({
              vehicleType: determineVehicleType(mostConfidentDetection.label),
              plateNumber: mostConfidentDetection.ocr_text || "UVV 2443",
              carBrand: `Conf: ${(
                mostConfidentDetection.confidence * 100
              ).toFixed(1)}%`,
              ocrText: mostConfidentDetection.ocr_text,
              annotationLabel: parseInt(mostConfidentDetection.label),
            });
          } else {
            setEntryDetectionData({
              vehicleType: "No detection",
              plateNumber: "N/A",
              carBrand: "N/A",
              ocrText: "",
              annotationLabel: 0,
            });
          }

          setDebugInfo((prev) => ({ ...prev, receivedFrame: true }));
        }
      );

      socket.current.on("video_error", (data: { error: string }) => {
        console.error("Video error:", data.error);
        setDebugInfo((prev) => ({
          ...prev,
          error: "Video error: " + data.error,
        }));
        stopVideo();
      });
    } catch (error) {
      console.error("Error in startVideo:", error);
      setDebugInfo((prev) => ({
        ...prev,
        error: "Start video error: " + error,
      }));
    }
  };

  const stopVideo = () => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
    if (entryVideoRef.current) {
      entryVideoRef.current.src = "";
    }
    setEnabled(false);
    setDebugInfo({
      lastDetection: null,
      receivedFrame: false,
      error: "",
    });
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[90%] mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Detect Vehicles</h1>
        <div className="flex items-center gap-4 mb-4">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-[200px]">
              <Camera className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={enabled ? "destructive" : "default"}
            onClick={() => {
              if (enabled) {
                stopVideo();
              } else {
                setEnabled(true);
                startVideo();
              }
            }}
          >
            {enabled ? (
              <>
                <Square className="w-4 h-4 mr-2" /> Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Start
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entry Video Stream */}
          <Card>
            <CardHeader>
              <CardTitle>Entry Stream</CardTitle>
            </CardHeader>
            <CardContent className="relative w-full h-[600px] bg-gray-50 rounded-lg overflow-hidden">
              <img
                ref={entryVideoRef}
                alt="Camera Stream"
                className="w-full h-full object-contain"
              />
            </CardContent>
          </Card>

          {/* Parking Slots */}
          <Card>
            <CardHeader>
              <CardTitle>Parking Slots</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-5 gap-4">
                {parkingData.map((slot) => (
                  <ParkingSlot
                    key={slot.id}
                    id={slot.id}
                    status={slot.status}
                  />
                ))}
              </div>

              {/* Legend Section */}
              <div className="mt-6 flex items-center justify-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded-sm"></div>
                  <span className="text-sm text-gray-600">Vacant</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-200 border-2 border-red-500 rounded-sm"></div>
                  <span className="text-sm text-gray-600">Occupied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-200 border-2 border-yellow-500 rounded-sm"></div>
                  <span className="text-sm text-gray-600">Reserved</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Statistics Cards (Entry Detections) */}
        <div className="grid grid-cols-3 gap-4 mt-[100px]">
          {/* Entry Detection Cards */}
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Entry/Exit Vehicle Type
              </p>
              <p className="text-lg font-bold">
                {entryDetectionData.vehicleType}
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Entry/Exit Plate Number
              </p>
              <p className="text-lg font-bold">
                {entryDetectionData.plateNumber}
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Entry/Exit Confidence
              </p>
              <p className="text-lg font-bold">{entryDetectionData.carBrand}</p>
            </CardContent>
          </Card>
        </div>
        {/* Parking Statistics Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-lg font-bold">{vacantSpaces}</p>
              <p className="text-xs text-gray-500">empty slots</p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-gray-500">Reserved</p>
              <p className="text-lg font-bold">{reservedSpaces}</p>
              <p className="text-xs text-gray-500">reserved slots</p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-gray-500">Occupied</p>
              <p className="text-lg font-bold">{occupiedSpaces}</p>
              <p className="text-xs text-gray-500">in use</p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-lg font-bold">{capacityStatus}</p>
              <p className="text-xs text-gray-500">
                {Math.round((occupiedSpaces / totalSpaces) * 100)}% occupied
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SurveillanceInterface;
