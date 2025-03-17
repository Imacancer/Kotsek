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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import axios from "axios";

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

interface Detection {
  label: string;
  confidence: number;
  color_annotation: string;
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
  const [user, setUser] = useState<{
    id: number;
    email: string;
    username: string;
    profile_image: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const router = useRouter();

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const LOCAL_URL = process.env.NEXT_PUBLIC_URL;

  // Parking monitoring state static lang
  const [parkingData, setParkingData] = useState<ParkingSlot[]>([]);

  const [entryDetectionData, setEntryDetectionData] = useState({
    vehicleType: "",
    plateNumber: "",
    //carBrand: "",
    colorAnnotation: "",
    ocrText: "",
    annotationLabel: 0,
  });

  const [debugInfo, setDebugInfo] = useState({
    lastDetection: null as Detection | null,
    receivedFrame: false,
    error: "",
  });

  useEffect(() => {
    // Function to handle OAuth callback response
    const handleOAuthCallback = () => {
      // Check URL search parameters first (this is how most OAuth callbacks work)
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const authProvider = searchParams.get("authProvider");

      console.log("Token from URL:", token);
      console.log("Auth provider from URL:", authProvider);

      if (token) {
        // Store access token
        sessionStorage.setItem("access_token", token);
        console.log("Token stored in session:", token);

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
          console.log("JWT payload:", payload);

          if (payload) {
            const userData = {
              id: payload.sub || payload.id || payload.identity,
              email: payload.email,
              username: payload.firstName
                ? `${payload.firstName} ${payload.lastName || ""}`
                : payload.email,
              profile_image: payload.picture || null,
            };

            sessionStorage.setItem("user", JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            console.log("User data stored:", userData);
            console.log("Received Token:", token);
          }
        } catch (e) {
          console.error("Error parsing JWT token:", e);
          setError("Invalid authentication token.");
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
    const callbackHandled = handleOAuthCallback();

    // Add this debug line
    console.log("Callback handled:", callbackHandled);

    // Function to fetch user data with token
    const fetchUserData = async (token: any) => {
      try {
        const response = await axios.get(`${SERVER_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Store user data if successful
        if (response.data) {
          sessionStorage.setItem("user", JSON.stringify(response.data));
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to fetch user data");
      }
    };

    // Handle error parameters
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("error")) {
      setError(searchParams.get("error") || "Authentication failed");

      // Clean the URL
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
        setUser(response.data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setError("Failed to fetch user data");
      // On failure, redirect to login
      router.replace("/login");
    }
  };

  useEffect(() => {
    const checkAuthentication = () => {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        console.log("No token found, redirecting to login");
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
          setUser(JSON.parse(storedUserData));
        } else {
          fetchUserData(token);
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error("Authentication error:", error);
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("user");
        toast.error("Authentication failed. Please login again.");
        router.replace("/login");
      } finally {
        setIsLoading(false);
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
      socket.current = io(`${SERVER_URL}`, {
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
          if (data?.entrance_frame && entryVideoRef.current) {
            entryVideoRef.current.src = `data:image/jpeg;base64,${data.entrance_frame}`;
          }

          // Process entrance detections
          if (data.entrance_detections?.length > 0) {
            const mostConfidentDetection = data.entrance_detections.reduce(
              (prev, current) =>
                current.confidence > prev.confidence ? current : prev
            );

            console.log("Detected OCR Text:", mostConfidentDetection.ocr_text);

            setEntryDetectionData({
              vehicleType: determineVehicleType(mostConfidentDetection.label),
              plateNumber: mostConfidentDetection.ocr_text || "NFP 8793",
              colorAnnotation: mostConfidentDetection.color_annotation,
              ocrText: mostConfidentDetection.ocr_text,
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
      socket.current.emit("stop_video");
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
