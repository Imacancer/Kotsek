"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Bike, Car, Icon } from "lucide-react";
import { useState, useEffect } from "react";
import { motorRacingHelmet } from "@lucide/lab";
import { User } from "@/app/detect/page";
import React from "react";

export interface ParkingSlot {
  id: string;
  slot_number: number;
  lot_id?: string;
  status: "available" | "occupied" | "reserved";
  plate_number?: string;
  current_vehicle_id?: string;
  section: string;
  vehicle_type?: string;
  reserved_for?: string;
  reserved_customer_name?: string;
  reserved_plate_number?: string;
}

interface ParkingSlotProps {
  id: string;
  slot_number: number;
  status: "available" | "occupied" | "reserved";
  section: string;
  plate_number?: string;
  lot_id?: string;
  current_vehicle_id?: string;
  reserved_for?: string; // Corrected parameter type
  reserved_customer_name?: string; // Corrected parameter type
  reserved_plate_number?: string;
  onSlotClick: (
    id: string,
    slot_number: number,
    section: string,
    lot_id?: string,
    status?: string,
    current_vehicle_id?: string,
    slots?: ParkingSlot[],
    reserved_for?: string, // Added to match handleSlotClick signature
    reserved_customer_name?: string, // Added to match handleSlotClick signature
    reserved_plate_number?: string // Add slots parameter
  ) => void;
  registeredCustomers?: User[];
  searchPlate?: string;
}

interface ParkingSlotsComponentProps {
  parkingDataLeft: ParkingSlot[];
  parkingDataCenter: ParkingSlot[];
  parkingDataRight: ParkingSlot[];
  parkingDataTop: ParkingSlot[];
  parkingDataBikeLeft: ParkingSlot[]; // Add these new props
  parkingDataBikeRight: ParkingSlot[];
  parkingDataMotor: ParkingSlot[];
  totalSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  vacantSpaces: number;
  capacityStatus: string;
  onSlotClick: (
    id: string,
    slot_number: number,
    section: string,
    lot_id?: string,
    status?: string,
    current_vehicle_id?: string,
    slots?: ParkingSlot[], // Add slots parameter
    reserved_for?: string, // Added
    reserved_customer_name?: string, // Added
    reserved_plate_number?: string // Added
  ) => void;
  registeredCustomers?: User[];
  searchPlate?: string;
}

interface BikeAreaData {
  id: string;
  name: string;
  total: number;
  occupied: number;
  lot_id: string;
  section: string;
  slots?: ParkingSlot[];
}

interface MotorParkingData {
  id: string;
  name: string;
  total: number;
  occupied: number;
  lot_id: string;
  section: string;
  slots?: ParkingSlot[];
}

