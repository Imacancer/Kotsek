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
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import axios from "axios";
import ParkingSlotsComponent, { ParkingSlot } from "@/components/ParkingSlot";
import UnassignedVehiclesTable from "@/components/Unassigned";

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface PlateDetection {
  label: string;
  confidence: number;
  coordinates: number[];
  ocr_text: string;
}

interface Detection {
  label: string;
  confidence: number;
  coordinates: number[];
  color_annotation: string;
  plates: PlateDetection[];
}

interface User {
  id: number;
  email: string;
  username: string;
  profile_image: string | null;
}

interface EntryDetectionData {
  vehicleType: string;
  plateNumber: string;
  colorAnnotation: string;
  ocrText: string;
  annotationLabel: number;
}

interface VideoFrameData {
  entrance_frame: string;
  entrance_detections: Detection[];
}

const SurveillanceInterface = () => {
  const entryVideoRef = useRef<HTMLImageElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("0");
  const [enabled, setEnabled] = useState(false);
  const socket = useRef<Socket | null>(null);

  const [debugInfo, setDebugInfo] = useState({
    lastError: "",
    socketStatus: "disconnected",
    authStatus: "checking",
  });
  const router = useRouter();

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  // Parking monitoring state
  const [parkingData, setParkingData] = useState<ParkingSlot[]>([]);

  const [entryDetectionData, setEntryDetectionData] =
    useState<EntryDetectionData>({
      vehicleType: "",
      plateNumber: "",
      colorAnnotation: "",
      ocrText: "",
      annotationLabel: 0,
    });

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

  useEffect(() => {
    // Function to handle OAuth callback response
    const handleOAuthCallback = (): boolean => {
      // Check URL search parameters first (this is how most OAuth callbacks work)
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const authProvider = searchParams.get("authProvider");

      if (token) {
        // Store access token
        sessionStorage.setItem("access_token", token);

        // If we have an auth provider, store that info
        if (authProvider) {
          sessionStorage.setItem("auth_provider", authProvider);
        }

        try {
          if (!token || token.split(".").length !== 3) {
            throw new Error("Invalid token format");
          }

          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

          // Check if the base64 string is valid before decoding
          if (!/^[A-Za-z0-9+/=]*$/.test(base64)) {
            throw new Error("Malformed base64 string in token");
          }

          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );

          const payload = JSON.parse(jsonPayload);

          if (payload) {
            const userData: User = {
              id: payload.sub || payload.id || payload.identity,
              email: payload.email,
              username: payload.firstName
                ? `${payload.firstName} ${payload.lastName || ""}`
                : payload.email,
              profile_image: payload.picture || null,
            };

            sessionStorage.setItem("user", JSON.stringify(userData));
            setDebugInfo((prev) => ({ ...prev, authStatus: "authenticated" }));
          }
        } catch {
          setDebugInfo((prev) => ({
            ...prev,
            lastError: "Invalid authentication token",
            authStatus: "failed",
          }));
          fetchUserData(token); // Fallback to API request
        }

        // Clean the URL to remove params
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        // Show success toast
        toast(
          `Successfully signed in${
            authProvider ? ` with ${authProvider}` : ""
          }`,
          {
            description: "Welcome to KoTsek!",
          }
        );

        return true;
      }

      return false;
    };

    // Check for OAuth callback response when component mounts
    handleOAuthCallback();

    // Handle error parameters
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("error")) {
      // Clean the URL
      const errorMsg = searchParams.get("error") || "Authentication failed";
      setDebugInfo((prev) => ({
        ...prev,
        lastError: errorMsg,
        authStatus: "failed",
      }));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [router]);

  // Function to fetch user data with token
  const fetchUserData = async (token: string) => {
    try {
      const response = await axios.get(`${SERVER_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Store user data if successful
      if (response.data) {
        sessionStorage.setItem("user", JSON.stringify(response.data));
        setDebugInfo((prev) => ({ ...prev, authStatus: "authenticated" }));
      }
    } catch {
      setDebugInfo((prev) => ({
        ...prev,
        lastError: "Failed to fetch user data",
        authStatus: "failed",
      }));
      // On failure, redirect to login
      router.replace("/login");
    }
  };

  useEffect(() => {
    const checkAuthentication = () => {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        // Verify the token is valid JWT
        const tokenParts = token.split(".");
        if (tokenParts.length !== 3) {
          throw new Error("Invalid token format");
        }

        // Decode and check token expiration
        const base64Url = tokenParts[1];
        let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if necessary
        while (base64.length % 4) {
          base64 += "=";
        }
        const payload = JSON.parse(atob(base64));

        if (payload.exp && payload.exp * 1000 < Date.now()) {
          throw new Error("Token expired");
        }

        // Fetch or set user data
        const storedUserData = sessionStorage.getItem("user");
        if (storedUserData) {
          setDebugInfo((prev) => ({ ...prev, authStatus: "authenticated" }));
        } else {
          fetchUserData(token);
        }
      } catch {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("user");
        setDebugInfo((prev) => ({
          ...prev,
          lastError: "Authentication failed",
          authStatus: "failed",
        }));
        toast.error("Authentication failed. Please login again.");
        router.replace("/login");
      }
    };

    checkAuthentication();
  }, [router]);

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

  // Initialize parking data
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
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  useEffect(() => {
    const startVideo = () => {
      try {
        socket.current = io(`${SERVER_URL}`, {
          reconnection: true,
          reconnectionAttempts: 5,
          timeout: 10000,
        });

        socket.current.on("connect", () => {
          console.log("Socket connected successfully");
          setDebugInfo((prev) => ({ ...prev, socketStatus: "connected" }));
          socket.current?.emit("start_video", { camera_index: selectedCamera });
        });

        socket.current.on("connect_error", (socketError: Error) => {
          console.error("Socket connection error:", socketError);
          setDebugInfo((prev) => ({
            ...prev,
            socketStatus: "error",
            lastError: `Socket error: ${socketError.message}`,
          }));
        });

        socket.current.on("video_frame", (data: VideoFrameData) => {
          if (!data) {
            console.error("No data received");
            return;
          }

          // Assign entrance frame
          if (data?.entrance_frame && entryVideoRef.current) {
            entryVideoRef.current.src = `data:image/jpeg;base64,${data.entrance_frame}`;
          }

          // Process entrance detections
          if (data.entrance_detections?.length > 0) {
            const mostConfidentDetection = data.entrance_detections.reduce(
              (prev, current) =>
                current.confidence > prev.confidence ? current : prev
            );

            console.log("Detected Vehicle:", mostConfidentDetection.label);
            console.log("Detected Plates:", mostConfidentDetection.plates);
            console.log(
              "Detected Color:",
              mostConfidentDetection.color_annotation
            );

            console.log(
              "Detected OCR Text:",
              mostConfidentDetection.plates.map((plate) => plate.ocr_text)
            );

            setEntryDetectionData({
              vehicleType: determineVehicleType(mostConfidentDetection.label),
              plateNumber:
                mostConfidentDetection.plates
                  .map((plate) => plate.label)
                  .join(", ") || "Unknown Plate",
              colorAnnotation: mostConfidentDetection.color_annotation,
              ocrText:
                mostConfidentDetection.plates
                  .map((plate) => plate.ocr_text)
                  .join(", ") || "",
              annotationLabel: parseInt(mostConfidentDetection.label),
            });
          } else {
            setEntryDetectionData({
              vehicleType: "No detection",
              plateNumber: "N/A",
              colorAnnotation: "N/A",
              ocrText: "",
              annotationLabel: 0,
            });
          }
        });

        socket.current.on("video_error", (data: { error: string }) => {
          console.error("Video error:", data.error);
          stopVideo();
        });
      } catch (error) {
        console.error("Error in startVideo:", error);
      }
    };

    startVideo();

    // Clean up function
    return () => {
      console.log("Cleaning up video connection...");
      stopVideo();
    };
  }, [selectedCamera, SERVER_URL]);

  const stopVideo = () => {
    if (socket.current) {
      socket.current.emit("stop_video");
      socket.current.disconnect();
      socket.current = null;
    }
    if (entryVideoRef.current) {
      entryVideoRef.current.src = "";
    }
    setEnabled(false);
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

          <span className="text-xs text-gray-500">
            Socket: {debugInfo.socketStatus}
          </span>
        </div>

        {/* Entry Video Stream - Larger, Full Width */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entry Stream</CardTitle>
          </CardHeader>
          <CardContent className="relative w-full h-[700px] bg-gray-50 rounded-lg overflow-hidden">
            <img
              ref={entryVideoRef}
              alt="Camera Stream"
              className="w-full h-full object-contain"
            />
          </CardContent>
        </Card>

        {/* Statistics Cards (Entry Detections) */}
        <div className="grid grid-cols-3 gap-4 mt-6">
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
              <p className="text-lg font-bold">{entryDetectionData.ocrText}</p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Detected Color
              </p>
              <div className="flex items-center space-x-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-400"
                  style={{
                    backgroundColor:
                      entryDetectionData.colorAnnotation || "#ffffff",
                  }}
                />
                <p
                  className="text-lg font-bold"
                  style={{ color: entryDetectionData.colorAnnotation }}
                >
                  {entryDetectionData.colorAnnotation}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <UnassignedVehiclesTable />

        {/* Parking Slots Section - Now Full Width below entry stream */}
        <Card className="w-full mt-6">
          <CardHeader>
            <CardTitle>Parking Slots Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col space-y-6">
              {/* Parking Slots Visual Component */}
              <ParkingSlotsComponent
                parkingData={parkingData}
                totalSpaces={totalSpaces}
                occupiedSpaces={occupiedSpaces}
                reservedSpaces={reservedSpaces}
                vacantSpaces={vacantSpaces}
                capacityStatus={capacityStatus}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SurveillanceInterface;
