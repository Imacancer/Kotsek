"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, Printer, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import TrafficChart from "@/components/TrafficChart";
import ParkingChart from "@/components/ParkingChart";
import CustomerChart from "@/components/CustomerChart";

// Define types for the report data
interface DateRange {
  start_date: string;
  end_date: string;
  display_range: string;
}

interface TrafficOverview {
  section_title: string;
  total_entries: number;
  total_exits: number;
  total_traffic: number;
  vehicle_type_distribution: Record<string, number>;
  average_parking_duration: {
    minutes: number;
    formatted: string;
  };
}

interface DailyTrafficData {
  date: string;
  day_name: string;
  entries: number;
  exits: number;
  total: number;
}

interface DailyTrafficBreakdown {
  section_title: string;
  daily_data: DailyTrafficData[];
  busiest_day: DailyTrafficData | null;
}

interface HourlyTrafficData {
  hour: number;
  hour_display: string;
  entries: number;
  exits: number;
  total: number;
}

interface HourlyTrafficPatterns {
  section_title: string;
  hourly_data: HourlyTrafficData[];
  peak_entry_hour: HourlyTrafficData | null;
  peak_exit_hour: HourlyTrafficData | null;
}

interface ParkingSlot {
  slot_id: string;
  slot_number: string;
  section: string;
  lot_name: string;
  total_hours: number;
  total_minutes: number;
  formatted_duration: string;
}

interface SectionStatistics {
  section: string;
  lot_name: string;
  total_hours: number;
  session_count: number;
  formatted_duration: string;
}

interface SlotUtilization {
  section_title: string;
  top_utilized_slots: ParkingSlot[];
  section_statistics: SectionStatistics[];
}

interface CustomerParkingTime {
  minutes: number;
  hours: number;
  formatted: string;
}

interface CustomerData {
  customer_id: string;
  name: string;
  vehicle_type: string;
  visits: number;
  total_parking_time: CustomerParkingTime;
}

interface FavoriteSpot {
  slot_number: string;
  section: string;
  lot_name: string;
  usage_count: number;
}

interface CustomerFavoriteSpots {
  customer_id: string;
  name: string;
  favorite_spots: FavoriteSpot[];
}

interface CustomerAnalytics {
  section_title: string;
  top_customers: CustomerData[];
  customer_favorite_spots: CustomerFavoriteSpots[];
}

interface DurationAnalysis {
  section_title: string;
  duration_distribution: Record<string, number>;
}

interface ReportSection {
  section_title: string;
  [key: string]: any;
}

interface WeeklyReport {
  report_title: string;
  date_range: DateRange;
  generated_at: string;
  sections: ReportSection[];
}

