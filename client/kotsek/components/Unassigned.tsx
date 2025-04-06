"use client";

import { useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Define Vehicle type
type Vehicle = {
  id: string;
  image: string;
  time: string;
  type: string;
  plate: string;
  color: string;
  date: Date;
};

export default function UnassignedVehiclesTable() {
  // Sample data
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: "1",
      image: "/bike.png",
      time: "08:30",
      type: "Bike",
      plate: "None",
      color: "Blue",
      date: new Date("2025-04-02"),
    },
    {
      id: "2",
      image: "/ducati.jpg",
      time: "09:45",
      type: "Motorcycle",
      plate: "NIG645",
      color: "Red",
      date: new Date("2025-04-03"),
    },
    {
      id: "3",
      image: "/mustang.jpeg",
      time: "10:15",
      type: "Car",
      plate: "ANA123",
      color: "Black",
      date: new Date("2025-04-05"),
    },
  ]);

  // Form state for adding a new vehicle
  const [newVehicle, setNewVehicle] = useState<
    Omit<Vehicle, "id" | "date"> & { date: string }
  >({
    image: "",
    time: "",
    type: "",
    plate: "",
    color: "",
    date: "",
  });

  // Sorting state
  const [sortField, setSortField] = useState<keyof Vehicle | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Handle sort
  const handleSort = (field: keyof Vehicle) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort vehicles
  const sortedVehicles = [...vehicles].sort((a, b) => {
    if (!sortField) return 0;

    if (sortDirection === "asc") {
      return String(a[sortField]).localeCompare(String(b[sortField]));
    } else {
      return String(b[sortField]).localeCompare(String(a[sortField]));
    }
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewVehicle((prev) => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const vehicleToAdd: Vehicle = {
      id: Date.now().toString(),
      ...newVehicle,
      date: new Date(newVehicle.date),
    };

    setVehicles((prev) => [...prev, vehicleToAdd]);
  };

  // Define sort icon component
  const SortIcon = ({ field }: { field: keyof Vehicle }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4" />
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center text-center justify-center">
        <div>
          <CardTitle>Unassigned Vehicles</CardTitle>
          <CardDescription>Assign vehicles to parking slots.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("time")}
                >
                  <div className="flex items-center">
                    Time
                    <SortIcon field="time" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center">
                    Type
                    <SortIcon field="type" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("plate")}
                >
                  <div className="flex items-center">
                    Plate
                    <SortIcon field="plate" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("color")}
                >
                  <div className="flex items-center">
                    Color
                    <SortIcon field="color" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon field="date" />
                  </div>
                </TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedVehicles.length > 0 ? (
                sortedVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <Image
                        src={vehicle.image}
                        alt={`${vehicle.type} ${vehicle.plate}`}
                        width={150}
                        height={100}
                        className="rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell>{vehicle.time}</TableCell>
                    <TableCell>{vehicle.type}</TableCell>
                    <TableCell className="font-medium">
                      {vehicle.plate}
                    </TableCell>
                    <TableCell>{vehicle.color}</TableCell>
                    <TableCell>
                      {format(vehicle.date, "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              // View details action
                              console.log("View", vehicle.id);
                            }}
                          >
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Delete action
                              setVehicles(
                                vehicles.filter((v) => v.id !== vehicle.id)
                              );
                            }}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-gray-500"
                  >
                    No vehicles found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
