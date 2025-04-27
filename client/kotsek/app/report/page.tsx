"use client";

import React, { useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import CustomDropdown from "@/components/Dropdown";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { CalendarIcon, PlusIcon, TrashIcon } from "lucide-react";

const VEHICLE_TYPES = ["Car", "Motorcycle", "Bicycle", "Truck", "Van"];

const vehicleSchema = z.object({
  plateNumber: z.string().optional(),
  type: z.string().min(1, "Vehicle type is required"),
  color: z.string().min(1, "Color is required"),
  driversName: z.string().min(1, "Driver's name is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
}).refine((data) => {
  if (data.type !== "Bicycle") {
    return data.plateNumber && data.plateNumber.trim() !== "";
  }
  return true;
}, {
  message: "Plate number is required unless the vehicle is a Bicycle",
  path: ["plateNumber"],
});

const incidentSchema = z.object({
  incident_name: z.string().min(1, "Incident name is required"),
  date: z.date(),
  time: z.string().min(1, "Time is required"),
  details: z.string().min(1, "Details are required"),
  vehicles: z.array(vehicleSchema).min(1, "At least one vehicle is required"),
});

type Incident = {
  id: string;
  incident_name: string;
  date: string;
  time: string;
  details: string;
  vehicles: any[];
  created_at?: string;
};

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

  const [incidents, setIncidents] = React.useState<Incident[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const fetchIncidents = async () => {
    const { data, error } = await supabase.from("incidents").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error(error);
    } else {
      setIncidents(data || []);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const onSubmit = async (data: z.infer<typeof incidentSchema>) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("incidents").insert([
        {
          incident_name: data.incident_name,
          date: data.date.toISOString().split("T")[0],
          time: data.time,
          details: data.details,
          vehicles: data.vehicles,
        },
      ]);

      if (error) {
        console.error("Error inserting incident:", error.message);
        alert("❌ Failed to submit incident. Please try again.");
        return;
      }

      alert("✅ Incident submitted successfully!");
      form.reset();
      fetchIncidents();
      setDialogOpen(false); // Close the dialog after success
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("❌ Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pl-[100px] md:pl-[100px] lg:pl-[100px]">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Incident Logs</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <PlusIcon className="mr-2 h-4 w-4" /> Add Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="incident_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Shadcn Calendar */}
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="time" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="details" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incident Description</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                {fields.map((field, index) => (
                  <div key={field.id} className="space-y-2 p-4 border rounded">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Vehicle {index + 1}</h3>
                      {index > 0 && (
                        <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name={`vehicles.${index}.plateNumber`} render={({ field }) => (
                        <FormItem><FormLabel>Plate Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`vehicles.${index}.type`} render={({ field }) => (
                        <FormItem><FormLabel>Vehicle Type</FormLabel><FormControl><CustomDropdown options={VEHICLE_TYPES} value={field.value} onChange={field.onChange} placeholder="Select Type" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`vehicles.${index}.color`} render={({ field }) => (
                        <FormItem><FormLabel>Color</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`vehicles.${index}.driversName`} render={({ field }) => (
                        <FormItem><FormLabel>Driver's Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`vehicles.${index}.contactNumber`} render={({ field }) => (
                        <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={() => append({ plateNumber: "", type: "", color: "", driversName: "", contactNumber: "" })}>
                  <PlusIcon className="mr-2 h-4 w-4" /> Add Vehicle
                </Button>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button type="submit" disabled={loading} className="flex items-center justify-center gap-2">
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    )}
                    {loading ? "Submitting..." : "Submit Incident"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
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
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>{incident.incident_name}</TableCell>
                  <TableCell>{new Date(incident.date).toLocaleDateString()}</TableCell>
                  <TableCell>{incident.time}</TableCell>
                  <TableCell>{incident.details}</TableCell>
                  <TableCell>
                    {incident.vehicles?.map((vehicle, idx) => (
                      <div key={idx}>{vehicle.plateNumber} - {vehicle.type} ({vehicle.color})</div>
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
