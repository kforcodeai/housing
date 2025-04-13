"use client";
import { useState, useEffect } from "react";
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
  ReferenceLine,
} from "recharts";
import Papa from "papaparse";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  LineChart as LineChartIcon,
  AlertCircle,
  Home,
  PieChart as PieChartIcon,
  TrendingUp,
  Map,
  Download,
  Info,
  HelpCircle,
  Calendar,
  DollarSign,
  Percent,
  Building,
  Waves,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface HousingData {
  YEAR: number;
  COUNTY: string;
  STATE?: string;
  Classification: "ADU" | "NON_ADU" | "POTENTIAL_ADU_CONVERSION";
  JOB_VALUE: number;
  [key: string]: any;
}

interface UnitsByYearData {
  year: string;
  ADU: number;
  NON_ADU: number;
  POTENTIAL_ADU_CONVERSION: number;
}

interface AduPercentageByYearData {
  year: string;
  aduPercentage: number;
  aduCount: number;
  totalCount: number;
}

interface UnitsByJurisdictionData {
  county: string;
  total: number;
  ADU: number;
}

interface JobValueByCountyData {
  county: string;
  avgValue: number;
  count: number;
}

interface AverageAduJobValueByYearData {
  year: string;
  avgAduValue: number;
  count: number;
}

interface AduJobValuePercentageByYearData {
  year: string;
  aduJobValuePercentage: number;
  aduValue: number;
  totalValue: number;
}

interface AvgJobValueByStructureTypeAndYearData {
  year: string;
  ADU: number;
  NON_ADU: number;
  POTENTIAL_ADU_CONVERSION: number;
}

interface ChartDataState {
  unitsByYear: UnitsByYearData[];
  aduPercentageByYear: AduPercentageByYearData[];
  unitsByJurisdiction: UnitsByJurisdictionData[];
  aduJobValuePercentageByYear: AduJobValuePercentageByYearData[];
  avgJobValueByStructureTypeAndYear: AvgJobValueByStructureTypeAndYearData[];
  jobValueByCounty: JobValueByCountyData[];
  averageAduJobValueByYear: AverageAduJobValueByYearData[]; // still used in certain cards if needed
}

interface ValueAggregate {
  sum: number;
  count: number;
}

// Sample data in case CSV not available
const generateSampleData = (): HousingData[] => {
  const counties = [
    "Santa Clara",
    "Los Angeles",
    "San Diego",
    "Alameda",
    "Orange",
    "San Francisco",
    "Riverside",
  ];
  const years = [2018, 2019, 2020, 2021, 2022, 2023];
  const classifications = ["ADU", "NON_ADU", "POTENTIAL_ADU_CONVERSION"];

  return Array.from({ length: 300 }, (_, i) => ({
    YEAR: years[Math.floor(Math.random() * years.length)],
    COUNTY: counties[Math.floor(Math.random() * counties.length)],
    Classification:
      classifications[Math.floor(Math.random() * classifications.length)] as any,
    JOB_VALUE: Math.floor(Math.random() * 300000) + 100000,
    ID: i + 1,
  }));
};

const THEME_COLORS = {
  adu: "#2563eb", // Primary blue
  nonAdu: "#10b981", // Green
  potentialAdu: "#f97316", // Orange
  primary: "#2563eb",
  secondary: "#64748b",
  accent: "#f0f9ff",
  muted: "#94a3b8",
  background: "#f8fafc",
  card: "#ffffff",
  cardHover: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
};

