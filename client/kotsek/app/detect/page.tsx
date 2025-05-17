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

export interface User {
  id: string; // Should be string to match backend UUID
  email: string;
  username?: string; // Keep if applicable
  profile_image: string | null; // Keep if applicable
  first_name?: string; // Optional, based on ParkingCustomer model
  last_name?: string; // Optional, based on ParkingCustomer model
  plate_number?: string; // Added: Include plate number from backend
  display_name_with_plate?: string; // Added: The formatted string for dropdown
  // Add any other properties your backend returns for a registered customer
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
  exit_frame?: string;
  exit_detections?: Detection[];
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
  reserved_for?: string; // UUID of customer if reserved
  // Added fields to store reserved customer details for display
  reserved_customer_name?: string;
  reserved_plate_number?: string;
}
interface SpecialtyVehicleSlot {
  id: string;
  slot_number: number;
  status: "available" | "occupied" | "reserved";
  current_vehicle_id?: string;
  plate_number?: string;
  section: string; // ✅ Add this
  lot_id: string;
  reserved_for?: string;
  reserved_customer_name?: string;
  reserved_plate_number?: string;
}
interface UnassignedVehicle {
  id: string;
  plate: string;
  type: string;
  color_annotation: string;
  entry_time: string;
  exit_time: string | null;
}
const getCustomerDisplayName = (customer: User): string => {
  if (customer.first_name || customer.last_name) {
    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  }
  return customer.username || customer.email || customer.id; // Fallback display
};

