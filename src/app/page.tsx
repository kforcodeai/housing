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
} from "recharts";
import Papa from "papaparse";

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

interface ChartDataState {
  unitsByYear: UnitsByYearData[];
  unitsByJurisdiction: UnitsByJurisdictionData[];
  jobValueByYear: JobValueData[];
  jobValueByCounty: JobValueByCountyData[];
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

interface ColorScheme {
  adu: string;
  nonAdu: string;
  potentialAdu: string;
  other: string;
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
  });

  // Color scheme similar to screenshot
  const colors: ColorScheme = {
    adu: "#1e88e5", // Blue
    nonAdu: "#4caf50", // Green
    potentialAdu: "#ff5722", // Red
    other: "#ffeb3b", // Yellow/amber for other categories if needed
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

    setChartData({
      unitsByYear,
      unitsByJurisdiction,
      jobValueByYear,
      jobValueByCounty,
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

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow">
          <p className="font-bold">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="text-center p-8">Loading data...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-500 mb-4">{error}</div>
        <div>
          <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer">
            Upload CSV file
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 font-sans">
      {/* Optional file upload button for browser contexts */}

      <div className="text-center my-6">
        <h2 className="text-4xl font-extrabold text-gray-800 tracking-wide">
          Comparison by Units
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Chart 1: Units by Structure Type over time (LARGER) */}
        <div className="bg-white p-4 rounded shadow border-2 border-gray-300 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Units Permitted by Structure Type
          </h2>
          <ResponsiveContainer width="100%" height={500}>
            <AreaChart
              data={chartData.unitsByYear}
              margin={{ top: 10, right: 30, left: 30, bottom: 20 }}
            >
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
                fill={colors.potentialAdu}
                stroke={colors.potentialAdu}
              />
              <Area
                type="monotone"
                dataKey="ADU"
                name="ADU"
                stackId="1"
                fill={colors.adu}
                stroke={colors.adu}
              />
              <Area
                type="monotone"
                dataKey="NON_ADU"
                name="Non-ADU"
                stackId="1"
                fill={colors.nonAdu}
                stroke={colors.nonAdu}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Units by Jurisdiction (SMALLER) */}
        <div className="bg-white p-4 rounded shadow border-2 border-gray-300 md:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Units Permitted by Structure Type by Jurisdiction
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData.unitsByJurisdiction}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 120, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="county" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="ADU" name="ADU" stackId="a" fill={colors.adu} />
              <Bar
                dataKey="NON_ADU"
                name="Non-ADU"
                stackId="a"
                fill={colors.nonAdu}
              />
              <Bar
                dataKey="POTENTIAL_ADU_CONVERSION"
                name="Potential ADU Conversion"
                stackId="a"
                fill={colors.potentialAdu}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="text-center my-6">
        <h2 className="text-4xl font-extrabold text-gray-800 tracking-wide">
          Comparison by job value
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart 3: JOB_VALUE by Year and Type (LARGER) */}
        <div className="bg-white p-4 rounded shadow border-2 border-gray-300 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Average Job Value by Structure Type and Year (K)
          </h2>
          <ResponsiveContainer width="100%" height={500}>
            <AreaChart
              data={chartData.jobValueByYear}
              margin={{ top: 10, right: 30, left: 30, bottom: 20 }}
            >
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
                fill={colors.potentialAdu}
                stroke={colors.potentialAdu}
              />
              <Area
                type="monotone"
                dataKey="ADU"
                name="ADU"
                stackId="1"
                fill={colors.adu}
                stroke={colors.adu}
              />
              <Area
                type="monotone"
                dataKey="NON_ADU"
                name="Non-ADU"
                stackId="1"
                fill={colors.nonAdu}
                stroke={colors.nonAdu}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: JOB_VALUE by County (SMALLER) */}
        <div className="bg-white p-4 rounded shadow border-2 border-gray-300 md:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Average Job Value by County (K)
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData.jobValueByCounty}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 120, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="county" />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="avgValue"
                name="Average Job Value (K)"
                fill={colors.nonAdu}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default HousingDashboard;