const ParkingSlotItem = ({
  id,
  slot_number,
  status,
  section,
  plate_number,
  lot_id,
  current_vehicle_id,
  reserved_for, // Destructure the new props
  reserved_customer_name, // Destructure the new props
  reserved_plate_number,
  onSlotClick,
  registeredCustomers,
  searchPlate,
}: ParkingSlotProps) => {
  // <--- CHANGE 1: Added curly brace for the function body
  const [isHovered, setIsHovered] = useState(false);

  // --- You can now add statements here ---
  // For example, a console log to see the props this item received:
  // --- End of statements ---
  const customers = registeredCustomers || [];
  const owner = React.useMemo(() => {
    if (!registeredCustomers || !plate_number) {
      console.log("No customers or plate_number available");
      return null;
    }

    const found = registeredCustomers.find((customer) => {
      const customerPlate = customer.plate_number?.toLowerCase().trim();
      const slotPlate = plate_number.toLowerCase().trim();

      console.log(
        `Comparing slot plate "${slotPlate}" with customer plate "${customerPlate}"`
      );

      return customerPlate === slotPlate;
    });

    console.log("Found owner:", found);
    return found || null;
  }, [registeredCustomers, plate_number]);

  const ownerName = owner
    ? [owner.first_name, owner.last_name].filter(Boolean).join(" ") ||
      "Not Registered"
    : "N/A";
  const tooltipContent =
    status === "reserved" ? (
      <>
        <div>
          <strong>Reserved For:</strong> {reserved_customer_name || "N/A"}
        </div>
        <div>
          <strong>Plate:</strong> {reserved_plate_number || "N/A"}
        </div>
      </>
    ) : status === "occupied" ? (
      <>
        <div>
          <strong>Owner:</strong> {ownerName || "N/A"}
        </div>
        <div>
          <strong>Plate:</strong> {plate_number || "N/A"}
        </div>
      </>
    ) : (
      <>
        <div>Vacant</div>
      </>
    );
  const normalize = (plate: string) => plate.toLowerCase().replace(/\s/g, "");
  const isMatch =
    !!searchPlate &&
    ((plate_number && normalize(plate_number) === normalize(searchPlate)) ||
      (reserved_plate_number &&
        normalize(reserved_plate_number) === normalize(searchPlate)));

  const slotRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isMatch && slotRef.current) {
      slotRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }, [isMatch]);

  return (
    // <--- CHANGE 2: Added explicit return keyword

    <div
      ref={slotRef}
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className={`
        w-full h-full border-2 flex flex-col items-center justify-center font-bold cursor-pointer transition-colors text-center p-1
        ${
          status === "occupied"
            ? "bg-red-200 border-red-500 hover:bg-red-300"
            : status === "reserved"
            ? "bg-yellow-200 border-yellow-500 hover:bg-yellow-300"
            : "bg-green-200 border-green-500 hover:bg-green-300"
        }
        ${isMatch ? "ring-4 ring-blue-500 animate-pulse" : ""}
      `}
        onClick={() => {
          // <--- Added curly braces for the onClick handler body
          // Optional: Add a log here to see parameters just before calling onSlotClick
          // console.log(`[ParkingSlotItem Slot ${slot_number}] Calling onSlotClick...`);

          onSlotClick(
            id, // 1st argument
            slot_number, // 2nd argument
            section, // 3rd argument
            lot_id, // 4th argument
            status, // 5th argument (Passing the actual status prop)
            current_vehicle_id,
            undefined, // 6th argument
            reserved_for, // <-- CORRECTED ARGUMENT ORDER: Pass reserved_for (7th argument)
            reserved_customer_name, // <-- CORRECTED ARGUMENT ORDER: Pass reserved_customer_name (8th argument)
            reserved_plate_number // <-- CORRECTED ARGUMENT ORDER: Pass reserved_plate_number (9th argument)
            // Removed the erroneous 'undefined' argument that was previously in the 7th position
          );
        }} // <--- Closing curly brace for onClick handler
        title={
          status === "reserved"
            ? `Reserved For: ${reserved_customer_name || "N/A"}\nPlate: ${
                reserved_plate_number || "N/A"
              }`
            : status === "occupied"
            ? `Plate: ${plate_number || "N/A"}`
            : "Vacant"
        }
      >
        <CardContent className="p-1 flex flex-col items-center justify-center w-full h-full">
          <span className="text-sm font-bold">{slot_number}</span>
          {/* Display plate number if occupied */}
          {status === "occupied" && plate_number && (
            <span className="text-xs truncate max-w-full px-1">
              {plate_number}
            </span>
          )}
          {/* Display reserved name/plate if reserved */}
          {status === "reserved" &&
            reserved_customer_name &&
            reserved_plate_number && (
              <span className="text-xs truncate max-w-full px-1 text-yellow-800">
                {reserved_customer_name.split(" ")[0]}: {reserved_plate_number}{" "}
                {/* Display first name and plate */}
              </span>
            )}
        </CardContent>
      </Card>
      {/* Custom Tooltip Box */}
      {isHovered && (
        <div
          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-xs rounded-md bg-white p-2 shadow-lg border border-gray-200 text-gray-900 text-xs whitespace-normal"
          style={{ minWidth: "120px" }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  ); // <--- CHANGE 3: Closing parenthesis and semicolon for the return statement
};
const ParkingSlotsComponent = ({
  parkingDataTop,
  parkingDataLeft,
  parkingDataCenter,
  parkingDataRight,
  parkingDataBikeLeft,
  parkingDataBikeRight,
  parkingDataMotor,
  totalSpaces,
  occupiedSpaces,
  vacantSpaces,
  registeredCustomers,
  onSlotClick,
  searchPlate,
}: ParkingSlotsComponentProps) => {
  const [screenSize, setScreenSize] = useState("lg");

  const bikeAreaLeft: BikeAreaData[] = [
    {
      id: parkingDataBikeLeft[0]?.id || "bike area left",
      name: "Bike Area Left",
      total: parkingDataBikeLeft?.length || 0,
      occupied:
        parkingDataBikeLeft?.filter((slot) => slot.status === "occupied")
          .length || 0,
      lot_id: parkingDataBikeLeft[0]?.lot_id || "PE1_Bike",
      section: "bike area left",
      slots: parkingDataBikeLeft,
    },
  ];
  // Bike areas data with total occupancy
  const bikeAreaRight: BikeAreaData[] = [
    {
      id: parkingDataBikeRight[0]?.id || "bike area right",
      name: "Bike Area Right",
      total: parkingDataBikeRight?.length || 0,
      occupied:
        parkingDataBikeRight?.filter((slot) => slot.status === "occupied")
          .length || 0,
      lot_id: parkingDataBikeRight[0]?.lot_id || "PE1_Bike",
      section: "bike area right",
      slots: parkingDataBikeRight,
    },
  ];

  // Motor parking lot data with total occupancy
  const motorParkingLot: MotorParkingData = {
    id: parkingDataMotor[0]?.id || "elevated parking",
    name: "Motor Parking Lot",
    total: parkingDataMotor?.length || 0,
    occupied:
      parkingDataMotor?.filter((slot) => slot.status === "occupied").length ||
      0,
    lot_id: parkingDataMotor[0]?.lot_id || "Elevated_MCP",
    section: "elevated parking",
    slots: parkingDataMotor,
  };

  // Sort parking data by slot number to ensure consistent placement
  const sortedTopData = [...parkingDataTop].sort(
    (a, b) => a.slot_number - b.slot_number
  );
  const sortedLeftData = [...parkingDataLeft].sort(
    (a, b) => a.slot_number - b.slot_number
  );
  const sortedRightData = [...parkingDataRight].sort(
    (a, b) => a.slot_number - b.slot_number
  );

  // For center, we need to maintain the row structure
  const sortedCenterData = [...parkingDataCenter].sort(
    (a, b) => a.slot_number - b.slot_number
  );

  // Create placeholder arrays for consistent layout
  const topSlots = Array(13)
    .fill(null)
    .map((_, index) => {
      const slot = sortedTopData.find((s) => s.slot_number === index + 1);
      return (
        slot ||
        ({
          id: `empty-top-${index}`,
          slot_number: index + 1,
          status: "available" as const,
          section: "top",
          lot_id: "",
          plate_number: "",
          current_vehicle_id: "",
          reserved_for: "",
          reserved_customer_name: "",
          reserved_plate_number: "",
        } as ParkingSlot)
      );
    });
  const leftSlots = Array(10)
    .fill(null)
    .map((_, index) => {
      const slot = sortedLeftData.find((s) => s.slot_number === index + 1);
      return (
        slot ||
        ({
          id: `empty-left-${index}`,
          slot_number: index + 1,
          status: "available" as const,
          section: "left",
          lot_id: "",
          plate_number: "",
          current_vehicle_id: "",
          reserved_for: "",
          reserved_customer_name: "",
          reserved_plate_number: "",
        } as ParkingSlot)
      );
    });

  const rightSlots = Array(9)
    .fill(null)
    .map((_, index) => {
      const slot = sortedRightData.find((s) => s.slot_number === index + 1);
      return (
        slot ||
        ({
          id: `empty-right-${index}`,
          slot_number: index + 1,
          status: "available" as const,
          section: "right",
          lot_id: "",
          plate_number: "",
          current_vehicle_id: "",
          reserved_for: "",
          reserved_customer_name: "",
          reserved_plate_number: "",
        } as ParkingSlot)
      );
    });

  // Create fixed-size arrays for each center row
  const centerRowsCount = [14, 14, 14, 14]; // 4 rows with 14 slots each
  const centerSlots = [];

  let slotCounter = 1;
  for (let row = 0; row < centerRowsCount.length; row++) {
    const rowSlots = [];
    for (let i = 0; i < centerRowsCount[row]; i++) {
      const slot = sortedCenterData.find((s) => s.slot_number === slotCounter);
      rowSlots.push(
        slot || {
          id: `empty-center-${slotCounter}`,
          slot_number: slotCounter,
          status: "available" as const,
          section: "center",
          lot_id: "",
          plate_number: "",
          current_vehicle_id: "",
          reserved_for: "",
          reserved_customer_name: "",
          reserved_plate_number: "",
        }
      );
      slotCounter++;
    }
    centerSlots.push(rowSlots);
  }

  // Handle responsive display
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setScreenSize("sm");
      } else if (width < 1536) {
        setScreenSize("lg");
      } else {
        setScreenSize("xl");
      }
    };

    handleResize(); // Check initial size
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (screenSize === "sm") {
    return (
      <div className="p-4 text-center">
        <Card className="p-4 bg-gray-100">
          <CardContent>
            <p className="text-lg font-medium">
              Parking visualization is available on larger screens
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please view on a desktop or tablet in landscape mode
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Legend Section */}
      <div className="mt-6 flex items-center justify-start space-x-4 mb-12">
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

      <Card className="p-0 h-full w-full mb-12">
        <CardContent className="p-2">
          <div className="flex p-0 m-0">
            <div
              className={`w-full h-full grid grid-cols-8 grid-rows-8 gap-4 space-y-8 ${
                screenSize === "xl" ? "py-8" : "py-4"
              }`}
            >
              {/* Top Parking Slots 1-13*/}
              <div className="flex w-full col-start-2 col-end-8 space-x-12 mb-16">
                <div
                  className="grid grid-cols-13 w-full"
                  style={{
                    gridTemplateColumns: "repeat(13, minmax(0, 1fr))",
                    gap: "12px",
                  }}
                >
                  {topSlots.map((slot) => (
                    <ParkingSlotItem
                      key={`top-${slot.slot_number}`}
                      id={
                        "lot_id" in slot && slot.lot_id
                          ? slot.lot_id
                          : slot.id || ""
                      }
                      slot_number={slot.slot_number}
                      status={slot.status}
                      section="top"
                      plate_number={
                        "plate_number" in slot ? slot.plate_number : ""
                      }
                      lot_id={slot.lot_id}
                      current_vehicle_id={
                        "current_vehicle_id" in slot
                          ? slot.current_vehicle_id
                          : ""
                      }
                      onSlotClick={onSlotClick}
                      reserved_for={slot.reserved_for}
                      reserved_customer_name={slot.reserved_customer_name}
                      reserved_plate_number={slot.reserved_plate_number}
                      registeredCustomers={registeredCustomers}
                      searchPlate={searchPlate}
                    />
                  ))}
                </div>
              </div>

              {/* Bike Left Area */}
              <div
                className="w-full h-full flex flex-col justify-center items-center row-start-1 border border-dashed border-black bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() =>
                  onSlotClick(
                    bikeAreaLeft[0].id,
                    0,
                    bikeAreaLeft[0].section,
                    bikeAreaLeft[0].lot_id,
                    "available",
                    undefined,
                    bikeAreaLeft[0].slots // Pass slots data
                  )
                }
              >
                <p className="font-bold text-center text-base">
                  Bike Area Left
                </p>
                <p className="text-sm font-medium mt-1">
                  {bikeAreaLeft[0].occupied}/{bikeAreaLeft[0].total}
                </p>
              </div>

              {/* Bike Right Area */}
              <div
                className="w-full h-full flex flex-col justify-center items-center col-start-8 border border-dashed border-black bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                onClick={() =>
                  onSlotClick(
                    bikeAreaRight[0].id,
                    0,
                    bikeAreaRight[0].section,
                    bikeAreaRight[0].lot_id,
                    "available",
                    undefined,
                    bikeAreaRight[0].slots // Pass slots data
                  )
                }
              >
                <p className="font-bold text-center text-base">
                  Bike Area Right
                </p>
                <p className="text-sm font-medium mt-1">
                  {bikeAreaRight[0].occupied}/{bikeAreaRight[0].total}
                </p>
              </div>

              {/* Left Parking Slots - Improved positioning and size */}
              <div className="w-full row-start-2 row-end-7 col-start-1 col-end-2">
                <div className="relative w-full h-full">
                  <div
                    className={`absolute ${
                      screenSize === "xl"
                        ? "top-[220px] left-[-240px] w-[580px] h-[120px]"
                        : "top-[190px] left-[-200px] w-[480px] h-[100px]"
                    } flex flex-row justify-between items-center rotate-90`}
                  >
                    {leftSlots.map((slot) => (
                      <div
                        key={`left-${slot.slot_number}`}
                        className="w-full max-w-[38px] mx-1"
                        style={{ order: slot.slot_number }}
                      >
                        <ParkingSlotItem
                          id={
                            "lot_id" in slot && slot.lot_id
                              ? slot.lot_id
                              : slot.id || ""
                          }
                          slot_number={slot.slot_number}
                          status={slot.status}
                          section="left"
                          plate_number={
                            "plate_number" in slot ? slot.plate_number : ""
                          }
                          lot_id={slot.lot_id}
                          current_vehicle_id={
                            "current_vehicle_id" in slot
                              ? slot.current_vehicle_id
                              : ""
                          }
                          onSlotClick={onSlotClick}
                          reserved_for={slot.reserved_for}
                          reserved_customer_name={slot.reserved_customer_name}
                          reserved_plate_number={slot.reserved_plate_number}
                          registeredCustomers={registeredCustomers}
                          searchPlate={searchPlate}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center Parking Slots */}
              <div className="w-full row-start-2 row-end-7 col-start-2 col-end-8">
                <div className={`space-y-${screenSize === "xl" ? "12" : "8"}`}>
                  {/* Row 1: 1-14 (Upper-Center) */}
                  <div
                    className="grid grid-cols-14 gap-3 pb-[20px]"
                    style={{
                      gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {centerSlots[0].map((slot) => (
                      <ParkingSlotItem
                        key={`center-upper-${slot.slot_number}`}
                        id={
                          "lot_id" in slot && slot.lot_id
                            ? slot.lot_id
                            : slot.id || ""
                        }
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center-upper"
                        plate_number={
                          "plate_number" in slot ? slot.plate_number : ""
                        }
                        lot_id={slot.lot_id}
                        current_vehicle_id={
                          "current_vehicle_id" in slot
                            ? slot.current_vehicle_id
                            : ""
                        }
                        onSlotClick={onSlotClick}
                        reserved_for={slot.reserved_for}
                        reserved_customer_name={slot.reserved_customer_name}
                        reserved_plate_number={slot.reserved_plate_number}
                        registeredCustomers={registeredCustomers}
                        searchPlate={searchPlate}
                      />
                    ))}
                  </div>

                  {/* Row 2: 15-28 (Lower-Center) */}
                  <div
                    className="grid grid-cols-14 gap-3 pb-[20px]"
                    style={{
                      gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {centerSlots[1].map((slot) => (
                      <ParkingSlotItem
                        key={`center-lower-${slot.slot_number}`}
                        id={
                          "lot_id" in slot && slot.lot_id
                            ? slot.lot_id
                            : slot.id || ""
                        }
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center-lower"
                        plate_number={
                          "plate_number" in slot ? slot.plate_number : ""
                        }
                        lot_id={slot.lot_id}
                        current_vehicle_id={
                          "current_vehicle_id" in slot
                            ? slot.current_vehicle_id
                            : ""
                        }
                        onSlotClick={onSlotClick}
                        reserved_for={slot.reserved_for}
                        reserved_customer_name={slot.reserved_customer_name}
                        reserved_plate_number={slot.reserved_plate_number}
                        registeredCustomers={registeredCustomers}
                        searchPlate={searchPlate}
                      />
                    ))}
                  </div>

                  <div className="text-center text-lg font-semibold py-2 pb-[20px]">
                    Car Area
                  </div>

                  {/* Row 3: 29-42 */}
                  <div
                    className="grid grid-cols-14 gap-3 pb-[20px]"
                    style={{
                      gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {centerSlots[2].map((slot) => (
                      <ParkingSlotItem
                        key={`center-row3-${slot.slot_number}`}
                        id={
                          "lot_id" in slot && slot.lot_id
                            ? slot.lot_id
                            : slot.id || ""
                        }
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center"
                        plate_number={
                          "plate_number" in slot ? slot.plate_number : ""
                        }
                        lot_id={slot.lot_id}
                        current_vehicle_id={
                          "current_vehicle_id" in slot
                            ? slot.current_vehicle_id
                            : ""
                        }
                        onSlotClick={onSlotClick}
                        reserved_for={slot.reserved_for}
                        reserved_customer_name={slot.reserved_customer_name}
                        reserved_plate_number={slot.reserved_plate_number}
                        registeredCustomers={registeredCustomers}
                        searchPlate={searchPlate}
                      />
                    ))}
                  </div>

                  {/* Row 4: 43-56 */}
                  <div
                    className="grid grid-cols-14 gap-3"
                    style={{
                      gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {centerSlots[3].map((slot) => (
                      <ParkingSlotItem
                        key={`center-row4-${slot.slot_number}`}
                        id={
                          "lot_id" in slot && slot.lot_id
                            ? slot.lot_id
                            : slot.id || ""
                        }
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center"
                        plate_number={
                          "plate_number" in slot ? slot.plate_number : ""
                        }
                        lot_id={slot.lot_id}
                        current_vehicle_id={
                          "current_vehicle_id" in slot
                            ? slot.current_vehicle_id
                            : ""
                        }
                        onSlotClick={onSlotClick}
                        reserved_for={slot.reserved_for}
                        reserved_customer_name={slot.reserved_customer_name}
                        reserved_plate_number={slot.reserved_plate_number}
                        registeredCustomers={registeredCustomers}
                        searchPlate={searchPlate}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Parking Slots - Improved positioning and size */}
              <div className="w-full row-start-2 row-end-7 col-start-8 col-end-9 relative">
                <div className="relative w-full h-full">
                  <div
                    className={`absolute ${
                      screenSize === "xl"
                        ? "top-[220px] right-[-240px] w-[580px] h-[120px]"
                        : "top-[190px] right-[-200px] w-[480px] h-[100px]"
                    } flex flex-row justify-between items-center rotate-90`}
                  >
                    {rightSlots.map((slot) => (
                      <div
                        key={`right-${slot.slot_number}`}
                        className="w-full max-w-[40px] mx-1"
                        style={{ order: slot.slot_number }}
                      >
                        <ParkingSlotItem
                          id={
                            "lot_id" in slot && slot.lot_id
                              ? slot.lot_id
                              : slot.id || ""
                          }
                          slot_number={slot.slot_number}
                          status={slot.status}
                          section="right"
                          plate_number={
                            "plate_number" in slot ? slot.plate_number : ""
                          }
                          lot_id={slot.lot_id}
                          current_vehicle_id={
                            "current_vehicle_id" in slot
                              ? slot.current_vehicle_id
                              : ""
                          }
                          onSlotClick={onSlotClick}
                          reserved_for={slot.reserved_for}
                          reserved_customer_name={slot.reserved_customer_name}
                          reserved_plate_number={slot.reserved_plate_number}
                          registeredCustomers={registeredCustomers}
                          searchPlate={searchPlate}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Motor Parking Lot */}
              <div
                className={`w-full h-full flex flex-col justify-center items-center row-start-7 row-end-10 col-start-3 col-end-8 border border-black bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors ${
                  screenSize === "xl" ? "mt-8" : "mt-6"
                }`}
                onClick={() =>
                  onSlotClick(
                    motorParkingLot.id,
                    0,
                    motorParkingLot.section,
                    motorParkingLot.lot_id,
                    "available",
                    undefined,
                    motorParkingLot.slots // Pass slots data
                  )
                }
              >
                <p className="font-bold text-center text-base">
                  Motor Parking Lot
                </p>
                <p className="text-sm font-medium mt-1">
                  {motorParkingLot.slots?.filter(
                    (slot) => slot.status === "occupied"
                  ).length || 0}
                  /{motorParkingLot.slots?.length || 0}
                </p>
              </div>

              <div className="w-full h-full flex justify-center items-center row-start-8 row-end-10 col-start-1 border border-black bg-gray-300">
                <p className="font-bold text-center text-base">Guard House</p>
              </div>

              <div className="w-full h-full flex justify-center items-center row-start-9 col-start-2 border border-black bg-amber-500">
                <p className="font-bold text-center text-base">Main Gate</p>
              </div>
            </div>
          </div>

          <div
            className={`grid grid-cols-3 gap-4 ${
              screenSize === "xl" ? "mt-16" : "mt-12"
            }`}
          >
            <Card className="bg-green-50">
              <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
                <p className="font-bold text-2xl text-gray-800 pb-5">Car</p>
                <div className="flex w-1/2 justify-between items-center flex-row">
                  <div className="w-[70px] h-[70px] flex items-center justify-center rounded-md">
                    <Car className="w-14 h-14" />
                  </div>
                  <p className="text-6xl font-bold text-green-600">
                    {vacantSpaces}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {Math.round((occupiedSpaces / totalSpaces) * 100)}% occupied
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
                <p className="font-bold text-2xl text-gray-800 pb-5">
                  Motorcycle
                </p>
                <div className="flex w-1/2 justify-between items-center flex-row">
                  <div className="w-[70px] h-[70px]  flex items-center justify-center rounded-md">
                    <Icon iconNode={motorRacingHelmet} className="w-14 h-14" />
                  </div>
                  <p className="text-6xl font-bold text-green-600">
                    {motorParkingLot.total - motorParkingLot.occupied}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {Math.round(
                    (motorParkingLot.occupied / motorParkingLot.total) * 100
                  )}
                  % occupied
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
                <p className="font-bold text-2xl text-gray-800 pb-5">Bicycle</p>
                <div className="flex w-1/2 justify-between items-center flex-row">
                  <div className="w-[70px] h-[70px] flex items-center justify-center rounded-md">
                    <Bike className="w-14 h-14" />
                  </div>
                  <p className="text-6xl font-bold text-green-600">
                    {bikeAreaLeft[0].total -
                      bikeAreaLeft[0].occupied +
                      (bikeAreaRight[0].total - bikeAreaRight[0].occupied)}
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {Math.round(
                    ((bikeAreaLeft[0].occupied + bikeAreaRight[0].occupied) /
                      (bikeAreaLeft[0].total + bikeAreaRight[0].total)) *
                      100
                  )}
                  % occupied
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ParkingSlotsComponent;
