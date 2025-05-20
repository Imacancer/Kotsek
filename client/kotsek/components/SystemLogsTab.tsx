"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { generateSystemLogsPDF } from "./SystemLogsPDF";

interface SystemLog {
  id: string;
  timestamp: string;
  log_type: string;
  action: string;
  details: any;
  user_id: string;
  ip_address: string;
}

export default function SystemLogsTab() {
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [allLogs, setAllLogs] = useState<SystemLog[]>([]); // Store all logs
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: "",
    search: "",
    action: "",
    dateRange: undefined as DateRange | undefined,
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // Initial fetch of all logs
  useEffect(() => {
    fetchAllLogs();
  }, []);

  // Filter logs whenever filters change
  useEffect(() => {
    filterLogs();
  }, [
    debouncedSearch,
    filters.type,
    filters.action,
    filters.dateRange,
    allLogs,
  ]);

  const fetchAllLogs = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      const response = await axios.get(`${SERVER_URL}/admin/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAllLogs(response.data.logs);
      setLogs(response.data.logs);

      // Extract unique actions from logs
      const actions = [
        ...new Set(response.data.logs.map((log: SystemLog) => log.action)),
      ] as string[];
      setAvailableActions(actions);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to fetch system logs");
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filteredLogs = [...allLogs];

    // Filter by type
    if (filters.type && filters.type !== "All Types") {
      filteredLogs = filteredLogs.filter(
        (log) => log.log_type === filters.type
      );
    }

    // Filter by action
    if (filters.action) {
      filteredLogs = filteredLogs.filter(
        (log) => log.action === filters.action
      );
    }

    // Filter by date range
    if (filters.dateRange?.from) {
      filteredLogs = filteredLogs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate >= filters.dateRange!.from!;
      });
    }
    if (filters.dateRange?.to) {
      filteredLogs = filteredLogs.filter((log) => {
        const logDate = new Date(log.timestamp);
        return logDate <= filters.dateRange!.to!;
      });
    }

    // Filter by search text
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.action.toLowerCase().includes(searchLower) ||
          log.log_type.toLowerCase().includes(searchLower) ||
          log.timestamp.toLowerCase().includes(searchLower) ||
          (log.details &&
            JSON.stringify(log.details).toLowerCase().includes(searchLower))
      );
    }

    setLogs(filteredLogs);
  };

  const exportLogs = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      // Generate PDF
      const doc = await generateSystemLogsPDF(logs, filters);

      // Save the PDF
      doc.save(`system-logs-${new Date().toISOString()}.pdf`);

      toast.success("Logs exported successfully");
    } catch (error) {
      console.error("Error exporting logs:", error);
      toast.error("Failed to export logs");
    }
  };

  return (
    <Card className="h-full w-full lg:w-[350px] xl:w-[400px] lg:fixed lg:right-0 lg:top-0 lg:mr-4 lg:mt-4">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">System Logs</h2>
        <div className="flex flex-col gap-3 mb-4">
          {/* Type Filter */}
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters({ ...filters, type: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Types">All Types</SelectItem>
              <SelectItem value="user_action">User Actions</SelectItem>
              <SelectItem value="system_event">System Events</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Picker */}
          <div className="w-full">
            <DatePickerWithRange
              date={filters.dateRange}
              onDateChange={(range) =>
                setFilters({ ...filters, dateRange: range })
              }
            />
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              className="w-full pl-10"
            />
          </div>

          {/* Export Button */}
          <Button onClick={exportLogs} size="sm" className="w-full">
            Export
          </Button>
        </div>

        <div className="rounded-md border h-[400px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead className="whitespace-nowrap">Time</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center py-4 text-gray-500"
                  >
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.log_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs">
                      {log.action}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}