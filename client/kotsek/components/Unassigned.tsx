"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define Vehicle type
type Vehicle = {
  id: string;
  image: string;
  time: string;
  type: string;
  plate: string;
  color: string;
  date: string;
  created_at: string;
  registered: string;
};

export default function UnassignedVehiclesTable() {
  // State for vehicles data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<keyof Vehicle | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  // Fetch data from API
  // Fetch data from API
  // useEffect(() => {
  //   const fetchVehicles = async () => {
  //     try {
  //       setLoading(true);
  //       const response = await fetch(`${SERVER_URL}/api/unassigned-vehicles`);

  //       // Check if response is OK before parsing JSON
  //       if (!response.ok) {
  //         const text = await response.text();
  //         console.error("Server responded with:", response.status, text);
  //         throw new Error(`Server responded with ${response.status}`);
  //       }

  //       const result = await response.json();

  //       if (result.success) {
  //         setVehicles(result.data);
  //         setError(null);
  //       } else {
  //         setError(result.message || "Failed to fetch vehicles");
  //         setVehicles([]);
  //       }
  //     } catch (err) {
  //       setError("Failed to connect to the server");
  //       console.error("Error fetching unassigned vehicles:", err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchVehicles();

  //   // Optional: Set up polling to refresh data periodically
  //   const intervalId = setInterval(fetchVehicles, 30000); // Refresh every 30 seconds

  //   // Clean up interval on component unmount
  //   return () => clearInterval(intervalId);
  // }, [SERVER_URL]); // Include SERVER_URL in dependencies

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const setupSSE = () => {
      setLoading(true);
      eventSource = new EventSource(`${SERVER_URL}/api/unassigned-vehicles`);

      eventSource.onmessage = (event) => {
        const result = JSON.parse(event.data);
        if (result.success) {
          setVehicles(result.data);
          setError(null);
        } else {
          setError(result.message || "Failed to fetch vehicles");
        }
        setLoading(false);
      };

      eventSource.onerror = () => {
        setError("Connection to server lost. Reconnecting...");
        eventSource?.close();
        // Try to reconnect after a short delay
        setTimeout(setupSSE, 5000);
      };
    };

    setupSSE();

    // Clean up on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [SERVER_URL]);

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
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border max-h-[300px] overflow-y-auto">
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
                <TableHead className="text-center">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6">
                    Loading vehicles...
                  </TableCell>
                </TableRow>
              ) : sortedVehicles.length > 0 ? (
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
                    <TableCell>
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: vehicle.color }}
                        />
                        {vehicle.color}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(vehicle.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-center">
                    {vehicle.registered}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-gray-500"
                  >
                    No unassigned vehicles found
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
