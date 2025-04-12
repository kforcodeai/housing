"use client";
import { useState, useEffect } from "react";
import type React from "react";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BarChart3, LineChart, AlertCircle, Home } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Define types
interface HousingData {
  YEAR: number;
  COUNTY: string;
  Classification: "ADU" | "NON_ADU" | "POTENTIAL_ADU_CONVERSION";
  JOB_VALUE: number;
  [key: string]: any;
}

interface UnitsByYearData {
  year: string;
  ADU: number;
  NON_ADU: number;
  POTENTIAL_ADU_CONVERSION: number;
  aduLabel: string;
  nonAduLabel: string;
  potentialAduLabel: string;
}

interface UnitsByJurisdictionData {
  county: string;
  total: number;
  ADU: number;
  NON_ADU: number;
  POTENTIAL_ADU_CONVERSION: number;
  aduLabel: string;
  nonAduLabel: string;
  potentialAduLabel: string;
}

interface JobValueData {
  year: string;
  ADU?: number;
  NON_ADU?: number;
  POTENTIAL_ADU_CONVERSION?: number;
  ADULabel?: string;
  NON_ADULabel?: string;
  POTENTIAL_ADU_CONVERSIONLabel?: string;
  [key: string]: any;
}

interface JobValueByCountyData {
  county: string;
  avgValue: number;
  count: number;
  avgValueLabel: string;
}

interface AverageAduJobValueByYearData {
  year: string;
  avgAduValue: number;
  count: number;
  valueLabel: string;
}

interface ChartDataState {
  unitsByYear: UnitsByYearData[];
  unitsByJurisdiction: UnitsByJurisdictionData[];
  jobValueByYear: JobValueData[];
  jobValueByCounty: JobValueByCountyData[];
  averageAduJobValueByYear: AverageAduJobValueByYearData[];
}

interface ValueAggregate {
  sum: number;
  count: number;
}

interface JobValueByYearAndType {
  [year: string]: {
    ADU: ValueAggregate;
    NON_ADU: ValueAggregate;
    POTENTIAL_ADU_CONVERSION: ValueAggregate;
    [key: string]: ValueAggregate;
  };
}

interface JobValueByCounty {
  [county: string]: ValueAggregate;
}

interface UnitsByYearAndType {
  [year: string]: {
    ADU: number;
    NON_ADU: number;
    POTENTIAL_ADU_CONVERSION: number;
    [key: string]: number;
  };
}

