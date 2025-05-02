"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TrafficChart from "@/components/TrafficChart";
import ParkingChart from "@/components/ParkingChart";
import CustomerChart from "@/components/CustomerChart";

const AnalyticsDashboard = () => {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[90%] mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        </div>

        <Tabs defaultValue="traffic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="traffic">Traffic Analytics</TabsTrigger>
            <TabsTrigger value="parking">Parking Duration</TabsTrigger>
            <TabsTrigger value="customer">Customer Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="traffic" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Traffic Volume Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <TrafficChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parking" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Parking Duration Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <ParkingChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customer" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Visit Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerChart />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
