import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MotorcycleDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  motorcycleSpaces: number;
  vacantMotorcycleSpaces: number;
  occupiedMotorcycleSpaces: number;
  motorLotData: Array<{
    id: string;
    slot_number: number;
    status: string;
    plate_number?: string;
    current_vehicle_id?: string;
  }>;
  selectedVehicle: string | null;
  setSelectedVehicle: (value: string | null) => void;
  unassignedVehicles: Array<{
    id: string;
    plate: string;
    type: string;
  }>;
  onAssignSlot: (slotId: string) => void;
  onReleaseSlot: (slotId: string) => void;
}

const MotorcycleDialog = ({
  showDialog,
  setShowDialog,
  motorcycleSpaces,
  vacantMotorcycleSpaces,
  occupiedMotorcycleSpaces,
  motorLotData,
  selectedVehicle,
  setSelectedVehicle,
  unassignedVehicles,
  onAssignSlot,
  onReleaseSlot,
}: MotorcycleDialogProps) => {
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Motorcycle Parking Lot Management</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-green-50">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-sm font-medium">Total Spaces</p>
                    <p className="text-2xl font-bold">{motorcycleSpaces}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Available</p>
                    <p className="text-2xl font-bold text-green-600">
                      {vacantMotorcycleSpaces}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Occupied</p>
                    <p className="text-2xl font-bold text-red-600">
                      {occupiedMotorcycleSpaces}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col justify-center">
              <h3 className="text-sm font-medium mb-2">Assign Vehicle</h3>
              <Select
                value={selectedVehicle || ""}
                onValueChange={setSelectedVehicle}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select motorcycle" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} - {vehicle.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-24">Slot #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>License Plate</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {motorLotData && motorLotData.length > 0 ? (
                    [...motorLotData]
                      .sort((a, b) => a.slot_number - b.slot_number) // Sort by slot number
                      .map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell className="font-medium">
                            {slot.slot_number}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                slot.status === "occupied"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {slot.status}
                            </span>
                          </TableCell>
                          <TableCell>{slot.plate_number || "-"}</TableCell>
                          <TableCell>
                            {slot.status === "occupied" ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onReleaseSlot(slot.id)}
                              >
                                Release
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                disabled={!selectedVehicle}
                                onClick={() => onAssignSlot(slot.id)}
                              >
                                Assign
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4">
                        No motorcycle slots available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MotorcycleDialog;
