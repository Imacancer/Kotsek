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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  is_verified: boolean;
  image_url: string | null;
}

export default function UserManagementTab() {
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      const response = await axios.get(`${SERVER_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      const response = await axios.put(
        `${SERVER_URL}/admin/users/${userId}/role`,
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        setUsers(
          users.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );
        toast.success("User role updated successfully");
      }
    } catch (error) {
      console.error("Error changing user role:", error);
      toast.error("Failed to update user role");
    }
  };

  const toggleUserBlock = async (
    userId: string,
    currentBlockedStatus: boolean
  ) => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      const endpoint = currentBlockedStatus ? "unblock" : "block";
      const response = await axios.put(
        `${SERVER_URL}/admin/users/${userId}/${endpoint}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        setUsers(
          users.map((user) =>
            user.id === userId
              ? { ...user, is_blocked: !currentBlockedStatus }
              : user
          )
        );
        toast.success(
          `User ${currentBlockedStatus ? "unblocked" : "blocked"} successfully`
        );
      }
    } catch (error) {
      console.error("Error toggling user block status:", error);
      toast.error(
        `Failed to ${currentBlockedStatus ? "unblock" : "block"} user`
      );
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const token = sessionStorage.getItem("access_token");
      if (!token) return;

      const response = await axios.delete(
        `${SERVER_URL}/admin/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data) {
        setUsers(users.filter((user) => user.id !== userId));
        toast.success("User deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage system users and their roles</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "Admin" ? "default" : "secondary"}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_blocked ? "destructive" : "default"}
                    >
                      {user.is_blocked ? "Blocked" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.role !== "Admin" && (
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "Admin")}
                          >
                            Change to Admin
                          </DropdownMenuItem>
                        )}
                        {user.role !== "Manager" && (
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "Manager")}
                          >
                            Change to Manager
                          </DropdownMenuItem>
                        )}
                        {user.role !== "Attendant" && (
                          <DropdownMenuItem
                            onClick={() => changeUserRole(user.id, "Attendant")}
                          >
                            Change to Attendant
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            toggleUserBlock(user.id, user.is_blocked)
                          }
                        >
                          {user.is_blocked ? "Unblock User" : "Block User"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteUser(user.id)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}