const HousingDashboard = () => {
  const [data, setData] = useState<HousingData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataState>({
    unitsByYear: [],
    aduPercentageByYear: [],
    unitsByJurisdiction: [],
    aduJobValuePercentageByYear: [],
    avgJobValueByStructureTypeAndYear: [],
    jobValueByCounty: [],
    averageAduJobValueByYear: [],
  });
  const [activeTab, setActiveTab] = useState<string>("overview");
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/housing_data.csv");

        // If fetch fails, use sample data
        if (!response.ok) {
          console.warn("Using sample data as CSV couldn't be loaded");
          const sampleData = generateSampleData();
          setData(sampleData);
          processData(sampleData);
          return;
        }

        const csvText = await response.text();
        const parsedData = Papa.parse<HousingData>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });

        if (parsedData.errors?.length) {
          throw new Error(parsedData.errors[0].message);
        }

        setData(parsedData.data);
        processData(parsedData.data);
      } catch (err) {
        console.error("Error loading data:", err);
        const sampleData = generateSampleData();
        setData(sampleData);
        processData(sampleData);
        setError("Error loading CSV data. Using sample data instead.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* --------------------------
   * PROCESSING FUNCTIONS
   * -------------------------- */

  // 1) Units by year, for wave-like chart
  const processUnitsByYear = (data: HousingData[]): UnitsByYearData[] => {
    const unitsByYear = data.reduce((acc, row) => {
      const year = row.YEAR.toString();
      if (!acc[year]) {
        acc[year] = {
          year,
          ADU: 0,
          NON_ADU: 0,
          POTENTIAL_ADU_CONVERSION: 0,
        };
      }
      acc[year][row.Classification]++;
      return acc;
    }, {} as Record<string, UnitsByYearData>);

    return Object.values(unitsByYear).sort(
      (a, b) => parseInt(a.year) - parseInt(b.year),
    );
  };

  // 2) ADU percentage of total units by year
  const processAduPercentageByYear = (
    data: HousingData[],
  ): AduPercentageByYearData[] => {
    const yearlyData = processUnitsByYear(data);
    return yearlyData.map(({ year, ADU, NON_ADU, POTENTIAL_ADU_CONVERSION }) => {
      const total = ADU + NON_ADU + POTENTIAL_ADU_CONVERSION;
      const aduPercentage = total > 0 ? (ADU / total) * 100 : 0;
      return {
        year,
        aduPercentage: Math.round(aduPercentage),
        aduCount: ADU,
        totalCount: total,
      };
    });
  };

  // 3) Distribution of ADU permits by county
  const processUnitsByJurisdiction = (
    data: HousingData[],
  ): UnitsByJurisdictionData[] => {
    const jurisdictionData = data.reduce((acc, row) => {
      if (!acc[row.COUNTY]) {
        acc[row.COUNTY] = { ADU: 0, total: 0 };
      }
      if (row.Classification === "ADU") {
        acc[row.COUNTY].ADU++;
      }
      acc[row.COUNTY].total++;
      return acc;
    }, {} as Record<string, { ADU: number; total: number }>);

    return Object.entries(jurisdictionData)
      .map(([county, { ADU, total }]) => ({ county, ADU, total }))
      .sort((a, b) => b.ADU - a.ADU)
      .slice(0, 8);
  };

  // 4) Percentage of ADU job value by year => (sum of ADU job value / sum of ALL job value) * 100
  const processAduJobValuePercentageByYear = (
    data: HousingData[],
  ): AduJobValuePercentageByYearData[] => {
    const groupedByYear = data.reduce((acc, row) => {
      const year = row.YEAR.toString();
      if (!acc[year]) {
        acc[year] = { aduValue: 0, totalValue: 0 };
      }
      acc[year].totalValue += row.JOB_VALUE;
      if (row.Classification === "ADU") {
        acc[year].aduValue += row.JOB_VALUE;
      }
      return acc;
    }, {} as Record<string, { aduValue: number; totalValue: number }>);

    const results: AduJobValuePercentageByYearData[] = Object.entries(
      groupedByYear,
    )
      .map(([year, val]) => {
        const ratio =
          val.totalValue > 0 ? (val.aduValue / val.totalValue) * 100 : 0;
        return {
          year,
          aduJobValuePercentage: Math.round(ratio),
          aduValue: val.aduValue,
          totalValue: val.totalValue,
        };
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));

    return results;
  };

  // 5) Average job value by each structure type and year (for wave-like chart on Job Value Analysis)
  const processAverageJobValueByStructureTypeAndYear = (
    data: HousingData[],
  ): AvgJobValueByStructureTypeAndYearData[] => {
    const grouped = data.reduce((acc, row) => {
      const year = row.YEAR.toString();
      if (!acc[year]) {
        acc[year] = {
          ADU: { sum: 0, count: 0 },
          NON_ADU: { sum: 0, count: 0 },
          POTENTIAL_ADU_CONVERSION: { sum: 0, count: 0 },
        };
      }
      acc[year][row.Classification].sum += row.JOB_VALUE;
      acc[year][row.Classification].count++;
      return acc;
    }, {} as Record<
      string,
      {
        ADU: ValueAggregate;
        NON_ADU: ValueAggregate;
        POTENTIAL_ADU_CONVERSION: ValueAggregate;
      }
    >);

    return Object.entries(grouped)
      .map(([year, sums]) => {
        const aduAvg =
          sums.ADU.count > 0 ? Math.round(sums.ADU.sum / sums.ADU.count) : 0;
        const nonAduAvg =
          sums.NON_ADU.count > 0
            ? Math.round(sums.NON_ADU.sum / sums.NON_ADU.count)
            : 0;
        const potAduAvg =
          sums.POTENTIAL_ADU_CONVERSION.count > 0
            ? Math.round(
                sums.POTENTIAL_ADU_CONVERSION.sum /
                  sums.POTENTIAL_ADU_CONVERSION.count,
              )
            : 0;

        return {
          year,
          ADU: aduAvg,
          NON_ADU: nonAduAvg,
          POTENTIAL_ADU_CONVERSION: potAduAvg,
        };
      })
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  };

  // 6) Average ADU job value by county (for bar chart on Job Value Analysis tab)
  const processJobValueByCounty = (
    data: HousingData[],
  ): JobValueByCountyData[] => {
    const countyData = data.reduce((acc, row) => {
      if (row.Classification === "ADU" && row.JOB_VALUE) {
        if (!acc[row.COUNTY]) acc[row.COUNTY] = { sum: 0, count: 0 };
        acc[row.COUNTY].sum += row.JOB_VALUE;
        acc[row.COUNTY].count++;
      }
      return acc;
    }, {} as Record<string, ValueAggregate>);

    return Object.entries(countyData)
      .map(([county, { sum, count }]) => ({
        county,
        avgValue: Math.round(sum / count / 1000), // in thousands, if desired
        count,
      }))
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 8);
  };

  // 7) (If you still need it) Average ADU job value by year
  const processAverageAduJobValueByYear = (
    data: HousingData[],
  ): AverageAduJobValueByYearData[] => {
    const yearlyData = data.reduce((acc, row) => {
      if (row.Classification === "ADU" && row.JOB_VALUE) {
        const year = row.YEAR.toString();
        if (!acc[year]) acc[year] = { sum: 0, count: 0 };
        acc[year].sum += row.JOB_VALUE;
        acc[year].count++;
      }
      return acc;
    }, {} as Record<string, ValueAggregate>);

    return Object.entries(yearlyData)
      .map(([year, { sum, count }]) => ({
        year,
        avgAduValue: Math.round(sum / count / 1000), // in thousands
        count,
      }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  };

  /* --------------------------
   * PROCESS & SET CHART DATA
   * -------------------------- */
  const processData = (data: HousingData[]) => {
    const _unitsByYear = processUnitsByYear(data);
    const _aduPercentageByYear = processAduPercentageByYear(data);
    const _unitsByJurisdiction = processUnitsByJurisdiction(data);
    const _aduJobValuePercentageByYear = processAduJobValuePercentageByYear(data);
    const _avgJobValueByStructureTypeAndYear =
      processAverageJobValueByStructureTypeAndYear(data);
    const _jobValueByCounty = processJobValueByCounty(data);
    const _averageAduJobValueByYear = processAverageAduJobValueByYear(data);

    setChartData({
      unitsByYear: _unitsByYear,
      aduPercentageByYear: _aduPercentageByYear,
      unitsByJurisdiction: _unitsByJurisdiction,
      aduJobValuePercentageByYear: _aduJobValuePercentageByYear,
      avgJobValueByStructureTypeAndYear: _avgJobValueByStructureTypeAndYear,
      jobValueByCounty: _jobValueByCounty,
      averageAduJobValueByYear: _averageAduJobValueByYear,
    });
  };

  /* --------------------------
   * TOOLTIP & MISC
   * -------------------------- */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="bg-white p-4 border rounded-lg shadow-lg text-left">
        <p className="font-bold mb-2 text-gray-800">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 py-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-semibold text-gray-900">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const handleDownloadData = () => {
    toast({
      title: "Download Started",
      description: "Your data is being prepared for download",
    });

    // In a real application, you'd trigger a real CSV export here
    setTimeout(() => {
      toast({
        title: "Download Complete",
        description: "The data has been downloaded successfully",
      });
    }, 1500);
  };

  const getOverviewData = () => {
    // For the big card stats: trend & latest for aduPercentage
    if (!chartData.aduPercentageByYear.length) return { trend: 0, latest: 0 };

    const arr = chartData.aduPercentageByYear;
    const latestYear = arr[arr.length - 1];
    const previousYear =
      arr.length > 1 ? arr[arr.length - 2] : { aduPercentage: 0 };
    const trend = latestYear.aduPercentage - previousYear.aduPercentage;

    return {
      trend,
      latest: latestYear.aduPercentage,
    };
  };

  const getAverageValueData = () => {
    // For the big card stats: trend & latest for average ADU value
    if (!chartData.averageAduJobValueByYear.length)
      return { trend: 0, latest: 0 };

    const arr = chartData.averageAduJobValueByYear;
    const latestYear = arr[arr.length - 1];
    const previousYear =
      arr.length > 1 ? arr[arr.length - 2] : { avgAduValue: 0 };
    const trend = latestYear.avgAduValue - previousYear.avgAduValue;

    return {
      trend,
      latest: latestYear.avgAduValue,
    };
  };

  const getTopCounty = () => {
    if (!chartData.unitsByJurisdiction.length) return "N/A";
    return chartData.unitsByJurisdiction[0].county;
  };

  /* --------------------------
   * RENDERING
   * -------------------------- */
  const renderSkeleton = () => (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-14 w-full mb-8" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderError = () => (
    <div className="p-6 max-w-7xl mx-auto">
      <Alert variant="destructive" className="mb-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Data</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Using Sample Data</CardTitle>
          <CardDescription>
            The dashboard is currently displaying sample data for demonstration
            purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            We were unable to load the actual housing data CSV file. Please
            check that the file exists and is correctly formatted.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return renderSkeleton();
  }

  const overviewData = getOverviewData();
  const valueData = getAverageValueData();

  return (
    <div className="p-6 max-w-7xl mx-auto bg-background min-h-screen">
      {error && (
        <Alert variant="default" className="mb-8 border-amber-500 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700">Notice</AlertTitle>
          <AlertDescription className="text-amber-600">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold text-gray-900">
              ADU Insights Explorer
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Interactive analysis of Accessory Dwelling Unit permits and
            construction trends
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm">
            <HelpCircle className="h-4 w-4 mr-2" />
            Help
          </Button>
        </div>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
              <Percent className="h-4 w-4 mr-2 text-blue-500" />
              ADU Percentage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {overviewData.latest}%
                </div>
                <div className="flex items-center mt-1">
                  {overviewData.trend > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{overviewData.trend}%
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200"
                    >
                      <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                      {overviewData.trend}%
                    </Badge>
                  )}
                  <span className="text-gray-500 text-xs ml-2">
                    vs previous year
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
              <DollarSign className="h-4 w-4 mr-2 text-indigo-500" />
              Average ADU Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  ${valueData.latest}k
                </div>
                <div className="flex items-center mt-1">
                  {valueData.trend > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +${valueData.trend}k
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-red-50 text-red-700 border-red-200"
                    >
                      <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                      ${valueData.trend}k
                    </Badge>
                  )}
                  <span className="text-gray-500 text-xs ml-2">
                    vs previous year
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center">
              <Building className="h-4 w-4 mr-2 text-purple-500" />
              Top ADU County
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {getTopCounty()}
                </div>
                <div className="flex items-center mt-1">
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200"
                  >
                    <Map className="h-3 w-3 mr-1" />
                    Highest ADU Concentration
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid grid-cols-3 w-full sm:w-[500px] mb-6">
          <TabsTrigger value="overview" className="flex gap-2">
            <PieChartIcon className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="units" className="flex gap-2">
            <BarChart3 className="h-4 w-4" /> Units Analysis
          </TabsTrigger>
          <TabsTrigger value="values" className="flex gap-2">
            <LineChartIcon className="h-4 w-4" /> Value Analysis
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: ADU Units Percentage by Year */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-blue-500" />
                  ADU Units Percentage Trend by Year
                </CardTitle>
                <CardDescription>
                  (ADU Units / Total Units) * 100 over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.aduPercentageByYear}>
                    <defs>
                      <linearGradient
                        id="aduPercentageGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={THEME_COLORS.border}
                    />
                    <XAxis
                      dataKey="year"
                      stroke={THEME_COLORS.text}
                      tick={{ fill: THEME_COLORS.text }}
                    />
                    <YAxis
                      stroke={THEME_COLORS.text}
                      tick={{ fill: THEME_COLORS.text }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      dataKey="aduPercentage"
                      name="ADU %"
                      stroke={THEME_COLORS.adu}
                      fill="url(#aduPercentageGradient)"
                      activeDot={{
                        r: 5,
                        stroke: THEME_COLORS.background,
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Right: ADU Job Value Percentage by Year */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-500" />
                  ADU Job Value Percentage Trend by Year
                </CardTitle>
                <CardDescription>
                  (Sum of ADU Job Value / Sum of ALL Job Value) * 100 over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.aduJobValuePercentageByYear}>
                    <defs>
                      <linearGradient
                        id="aduJobValueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={THEME_COLORS.border}
                    />
                    <XAxis
                      dataKey="year"
                      stroke={THEME_COLORS.text}
                      tick={{ fill: THEME_COLORS.text }}
                    />
                    <YAxis
                      stroke={THEME_COLORS.text}
                      tick={{ fill: THEME_COLORS.text }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      dataKey="aduJobValuePercentage"
                      name="ADU Value %"
                      stroke={THEME_COLORS.adu}
                      fill="url(#aduJobValueGradient)"
                      activeDot={{
                        r: 5,
                        stroke: THEME_COLORS.background,
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* UNITS ANALYSIS TAB */}
        <TabsContent value="units">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Wave-like chart of total units by structure type */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-500" />
                  Units Permitted by Structure Type
                </CardTitle>
                <CardDescription>
                  Wave visualization of ADU / NON-ADU / POTENTIAL over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.unitsByYear}>
                    <defs>
                      <linearGradient
                        id="aduGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="nonAduGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.nonAdu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.nonAdu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="potentialAduGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.potentialAdu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.potentialAdu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="POTENTIAL_ADU_CONVERSION"
                      name="Potential ADU Conversion"
                      stackId="1"
                      stroke={THEME_COLORS.potentialAdu}
                      fill="url(#potentialAduGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="NON_ADU"
                      name="Non-ADU"
                      stackId="1"
                      stroke={THEME_COLORS.nonAdu}
                      fill="url(#nonAduGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ADU"
                      name="ADU"
                      stackId="1"
                      stroke={THEME_COLORS.adu}
                      fill="url(#aduGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Right: ADU permits by county */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5 text-blue-500" />
                  Distribution of ADU Permits by County
                </CardTitle>
                <CardDescription>
                  Top 8 counties with highest ADU permits
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData.unitsByJurisdiction}
                    layout="vertical"
                    barSize={15}
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="county" width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="ADU"
                      name="ADU Permits"
                      fill={THEME_COLORS.adu}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* VALUE (JOB VALUE) ANALYSIS TAB */}
        <TabsContent value="values">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Average job value by structure type (wave-like) */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-500" />
                  Average Job Value by Structure Type
                </CardTitle>
                <CardDescription>
                  Wave-like chart of ADU / NON-ADU / POTENTIAL average value
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.avgJobValueByStructureTypeAndYear}>
                    <defs>
                      <linearGradient
                        id="aduValueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.adu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="nonAduValueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.nonAdu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.nonAdu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                      <linearGradient
                        id="potAduValueGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={THEME_COLORS.potentialAdu}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor={THEME_COLORS.potentialAdu}
                          stopOpacity={0.1}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="POTENTIAL_ADU_CONVERSION"
                      name="Potential ADU Conv. Avg"
                      stackId="1"
                      stroke={THEME_COLORS.potentialAdu}
                      fill="url(#potAduValueGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="NON_ADU"
                      name="Non-ADU Avg"
                      stackId="1"
                      stroke={THEME_COLORS.nonAdu}
                      fill="url(#nonAduValueGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ADU"
                      name="ADU Avg"
                      stackId="1"
                      stroke={THEME_COLORS.adu}
                      fill="url(#aduValueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Right: Average ADU Job Value by County */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-500" />
                  Average ADU Job Value by County
                </CardTitle>
                <CardDescription>Top 8 counties (in thousands)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData.jobValueByCounty}
                    barSize={15}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => `$${value}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="county"
                      width={100}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="avgValue"
                      name="Avg ADU Value (k)"
                      fill={THEME_COLORS.adu}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* FOOTER */}
      <div className="mt-8 text-center text-sm text-muted-foreground border-t pt-4">
        <p>Data last updated: {new Date().toLocaleDateString()}</p>
        <p className="mt-1">
          <span className="inline-flex items-center">
            <Info className="h-3 w-3 mr-1" />
            This dashboard visualizes ADU housing trends and construction values
            across California
          </span>
        </p>
      </div>
    </div>
  );
};

export default HousingDashboard;
