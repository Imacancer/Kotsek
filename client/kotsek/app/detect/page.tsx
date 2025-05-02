"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MotorcycleDialog from "@/components/MotorcycleDialog";
import BicycleDialog from "@/components/BicycleDialog";

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

interface ExitDetectionData {
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

interface ExitVideoFrameData {
  exit_frame: string;
  exit_detections: Detection[];
}

interface Guard {
  guard_id: string;
  name: string;
  contact: string;
}

interface SelectedSlot {
  id: string;
  slot_number: number;
  section: string;
  lot_id?: string;
  status?: string;
  current_vehicle_id?: string;
}

interface UnassignedVehicle {
  id: string;
  plate: string;
  type: string;
  color_annotation: string;
  entry_time: string;
  exit_time: string | null;
}

interface SpecialtyVehicleSlot {
  id: string;
  slot_number: number;
  status: "available" | "occupied" | "reserved";
  current_vehicle_id?: string;
  plate_number?: string;
}

const SurveillanceInterface = () => {
  const entryVideoRef = useRef<HTMLImageElement | null>(null);
  const exitVideoRef = useRef<HTMLImageElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("0");
  const [selectedExitCamera, setSelectedExitCamera] = useState<string>("0");
  const [enabled, setEnabled] = useState(false);
  const [exitEnabled, setExitEnabled] = useState(false);
  const socket = useRef<Socket | null>(null);
  const exitSocket = useRef<Socket | null>(null);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuard, setSelectedGuard] = useState<string>("");
  const [activeGuard, setActiveGuard] = useState<Guard | null>(null);
  const [parkingDataLeft, setParkingDataLeft] = useState<ParkingSlot[]>([]);
  const [parkingDataRight, setParkingDataRight] = useState<ParkingSlot[]>([]);
  const [parkingDataCenter, setParkingDataCenter] = useState<ParkingSlot[]>([]);
  const [parkingDataTop, setParkingDataTop] = useState<ParkingSlot[]>([]);
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [motorcycleData, setMotorcycleData] = useState<ParkingSlot[]>([]);
  const [bicycleData, setBicycleData] = useState<ParkingSlot[]>([]);
  const [showMotorcycleDialog, setShowMotorcycleDialog] = useState(false);
  const [showBicycleDialog, setShowBicycleDialog] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");
  const [unassignedVehicles, setUnassignedVehicles] = useState<
    UnassignedVehicle[]
  >([]);
  const [bikeLeftData, setBikeLeftData] = useState<SpecialtyVehicleSlot[]>([]);
  const [bikeRightData, setBikeRightData] = useState<SpecialtyVehicleSlot[]>(
    []
  );
  const [motorLotData, setMotorLotData] = useState<SpecialtyVehicleSlot[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [currentSpecialtySection, setCurrentSpecialtySection] =
    useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const [debugInfo, setDebugInfo] = useState({
    lastError: "",
    socketStatus: "disconnected",
    authStatus: "checking",
  });
  const router = useRouter();

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const EXIT_URL = process.env.NEXT_PUBLIC_SERVER_URL_V2;

  const [entryDetectionData, setEntryDetectionData] =
    useState<EntryDetectionData>({
      vehicleType: "",
      plateNumber: "",
      colorAnnotation: "",
      ocrText: "",
      annotationLabel: 0,
    });

  const [exitDetectionData, setExitDetectionData] = useState<ExitDetectionData>(
    {
      vehicleType: "",
      plateNumber: "",
      colorAnnotation: "",
      ocrText: "",
      annotationLabel: 0,
    }
  );

  const fetchGuards = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/guard/guards`);
      setGuards(response.data);
    } catch (error) {
      console.error("Error fetching guards:", error);
      toast.error("Failed to load guards");
    }
  };

  const getActiveGuard = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/guard/active-guard`);
      if (response.data.active_guard) {
        setActiveGuard(response.data.active_guard);
        setSelectedGuard(response.data.active_guard.id);
      }
    } catch (error) {
      console.error("Error fetching active guard:", error);
    }
  };

  // Add a function to set the active guard
  const handleSetActiveGuard = async () => {
    try {
      const response = await axios.post(
        `${SERVER_URL}/guard/set-active-guard`,
        {
          guard_id: selectedGuard || null,
        }
      );

      if (response.data.success) {
        setActiveGuard(response.data.active_guard);
        toast.success(response.data.message);
      } else {
        toast.error("Failed to set active guard");
      }
    } catch (error) {
      console.error("Error setting active guard:", error);
      toast.error("Failed to set active guard");
    }
  };

  // Add this to your existing useEffect hooks
  useEffect(() => {
    fetchGuards();
    getActiveGuard();
  }, [SERVER_URL]);

  const fetchParkingData = async () => {
    try {
      const response = await axios.get(
        `${SERVER_URL}/parking/get-parking-status`
      );

      if (response.data && response.data.success) {
        const data = response.data.data;
        const slots = data?.slots || {};

        // Handle car slots as before (unchanged)
        setParkingDataLeft(
          (slots.car?.left || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number: slot.plate_number || undefined,
            current_vehicle_id: slot.current_vehicle_id || undefined,
          }))
        );

        setParkingDataRight(
          (slots.car?.right || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number: slot.plate_number || undefined,
            current_vehicle_id: slot.current_vehicle_id || undefined,
          }))
        );

        setParkingDataCenter(
          (slots.car?.center || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number: slot.plate_number || undefined,
            current_vehicle_id: slot.current_vehicle_id || undefined,
          }))
        );

        setParkingDataTop(
          (slots.car?.top || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number: slot.plate_number || undefined,
            current_vehicle_id: slot.current_vehicle_id || undefined,
          }))
        );

        // Store motorcycle and bicycle data
        const motorcycles = (slots.motorcycle || []).map(
          (slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number: slot.plate_number || undefined,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            vehicle_type: "motorcycle",
          })
        );
        setMotorcycleData(motorcycles);

        // Map to motor lot data for detailed table view
        setMotorLotData(
          motorcycles.map((slot: ParkingSlot, index: number) => ({
            id: slot.id || `motor-${index + 1}`,
            slot_number: index + 1,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
          }))
        );

        // Inside fetchParkingData function
        const bicycles = (slots.bicycle || []).map((slot: ParkingSlot) => ({
          id: slot.id,
          slot_number: slot.slot_number,
          lot_id: slot.lot_id,
          status: slot.status,
          plate_number: slot.plate_number || undefined,
          current_vehicle_id: slot.current_vehicle_id || undefined,
          vehicle_type: "bicycle",
        }));
        setBicycleData(bicycles);

        const totalBikes = bicycles.length;
        const leftBikes = bicycles.slice(0, Math.ceil(totalBikes / 2));
        const rightBikes = bicycles.slice(Math.ceil(totalBikes / 2));

        setBikeLeftData(
          leftBikes.map((slot: ParkingSlot, index: number) => ({
            id: slot.id || `bike-left-${index + 1}`,
            slot_number: index + 1,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
          }))
        );

        setBikeRightData(
          rightBikes.map((slot: ParkingSlot, index: number) => ({
            id: slot.id || `bike-right-${index + 1}`,
            slot_number: index + 1,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching parking data:", error);
      toast.error("Failed to load parking data");
    }
  };

  const fetchUnassignedVehicles = () => {
    // Clean up any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create a new EventSource connection
      const eventSource = new EventSource(
        `${SERVER_URL}/api/unassigned-vehicles`
      );
      eventSourceRef.current = eventSource;

      // Handle incoming messages
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.success) {
          setUnassignedVehicles(data.data);
        } else {
          console.error("Error in SSE data:", data.error);
          toast.error("Failed to load unassigned vehicles");
        }
      };

      // Handle errors
      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource.close();
        eventSourceRef.current = null;
        toast.error(
          "Connection to unassigned vehicles feed lost. Reconnecting..."
        );

        // Attempt to reconnect after a delay
        setTimeout(() => fetchUnassignedVehicles(), 5000);
      };
    } catch (error) {
      console.error("Error setting up EventSource:", error);
      toast.error("Failed to connect to unassigned vehicles feed");
    }
  };

  useEffect(() => {
    fetchParkingData();
    fetchUnassignedVehicles();

    // Clean up function to close EventSource connection when component unmounts
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [SERVER_URL]);

  // Handle slot click
  // Update the handleSlotClick function
  // Update the handleSlotClick function
  const handleSlotClick = useCallback(
    (
      id: string,
      slot_number: number,
      section: string,
      lot_id?: string,
      status?: string,
      current_vehicle_id?: string,
      slots?: ParkingSlot[] // Add slots parameter
    ) => {
      // Handle specialty vehicle sections
      if (
        section === "bike area left" ||
        section === "bike area right" ||
        section === "elevated parking"
      ) {
        setCurrentSpecialtySection(section);

        if (section === "bike area left" || section === "bike area right") {
          setShowBicycleDialog(true);
          setSelectedVehicleType("bicycle");
        } else if (section === "elevated parking") {
          setShowMotorcycleDialog(true);
          setSelectedVehicleType("motorcycle");
        } else {
          setIsSlotDialogOpen(true);
        }

        // Reset selected vehicle when opening specialty dialog
        setSelectedVehicle(null);
        return;
      }

      // Handle regular parking slots
      const slotData = {
        id,
        slot_number,
        section,
        lot_id,
        status: status || "available",
        current_vehicle_id,
      };

      console.log("Selected Slot Data:", slotData);
      console.log("Selected Slot JSON:", JSON.stringify(slotData, null, 2));

      setSelectedSlot(slotData);
      setIsSlotDialogOpen(true);

      // Only reset selected vehicle if we're going to assign a new one
      if (status === "available" || !current_vehicle_id) {
        setSelectedVehicle(null);
      }
    },
    []
  );

  // Update the assignParkingSlot function to handle different section types
  // Update assignParkingSlot function
  const assignParkingSlot = async () => {
    if (!selectedSlot || !selectedVehicle) {
      toast.error("Please select both a slot and a vehicle");
      return;
    }

    try {
      // Determine the lot number based on section and ID
      let lotNumber = selectedSlot.lot_id || "";

      if (!lotNumber) {
        if (selectedSlot.section === "bike area left") {
          lotNumber = "PE1_Bike";
        } else if (selectedSlot.section === "bike arearight") {
          lotNumber = "PE2_Bike";
        } else if (selectedSlot.section === "elevated parking") {
          lotNumber = "Elevated_MCP";
        } else if (selectedSlot.section === "top") {
          lotNumber = `PE2_${selectedSlot.id}`;
        } else if (selectedSlot.section === "left") {
          lotNumber = `PE1_${selectedSlot.id}`;
        } else if (selectedSlot.section === "right") {
          lotNumber = `BLDG1_${selectedSlot.id}`;
        } else if (selectedSlot.section === "center-upper") {
          lotNumber = `CENTER1_${selectedSlot.id}`;
        } else if (selectedSlot.section === "center-lower") {
          lotNumber = `CENTER2_${selectedSlot.id}`;
        } else {
          lotNumber = `CENTER_${selectedSlot.id}`;
        }
      }

      const response = await axios.post(`${SERVER_URL}/parking/assign-slot`, {
        slot_id: selectedSlot.slot_number.toString(),
        slot_section: selectedSlot.section,
        entry_id: selectedVehicle,
        lot_id: lotNumber,
        vehicle_type: selectedVehicleType || undefined, // Add vehicle type for motorcycle/bicycle
      });

      if (response.data && response.data.success) {
        toast.success(response.data.message);
        setIsSlotDialogOpen(false);
        setShowMotorcycleDialog(false);
        setShowBicycleDialog(false);

        // Refresh data
        fetchParkingData();
        fetchUnassignedVehicles();
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle API errors
      } else if (error instanceof Error) {
        // Handle generic errors
        toast.error(error.message);
      } else {
        // Handle unknown error types
        toast.error("An unexpected error occurred");
      }
    }
  };

  const assignSpecialtySlot = async (slotId: string) => {
    if (!selectedVehicle) {
      toast.error("Please select a vehicle to assign");
      return;
    }

    try {
      // Find the correct slot object based on currentSpecialtySection
      let slotNumber = 0;
      let section = currentSpecialtySection;
      let lotId = "";

      // Match exact section name format from the data structures
      if (currentSpecialtySection === "bike area left") {
        const slot = bikeLeftData.find((s) => s.id === slotId);
        if (slot) {
          slotNumber = slot.slot_number;
          section = "bike area left"; // Exact section name from database
          lotId = "PE1_Bike";
        }
      } else if (currentSpecialtySection === "bike area right") {
        const slot = bikeRightData.find((s) => s.id === slotId);
        if (slot) {
          slotNumber = slot.slot_number;
          section = "bike area right"; // Exact section name from database
          lotId = "PE2_Bike";
        }
      } else if (currentSpecialtySection === "elevated parking") {
        const slot = motorLotData.find((s) => s.id === slotId);
        if (slot) {
          slotNumber = slot.slot_number;
          section = "elevated parking"; // Exact section name from database
          lotId = "Elevated_MCP";
        }
      }

      if (!slotNumber) {
        toast.error("Cannot find selected slot information");
        return;
      }

      console.log("Assigning specialty slot with data:", {
        slot_id: slotNumber.toString(),
        slot_section: section,
        entry_id: selectedVehicle,
        lot_id: lotId,
        vehicle_type: selectedVehicleType,
      });

      const response = await axios.post(`${SERVER_URL}/parking/assign-slot`, {
        slot_id: slotNumber.toString(),
        slot_section: section,
        entry_id: selectedVehicle,
        lot_id: lotId,
        vehicle_type: selectedVehicleType,
      });

      if (response.data && response.data.success) {
        toast.success(response.data.message);
        setShowBicycleDialog(false);
        setShowMotorcycleDialog(false);

        // Refresh data
        fetchParkingData();
        fetchUnassignedVehicles();
      } else {
        toast.error(response.data?.message || "Failed to assign slot");
      }
    } catch (error) {
      console.error("Error in assignSpecialtySlot:", error);

      if (axios.isAxiosError(error)) {
        console.error("API Error Response:", error.response?.data);
        toast.error(error.response?.data?.message || "API error occurred");
      } else if (error instanceof Error) {
        console.error("Error details:", error);
        toast.error(error.message);
      } else {
        console.error("Unknown error:", error);
        toast.error("An unexpected error occurred");
      }
    }
  };

  const releaseSpecialtySlot = async (slotId: string) => {
    try {
      // Find the slot information based on currentSpecialtySection
      let slotNumber = 0;
      let section = currentSpecialtySection; // Use the exact section name
      let slotData = null;

      if (currentSpecialtySection === "bike area left") {
        slotData = bikeLeftData.find((s) => s.id === slotId);
      } else if (currentSpecialtySection === "bike area right") {
        slotData = bikeRightData.find((s) => s.id === slotId);
      } else if (currentSpecialtySection === "elevated parking") {
        slotData = motorLotData.find((s) => s.id === slotId);
      }

      if (!slotData) {
        toast.error("Cannot find selected slot information");
        return;
      }

      // Extract the slot number
      slotNumber = slotData.slot_number;

      console.log("Releasing specialty slot with data:", {
        id: slotId,
        slot_number: slotNumber,
        section: section, // Using exact section name from database
      });

      // Make API request to release the slot
      const response = await axios.post(`${SERVER_URL}/parking/release-slot`, {
        id: slotId,
        slot_number: slotNumber.toString(),
        section: section,
      });

      if (response.data && response.data.success) {
        toast.success(response.data.message);
        // Refresh parking data to reflect changes
        fetchParkingData();
      } else {
        toast.error(response.data?.message || "Failed to release slot");
      }
    } catch (error) {
      console.error("Error in releaseSpecialtySlot:", error);

      if (axios.isAxiosError(error)) {
        console.error("API Error Response:", {
          status: error.response?.status,
          data: error.response?.data,
        });
        toast.error(error.response?.data?.message || "API error occurred");
      } else if (error instanceof Error) {
        console.error("Error details:", error.message);
        toast.error(error.message);
      } else {
        console.error("Unknown error:", error);
        toast.error("An unexpected error occurred");
      }
    }
  };

  // Update releaseParkingSlot function
  const releaseParkingSlot = async () => {
    if (!selectedSlot) {
      toast.error("Invalid slot selected");
      return;
    }

    // // Get the slot_id value (either from lot_id or selecting appropriately)
    // const slotIdToRelease = selectedSlot.lot_id || selectedSlot.id.toString();

    try {
      const response = await axios.post(`${SERVER_URL}/parking/release-slot`, {
        id: selectedSlot.id.toString(),
        section: selectedSlot.section,
      });

      console.log("selectedSlot id:", selectedSlot.id);

      if (response.data && response.data.success) {
        toast.success(response.data.message);
        setIsSlotDialogOpen(false);

        // Refresh data
        fetchParkingData();
      }
    } catch (error) {
      console.error("Error in releaseSpecialtySlot:", error);

      if (axios.isAxiosError(error)) {
        console.error("API Error Response:", {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
        });
        toast.error(error.response?.data?.message || "API error occurred");
      } else if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        toast.error(error.message);
      } else {
        console.error("Unknown error:", error);
        toast.error("An unexpected error occurred");
      }
    }
  };

  const motorcycleSpaces = motorcycleData.length;
  const occupiedMotorcycleSpaces = motorcycleData.filter(
    (slot) => slot.status === "occupied"
  ).length;
  const reservedMotorcycleSpaces = motorcycleData.filter(
    (slot) => slot.status === "reserved"
  ).length;
  const vacantMotorcycleSpaces =
    motorcycleSpaces - occupiedMotorcycleSpaces - reservedMotorcycleSpaces;

  // Add bicycle stats calculation
  const bicycleSpaces = bicycleData.length;
  const occupiedBicycleSpaces = bicycleData.filter(
    (slot) => slot.status === "occupied"
  ).length;
  const reservedBicycleSpaces = bicycleData.filter(
    (slot) => slot.status === "reserved"
  ).length;
  const vacantBicycleSpaces =
    bicycleSpaces - occupiedBicycleSpaces - reservedBicycleSpaces;

  // Initialize data on component mount
  useEffect(() => {
    fetchParkingData();
    fetchUnassignedVehicles();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchParkingData();
      fetchUnassignedVehicles();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [SERVER_URL]);

  const allParkingSlots = [
    ...parkingDataLeft,
    ...parkingDataRight,
    ...parkingDataCenter,
    ...parkingDataTop,
  ];
  const totalSpaces = allParkingSlots.length;
  const occupiedSpaces = allParkingSlots.filter(
    (slot) => slot.status === "occupied"
  ).length;
  const reservedSpaces = allParkingSlots.filter(
    (slot) => slot.status === "reserved"
  ).length;
  const vacantSpaces = totalSpaces - occupiedSpaces - reservedSpaces;
  const capacityStatus =
    occupiedSpaces === totalSpaces
      ? "Full Capacity"
      : occupiedSpaces > totalSpaces * 0.8
      ? "Near Full"
      : "Available";

  const filteredUnassignedVehicles = unassignedVehicles.filter((vehicle) => {
    if (selectedVehicleType === "motorcycle") {
      return (
        vehicle.type.toLowerCase().includes("motor") ||
        vehicle.type.toLowerCase().includes("motorcycle")
      );
    } else if (selectedVehicleType === "bicycle") {
      return (
        vehicle.type.toLowerCase().includes("bike") ||
        vehicle.type.toLowerCase().includes("bicycle")
      );
    }
    return true;
  });
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

  // const determineVehicleType = (label: string | number): string => {
  //   const numericLabel = typeof label === "string" ? parseInt(label) : label;

  //   if (numericLabel === 2 || numericLabel === 15) {
  //     return "Car";
  //   } else if (numericLabel === 10) {
  //     return "Motorcycle";
  //   } else {
  //     return "Bicycle";
  //   }
  // };

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

            // console.log(
            //   "Detected OCR Text:",
            //   mostConfidentDetection.plates.map((plate) => plate.ocr_text)
            // );

            const PlateNum =
              mostConfidentDetection.plates
                ?.map((plate) => plate.ocr_text)
                .join(", ") || "";

            setEntryDetectionData({
              vehicleType: mostConfidentDetection.label,
              plateNumber: PlateNum,
              colorAnnotation: mostConfidentDetection?.color_annotation,
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
      setEnabled(false);

      if (entryVideoRef.current) {
        entryVideoRef.current.src = "";
      }

      socket.current.emit("stop_video", null, () => {
        // Only disconnect after confirming the stop event was sent
        socket.current?.disconnect();
        socket.current = null;
      });
      socket.current.disconnect();
      socket.current = null;
    }
    if (entryVideoRef.current) {
      entryVideoRef.current.src = "";
    }
    setEnabled(false);
  };

  // Updated exit video connection (based on EntryStartVideo pattern)
  useEffect(() => {
    const startExitVideo = () => {
      console.log("useEffect triggered with exitEnabled:", exitEnabled);

      if (!exitEnabled) return;

      try {
        // Connect to the main socket without namespace specification
        exitSocket.current = io(`${EXIT_URL}`, {
          reconnection: true,
          reconnectionAttempts: 5,
          timeout: 10000,
        });

        exitSocket.current.on("connect", () => {
          console.log("Exit socket connected successfully");
          // Emit the start event to main namespace
          exitSocket.current?.emit("start_exit_video", {
            camera_index: selectedExitCamera,
          });
        });

        exitSocket.current.on("connect_error", (socketError: Error) => {
          console.error("Exit socket connection error:", socketError);
        });

        // Listen for frames on the main namespace
        exitSocket.current.on(
          "exit_video_frame",
          (data: ExitVideoFrameData) => {
            if (!data) {
              console.error("No exit data received");
              return;
            }

            // Assign exit frame
            if (data?.exit_frame && exitVideoRef.current) {
              exitVideoRef.current.src = `data:image/jpeg;base64,${data.exit_frame}`;
            }

            // Process exit detections - safely handle potential undefined values
            if (data.exit_detections && data.exit_detections.length > 0) {
              try {
                // Find most confident detection with safer filtering
                const mostConfidentDetection = data.exit_detections.reduce(
                  (prev, current) => {
                    if (!current) return prev;
                    if (!prev) return current;
                    return (current.confidence || 0) > (prev.confidence || 0)
                      ? current
                      : prev;
                  }
                );

                if (mostConfidentDetection) {
                  console.log(
                    "Exit Detected Vehicle:",
                    mostConfidentDetection.label
                  );

                  // Extract plate information safely
                  const plates = mostConfidentDetection.plates || [];
                  const plateText = Array.isArray(plates)
                    ? plates
                        .filter(Boolean)
                        .map((plate) => plate?.ocr_text || "")
                        .filter(Boolean)
                        .join(", ")
                    : "";

                  setExitDetectionData({
                    vehicleType: mostConfidentDetection.label || "Unknown",
                    plateNumber: plateText,
                    colorAnnotation:
                      mostConfidentDetection.color_annotation || "#FFFFFF",
                    ocrText: plateText,
                    annotationLabel:
                      typeof mostConfidentDetection.label === "number"
                        ? mostConfidentDetection.label
                        : 0,
                  });
                }
              } catch (error) {
                console.error("Error processing detection data:", error);
              }
            } else {
              setExitDetectionData({
                vehicleType: "No detection",
                plateNumber: "N/A",
                colorAnnotation: "N/A",
                ocrText: "",
                annotationLabel: 0,
              });
            }
          }
        );

        exitSocket.current.on("video_error", (data: { error: string }) => {
          console.error("Exit video error:", data.error);
          stopExitVideo();
        });

        // Add debug event to log all incoming events
        exitSocket.current.onAny((event, ...args) => {
          console.log(`[Exit Socket] Received event: ${event}`, args);
        });
      } catch (error) {
        console.error("Error in startExitVideo:", error);
      }
    };
    startExitVideo();

    // Clean up function
    return () => {
      console.log("Cleaning up video connection...");
      stopExitVideo();
    };
  }, [selectedExitCamera, SERVER_URL]);

  const stopExitVideo = useCallback(() => {
    try {
      if (exitSocket.current) {
        // Set exit enabled to false first
        setExitEnabled(false);

        // Clear the video frame
        if (exitVideoRef.current) {
          exitVideoRef.current.src = "";
        }

        // Emit stop event and wait briefly before disconnecting
        exitSocket.current.emit("stop_exit_video", null, () => {
          // Only disconnect after confirming the stop event was sent
          exitSocket.current?.disconnect();
          exitSocket.current = null;
        });
      }
    } catch (error) {
      console.error("Error stopping exit video:", error);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopVideo();
      stopExitVideo();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[90%] mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Detect Vehicles</h1>
        <div className="flex items-center gap-4 mb-4 mt-4">
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
                <Square className="w-4 h-4 mr-2" /> Stop Entry
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Start Entry
              </>
            )}
          </Button>

          <Select
            value={selectedExitCamera}
            onValueChange={setSelectedExitCamera}
          >
            <SelectTrigger className="w-[200px]">
              <Camera className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Exit Camera" />
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
            variant={exitEnabled ? "destructive" : "default"}
            onClick={() => {
              if (exitEnabled) {
                stopExitVideo();
              } else {
                setExitEnabled(true);
              }
            }}
          >
            {exitEnabled ? (
              <>
                <Square className="w-4 h-4 mr-2" /> Stop Exit
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Start Exit
              </>
            )}
          </Button>

          <Select value={selectedGuard} onValueChange={setSelectedGuard}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Guard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Guard</SelectItem>
              {guards.map((guard) => (
                <SelectItem key={guard.guard_id} value={guard.guard_id}>
                  {guard.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Button to Set Active Guard */}
          <Button variant="outline" onClick={handleSetActiveGuard}>
            Assign Guard
          </Button>

          {/* Active Guard Status */}
          {activeGuard && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Active Guard: {activeGuard.name}
            </span>
          )}

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
        {/* Exit Video Stream - Right Side */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Exit Stream</CardTitle>
          </CardHeader>
          <CardContent className="relative w-full h-[700px] bg-gray-50 rounded-lg overflow-hidden">
            <img
              ref={exitVideoRef}
              alt="Exit Camera Stream"
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
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Exit Vehicle Type
              </p>
              <p className="text-lg font-bold">
                {exitDetectionData.vehicleType}
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Exit Plate Number
              </p>
              <p className="text-lg font-bold">{exitDetectionData.ocrText}</p>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-medium text-gray-500">
                Exit Detected Color
              </p>
              <div className="flex items-center space-x-2">
                <div
                  className="w-6 h-6 rounded-full border border-gray-400"
                  style={{
                    backgroundColor:
                      exitDetectionData.colorAnnotation || "#ffffff",
                  }}
                />
                <p
                  className="text-lg font-bold"
                  style={{ color: exitDetectionData.colorAnnotation }}
                >
                  {exitDetectionData.colorAnnotation}
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
              <ParkingSlotsComponent
                parkingDataLeft={parkingDataLeft}
                parkingDataRight={parkingDataRight}
                parkingDataCenter={parkingDataCenter}
                parkingDataTop={parkingDataTop}
                parkingDataBikeLeft={parkingDataLeft}
                parkingDataBikeRight={parkingDataRight}
                parkingDataMotor={motorcycleData}
                totalSpaces={totalSpaces}
                occupiedSpaces={occupiedSpaces}
                vacantSpaces={vacantSpaces}
                reservedSpaces={reservedSpaces}
                capacityStatus={capacityStatus}
                onSlotClick={(
                  id,
                  number,
                  section,
                  lotId,
                  status,
                  vehicleId,
                  slots
                ) => {
                  // First set the current section
                  setCurrentSpecialtySection(section);

                  if (
                    section === "bike area left" ||
                    section === "bike area right"
                  ) {
                    // For bike areas, show bicycle dialog
                    setShowBicycleDialog(true);
                    setSelectedVehicleType("bicycle");
                    // Update the bike data based on section
                    if (section === "bike area left") {
                      setBikeLeftData(slots || []);
                      setBikeLeftData([]);
                    } else {
                      setBikeRightData(slots || []);
                      setBikeRightData([]);
                    }
                  } else if (section === "elevated parking") {
                    // For motor area, show motorcycle dialog
                    setShowMotorcycleDialog(true);
                    setSelectedVehicleType("motorcycle");
                    // Update motor lot data
                    setMotorLotData(slots || []);
                  } else {
                    // For car slots, set selected slot and show dialog
                    setSelectedSlot({
                      id,
                      slot_number: number,
                      section,
                      lot_id: lotId,
                      status: status || "available",
                      current_vehicle_id: vehicleId,
                    });
                    setIsSlotDialogOpen(true);
                  }

                  // Reset selected vehicle when opening any dialog
                  setSelectedVehicle(null);
                }}
              />
            </div>
          </CardContent>
        </Card>

        <MotorcycleDialog
          showDialog={showMotorcycleDialog}
          setShowDialog={setShowMotorcycleDialog}
          motorcycleSpaces={motorcycleSpaces}
          vacantMotorcycleSpaces={vacantMotorcycleSpaces}
          occupiedMotorcycleSpaces={occupiedMotorcycleSpaces}
          motorLotData={motorLotData}
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          unassignedVehicles={filteredUnassignedVehicles}
          onAssignSlot={assignSpecialtySlot}
          onReleaseSlot={releaseSpecialtySlot}
        />
        <BicycleDialog
          showDialog={showBicycleDialog}
          setShowDialog={setShowBicycleDialog}
          currentSection={
            currentSpecialtySection as "bike area left" | "bike area right"
          }
          setCurrentSection={setCurrentSpecialtySection}
          bikeData={
            currentSpecialtySection === "bike-left"
              ? bikeLeftData
              : bikeRightData
          }
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          unassignedVehicles={filteredUnassignedVehicles}
          onAssignSlot={assignSpecialtySlot}
          onReleaseSlot={releaseSpecialtySlot}
        />
        <Dialog open={isSlotDialogOpen} onOpenChange={setIsSlotDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedSlot?.section.includes("bike")
                  ? `Manage Bike Area ${
                      selectedSlot.section === "bike area left"
                        ? "Left"
                        : "Right"
                    }`
                  : selectedSlot?.section === "elevated parking"
                  ? "Manage Motor Parking Lot"
                  : `Manage Parking Slot ${selectedSlot?.lot_id}
                      ${selectedSlot?.section.toUpperCase()} ${
                      selectedSlot?.slot_number
                    }`}
              </DialogTitle>
            </DialogHeader>

            {selectedSlot && (
              <div className="space-y-4 py-4">
                {/* Check if the slot is occupied (has status "occupied" or has current_vehicle_id) */}
                {selectedSlot.status === "occupied" ||
                selectedSlot.current_vehicle_id ? (
                  // Show release option for occupied slots
                  <>
                    <p>
                      This{" "}
                      {selectedSlot.section.includes("bike")
                        ? "bike area"
                        : selectedSlot.section === "elevated parking"
                        ? "motor parking lot"
                        : "parking slot"}{" "}
                      is currently occupied.
                    </p>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsSlotDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={releaseParkingSlot}
                      >
                        Release Slot
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  // Show assignment options for available slots
                  <Tabs defaultValue="assign">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="assign">Assign Vehicle</TabsTrigger>
                      <TabsTrigger value="reserve">Reserve Slot</TabsTrigger>
                    </TabsList>

                    <TabsContent value="assign" className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          Select Unassigned Vehicle
                        </h3>
                        <select
                          className="w-full p-2 border rounded"
                          value={selectedVehicle || ""}
                          onChange={(e) => setSelectedVehicle(e.target.value)}
                        >
                          <option value="">Select a vehicle</option>
                          {unassignedVehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.plate} - {vehicle.type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsSlotDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={assignParkingSlot}>
                          Assign Vehicle
                        </Button>
                      </DialogFooter>
                    </TabsContent>

                    <TabsContent value="reserve" className="space-y-4">
                      <p>Reservation functionality not implemented yet.</p>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsSlotDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                      </DialogFooter>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SurveillanceInterface;
