"use client";

import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusIcon, TrashIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import CustomDropdown from "@/components/Dropdown";

const VEHICLE_TYPES = ["Car", "Motorcycle", "Bicycle", "Truck", "Van"];

// Zod Schemas
const vehicleSchema = z.object({
  plateNumber: z.string().min(1, "Plate number is required"),
  type: z.string().min(1, "Vehicle type is required"),
  color: z.string().min(1, "Color is required"),
  driversName: z.string().min(1, "Driver's name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
});

const incidentSchema = z.object({
  incident_name: z.string().min(1, "Incident name is required"),
  date: z.date(),
  time: z.string().min(1, "Time is required"),
  details: z.string().min(1, "Details are required"),
  vehicles: z.array(vehicleSchema).min(1, "At least one vehicle is required"),
});

// Main Component
const IncidentReportPage = () => {
  const form = useForm({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      incident_name: "",
      date: new Date(),
      time: "",
      details: "",
      vehicles: [
        {
          plateNumber: "",
          type: "",
          color: "",
          driversName: "",
          contactNumber: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "vehicles",
  });

  const [incidents, setIncidents] = React.useState(generateSampleIncidents());
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortBy, setSortBy] = React.useState("date");
  const [vehicleTypeFilter, setVehicleTypeFilter] = React.useState("");

  const onSubmit = (data: any) => {
    const newIncident = {
      ...data,
      id: incidents.length + 1,
    };
    setIncidents([...incidents, newIncident]);
    form.reset();
  };

  const filteredIncidents = incidents
    .filter(
      (incident) =>
        incident.incident_name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        incident.details.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(
      (incident) =>
        !vehicleTypeFilter ||
        incident.vehicles.some((v) => v.type === vehicleTypeFilter)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.incident_name.localeCompare(b.incident_name);
        case "date":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        default:
          return 0;
      }
    });

  return (
    <div className="p-4 md:p-6 space-y-6 pl-[100px] md:pl-[100px] lg:pl-[100px]">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Incident Logs</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" /> Add Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="incident_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value
                                ? format(field.value, "PPP")
                                : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => field.onChange(date)}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 p-4 border rounded">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Vehicle {index + 1}</h3>
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`vehicles.${index}.plateNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plate Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`vehicles.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle Type</FormLabel>
                            <FormControl>
                              <CustomDropdown
                                options={VEHICLE_TYPES}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select Type"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`vehicles.${index}.color`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`vehicles.${index}.driversName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Driver's Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`vehicles.${index}.contactNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    append({
                      plateNumber: "",
                      type: "",
                      color: "",
                      driversName: "",
                      contactNumber: "",
                    })
                  }
                >
                  <PlusIcon className="mr-2 h-4 w-4" /> Add Vehicle
                </Button>

                <div className="flex justify-end space-x-2 mt-4">
                  <Button type="submit">Submit Incident</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 mb-4">
            <Input
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-auto"
            />
            <CustomDropdown
              options={["name", "date"]}
              value={sortBy}
              onChange={setSortBy}
              placeholder="Sort By"
              className="w-full md:w-[180px]"
            />
            <CustomDropdown
              options={["", ...VEHICLE_TYPES]}
              value={vehicleTypeFilter}
              onChange={setVehicleTypeFilter}
              placeholder="Vehicle Type"
              className="w-full md:w-[180px]"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Vehicles Involved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>{incident.incident_name}</TableCell>
                  <TableCell>{incident.date.toLocaleDateString()}</TableCell>
                  <TableCell>{incident.time}</TableCell>
                  <TableCell>{incident.details}</TableCell>
                  <TableCell>
                    {incident.vehicles.map((vehicle, index) => (
                      <div key={index} className="mb-2">
                        {vehicle.plateNumber} - {vehicle.type} ({vehicle.color})
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default IncidentReportPage;

function generateSampleIncidents() {
  return [
    {
      id: 1,
      incident_name: "Parking Collision",
      date: new Date("2024-01-15"),
      time: "14:30",
      details: "Minor collision in parking lot",
      vehicles: [
        {
          plateNumber: "ABC1234",
          type: "Car",
          color: "Blue",
          driversName: "John Doe",
          contactNumber: "123-456-7890",
        },
      ],
    },
    {
      id: 2,
      incident_name: "Speeding Violation",
      date: new Date("2024-01-20"),
      time: "09:15",
      details: "Vehicle exceeding speed limit",
      vehicles: [
        {
          plateNumber: "XYZ5678",
          type: "Motorcycle",
          color: "Red",
          driversName: "Jane Smith",
          contactNumber: "987-654-3210",
        },
      ],
    },
  ];
}
