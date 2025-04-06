"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ParkingSlot {
  id: number;
  status: "available" | "occupied" | "reserved";
}

interface ParkingSlotProps {
  id: number;
  status: "available" | "occupied" | "reserved";
}

interface ParkingSlotsComponentProps {
  parkingData: ParkingSlot[];
  totalSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  vacantSpaces: number;
  capacityStatus: string;
}

const ParkingSlotItem = ({ id, status }: ParkingSlotProps) => (
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

const ParkingSlotsComponent = ({
  parkingData,
  totalSpaces,
  occupiedSpaces,
  reservedSpaces,
  vacantSpaces,
}: ParkingSlotsComponentProps) => {
  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gray-50">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
            <p className="text-sm font-medium text-gray-500">Total Spaces</p>
            <p className="text-3xl font-bold">{totalSpaces}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
            <p className="text-sm font-medium text-gray-500">Available</p>
            <p className="text-3xl font-bold text-green-600">{vacantSpaces}</p>
            <p className="text-sm text-gray-500">
              {Math.round((occupiedSpaces / totalSpaces) * 100)}% occupied
            </p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-100/80">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
            <p className="text-sm font-medium text-gray-500">Reserved</p>
            <p className="text-3xl font-bold text-yellow-300">
              {reservedSpaces}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6">
            <p className="text-sm font-medium text-gray-500">Occupied</p>
            <p className="text-3xl font-bold text-red-600">{occupiedSpaces}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Parking Slots</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {parkingData.map((slot) => (
              <ParkingSlotItem
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
    </>
  );
};

export default ParkingSlotsComponent;
