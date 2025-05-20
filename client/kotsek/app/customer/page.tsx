"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal,
  UserMinus,
  Plus,
  Save,
  Trash2,
  User,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Customer {
  customer_id: string;
  first_name: string;
  last_name: string;
  plate_number: string;
  car_model: string;
  color: string;
  contact_num: string;
  is_registered: boolean;
  address: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface NewCustomer {
  first_name: string;
  last_name: string;
  contact_num?: string;
  address?: string;
  email?: string;
  is_registered: boolean;
  plate_number: string;
  vehicle_type?: string;
}

interface UpdateCustomer {
  contact_num?: string;
  address?: string;
  email?: string;
  is_registered: boolean;
}

export default function CustomerPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingDialog, setPendingDialog] = useState<
    null | "update" | "delete"
  >(null);
  const [openDropdownFor, setOpenDropdownFor] = useState<string | null>(null);
  const openUpdateDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setUpdateCustomerData({
      contact_num: customer.contact_num || "",
      address: customer.address || "",
      email: customer.email || "",
      is_registered: customer.is_registered,
    });
    setShowUpdateDialog(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirmation(true);
  };

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [updateCustomerData, setUpdateCustomerData] = useState<UpdateCustomer>({
    contact_num: "",
    address: "",
    email: "",
    is_registered: true,
  });
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({
    first_name: "",
    last_name: "",
    is_registered: true,
    plate_number: "",
    vehicle_type: "",
  });
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null
  );
  const pendingCustomerRef = useRef<Customer | null>(null);

  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCustomers(searchTerm);
    }, 300); // debounce search

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const fetchCustomers = async (searchTerm: string = "") => {
    try {
      const query = searchTerm
        ? `?search=${encodeURIComponent(searchTerm)}`
        : "";
      const response = await fetch(`${SERVER_URL}/get-customers${query}`);
      if (!response.ok) throw new Error("Failed to fetch customers");
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRegistration = async (
    customerId: string,
    isRegistered: boolean
  ) => {
    try {
      const response = await fetch(
        `${SERVER_URL}/update-registration/${customerId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_registered: isRegistered }),
        }
      );

      if (!response.ok) throw new Error("Failed to update registration status");
      toast.success("Registration status updated successfully");
      await fetchCustomers(); // Refresh the table
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update registration status"
      );
    }
  };

  const handleUpdateDetails = (customer: Customer) => {
    console.log("Update Details clicked:", customer);
    setSelectedCustomer(customer);
    setUpdateCustomerData({
      contact_num: customer.contact_num || "",
      address: customer.address || "",
      email: customer.email || "",
      is_registered: customer.is_registered,
    });
    setShowUpdateDialog(true);
    console.log("Update dialog should now be open.");
  };

  const handleSaveUpdate = async () => {
    if (!selectedCustomer) return;
    try {
      const response = await fetch(
        `${SERVER_URL}/update-customer/${selectedCustomer.customer_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateCustomerData),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to update customer");
      }

      toast.success(responseData.message);
      setShowUpdateDialog(false);
      await fetchCustomers(); // Refresh the table
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update customer"
      );
    }
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      const response = await fetch(
        `${SERVER_URL}/delete-customer/${customerToDelete.customer_id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete customer");
      }

      toast.success("Customer deleted successfully");
      setShowDeleteConfirmation(false);
      await fetchCustomers(); // Refresh the table
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete customer"
      );
    }
  };

  const handleAddCustomer = async () => {
    const { first_name, last_name, plate_number, contact_num } = newCustomer;

    if (
      !first_name.trim() ||
      !last_name.trim() ||
      !plate_number.trim() ||
      !contact_num?.trim()
    ) {
      toast.error(
        "Please fill in all required fields: First Name, Last Name, Plate Number, and Contact."
      );
      return;
    }
    if (!newCustomer.vehicle_type) {
      toast.error("Please select a vehicle type.");
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/create-customer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCustomer),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create customer");
      }

      const result = await response.json();
      toast.success(result.message);

      // Reset form and close dialog
      setNewCustomer({
        first_name: "",
        last_name: "",
        is_registered: true,
        plate_number: "",
        vehicle_type: "",
        contact_num: "",
        address: "",
        email: "",
      });
      setShowAddDialog(false);

      // Refresh customer list
      fetchCustomers();
    } catch (err) {
      toast.error("Failed to create customer");
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Customer Management
        </h1>
        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) document.body.style.overflow = "unset";
          }}
        >
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] z-[9999] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>
                Add a new customer to the system. Fields marked with * are
                required.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="firstName" className="text-right">
                  First Name *
                </Label>
                <Input
                  id="firstName"
                  className="col-span-3"
                  value={newCustomer.first_name}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      first_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="lastName" className="text-right">
                  Last Name *
                </Label>
                <Input
                  id="lastName"
                  className="col-span-3"
                  value={newCustomer.last_name}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      last_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="plateNumber" className="text-right">
                  Plate Number *
                </Label>
                <Input
                  id="plateNumber"
                  className="col-span-3"
                  value={newCustomer.plate_number}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      plate_number: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isRegistered" className="text-right">
                  Registration
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Checkbox
                    id="isRegistered"
                    checked={newCustomer.is_registered}
                    onCheckedChange={(checked) =>
                      setNewCustomer({
                        ...newCustomer,
                        is_registered: checked === true,
                      })
                    }
                  />
                  <label
                    htmlFor="isRegistered"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Registered Customer
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contact" className="text-right">
                  Contact
                </Label>
                <Input
                  id="contact"
                  className="col-span-3"
                  value={newCustomer.contact_num || ""}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      contact_num: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="col-span-3"
                  value={newCustomer.email || ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="address" className="text-right">
                  Address
                </Label>
                <Input
                  id="address"
                  className="col-span-3"
                  value={newCustomer.address || ""}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, address: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicleType" className="text-right">
                  Vehicle Type
                </Label>
                <select
                  id="vehicleType"
                  className="col-span-3 border rounded-md px-3 py-2"
                  value={newCustomer.vehicle_type || ""}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      vehicle_type: e.target.value,
                    })
                  }
                >
                  <option value="">Select vehicle type</option>
                  <option value="Car">Car</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Bicycle">Bicycle</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNewCustomer({
                    first_name: "",
                    last_name: "",
                    is_registered: true,
                    plate_number: "",
                    vehicle_type: "",
                    contact_num: "",
                    address: "",
                    email: "",
                  });
                  setShowAddDialog(false);
                }}
              >
                Cancel
              </Button>

              <Button onClick={handleAddCustomer}>Save Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update Customer Dialog */}
        <Dialog
          open={showUpdateDialog}
          onOpenChange={(open) => {
            console.log("Update Dialog open:", open);
            setShowUpdateDialog(open);
            if (!open) document.body.style.overflow = "unset";
          }}
        >
          <DialogContent className="sm:max-w-[425px] z-[9999] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Update Customer Details</DialogTitle>
              <DialogDescription>
                Update details for {selectedCustomer?.first_name}{" "}
                {selectedCustomer?.last_name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="updateIsRegistered" className="text-right">
                  Registration
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <Checkbox
                    id="updateIsRegistered"
                    checked={updateCustomerData.is_registered}
                    onCheckedChange={(checked) =>
                      setUpdateCustomerData({
                        ...updateCustomerData,
                        is_registered: checked === true,
                      })
                    }
                  />
                  <label
                    htmlFor="updateIsRegistered"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Registered Customer
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="updateContact" className="text-right">
                  Contact
                </Label>
                <Input
                  id="updateContact"
                  className="col-span-3"
                  value={updateCustomerData.contact_num}
                  onChange={(e) =>
                    setUpdateCustomerData({
                      ...updateCustomerData,
                      contact_num: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="updateEmail" className="text-right">
                  Email
                </Label>
                <Input
                  id="updateEmail"
                  type="email"
                  className="col-span-3"
                  value={updateCustomerData.email}
                  onChange={(e) =>
                    setUpdateCustomerData({
                      ...updateCustomerData,
                      email: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="updateAddress" className="text-right">
                  Address
                </Label>
                <Input
                  id="updateAddress"
                  className="col-span-3"
                  value={updateCustomerData.address}
                  onChange={(e) =>
                    setUpdateCustomerData({
                      ...updateCustomerData,
                      address: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUpdateDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveUpdate}>Update Customer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={showDeleteConfirmation}
          onOpenChange={(open) => {
            setShowDeleteConfirmation(open);
            if (!open) document.body.style.overflow = "unset";
          }}
        >
          <DialogContent className="sm:max-w-[425px] z-[9999] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {customerToDelete?.first_name}{" "}
                {customerToDelete?.last_name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteCustomer}>
                Delete Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Registered Customers</CardTitle>
              <CardDescription>
                View and manage customers and their registration status.
              </CardDescription>
            </div>
            <Input
              type="text"
              placeholder="Search by name or plate number"
              className="w-[250px] md:w-[300px] border border-gray-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <div className="max-h-[480px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Customer Name</TableHead>
                    <TableHead>Vehicle Details</TableHead>
                    <TableHead>Contact Information</TableHead>
                    <TableHead>Registration Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        <div className="flex items-center justify-center">
                          Loading customers...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : customers.length > 0 ? (
                    customers.map((customer) => (
                      <TableRow key={customer.customer_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {customer.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {customer.plate_number}
                            </span>
                            <span className="text-sm text-gray-500">
                              {customer.car_model} • {customer.color}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{customer.contact_num}</span>
                            <span className="text-sm text-gray-500 truncate max-w-[200px]">
                              {customer.address}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`reg-${customer.customer_id}`}
                              checked={customer.is_registered}
                              onCheckedChange={(checked) =>
                                handleUpdateRegistration(
                                  customer.customer_id,
                                  checked === true
                                )
                              }
                            />
                            <Badge
                              variant={
                                customer.is_registered
                                  ? "default"
                                  : "destructive"
                              }
                              className="whitespace-nowrap"
                            >
                              {customer.is_registered
                                ? "Registered"
                                : "Unregistered"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu
                            open={openDropdownFor === customer.customer_id}
                            onOpenChange={(isOpen) => {
                              setOpenDropdownFor(
                                isOpen ? customer.customer_id : null
                              );
                            }}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-slate-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-[160px]"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenDropdownFor(null); // manually close the dropdown
                                  setTimeout(
                                    () => openUpdateDialog(customer),
                                    10
                                  ); // short delay
                                }}
                                className="cursor-pointer"
                              >
                                <User className="mr-2 h-4 w-4" />
                                Update Details
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  setOpenDropdownFor(null); // close menu
                                  setTimeout(
                                    () => openDeleteDialog(customer),
                                    10
                                  );
                                }}
                                className="cursor-pointer text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No customers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
