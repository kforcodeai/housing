"use client"

import type React from "react"

import { useState, useEffect } from "react"
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
} from "recharts"
import Papa from "papaparse"
import { FileUp, BarChart3, LineChart, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Define types
interface HousingData {
  YEAR: number
  COUNTY: string
  Classification: "ADU" | "NON_ADU" | "POTENTIAL_ADU_CONVERSION"
  JOB_VALUE: number
  [key: string]: any
}

interface UnitsByYearData {
  year: string
  ADU: number
  NON_ADU: number
  POTENTIAL_ADU_CONVERSION: number
  aduLabel: string
  nonAduLabel: string
  potentialAduLabel: string
}

interface UnitsByJurisdictionData {
  county: string
  total: number
  ADU: number
  NON_ADU: number
  POTENTIAL_ADU_CONVERSION: number
  aduLabel: string
  nonAduLabel: string
  potentialAduLabel: string
}

interface JobValueData {
  year: string
  ADU?: number
  NON_ADU?: number
  POTENTIAL_ADU_CONVERSION?: number
  ADULabel?: string
  NON_ADULabel?: string
  POTENTIAL_ADU_CONVERSIONLabel?: string
  [key: string]: any
}

interface JobValueByCountyData {
  county: string
  avgValue: number
  count: number
  avgValueLabel: string
}

interface ChartDataState {
  unitsByYear: UnitsByYearData[]
  unitsByJurisdiction: UnitsByJurisdictionData[]
  jobValueByYear: JobValueData[]
  jobValueByCounty: JobValueByCountyData[] // This will now be specifically for ADU only
}

interface ValueAggregate {
  sum: number
  count: number
}

interface JobValueByYearAndType {
  [year: string]: {
    ADU: ValueAggregate
    NON_ADU: ValueAggregate
    POTENTIAL_ADU_CONVERSION: ValueAggregate
    [key: string]: ValueAggregate
  }
}

interface JobValueByCounty {
  [county: string]: ValueAggregate
}

interface UnitsByYearAndType {
  [year: string]: {
    ADU: number
    NON_ADU: number
    POTENTIAL_ADU_CONVERSION: number
    [key: string]: number
  }
}

interface UnitsByJurisdictionAndType {
  [county: string]: {
    ADU: number
    NON_ADU: number
    POTENTIAL_ADU_CONVERSION: number
    [key: string]: number
  }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

interface ColorScheme {
  adu: string
  nonAdu: string
  potentialAdu: string
  other: string
}

// For file input
interface FileInputEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement & {
    files: FileList
  }
}

export default function HousingDashboard() {
  const [data, setData] = useState<HousingData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<ChartDataState>({
    unitsByYear: [],
    unitsByJurisdiction: [],
    jobValueByYear: [],
    jobValueByCounty: [],
  })
  const [activeTab, setActiveTab] = useState<string>("units")

  // Modern color scheme
  const colors: ColorScheme = {
    adu: "#3b82f6", // Blue
    nonAdu: "#10b981", // Green
    potentialAdu: "#f97316", // Orange
    other: "#f59e0b", // Amber
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch CSV from public folder
        const response = await fetch("/housing_data.csv")

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const csvText = await response.text()

        const parsedData = Papa.parse<HousingData>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        })

        if (parsedData.errors && parsedData.errors.length > 0) {
          setError(`CSV parsing error: ${parsedData.errors[0].message}`)
          setLoading(false)
          return
        }

        setData(parsedData.data)
        processData(parsedData.data)
      } catch (error) {
        console.error("Error loading data:", error)
        setError(`Error loading data: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // File input handler for browser-based file upload
  const handleFileUpload = (event: FileInputEvent) => {
    setLoading(true)
    setError(null)

    const file = event.target.files[0]
    if (!file) {
      setLoading(false)
      return
    }

    const reader = new FileReader()

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const csvText = e.target?.result as string
        const parsedData = Papa.parse<HousingData>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        })

        if (parsedData.errors && parsedData.errors.length > 0) {
          setError(`CSV parsing error: ${parsedData.errors[0].message}`)
          setLoading(false)
          return
        }

        setData(parsedData.data)
        processData(parsedData.data)
        setLoading(false)
      } catch (error) {
        console.error("Error parsing file:", error)
        setError(`Error parsing file: ${error instanceof Error ? error.message : String(error)}`)
        setLoading(false)
      }
    }

    reader.onerror = () => {
      setError("Error reading file")
      setLoading(false)
    }

    reader.readAsText(file)
  }

  const processData = (data: HousingData[]) => {
    // 1. Units by Structure Type over time
    const unitsByYear = processUnitsByYear(data)

    // 2. Units by Jurisdiction and Type
    const unitsByJurisdiction = processUnitsByJurisdiction(data)

    // 3. JOB_VALUE by year for each type
    const jobValueByYear = processJobValueByYear(data)

    // 4. JOB_VALUE (ADU only) by county
    const jobValueByCounty = processJobValueByCountyADU(data)

    setChartData({
      unitsByYear,
      unitsByJurisdiction,
      jobValueByYear,
      jobValueByCounty, // now ADU only
    })
  }

  const processUnitsByYear = (data: HousingData[]): UnitsByYearData[] => {
    const unitsByYearAndType: { [year: string]: { [key: string]: number } } = {}

    data.forEach((row) => {
      if (row.YEAR && row.Classification) {
        const year = row.YEAR.toString()
        if (!unitsByYearAndType[year]) {
          unitsByYearAndType[year] = {
            ADU: 0,
            NON_ADU: 0,
            POTENTIAL_ADU_CONVERSION: 0,
          }
        }

        if (row.Classification in unitsByYearAndType[year]) {
          unitsByYearAndType[year][row.Classification]++
        }
      }
    })

    return Object.keys(unitsByYearAndType)
      .sort()
      .map((year) => ({
        year,
        ADU: unitsByYearAndType[year]["ADU"],
        NON_ADU: unitsByYearAndType[year]["NON_ADU"],
        POTENTIAL_ADU_CONVERSION: unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"],
        // Add labels for the chart
        aduLabel: unitsByYearAndType[year]["ADU"] > 50 ? `${unitsByYearAndType[year]["ADU"]}` : "",
        nonAduLabel: `${unitsByYearAndType[year]["NON_ADU"]}`,
        potentialAduLabel:
          unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"] > 5
            ? `${unitsByYearAndType[year]["POTENTIAL_ADU_CONVERSION"]}`
            : "",
      }))
  }

  const processUnitsByJurisdiction = (data: HousingData[]): UnitsByJurisdictionData[] => {
    const unitsByJurisdictionAndType: { [county: string]: { [key: string]: number } } = {}

    data.forEach((row) => {
      if (row.COUNTY && row.Classification) {
        if (!unitsByJurisdictionAndType[row.COUNTY]) {
          unitsByJurisdictionAndType[row.COUNTY] = {
            ADU: 0,
            NON_ADU: 0,
            POTENTIAL_ADU_CONVERSION: 0,
          }
        }

        if (row.Classification in unitsByJurisdictionAndType[row.COUNTY]) {
          unitsByJurisdictionAndType[row.COUNTY][row.Classification]++
        }
      }
    })

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
        potentialAduLabel: counts.POTENTIAL_ADU_CONVERSION > 10 ? `${counts.POTENTIAL_ADU_CONVERSION}` : "",
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }

  const processJobValueByYear = (data: HousingData[]): JobValueData[] => {
    const jobValueByYearAndType: JobValueByYearAndType = {}

    data.forEach((row) => {
      if (row.YEAR && row.Classification && row.JOB_VALUE) {
        const year = row.YEAR.toString()
        if (!jobValueByYearAndType[year]) {
          jobValueByYearAndType[year] = {
            ADU: { sum: 0, count: 0 },
            NON_ADU: { sum: 0, count: 0 },
            POTENTIAL_ADU_CONVERSION: { sum: 0, count: 0 },
          }
        }

        if (row.Classification in jobValueByYearAndType[year]) {
          jobValueByYearAndType[year][row.Classification].sum += row.JOB_VALUE
          jobValueByYearAndType[year][row.Classification].count += 1
        }
      }
    })

    // Calculate averages
    return Object.keys(jobValueByYearAndType)
      .sort()
      .map((year) => {
        const result: JobValueData = { year }

        Object.entries(jobValueByYearAndType[year]).forEach(([type, data]) => {
          const avg = data.count > 0 ? Math.round(data.sum / data.count / 1000) : 0 // Convert to K
          result[type] = avg
          result[`${type}Label`] = avg > 0 ? `${avg}K` : ""
        })

        return result
      })
  }

  // Filter only ADU records and compute average job value by county
  const processJobValueByCountyADU = (data: HousingData[]): JobValueByCountyData[] => {
    const jobValueByCounty: JobValueByCounty = {}

    data.forEach((row) => {
      if (row.COUNTY && row.JOB_VALUE && row.Classification === "ADU") {
        // Only count ADU
        if (!jobValueByCounty[row.COUNTY]) {
          jobValueByCounty[row.COUNTY] = { sum: 0, count: 0 }
        }

        jobValueByCounty[row.COUNTY].sum += row.JOB_VALUE
        jobValueByCounty[row.COUNTY].count += 1
      }
    })

    // Calculate averages and sort by average job value
    return Object.entries(jobValueByCounty)
      .map(([county, data]) => {
        const avgValue = data.count > 0 ? Math.round(data.sum / data.count / 1000) : 0 // Convert to K
        return {
          county,
          avgValue,
          count: data.count,
          avgValueLabel: avgValue > 0 ? `${avgValue}K` : "",
        }
      })
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 15)
  }

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{`${label}`}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {`${entry.name}: ${entry.value.toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Loading housing data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="text-center">
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            Please upload a CSV file with housing data to continue
          </p>
          <Button className="relative">
            <FileUp className="mr-2 h-4 w-4" />
            Upload CSV
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Housing Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Analysis of housing permits and job values across jurisdictions
          </p>
        </div>

        <Button className="relative">
          <FileUp className="mr-2 h-4 w-4" />
          Upload New Data
          <input
            type="file"
            accept=".csv"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
          />
        </Button>
      </div>

      {/* Tabs container */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
        <Tabs defaultValue="units" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <TabsTrigger value="units" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Units Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="values" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              <span>Job Value Analysis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="bg-white dark:bg-gray-900 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Units Permitted by Structure Type</CardTitle>
                  <CardDescription>Yearly breakdown of housing units by classification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.unitsByYear} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <defs>
                          <linearGradient id="colorAdu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.adu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.adu} stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="colorNonAdu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.nonAdu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.nonAdu} stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="colorPotential" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.potentialAdu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.potentialAdu} stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <YAxis tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                        <Area
                          type="monotone"
                          dataKey="POTENTIAL_ADU_CONVERSION"
                          name="Potential ADU Conversion"
                          stackId="1"
                          fill="url(#colorPotential)"
                          stroke={colors.potentialAdu}
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="ADU"
                          name="ADU"
                          stackId="1"
                          fill="url(#colorAdu)"
                          stroke={colors.adu}
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="NON_ADU"
                          name="Non-ADU"
                          stackId="1"
                          fill="url(#colorNonAdu)"
                          stroke={colors.nonAdu}
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Units by Jurisdiction</CardTitle>
                  <CardDescription>Top jurisdictions by total housing units</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData.unitsByJurisdiction}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 120, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <YAxis
                          type="category"
                          dataKey="county"
                          tick={{ fill: "#6b7280" }}
                          axisLine={{ stroke: "#d1d5db" }}
                          width={110}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                        <Bar dataKey="ADU" name="ADU" stackId="a" fill={colors.adu} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="NON_ADU" name="Non-ADU" stackId="a" fill={colors.nonAdu} radius={[0, 0, 0, 0]} />
                        <Bar
                          dataKey="POTENTIAL_ADU_CONVERSION"
                          name="Potential ADU Conversion"
                          stackId="a"
                          fill={colors.potentialAdu}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="values" className="bg-white dark:bg-gray-900 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Average Job Value by Structure Type</CardTitle>
                  <CardDescription>Yearly average job value (K) by housing classification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.jobValueByYear} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <defs>
                          <linearGradient id="colorAduValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.adu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.adu} stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="colorNonAduValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.nonAdu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.nonAdu} stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="colorPotentialValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.potentialAdu} stopOpacity={0.8} />
                            <stop offset="95%" stopColor={colors.potentialAdu} stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="year" tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <YAxis tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                        <Area
                          type="monotone"
                          dataKey="POTENTIAL_ADU_CONVERSION"
                          name="Potential ADU Conversion"
                          stackId="1"
                          fill="url(#colorPotentialValue)"
                          stroke={colors.potentialAdu}
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="ADU"
                          name="ADU"
                          stackId="1"
                          fill="url(#colorAduValue)"
                          stroke={colors.adu}
                          fillOpacity={1}
                        />
                        <Area
                          type="monotone"
                          dataKey="NON_ADU"
                          name="Non-ADU"
                          stackId="1"
                          fill="url(#colorNonAduValue)"
                          stroke={colors.nonAdu}
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 
                NOTE the title change here. 
                We now show "Average Job Value for ADU by County (K)" 
                since we only computed ADU in processJobValueByCountyADU.
              */}
              <Card>
                <CardHeader>
                  <CardTitle>Average Job Value for ADU by County (K)</CardTitle>
                  <CardDescription>Top counties by average job value for ADUs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData.jobValueByCounty}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 120, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
                        <YAxis
                          type="category"
                          dataKey="county"
                          tick={{ fill: "#6b7280" }}
                          axisLine={{ stroke: "#d1d5db" }}
                          width={110}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        {/* 
                          Also change the bar label to mention ADU 
                        */}
                        <Bar
                          dataKey="avgValue"
                          name="Average Job Value for ADU (K)"
                          fill={colors.nonAdu}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Data last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  )
}