const AnalyticsDashboard = () => {
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;

  const handleGenerateReport = async () => {
    if (!dateRange.from || !dateRange.to) {
      alert("Please select both start and end dates");
      return;
    }

    try {
      setIsGeneratingReport(true);

      // Format the dates as YYYY-MM-DD
      const startDateStr = format(dateRange.from, "yyyy-MM-dd");
      const endDateStr = format(dateRange.to, "yyyy-MM-dd");

      // Make API call to generate the report
      const apiUrl = `${SERVER_URL}/analytics/weekly-summary?start_date=${encodeURIComponent(
        startDateStr
      )}&end_date=${encodeURIComponent(endDateStr)}`;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to generate report: ${response.status} ${response.statusText}`
        );
      }

      const reportData: WeeklyReport = await response.json();
      generatePDFReport(reportData);
    } catch (error) {
      console.error("Error generating report:", error);
      alert(
        `Failed to generate report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Function to generate the PDF report
  const generatePDFReport = (report: WeeklyReport) => {
    // Create a new window to show the report
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      alert("Please allow pop-ups to view the report");
      return;
    }

    // Generate HTML for the report
    const htmlContent = generateReportHTML(report);

    // Write the HTML to the new window
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();

    // Wait for the content to load and then print
    reportWindow.onload = () => {
      reportWindow.print();
    };
  };

  // Function to generate HTML from the report data
  const generateReportHTML = (report: WeeklyReport): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parking Analysis - Weekly Summary</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .report-header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #FFD700;
            padding-bottom: 20px;
          }
          .report-title {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .company-name {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .company-name span.yellow {
            color: #FFD700;
          }
          .report-subtitle {
            font-size: 20px;
            margin-bottom: 20px;
            color: #555;
          }
          .report-date {
            font-size: 16px;
            margin-bottom: 5px;
          }
          .report-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            border-bottom: 2px solid #ddd;
            padding-bottom: 8px;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .stat-box {
            display: inline-block;
            width: 23%;
            margin: 0 1% 20px 0;
            padding: 20px;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            background-color: #fcfcfc;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #0066cc;
          }
          .stat-label {
            font-size: 14px;
            color: #666;
          }
          .highlight {
            font-weight: bold;
            color: #0066cc;
          }
          .subsection-title {
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            color: #444;
          }
          .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #777;
            font-size: 12px;
          }
          .page-break {
            page-break-before: always;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="company-name"><span>Ko</span><span class="yellow">tsek</span></div>
          <div class="report-subtitle">Parking Analysis</div>
          <div class="report-title">${report.report_title}</div>
          <div class="report-date">${report.date_range.display_range}</div>
          <div class="report-date">Generated on: ${new Date().toLocaleString()}</div>
        </div>
        
        ${report.sections.map((section) => renderSection(section)).join("")}
        
        <div class="footer">
          <p>This report was generated automatically by the Kotsek Parking Management System.</p>
          <p>For questions or additional information, please contact the system administrator.</p>
        </div>
        
        <div class="no-print">
          <button onclick="window.print()">Print Report</button>
        </div>
      </body>
      </html>
    `;
  };

  // Function to render different sections based on their content
  const renderSection = (section: ReportSection): string => {
    switch (section.section_title) {
      case "Traffic Overview":
        return renderTrafficOverview(section as TrafficOverview);
      case "Daily Traffic Breakdown":
        return renderDailyBreakdown(section as DailyTrafficBreakdown);
      case "Hourly Traffic Patterns":
        return renderHourlyPatterns(section as HourlyTrafficPatterns);
      case "Parking Slot Utilization":
        return renderSlotUtilization(section as SlotUtilization);
      case "Customer Analytics":
        return renderCustomerAnalytics(section as CustomerAnalytics);
      case "Parking Duration Analysis":
        return renderDurationAnalysis(section as DurationAnalysis);
      default:
        return `
          <div class="report-section">
            <div class="section-title">${section.section_title}</div>
            <pre>${JSON.stringify(section, null, 2)}</pre>
          </div>
        `;
    }
  };

  // Render Traffic Overview section
  const renderTrafficOverview = (section: TrafficOverview): string => {
    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <div class="stat-box">
          <div class="stat-value">${section.total_entries}</div>
          <div class="stat-label">Total Entries</div>
        </div>
        
        <div class="stat-box">
          <div class="stat-value">${section.total_exits}</div>
          <div class="stat-label">Total Exits</div>
        </div>
        
        <div class="stat-box">
          <div class="stat-value">${section.total_traffic}</div>
          <div class="stat-label">Total Traffic</div>
        </div>
        
        <div class="stat-box">
          <div class="stat-value">${
            section.average_parking_duration.formatted
          }</div>
          <div class="stat-label">Avg. Duration</div>
        </div>
        
        <div style="clear: both; margin-bottom: 30px;"></div>
        
        <div class="subsection-title">Vehicle Type Distribution</div>
        <table>
          <thead>
            <tr>
              <th>Vehicle Type</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(section.vehicle_type_distribution || {})
              .map(([type, count]) => {
                const percentage = (
                  (count / section.total_entries) *
                  100
                ).toFixed(1);
                return `
                <tr>
                  <td>${type}</td>
                  <td>${count}</td>
                  <td>${percentage}%</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  // Render Daily Breakdown section
  const renderDailyBreakdown = (section: DailyTrafficBreakdown): string => {
    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Entries</th>
              <th>Exits</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${section.daily_data
              .map(
                (day) => `
              <tr ${
                section.busiest_day && day.date === section.busiest_day.date
                  ? 'style="font-weight: bold; background-color: #f0f7ff;"'
                  : ""
              }>
                <td>${day.date}</td>
                <td>${day.day_name}</td>
                <td>${day.entries}</td>
                <td>${day.exits}</td>
                <td>${day.total}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        ${
          section.busiest_day
            ? `
          <div style="margin-top: 20px;">
            <span class="highlight">Busiest Day:</span> ${section.busiest_day.day_name} (${section.busiest_day.date}) with ${section.busiest_day.total} total vehicles
          </div>
        `
            : ""
        }
      </div>
    `;
  };

  // Render Hourly Patterns section
  const renderHourlyPatterns = (section: HourlyTrafficPatterns): string => {
    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <table>
          <thead>
            <tr>
              <th>Hour</th>
              <th>Entries</th>
              <th>Exits</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${section.hourly_data
              .map(
                (hour) => `
              <tr ${
                (section.peak_entry_hour &&
                  hour.hour === section.peak_entry_hour.hour) ||
                (section.peak_exit_hour &&
                  hour.hour === section.peak_exit_hour.hour)
                  ? 'style="font-weight: bold; background-color: #f0f7ff;"'
                  : ""
              }>
                <td>${hour.hour_display}</td>
                <td>${hour.entries}</td>
                <td>${hour.exits}</td>
                <td>${hour.total}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <div style="margin-top: 20px;">
          ${
            section.peak_entry_hour
              ? `
            <div style="margin-bottom: 10px;">
              <span class="highlight">Peak Entry Hour:</span> ${section.peak_entry_hour.hour_display} with ${section.peak_entry_hour.entries} entries
            </div>
          `
              : ""
          }
          
          ${
            section.peak_exit_hour
              ? `
            <div>
              <span class="highlight">Peak Exit Hour:</span> ${section.peak_exit_hour.hour_display} with ${section.peak_exit_hour.exits} exits
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  };

  // Render Slot Utilization section
  const renderSlotUtilization = (section: SlotUtilization): string => {
    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <div class="subsection-title">Top Utilized Slots</div>
        <table>
          <thead>
            <tr>
              <th>Slot Number</th>
              <th>Section</th>
              <th>Lot</th>
              <th>Total Duration</th>
            </tr>
          </thead>
          <tbody>
            ${section.top_utilized_slots
              .map(
                (slot, index) => `
              <tr ${
                index === 0
                  ? 'style="font-weight: bold; background-color: #f0f7ff;"'
                  : ""
              }>
                <td>${slot.slot_number}</td>
                <td>${slot.section}</td>
                <td>${slot.lot_name}</td>
                <td>${slot.formatted_duration}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <div class="subsection-title">Section Statistics</div>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Lot</th>
              <th>Total Sessions</th>
              <th>Total Duration</th>
            </tr>
          </thead>
          <tbody>
            ${section.section_statistics
              .map(
                (stat) => `
              <tr>
                <td>${stat.section}</td>
                <td>${stat.lot_name}</td>
                <td>${stat.session_count}</td>
                <td>${stat.formatted_duration}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  // Render Customer Analytics section
  const renderCustomerAnalytics = (section: CustomerAnalytics): string => {
    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <div class="subsection-title">Top Customers</div>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Vehicle Type</th>
              <th>Visits</th>
              <th>Total Parking Time</th>
            </tr>
          </thead>
          <tbody>
            ${section.top_customers
              .map(
                (customer) => `
              <tr>
                <td>${customer.name}</td>
                <td>${customer.vehicle_type}</td>
                <td>${customer.visits}</td>
                <td>${customer.total_parking_time.formatted}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        ${
          section.customer_favorite_spots.length > 0
            ? `
          <div class="subsection-title">Customer Favorite Spots</div>
          ${section.customer_favorite_spots
            .map(
              (customer) => `
            <div style="margin-bottom: 20px;">
              <strong>${customer.name}</strong>
              <ul>
                ${customer.favorite_spots
                  .map(
                    (spot) => `
                  <li>Slot ${spot.slot_number} (${spot.section}, ${spot.lot_name}) - Used ${spot.usage_count} times</li>
                `
                  )
                  .join("")}
              </ul>
            </div>
          `
            )
            .join("")}
        `
            : ""
        }
      </div>
    `;
  };

  // Render Duration Analysis section
  const renderDurationAnalysis = (section: DurationAnalysis): string => {
    // Calculate total for percentages
    const total = Object.values(section.duration_distribution).reduce(
      (sum, count) => sum + count,
      0
    );

    return `
      <div class="report-section">
        <div class="section-title">${section.section_title}</div>
        
        <table>
          <thead>
            <tr>
              <th>Duration Range</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(section.duration_distribution)
              .map(([range, count]) => {
                const percentage =
                  total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                return `
                <tr>
                  <td>${range}</td>
                  <td>${count}</td>
                  <td>${percentage}%</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-[90%] mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to,
                  }}
                  onSelect={(range) => {
                    setDateRange({
                      from: range?.from,
                      to: range?.to,
                    });
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || !dateRange.from || !dateRange.to}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Printer size={18} />
              {isGeneratingReport ? "Generating..." : "Generate Report"}
            </Button>
          </div>
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