interface UnitsByJurisdictionAndType {
  [county: string]: {
    ADU: number;
    NON_ADU: number;
    POTENTIAL_ADU_CONVERSION: number;
    [key: string]: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

// For file input
interface FileInputEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & {
    files: FileList;
  };
}

const HousingDashboard = () => {
  const [data, setData] = useState<HousingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataState>({
    unitsByYear: [],
    unitsByJurisdiction: [],
    jobValueByYear: [],
    jobValueByCounty: [],
    averageAduJobValueByYear: [],
  });
  const [activeTab, setActiveTab] = useState<string>("units");

  // Modern color scheme
  const colors = {
    adu: "#3b82f6", // Blue
    nonAdu: "#10b981", // Green
    potentialAdu: "#f97316", // Orange
    background: "#f8fafc", // Light gray background
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch CSV from public folder - CSV should be placed in your public folder
        const response = await fetch("/housing_data.csv");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const csvText = await response.text();

        const parsedData = Papa.parse<HousingData>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        if (parsedData.errors && parsedData.errors.length > 0) {
          setError(`CSV parsing error: ${parsedData.errors[0].message}`);
          setLoading(false);
          return;
        }

        setData(parsedData.data);
        processData(parsedData.data);
      } catch (error) {
        console.error("Error loading data:", error);
        setError(
          `Error loading data: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // File input handler for browser-based file upload
  const handleFileUpload = (event: FileInputEvent) => {
    setLoading(true);
    setError(null);

    const file = event.target.files[0];
    if (!file) {
      setLoading(false);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const csvText = e.target?.result as string;
        const parsedData = Papa.parse<HousingData>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        if (parsedData.errors && parsedData.errors.length > 0) {
          setError(`CSV parsing error: ${parsedData.errors[0].message}`);
          setLoading(false);
          return;
        }

        setData(parsedData.data);
        processData(parsedData.data);
        setLoading(false);
      } catch (error) {
        console.error("Error parsing file:", error);
        setError(
          `Error parsing file: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Error reading file");
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const processData = (data: HousingData[]) => {
    // 1. Units by Structure Type over time
    const unitsByYear = processUnitsByYear(data);

    // 2. Units by Jurisdiction and Type
    const unitsByJurisdiction = processUnitsByJurisdiction(data);

    // 3. JOB_VALUE by year for each type
    const jobValueByYear = processJobValueByYear(data);

    // 4. JOB_VALUE by county
    const jobValueByCounty = processJobValueByCounty(data);

    // 5. Average ADU Job Value by Year
    const averageAduJobValueByYear = processAverageAduJobValueByYear(data);

    setChartData({
      unitsByYear,
      unitsByJurisdiction,
      jobValueByYear,
      jobValueByCounty,
      averageAduJobValueByYear,
    });
  };

  const processUnitsByYear = (data: HousingData[]): UnitsByYearData[] => {
    const unitsByYearAndType: UnitsByYearAndType = {};

    data.forEach((row) => {
      if (row.YEAR && row.Classification) {
        const year = row.YEAR.toString();
        if (!unitsByYearAndType[year]) {
          unitsByYearAndType[year] = {
            ADU: 0,
            NON_ADU: 0,
            POTENTIAL_ADU_CONVERSION: 0,
          };
        }

        if (row.Classification in unitsByYearAndType[year]) {
          unitsByYearAndType[year][row.Classification]++;
        }
      }
    });

    return Object.keys(unitsByYearAndType)
      .sort()
      .map((year) => ({
        year,
        ADU: unitsByYearAndType[year]["ADU"],
        NON_ADU: unitsByYearAndType[year]["NON_ADU"],
        POTENTIAL_ADU_CONVERSION:
          unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"],
        // Add labels for the chart
        aduLabel:
          unitsByYearAndType[year]["ADU"] > 50
            ? `${unitsByYearAndType[year]["ADU"]}`
            : "",
        nonAduLabel: `${unitsByYearAndType[year]["NON_ADU"]}`,
        potentialAduLabel:
          unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"] > 5
            ? `${unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"]}`
            : "",
      }));
  };

  const processUnitsByJurisdiction = (
    data: HousingData[]
  ): UnitsByJurisdictionData[] => {
    const unitsByJurisdictionAndType: UnitsByJurisdictionAndType = {};

    data.forEach((row) => {
      if (row.COUNTY && row.Classification) {
        if (!unitsByJurisdictionAndType[row.COUNTY]) {
          unitsByJurisdictionAndType[row.COUNTY] = {
            ADU: 0,
            NON_ADU: 0,
            POTENTIAL_ADU_CONVERSION: 0,
          };
        }

        if (row.Classification in unitsByJurisdictionAndType[row.COUNTY]) {
          unitsByJurisdictionAndType[row.COUNTY][row.Classification]++;
        }
      }
    });

    // Sort counties by total units and take top 15
    return Object.entries(unitsByJurisdictionAndType)
      .map(([county, counts]) => ({
        county,
        total: counts.ADU + counts.NON_ADU + counts.POTENTIAL_ADU_CONVERSION,
        ADU: counts.ADU,
        NON_ADU: counts.NON_ADU,
        POTENTIAL_ADU_CONVERSION: counts.POTENTIAL_ADU_CONVERSION,
        // Add labels for the chart
        aduLabel: counts.ADU > 50 ? `${counts.ADU}` : "",
        nonAduLabel: counts.NON_ADU > 1000 ? `${counts.NON_ADU}` : "",
        potentialAduLabel:
          counts.POTENTIAL_ADU_CONVERSION > 10
            ? `${counts.POTENTIAL_ADU_CONVERSION}`
            : "",
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  };

  const processJobValueByYear = (data: HousingData[]): JobValueData[] => {
    const jobValueByYearAndType: JobValueByYearAndType = {};

    data.forEach((row) => {
      if (row.YEAR && row.Classification && row.JOB_VALUE) {
        const year = row.YEAR.toString();
        if (!jobValueByYearAndType[year]) {
          jobValueByYearAndType[year] = {
            ADU: { sum: 0, count: 0 },
            NON_ADU: { sum: 0, count: 0 },
            POTENTIAL_ADU_CONVERSION: { sum: 0, count: 0 },
          };
        }

        if (row.Classification in jobValueByYearAndType[year]) {
          jobValueByYearAndType[year][row.Classification].sum += row.JOB_VALUE;
          jobValueByYearAndType[year][row.Classification].count += 1;
        }
      }
    });

    // Calculate averages
    return Object.keys(jobValueByYearAndType)
      .sort()
      .map((year) => {
        const result: JobValueData = { year };

        Object.entries(jobValueByYearAndType[year]).forEach(([type, data]) => {
          const avg =
            data.count > 0 ? Math.round(data.sum / data.count / 1000) : 0; // Convert to K
          result[type] = avg;
          result[`${type}Label`] = avg > 0 ? `${avg}K` : "";
        });

        return result;
      });
  };

  const processJobValueByCounty = (
    data: HousingData[]
  ): JobValueByCountyData[] => {
    const jobValueByCounty: JobValueByCounty = {};

    data.forEach((row) => {
      if (row.COUNTY && row.JOB_VALUE) {
        if (!jobValueByCounty[row.COUNTY]) {
          jobValueByCounty[row.COUNTY] = { sum: 0, count: 0 };
        }

        jobValueByCounty[row.COUNTY].sum += row.JOB_VALUE;
        jobValueByCounty[row.COUNTY].count += 1;
      }
    });

    // Calculate averages and sort by average job value
    return Object.entries(jobValueByCounty)
      .map(([county, data]) => {
        const avgValue =
          data.count > 0 ? Math.round(data.sum / data.count / 1000) : 0; // Convert to K
        return {
          county,
          avgValue,
          count: data.count,
          avgValueLabel: avgValue > 0 ? `${avgValue}K` : "",
        };
      })
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 15);
  };

  // New function to process average ADU job values by year
  const processAverageAduJobValueByYear = (
    data: HousingData[]
  ): AverageAduJobValueByYearData[] => {
    // Create an object to hold the sum and count of ADU job values by year
    const aduJobValuesByYear: Record<string, ValueAggregate> = {};

    // Process each data row
    data.forEach((row) => {
      if (row.YEAR && row.Classification === "ADU" && row.JOB_VALUE) {
        const year = row.YEAR.toString();
        if (!aduJobValuesByYear[year]) {
          aduJobValuesByYear[year] = { sum: 0, count: 0 };
        }

        aduJobValuesByYear[year].sum += row.JOB_VALUE;
        aduJobValuesByYear[year].count += 1;
      }
    });

    // Convert the aggregated data into the desired format
    return Object.keys(aduJobValuesByYear)
      .sort()
      .map((year) => {
        const avgValue =
          aduJobValuesByYear[year].count > 0
            ? Math.round(
                aduJobValuesByYear[year].sum /
                  aduJobValuesByYear[year].count /
                  1000
              )
            : 0; // Convert to K

        return {
          year,
          avgAduValue: avgValue,
          count: aduJobValuesByYear[year].count,
          valueLabel: avgValue > 0 ? `${avgValue}K` : "",
        };
      });
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg"
          role="tooltip"
          aria-live="polite"
        >
          <p className="font-bold text-gray-800 mb-1">{`${label}`}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></div>
              <p style={{ color: entry.color }}>{`${
                entry.name
              }: ${entry.value.toLocaleString()}`}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 ">
          <h1 className="text-3xl font-bold">Housing Data Dashboard</h1>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[400px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto bg-background">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Housing Data Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Analysis of housing permits and job values across jurisdictions
          </p>
        </div>
      </div>

      <Tabs
        defaultValue="units"
        value={activeTab}
        onValueChange={setActiveTab}
        className="mb-8"
      >
        <TabsList className="grid w-full grid-cols-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <TabsTrigger
            value="units"
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === "units"
                ? "bg-white dark:bg-gray-700 text-primary shadow-sm"
                : "text-muted-foreground hover:text-primary/80"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Units Analysis</span>
          </TabsTrigger>
          <TabsTrigger
            value="values"
            className={`flex items-center gap-2 transition-all duration-200 ${
              activeTab === "values"
                ? "bg-white dark:bg-gray-700 text-primary shadow-sm"
                : "text-muted-foreground hover:text-primary/80"
            }`}
          >
            <LineChart className="h-4 w-4" />
            <span>Job Value Analysis</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="units"
          className="mt-6 transition-opacity duration-300 ease-in-out"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Units by Structure Type over time */}
            <Card className="lg:col-span-2 shadow-md">
              <CardHeader className="text-center">
                <CardTitle className="font-bold">
                  Units Permitted by Structure Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart
                    data={chartData.unitsByYear}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fill: "#64748b" }} />
                    <YAxis tick={{ fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="POTENTIAL_ADU_CONVERSION"
                      name="Potential ADU Conversion"
                      stackId="1"
                      fill={colors.potentialAdu}
                      stroke={colors.potentialAdu}
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="ADU"
                      name="ADU"
                      stackId="1"
                      fill={colors.adu}
                      stroke={colors.adu}
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="NON_ADU"
                      name="Non-ADU"
                      stackId="1"
                      fill={colors.nonAdu}
                      stroke={colors.nonAdu}
                      fillOpacity={0.8}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 2: Units by Jurisdiction */}
            <Card className="shadow-md">
              <CardHeader className="text-center">
                <CardTitle className="font-bold">
                  Units by Jurisdiction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData.unitsByJurisdiction}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="county"
                      tick={{ fill: "#64748b" }}
                      width={90}
                      style={{ fontSize: "12px" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="ADU"
                      name="ADU"
                      stackId="a"
                      fill={colors.adu}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="NON_ADU"
                      name="Non-ADU"
                      stackId="a"
                      fill={colors.nonAdu}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="POTENTIAL_ADU_CONVERSION"
                      name="Potential ADU Conversion"
                      stackId="a"
                      fill={colors.potentialAdu}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="values"
          className="mt-6 transition-opacity duration-300 ease-in-out"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Chart 3: JOB_VALUE by Year and Type */}
            <Card className="shadow-md">
              <CardHeader className="flex justify-center">
                <CardTitle className="text-center font-bold">
                  Average Job Value by Structure Type (K)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart
                    data={chartData.jobValueByYear}
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fill: "#64748b" }} />
                    <YAxis tick={{ fill: "#64748b" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="POTENTIAL_ADU_CONVERSION"
                      name="Potential ADU Conversion"
                      stackId="1"
                      fill={colors.potentialAdu}
                      stroke={colors.potentialAdu}
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="ADU"
                      name="ADU"
                      stackId="1"
                      fill={colors.adu}
                      stroke={colors.adu}
                      fillOpacity={0.8}
                    />
                    <Area
                      type="monotone"
                      dataKey="NON_ADU"
                      name="Non-ADU"
                      stackId="1"
                      fill={colors.nonAdu}
                      stroke={colors.nonAdu}
                      fillOpacity={0.8}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 4: JOB_VALUE by County */}
            <Card className="shadow-md">
              <CardHeader className="text-center">
                <CardTitle className="font-bold">
                  Average Job Value by County
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData.jobValueByCounty}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fill: "#64748b" }} />
                    <YAxis
                      type="category"
                      dataKey="county"
                      tick={{ fill: "#64748b" }}
                      width={90}
                      style={{ fontSize: "12px" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="avgValue"
                      name="Average Job Value (K)"
                      fill={colors.adu}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* NEW CHART: Average ADU Job Value by Year */}
          <Card className="shadow-md">
            <CardHeader className="text-center">
              <CardTitle className="font-bold flex items-center justify-center gap-2">
                <Home className="h-5 w-5" />
                Average ADU Job Value by Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={chartData.averageAduJobValueByYear}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fill: "#64748b" }} />
                  <YAxis tick={{ fill: "#64748b" }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-bold text-gray-800 mb-1">{`Year: ${label}`}</p>
                            <p
                              className="text-sm"
                              style={{ color: colors.adu }}
                            >
                              {`Average ADU Job Value: $${data.avgAduValue.toLocaleString()}K`}
                            </p>
                            <p className="text-sm text-gray-600">{`Number of ADUs: ${data.count}`}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="avgAduValue"
                    name="Average ADU Job Value (K)"
                    fill={colors.adu}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Data last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default HousingDashboard;
