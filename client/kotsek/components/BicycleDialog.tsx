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

interface BicycleDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  currentSection: "bike area left" | "bike area right"; // Updated to match database names
  setCurrentSection: (section: string) => void;
  bikeData: Array<{
    id: string;
    slot_number: number;
    status: string;
    plate_number?: string;
    current_vehicle_id?: string;
    section: string;       // ✅ Add this
    lot_id: string; 
  }>;
  selectedVehicle: string | null;
  setSelectedVehicle: (value: string | null) => void;
  unassignedVehicles: Array<{
    id: string;
    plate: string;
    type: string;
  }>;
  onAssignSlot: (slot_number: number, section: string, lot_id: string) => void;
  onReleaseSlot: (slotId: string) => void;
}

const BicycleDialog = ({
  showDialog,
  setShowDialog,
  currentSection,
  setCurrentSection,
  bikeData,
  selectedVehicle,
  setSelectedVehicle,
  unassignedVehicles,
  onAssignSlot,
  onReleaseSlot,
}: BicycleDialogProps) => {
  // Simplified display name for UI
  const areaName = currentSection === "bike area left" ? "Left" : "Right";

  return (
    <Dialog
      open={showDialog}
      onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setCurrentSection("");
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bicycle Area {areaName} Management</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-green-50">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-sm font-medium">Total Spaces</p>
                    <p className="text-2xl font-bold">{bikeData.length}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Available</p>
                    <p className="text-2xl font-bold text-green-600">
                      {
                        bikeData.filter((slot) => slot.status !== "occupied")
                          .length
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Occupied</p>
                    <p className="text-2xl font-bold text-red-600">
                      {
                        bikeData.filter((slot) => slot.status === "occupied")
                          .length
                      }
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
                  <SelectValue placeholder="Select bicycle" />
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
                    <TableHead>License/ID</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bikeData && bikeData.length > 0 ? (
                    [...bikeData]
                      .sort((a, b) => a.slot_number - b.slot_number) // Sort by slot number
                      .map((slot) => (
                        <TableRow key={slot.id}>
                          <TableCell className="font-medium">
                            {slot.slot_number}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                                onClick={() => onAssignSlot(slot.slot_number, slot.section, slot.lot_id)}
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
                        No bicycle slots available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BicycleDialog;
