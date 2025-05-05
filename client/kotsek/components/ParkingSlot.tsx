"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Bike, Car, Icon } from "lucide-react";
import { useState, useEffect } from "react";
import { motorRacingHelmet } from "@lucide/lab";

export interface ParkingSlot {
  id: string;
  slot_number: number;
  lot_id?: string;
  status: "available" | "occupied" | "reserved";
  plate_number?: string;
  current_vehicle_id?: string;
}

interface ParkingSlotProps {
  id: string;
  slot_number: number;
  status: "available" | "occupied" | "reserved";
  section: string;
  plate_number?: string;
  lot_id?: string;
  onSlotClick: (
    id: string,
    slot_number: number,
    section: string,
    lot_id?: string,
    status?: string,
    current_vehicle_id?: string,
    slots?: ParkingSlot[] // Add slots parameter
  ) => void;
  current_vehicle_id?: string;
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
    slots?: ParkingSlot[] // Add slots parameter
  ) => void;
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
  onSlotClick,
}: ParkingSlotProps) => (
  <Card
    className={`
      w-full h-full border-2 flex items-center justify-center font-bold cursor-pointer transition-colors
      ${
        status === "occupied"
          ? "bg-red-200 border-red-500 hover:bg-red-300"
          : status === "reserved"
          ? "bg-yellow-200 border-yellow-500 hover:bg-yellow-300"
          : "bg-green-200 border-green-500 hover:bg-green-300"
      }
    `}
    onClick={() =>
      onSlotClick(id, slot_number, section, lot_id, status, current_vehicle_id)
    }
  >
    <CardContent className="p-2 flex items-center justify-center">
      <span className="text-sm font-bold">{slot_number}</span>
      {plate_number && (
        <span className="flex bottom-1 text-xs truncate max-w-full px-1">
          {plate_number}
        </span>
      )}
    </CardContent>
  </Card>
);

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
  onSlotClick,
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
  console.log("🧠 Bike Right Data:", parkingDataBikeRight);
  console.log("🚲 Total:", bikeAreaRight[0].total, "Occupied:", bikeAreaRight[0].occupied);
  
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
        slot || {
          id: `empty-top-${index}`,
          slot_number: index + 1,
          status: "available" as const,
        }
      );
    });

  const leftSlots = Array(10)
    .fill(null)
    .map((_, index) => {
      const slot = sortedLeftData.find((s) => s.slot_number === index + 1);
      return (
        slot || {
          id: `empty-left-${index}`,
          slot_number: index + 1,
          status: "available" as const,
        }
      );
    });

  const rightSlots = Array(9)
    .fill(null)
    .map((_, index) => {
      const slot = sortedRightData.find((s) => s.slot_number === index + 1);
      return (
        slot || {
          id: `empty-right-${index}`,
          slot_number: index + 1,
          status: "available" as const,
        }
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
                      id={slot.id}
                      slot_number={slot.slot_number}
                      status={slot.status}
                      section="top"
                      plate_number={slot.plate_number}
                      lot_id={slot.lot_id}
                      current_vehicle_id={slot.current_vehicle_id}
                      onSlotClick={onSlotClick}
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
                          id={slot.id}
                          slot_number={slot.slot_number}
                          status={slot.status}
                          section="left"
                          plate_number={slot.plate_number}
                          lot_id={slot.lot_id}
                          current_vehicle_id={slot.current_vehicle_id}
                          onSlotClick={onSlotClick}
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
                        id={slot.id}
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center-upper"
                        plate_number={slot.plate_number}
                        lot_id={slot.lot_id}
                        current_vehicle_id={slot.current_vehicle_id}
                        onSlotClick={onSlotClick}
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
                        id={slot.id}
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center-lower"
                        plate_number={slot.plate_number}
                        lot_id={slot.lot_id}
                        current_vehicle_id={slot.current_vehicle_id}
                        onSlotClick={onSlotClick}
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
                        id={slot.id}
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center"
                        plate_number={slot.plate_number}
                        lot_id={slot.lot_id}
                        current_vehicle_id={slot.current_vehicle_id}
                        onSlotClick={onSlotClick}
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
                        id={slot.id}
                        slot_number={slot.slot_number}
                        status={slot.status}
                        section="center"
                        plate_number={slot.plate_number}
                        lot_id={slot.lot_id}
                        current_vehicle_id={slot.current_vehicle_id}
                        onSlotClick={onSlotClick}
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
                          id={slot.id}
                          slot_number={slot.slot_number}
                          status={slot.status}
                          section="right"
                          plate_number={slot.plate_number}
                          lot_id={slot.lot_id}
                          current_vehicle_id={slot.current_vehicle_id}
                          onSlotClick={onSlotClick}
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