const SurveillanceInterface = () => {
  const [showCapacityAlert, setShowCapacityAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const lastAlertedVehicleType = useRef<string | null>(null);
  const checkParkingCapacityAlert = () => {
    const type = entryDetectionData.vehicleType.toLowerCase();
    let total = 0;
    let occupied = 0;

    if (type.includes("motorcycle")) {
      total = motorcycleData.length;
      occupied = motorcycleData.filter((s) => s.status === "occupied").length;
    } else if (type.includes("bike")) {
      total = bicycleData.length;
      occupied = bicycleData.filter((s) => s.status === "occupied").length;
    } else if (type.includes("car")) {
      total = allParkingSlots.length;
      occupied = allParkingSlots.filter((s) => s.status === "occupied").length;
    }

    const percent = (occupied / total) * 100;
    if (percent >= 95) {
      setAlertMessage(
        `The ${entryDetectionData.vehicleType} slots are ${percent.toFixed(
          0
        )}% full`
      );
      setShowCapacityAlert(true);
    }
  };

  const entryVideoRef = useRef<HTMLImageElement | null>(null);
  const exitVideoRef = useRef<HTMLImageElement | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("0");
  const [enabled, setEnabled] = useState(false);
  const socket = useRef<Socket | null>(null);
  console.log("Socket:", socket.current);
  const BASE_URL = "http://localhost:5001";
  useEffect(() => {
    socket.current = io(BASE_URL, {
      transports: ["polling", "websocket"], // ⬅️ Add "polling" as fallback
      reconnection: true,
    });

    socket.current.on("connect", () => {
      console.log("✅ Socket connected");
    });

    socket.current.on("connect_error", (err: Error) => {
      console.error("❌ Connect error:", err);
    });

    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  const [entryEnabled, setEntryEnabled] = useState(false);
  const [exitEnabled, setExitEnabled] = useState(false);
  const [motorcycleData, setMotorcycleData] = useState<ParkingSlot[]>([]);
  const [bicycleData, setBicycleData] = useState<ParkingSlot[]>([]);
  const [showMotorcycleDialog, setShowMotorcycleDialog] = useState(false);
  const [showBicycleDialog, setShowBicycleDialog] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");
  const [bikeLeftData, setBikeLeftData] = useState<SpecialtyVehicleSlot[]>([]);
  const [bikeRightData, setBikeRightData] = useState<SpecialtyVehicleSlot[]>(
    []
  );
  const [motorLotData, setMotorLotData] = useState<SpecialtyVehicleSlot[]>([]);
  const [exitDetectionData, setExitDetectionData] =
    useState<EntryDetectionData>({
      vehicleType: "",
      plateNumber: "",
      colorAnnotation: "",
      ocrText: "",
      annotationLabel: 0,
    });
  const [guards, setGuards] = useState<Guard[]>([]);
  const [selectedGuard, setSelectedGuard] = useState<string>("");
  const [activeGuard, setActiveGuard] = useState<Guard | null>(null);
  const [parkingDataLeft, setParkingDataLeft] = useState<ParkingSlot[]>([]);
  const [parkingDataRight, setParkingDataRight] = useState<ParkingSlot[]>([]);
  const [parkingDataCenter, setParkingDataCenter] = useState<ParkingSlot[]>([]);
  const [parkingDataTop, setParkingDataTop] = useState<ParkingSlot[]>([]);
  const [isSlotDialogOpen, setIsSlotDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [unassignedVehicles, setUnassignedVehicles] = useState<
    UnassignedVehicle[]
  >([]);
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
  console.log("➡️ Base URL:", SERVER_URL);
  const [entryDetectionData, setEntryDetectionData] =
    useState<EntryDetectionData>({
      vehicleType: "",
      plateNumber: "",
      colorAnnotation: "",
      ocrText: "",
      annotationLabel: 0,
    });
  // Add these new state variables for reservation

  const [registeredCustomers, setRegisteredCustomers] = useState<User[]>(
    [] as User[]
  );
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(
    null as string | null
  );
  const [searchPlate, setSearchPlate] = useState<string>("");
  const normalizePlate = (plate: string) =>
    plate.toLowerCase().replace(/\s/g, "");
  // To store the ID (UUID) of the selected customer
  const fetchGuards = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/guard/guards`);
      setGuards(response.data);
    } catch (error) {
      console.error("Error fetching guards:", error);
      toast.error("Failed to load guards");
    }
  };
  const fetchRegisteredCustomers = async () => {
    try {
      // Replace with your actual API endpoint for fetching registered users/customers
      // Assuming your backend has a /customer/registered-customers endpoint
      const response = await axios.get(
        `${SERVER_URL}/customer/registered-customers`
      );
      if (response.data?.success) {
        setRegisteredCustomers(response.data.data);
      } else {
        console.error(
          "Failed to fetch registered customers:",
          response.data?.message
        );
        toast.error("Failed to load registered customers");
      }
    } catch (error) {
      console.error("Error fetching registered customers:", error);
      toast.error("Failed to load registered customers");
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
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // This is the expected "no active guard" case, handle silently
          console.log("No active guard found - this is normal");
        } else {
          // This is an unexpected error, log it
          console.error(
            "Error fetching active guard:",
            error.response?.data || error.message
          );
        }
      } else {
        // Handle non-Axios errors
        console.error(
          "Unexpected error fetching active guard:",
          error instanceof Error ? error.message : String(error)
        );
      }
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
    fetchRegisteredCustomers();
  }, [SERVER_URL]);

  const fetchParkingData = async () => {
    try {
      const response = await axios.get(
        `${SERVER_URL}/parking/get-parking-status`
      );

      console.log("[fetchParkingData] Raw API Response Data:", response.data);

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
            plate_number:
              slot.status === "available" ? undefined : slot.plate_number,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            reserved_plate_number: slot.reserved_plate_number,
            reserved_for: slot.reserved_for,
            reserved_customer_name: slot.reserved_customer_name,
          }))
        );

        setParkingDataRight(
          (slots.car?.right || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number:
              slot.status === "available" ? undefined : slot.plate_number,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            reserved_plate_number: slot.reserved_plate_number,
            reserved_for: slot.reserved_for,
            reserved_customer_name: slot.reserved_customer_name,
          }))
        );

        setParkingDataCenter(
          (slots.car?.center || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number:
              slot.status === "available" ? undefined : slot.plate_number,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            reserved_plate_number: slot.reserved_plate_number,
          }))
        );

        setParkingDataTop(
          (slots.car?.top || []).map((slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number:
              slot.status === "available" ? undefined : slot.plate_number,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            reserved_plate_number: slot.reserved_plate_number,
            reserved_for: slot.reserved_for,
            reserved_customer_name: slot.reserved_customer_name,
          }))
        );

        // Store motorcycle and bicycle data
        const motorcycles = (slots.motorcycle || []).map(
          (slot: ParkingSlot) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            lot_id: slot.lot_id,
            status: slot.status,
            plate_number:
              slot.status === "available" ? undefined : slot.plate_number,
            current_vehicle_id: slot.current_vehicle_id || undefined,
            vehicle_type: "motorcycle",
          })
        );
        setMotorcycleData(motorcycles);

        // Map to motor lot data for detailed table view
        setMotorLotData(
          motorcycles.map((slot: ParkingSlot, index: number) => ({
            id: slot.id || `motor-${index + 1}`,
            slot_number: slot.slot_number,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
            section: "elevated parking",
            lot_id: "Elevated_MCP",
          }))
        );

        // Inside fetchParkingData function
        const bicycles = (slots.bicycle || []).map((slot: ParkingSlot) => ({
          id: slot.id,
          slot_number: slot.slot_number,
          lot_id: slot.lot_id,
          status: slot.status,
          plate_number:
            slot.status === "available" ? undefined : slot.plate_number,
          current_vehicle_id: slot.current_vehicle_id || undefined,
          section: slot.section || "", // ✅ REQUIRED for splitting
          vehicle_type: "bicycle",
        }));
        console.log(
          "🧠 Raw bicycle slot objects:",
          bicycles.map((b: ParkingSlot) => ({ id: b.id, section: b.section }))
        );
        console.log("🧠 Sample slot object:", bicycles[0]);

        setBicycleData(bicycles);

        const totalBikes = bicycles.length;
        const leftBikes = bicycles.filter(
          (s: ParkingSlot) =>
            s.section?.trim().toLowerCase() === "bike area left"
        );
        const rightBikes = bicycles.filter(
          (s: ParkingSlot) =>
            s.section?.trim().toLowerCase() === "bike area right"
        );
        console.log(
          "⬅️ Bike Area Left:",
          leftBikes.map((b: ParkingSlot) => b.id)
        );
        console.log(
          "➡️ Bike Area Right:",
          rightBikes.map((b: ParkingSlot) => b.id)
        );
        console.log("🚲 Total bicycles fetched:", bicycles);
        console.log("⬅️ Bike Area Left:", leftBikes);
        console.log("➡️ Bike Area Right:", rightBikes);
        setBikeLeftData(
          leftBikes.map((slot: ParkingSlot, index: number) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
            section: "bike area left", // or right
            lot_id: slot.lot_id ?? "PE1_Bike",
          }))
        );

        setBikeRightData(
          rightBikes.map((slot: ParkingSlot, index: number) => ({
            id: slot.id,
            slot_number: slot.slot_number,
            status: slot.status || "available",
            current_vehicle_id: slot.current_vehicle_id,
            plate_number: slot.plate_number,
            section: "bike area right", // or right
            lot_id: slot.lot_id ?? "PE2_Bike",
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
  // Handle slot click
  // Handle slot click
  const handleSlotClick = useCallback(
    (
      id: string,
      slot_number: number,
      section: string,
      lot_id?: string,
      status?: string,
      current_vehicle_id?: string,
      slot?: ParkingSlot[],
      reserved_for?: string,
      reserved_customer_name?: string,
      reserved_plate_number?: string

      // The ParkingSlotsComponent should now ideally pass the full slot object
      // including reserved_for, reserved_customer_name, reserved_plate_number from the backend response.
      // We will still find the full slot data from our state arrays as a fallback/confirmation.
    ) => {
      // ADD THIS CONSOLE LOG AS THE FIRST LINE
      console.log("[handleSlotClick] Received click parameters:", {
        id,
        slot_number,
        section,
        lot_id,
        status,
        current_vehicle_id,
        reserved_for,
        reserved_customer_name,
        reserved_plate_number,
      });

      const slotStatus = status || "available";

      // Find the full slot data from the state arrays. This data should now include
      // reserved_for, reserved_customer_name, and reserved_plate_number if available.
      // const foundSlot = [...parkingDataLeft, ...parkingDataRight, ...parkingDataCenter, ...parkingDataTop, ...bikeLeftData, ...bikeRightData, ...motorLotData]
      //                     .find(s => s.id === id);

      // Populate the selected slot data directly from the found slot
      const slotData: SelectedSlot = {
        id: id, // Use found id if available, fallback to passed id
        slot_number: slot_number, // Use found number if available
        section: section, // Use found section if available
        lot_id: lot_id, // Use found lot_id if available
        status: slotStatus, // Use found status if available
        current_vehicle_id: current_vehicle_id, // Use found vehicle_id if available
        reserved_for: reserved_for, // Get reserved_for directly from the found slot
        reserved_customer_name: reserved_customer_name, // Get reserved name directly
        reserved_plate_number: reserved_plate_number, // Get reserved plate directly
      };

      // Set the selected slot state BEFORE showing any dialog
      setSelectedSlot(slotData);

      console.log("[handleSlotClick] Populated selectedSlot:", slotData);

      // --- Handle specialty vehicle sections ---
      if (
        section === "bike area left" ||
        section === "bike area right" ||
        section === "elevated parking"
      ) {
        setCurrentSpecialtySection(section);

        if (section === "bike area left" || section === "bike area right") {
          setShowBicycleDialog(true);
          setSelectedVehicleType("bicycle");
          // Refresh data when opening specialty dialogs to ensure they have latest state
          fetchParkingData();
          fetchUnassignedVehicles();
          fetchRegisteredCustomers();
        } else if (section === "elevated parking") {
          setShowMotorcycleDialog(true);
          setSelectedVehicleType("motorcycle");
          // Refresh data when opening specialty dialogs
          fetchParkingData();
          fetchUnassignedVehicles();
          fetchRegisteredCustomers();
        }

        // Reset selected vehicle and customer when opening any specialty dialog
        setSelectedVehicle(null);
        setSelectedCustomer(null);
        return; // Exit the function after handling specialty sections
      }
      // --- End specialty vehicle handling ---

      // --- Handle regular parking slots (car) ---
      // If it's not a specialty section, open the main slot dialog
      setIsSlotDialogOpen(true);

      // Only reset selected vehicle if we're going to assign a new one
      if (slotData.status === "available" || !slotData.current_vehicle_id) {
        setSelectedVehicle(null);
      }
      // Always reset selected customer when opening the dialog for a car slot
      setSelectedCustomer(null);
    },
    // Add all state variables and functions that are accessed inside useCallback as dependencies
    [
      parkingDataLeft,
      parkingDataRight,
      parkingDataCenter,
      parkingDataTop,
      bikeLeftData,
      bikeRightData,
      motorLotData,
      registeredCustomers,
      fetchParkingData,
      fetchUnassignedVehicles,
      fetchRegisteredCustomers,
    ]
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
        } else if (selectedSlot.section === "bike area right") {
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
        vehicle_type: selectedVehicleType,
      });
      console.log("Selected Slot ID:", selectedSlot.slot_number);
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

  // Create a function to handle the reservation logic
  const reserveParkingSlot = async () => {
    if (!selectedSlot) {
      toast.error("Invalid slot selected");
      return;
    }

    // Determine the lot number based on section and ID
    let lotNumber = selectedSlot.lot_id || "";
    if (!lotNumber) {
      if (selectedSlot.section === "bike area left") {
        lotNumber = "PE1_Bike";
      } else if (selectedSlot.section === "bike arearight") {
        // Note: "bike arearight" might be a typo, check backend
        lotNumber = "PE2_Bike";
      } else if (selectedSlot.section === "elevated parking") {
        lotNumber = "Elevated_MCP";
      } else if (selectedSlot.section === "top") {
        lotNumber = `PE2_Top`; // Assuming lot_id structure
      } else if (selectedSlot.section === "left") {
        lotNumber = `PE1_Left`; // Assuming lot_id structure
      } else if (selectedSlot.section === "right") {
        lotNumber = `BLDG1_Right`; // Assuming lot_id structure
      } else if (selectedSlot.section === "center-upper") {
        lotNumber = `CENTER1_Upper`; // Assuming lot_id structure
      } else if (selectedSlot.section === "center-lower") {
        lotNumber = `CENTER2_Lower`; // Assuming lot_id structure
      } else {
        // Fallback or handle other sections
        lotNumber = `UNKNOWN_LOT_${selectedSlot.section}`;
      }
    }

    // Determine the API endpoint and data based on whether a customer is selected
    const isCancellingReservation = selectedCustomer === null; // Check if "None" is selected
    const apiEndpoint = isCancellingReservation
      ? `${SERVER_URL}/parking/release-slot`
      : `${SERVER_URL}/parking/reserve-slot`;
    const requestData: any = {
      slot_number: selectedSlot.slot_number.toString(), // Sending slot_number as slot_id
      section: selectedSlot.section,
      slot_section: selectedSlot.section,
      lot_id: lotNumber, // Pass the determined lotNumber
    };
    console.log(
      `selected customer? : ${isCancellingReservation}${selectedCustomer}`
    );
    console.log("UUID:", selectedSlot.id);
    if (isCancellingReservation) {
      // For releasing a reservation, send slot identifier
      requestData.id = selectedSlot.id; // Send the slot UUID for release
      // The backend release endpoint doesn't need customer_id or entry_id
    } else {
      // For reserving or changing reservation, send customer_id
      if (!selectedCustomer) {
        // Should be caught by initial check, but safety first
        toast.error("Please select a customer to reserve the slot.");
        return;
      }
      requestData.customer_id = selectedCustomer; // Sending the selected customer's UUID
    }

    try {
      console.log(
        `Attempting to ${
          isCancellingReservation ? "release reservation for" : "reserve"
        } slot:`,
        requestData
      );

      const response = await axios.post(apiEndpoint, requestData);
      console.log(`[reserveParkingSlot] Sending request to: ${apiEndpoint}`);
      console.log("[reserveParkingSlot] Request data:", requestData);

      if (response.data?.success) {
        toast.success(
          response.data.message ||
            `Slot ${
              isCancellingReservation ? "made available" : "reserved"
            } successfully!`
        );
        setIsSlotDialogOpen(false);
        setSelectedCustomer(null); // Clear selected customer

        // Refresh parking data to show the slot as reserved or available
        fetchParkingData();
        // Optionally refresh customer/unassigned lists if reservation affects them
        fetchRegisteredCustomers();
        fetchUnassignedVehicles();
      } else {
        toast.error(
          response.data?.message ||
            `Failed to ${
              isCancellingReservation ? "make slot available" : "reserve slot"
            }`
        );
      }
    } catch (error) {
      console.error(
        `Error during ${
          isCancellingReservation ? "reservation release" : "reservation"
        }:`,
        error
      );
      if (axios.isAxiosError(error)) {
        console.error("API Error Response:", {
          status: error.response?.status,
          data: error.response?.data,
        });
        toast.error(
          error.response?.data?.message ||
            `An API error occurred during ${
              isCancellingReservation ? "reservation release" : "reservation"
            }.`
        );
      } else {
        toast.error(
          `An unexpected error occurred during ${
            isCancellingReservation ? "reservation release" : "reservation"
          }.`
        );
      }
    }
  };

  const assignSpecialtySlot = async (
    slotNumber: number,
    section: string,
    lotId: string
  ) => {
    if (!selectedVehicle) {
      toast.error("Please select a vehicle to assign");
      return;
    }

    console.log("Assigning slot:", { slotNumber, section, lotId });

    try {
      const response = await axios.post(`${SERVER_URL}/parking/assign-slot`, {
        slot_id: slotNumber.toString(),
        slot_section: section,
        entry_id: selectedVehicle,
        lot_id: lotId,
        vehicle_type: selectedVehicleType,
      });

      if (response.data?.success) {
        toast.success(response.data.message);
        setShowBicycleDialog(false);
        setShowMotorcycleDialog(false);
        fetchParkingData();
        fetchUnassignedVehicles();
      } else {
        toast.error(response.data?.message || "Failed to assign slot");
      }
    } catch (error) {
      console.error("Error in assignSpecialtySlot:", error);
      toast.error("An error occurred while assigning slot");
    }
  };

  const handleAssignSlot = (
    slot_number: number,
    section: string,
    lot_id: string
  ) => {
    assignSpecialtySlot(slot_number, section, lot_id); // Call your existing function
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
        slot_number: selectedSlot.slot_number.toString(),
        section: selectedSlot.section,
      });
      console.log("🔍 Releasing slot with:", {
        id: selectedSlot.id,
        slot_number: selectedSlot.slot_number,
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
    fetchRegisteredCustomers();

    // Set up polling for real-time updates
    const interval = setInterval(() => {
      fetchParkingData();
      fetchUnassignedVehicles();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [SERVER_URL]);

  const allParkingSlots = [
    ...(parkingDataLeft || []),
    ...(parkingDataRight || []),
    ...(parkingDataCenter || []),
    ...(parkingDataTop || []),
  ];
  useEffect(() => {
    const type = entryDetectionData.vehicleType?.toLowerCase();
    if (!entryEnabled || !type || type === "no detection") {
      console.log("🚫 Skipping: entry not enabled or invalid type:", type);
      return;
    }

    if (lastAlertedVehicleType.current?.toLowerCase() === type) {
      console.log(`🟡 Skipping alert: already shown for ${type}`);
      return;
    }

    const isCar = type.includes("car");
    const isMotor = type.includes("motorcycle");
    const isBike = type.includes("bicycle");

    const carOccupied = allParkingSlots.filter(
      (slot) => slot.status === "occupied"
    ).length;
    const carTotal = allParkingSlots.length;
    const carPercent = (carOccupied / carTotal) * 100;

    const motorOccupied = motorcycleData.filter(
      (slot) => slot.status === "occupied"
    ).length;
    const motorTotal = motorcycleData.length;
    const motorPercent = (motorOccupied / motorTotal) * 100;

    const bikeOccupied = bicycleData.filter(
      (slot) => slot.status === "occupied"
    ).length;
    const bikeTotal = bicycleData.length;
    const bikePercent = (bikeOccupied / bikeTotal) * 100;

    console.log(
      `🔍 Capacity Check: type=${type}, car=${carPercent}%, motor=${motorPercent}%, bike=${bikePercent}%`
    );

    if (isCar && carPercent >= 90) {
      setTimeout(() => {
        setAlertMessage(`The car slots are ${Math.round(carPercent)}% full.`);
        setShowCapacityAlert(true);
      }, 2000);
      lastAlertedVehicleType.current = type;
      console.log("🚨 Triggered alert for car");
    } else if (isMotor && motorPercent >= 95) {
      setTimeout(() => {
        setAlertMessage(
          `The motorcycle slots are ${Math.round(motorPercent)}% full.`
        );
        setShowCapacityAlert(true);
      }, 2000);
      lastAlertedVehicleType.current = type;
      console.log("🚨 Triggered alert for motorcycle");
    } else if (isBike && bikePercent >= 95) {
      setTimeout(() => {
        setAlertMessage(
          `The bicycle slots are ${Math.round(bikePercent)}% full.`
        );
        setShowCapacityAlert(true);
      }, 2000);
      lastAlertedVehicleType.current = type;
      console.log("🚨 Triggered alert for bicycle");
    }
  }, [
    entryEnabled,
    entryDetectionData.vehicleType,
    allParkingSlots,
    motorcycleData,
    bicycleData,
  ]);

  useEffect(() => {
    if (!entryEnabled) return;

    const type = entryDetectionData.vehicleType?.toLowerCase();

    if (
      lastAlertedVehicleType.current &&
      type !== lastAlertedVehicleType.current?.toLowerCase()
    ) {
      console.log("🔄 Resetting alert cache for new vehicle type:", type);
      lastAlertedVehicleType.current = null;
    }
  }, [entryDetectionData.vehicleType, entryEnabled]);

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
                  ?.map((plate) => plate.ocr_text)
                  .join(", ") || "",
              annotationLabel: parseInt(mostConfidentDetection.label),
            });
            if (mostConfidentDetection.label === "bicycle") {
              setEntryDetectionData({
                vehicleType: mostConfidentDetection.label,
                plateNumber: "No Plate",
                colorAnnotation: mostConfidentDetection?.color_annotation,
                ocrText: "No Plate",
                annotationLabel: parseInt(mostConfidentDetection.label),
              });
            }
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
            variant={entryEnabled ? "destructive" : "default"}
            onClick={() => {
              if (entryEnabled) {
                socket.current?.emit("stop_entry_video");
                setEntryEnabled(false);
              } else {
                lastAlertedVehicleType.current = null;
                if (!socket.current || !socket.current.connected) {
                  socket.current = io(SERVER_URL, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    timeout: 10000,
                  });

                  socket.current.on("connect", () => {
                    console.log("Socket reconnected (entry)");
                    socket.current?.emit("start_entry_video", {
                      camera_index: selectedCamera,
                    });
                  });

                  socket.current.on("connect_error", (socketError: Error) => {
                    console.error(
                      "Socket connection error (entry):",
                      socketError
                    );
                  });

                  socket.current.on(
                    "entry_video_frame",
                    (data: VideoFrameData) => {
                      if (data?.entrance_frame && entryVideoRef.current) {
                        entryVideoRef.current.src = `data:image/jpeg;base64,${data.entrance_frame}`;
                      }

                      if (data.entrance_detections?.length > 0) {
                        const mostConfidentDetection =
                          data.entrance_detections.reduce((prev, current) =>
                            current.confidence > prev.confidence
                              ? current
                              : prev
                          );

                        const PlateNum =
                          mostConfidentDetection.plates
                            ?.map((plate) => plate.ocr_text)
                            .join(", ") || "";

                        setEntryDetectionData({
                          vehicleType: mostConfidentDetection.label,
                          plateNumber: PlateNum,
                          colorAnnotation:
                            mostConfidentDetection?.color_annotation,
                          ocrText:
                            mostConfidentDetection.plates
                              .map((plate) => plate.ocr_text)
                              .join(", ") || "",
                          annotationLabel: parseInt(
                            mostConfidentDetection.label
                          ),
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
                    }
                  );
                } else {
                  socket.current.emit("start_entry_video", {
                    camera_index: selectedCamera,
                  });
                }

                setEntryEnabled(true);
              }
            }}
          >
            {entryEnabled ? (
              <>
                <Square className="w-4 h-4 mr-2" /> Stop Entry
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" /> Start Entry
              </>
            )}
          </Button>

          <Button
            variant={exitEnabled ? "destructive" : "default"}
            onClick={() => {
              if (exitEnabled) {
                socket.current?.emit("stop_exit_video");
                setExitEnabled(false);
              } else {
                lastAlertedVehicleType.current = null;
                if (!socket.current || !socket.current.connected) {
                  socket.current = io(SERVER_URL, {
                    reconnection: true,
                    reconnectionAttempts: 5,
                    timeout: 10000,
                  });

                  socket.current.on("connect", () => {
                    console.log("Socket reconnected (exit)");
                    socket.current?.emit("start_exit_video", {
                      camera_index: selectedCamera,
                    });
                  });

                  socket.current.on("connect_error", (socketError: Error) => {
                    console.error(
                      "Socket connection error (exit):",
                      socketError
                    );
                  });

                  socket.current.on(
                    "exit_video_frame",
                    (data: VideoFrameData) => {
                      if (data?.exit_frame && exitVideoRef.current) {
                        exitVideoRef.current.src = `data:image/jpeg;base64,${data.exit_frame}`;
                      }

                      if (
                        data.exit_detections &&
                        data.exit_detections.length > 0
                      ) {
                        const mostConfidentDetection =
                          data.exit_detections.reduce((prev, current) =>
                            current.confidence > prev.confidence
                              ? current
                              : prev
                          );

                        const PlateNum =
                          mostConfidentDetection.plates
                            ?.map((plate) => plate.ocr_text)
                            .join(", ") || "";

                        setExitDetectionData({
                          vehicleType: mostConfidentDetection.label,
                          plateNumber: PlateNum,
                          colorAnnotation:
                            mostConfidentDetection?.color_annotation,
                          ocrText:
                            mostConfidentDetection.plates
                              .map((plate) => plate.ocr_text)
                              .join(", ") || "",
                          annotationLabel: parseInt(
                            mostConfidentDetection.label
                          ),
                        });
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
                } else {
                  socket.current.emit("start_exit_video", {
                    camera_index: selectedCamera,
                  });
                }

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
            <CardTitle>Gate 1(Entry Stream)</CardTitle>
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
        <div className="flex items-center space-x-4 mt-6">
          <input
            type="text"
            placeholder="Search plate number..."
            className="p-2 border rounded w-[300px]"
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
          />
          <span className="text-sm text-gray-500">
            Enter plate number to highlight the slot
          </span>
        </div>

        <Card className="w-full mt-6">
          <CardHeader>
            <CardTitle>Parking Slots Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col space-y-6">
              {/* Parking Slots Visual Component */}
              <ParkingSlotsComponent
                parkingDataLeft={parkingDataLeft}
                parkingDataRight={parkingDataRight}
                parkingDataCenter={parkingDataCenter}
                parkingDataTop={parkingDataTop}
                parkingDataBikeLeft={bikeLeftData}
                parkingDataBikeRight={bikeRightData}
                parkingDataMotor={motorcycleData}
                totalSpaces={totalSpaces}
                occupiedSpaces={occupiedSpaces}
                vacantSpaces={vacantSpaces}
                reservedSpaces={reservedSpaces}
                capacityStatus={capacityStatus}
                onSlotClick={handleSlotClick}
                registeredCustomers={registeredCustomers}
                searchPlate={searchPlate}
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
          onAssignSlot={handleAssignSlot}
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
            currentSpecialtySection === "bike area left"
              ? bikeLeftData
              : bikeRightData
          }
          selectedVehicle={selectedVehicle}
          setSelectedVehicle={setSelectedVehicle}
          unassignedVehicles={filteredUnassignedVehicles}
          onAssignSlot={(slot_number, section, lot_id) =>
            assignSpecialtySlot(slot_number, section, lot_id)
          }
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
                {/* Display reserved info if status is reserved */}
                {selectedSlot.status === "reserved" &&
                selectedSlot.reserved_customer_name &&
                selectedSlot.reserved_plate_number ? (
                  <>
                    {console.log("Inside RESERVED block:", {
                      status: selectedSlot.status,
                      reserved_customer_name:
                        selectedSlot.reserved_customer_name,
                      reserved_plate_number: selectedSlot.reserved_plate_number,
                    })}
                    <p className="text-lg font-medium text-green-700">
                      This slot is reserved for:
                    </p>
                    <p className="text-xl font-bold">
                      {selectedSlot.reserved_customer_name}:{" "}
                      {selectedSlot.reserved_plate_number}
                    </p>
                    <p className="text-sm text-gray-600">
                      Only a vehicle with this plate number can be assigned
                      here.
                    </p>
                    <Tabs defaultValue="assign">
                      {" "}
                      {/* Still show tabs, but filter assign */}
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="assign">
                          Assign Reserved Vehicle
                        </TabsTrigger>{" "}
                        {/* Updated text */}
                        <TabsTrigger value="reserve">
                          Change Reservation
                        </TabsTrigger>{" "}
                        {/* Updated text */}
                      </TabsList>
                      <TabsContent value="assign" className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            Select Reserved Vehicle Entry
                          </h3>
                          {/* Filter unassigned vehicles to only show the reserved one */}
                          <select
                            className="w-full p-2 border rounded"
                            value={selectedVehicle || ""}
                            onChange={(e) => setSelectedVehicle(e.target.value)}
                          >
                            <option value="">
                              Select the reserved vehicle
                            </option>
                            {unassignedVehicles
                              .filter(
                                (vehicle) =>
                                  vehicle.plate ===
                                  selectedSlot.reserved_plate_number
                              )
                              .map((vehicle) => (
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
                          {/* Only enable assign if the correct vehicle is selected */}
                          <Button
                            onClick={assignParkingSlot}
                            disabled={!selectedVehicle}
                          >
                            Assign Reserved Vehicle
                          </Button>
                        </DialogFooter>
                      </TabsContent>
                      {/* Reserve tab content for changing or cancelling reservation */}
                      <TabsContent value="reserve" className="space-y-4">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            Select New Customer or None
                          </h3>
                          <select
                            className="w-full p-2 border rounded"
                            value={selectedCustomer || ""}
                            onChange={(e) =>
                              setSelectedCustomer(e.target.value)
                            }
                          >
                            <option value="">None (Make Available)</option>{" "}
                            {/* Option to make available */}
                            {registeredCustomers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.display_name_with_plate ||
                                  getCustomerDisplayName(customer)}
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
                          {/* Button text changes based on selection */}
                          <Button onClick={reserveParkingSlot}>
                            {selectedCustomer
                              ? "Change Reservation"
                              : "Make /Available"}
                          </Button>
                        </DialogFooter>
                      </TabsContent>
                    </Tabs>
                  </>
                ) : selectedSlot.status === "occupied" ||
                  selectedSlot.current_vehicle_id ? (
                  // Show release option for occupied slots (keep existing logic)
                  <>
                    {console.log("🟢 Slot is available:", {
                      status: selectedSlot.status,
                      reserved_customer_name:
                        selectedSlot.reserved_customer_name,
                      reserved_plate_number: selectedSlot.reserved_plate_number,
                    })}
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
                  // Show assignment/reservation options for available slots (keep existing tabs)
                  <Tabs defaultValue="assign">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="assign">Assign Vehicle</TabsTrigger>
                      <TabsTrigger value="reserve">Reserve Slot</TabsTrigger>
                    </TabsList>

                    {/* Assign Vehicle Tab Content (Keep existing) */}
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

                    {/* Reserve Slot Tab Content (Modified for available slots) */}
                    <TabsContent value="reserve" className="space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          Select Registered Customer
                        </h3>
                        <select
                          className="w-full p-2 border rounded"
                          value={selectedCustomer || ""}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                          <option value="">Select a customer</option>{" "}
                          {/* No "None" option when initially reserving */}
                          {registeredCustomers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.display_name_with_plate ||
                                getCustomerDisplayName(customer)}
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
                        <Button onClick={reserveParkingSlot}>
                          {" "}
                          {/* Call the reserve function */}
                          Reserve Slot
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
      <Dialog open={showCapacityAlert} onOpenChange={setShowCapacityAlert}>
        <DialogContent className="max-w-lg text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-red-600 text-2xl">
              ⚠️ Parking Alert
            </DialogTitle>
          </DialogHeader>
          <p className="text-lg">{alertMessage}</p>
          <p className="text-sm text-gray-500">
            Please proceed with caution or consider redirecting the vehicle.
          </p>
          <Button onClick={() => setShowCapacityAlert(false)}>OK</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SurveillanceInterface;
