"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { format, parseISO, isValid } from "date-fns"
import { AirlineLogo } from "../common/AirlineLogo"
import { Check, Filter, ChevronDown, ChevronUp } from "lucide-react"

// Define types for the new API structure (copied from SearchResults for self-containment)
interface TaxBreakup {
  key: string
  value: number
}

interface ChargeBU {
  key: string
  value: number
}

interface Fare {
  Currency: string
  BaseFare: number
  Tax: number
  TaxBreakup: TaxBreakup[]
  YQTax: number
  AdditionalTxnFeeOfrd: number
  AdditionalTxnFeePub: number
  PGCharge: number
  OtherCharges: number
  ChargeBU: ChargeBU[]
  Discount: number
  PublishedFare: number
  CommissionEarned: number
  PLBEarned: number
  IncentiveEarned: number
  TdsOnCommission: number
  TdsOnPLB: number
  TdsOnIncentive: number
  ServiceFee: number
  TotalBaggageCharges: number
  TotalMealCharges: number
  TotalSeatCharges: number
}

interface FareBreakdown {
  Currency: string
  PassengerType: number
  PassengerCount: number
  BaseFare: number
  Tax: number
  TaxBreakUp: TaxBreakup[] | null
  YQTax: number
  AdditionalTxnFeeOfrd: number
  AdditionalTxnFeePub: number
  PGCharge: number
  SupplierReissueCharges: number
}

interface Airline {
  AirlineCode: string
  AirlineName: string
  FlightNumber: string
  FareClass: string
  OperatingCarrier: string
}

interface Airport {
  AirportCode: string
  AirportName: string
  Terminal: string
  CityCode: string
  CityName: string
  CountryCode: string
  CountryName: string
}

interface Origin {
  Airport: Airport
  DepTime: string
}

interface Destination {
  Airport: Airport
  ArrTime: string
}

interface FareClassification {
  Type: string
  Color?: string
}

interface Segment {
  Baggage: string
  CabinBaggage: string
  CabinClass: number
  SupplierFareClass: string | null
  TripIndicator: number
  SegmentIndicator: number
  Airline: Airline
  NoOfSeatAvailable: number
  Origin: Origin
  Destination: Destination
  Duration: number
  GroundTime: number
  Mile: number
  StopOver: boolean
  FlightInfoIndex: string
  StopPoint: string
  StopPointArrivalTime: string | null
  StopPointDepartureTime: string | null
  Craft: string
  Remark: string | null
  IsETicketEligible: boolean
  FlightStatus: string
  Status: string
  FareClassification: FareClassification
}

interface FareRule {
  Origin: string
  Destination: string
  Airline: string
  FareBasisCode: string
  FareRuleDetail: string
  FareRestriction: string
  FareFamilyCode: string
  FareRuleIndex: string
}

interface FlightResult {
  ResultIndex: string
  Source: number
  IsLCC: boolean
  IsRefundable: boolean
  IsPanRequiredAtBook: boolean
  IsPanRequiredAtTicket: boolean
  IsPassportRequiredAtBook: boolean
  IsPassportRequiredAtTicket: boolean
  GSTAllowed: boolean
  IsCouponAppilcable: boolean
  IsGSTMandatory: boolean
  AirlineRemark: string
  IsPassportFullDetailRequiredAtBook: boolean
  ResultFareType: string
  Fare: Fare
  FareBreakdown: FareBreakdown[]
  Segments: Segment[][]
  LastTicketDate: string | null
  TicketAdvisory: string | null
  FareRules: FareRule[]
  AirlineCode: string
  ValidatingAirline: string
  FareClassification: FareClassification
}

interface InternationalRoundTripSelectionViewProps {
  internationalCombinedFlights: FlightResult[]
  searchParams: any
  onBookFlight: (selectedFlight: FlightResult) => void
}

// Update the formatTime function to handle undefined or null values
const formatTime = (dateTimeStr: string | undefined | null) => {
  try {
    if (!dateTimeStr) {
      console.warn("Empty date string provided to formatTime")
      return "N/A"
    }

    let date = parseISO(dateTimeStr)
    if (!isValid(date)) {
      // Fallback for "dd/MM/yyyy, HH:mm" format if parseISO fails (though parseISO should handle this well)
      const parts = dateTimeStr.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/)
      if (parts) {
        const [, day, month, year, hour, minute] = parts
        date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
      }
    }

    if (!isValid(date)) {
      console.warn(`Invalid date format after all attempts: ${dateTimeStr}`)
      return "N/A"
    }

    return format(date, "HH:mm")
  } catch (error) {
    console.error("Error formatting date:", error, "for date string:", dateTimeStr)
    return "N/A"
  }
}

// Update formatDuration to handle invalid inputs
const formatDuration = (minutes: number | undefined | null) => {
  if (minutes === undefined || minutes === null || isNaN(minutes)) {
    return "N/A"
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours} h ${mins} m`
}

const InternationalRoundTripSelectionView: React.FC<InternationalRoundTripSelectionViewProps> = ({
  internationalCombinedFlights,
  searchParams,
  onBookFlight,
}) => {
  const [selectedCombinedFlightIndex, setSelectedCombinedFlightIndex] = useState<string | null>(null)
  const [showFlightDetails, setShowFlightDetails] = useState(false)

  // Filter states for outbound and return legs
  const [outboundPriceRange, setOutboundPriceRange] = useState<number[]>([0, 100000])
  const [returnPriceRange, setReturnPriceRange] = useState<number[]>([0, 100000])
  const [outboundSelectedStops, setOutboundSelectedStops] = useState<number[]>([])
  const [returnSelectedStops, setReturnSelectedStops] = useState<number[]>([])
  const [outboundSelectedAirlines, setOutboundSelectedAirlines] = useState<string[]>([])
  const [returnSelectedAirlines, setReturnSelectedAirlines] = useState<string[]>([])
  const [outboundSelectedDepartureTimes, setOutboundSelectedDepartureTimes] = useState<string[]>([])
  const [returnSelectedDepartureTimes, setReturnSelectedDepartureTimes] = useState<string[]>([])
  const [showOutboundFilters, setShowOutboundFilters] = useState(false)
  const [showReturnFilters, setShowReturnFilters] = useState(false)

  // Find the selected combined international flight
  const selectedCombinedFlight = internationalCombinedFlights.find(
    (flight) => flight.ResultIndex === selectedCombinedFlightIndex,
  )

  // Calculate min/max prices for initial range setting
  const allPrices = useMemo(
    () => internationalCombinedFlights.map((f) => f.Fare.PublishedFare),
    [internationalCombinedFlights],
  )
  const minOverallPrice = useMemo(() => (allPrices.length > 0 ? Math.min(...allPrices) : 0), [allPrices])
  const maxOverallPrice = useMemo(() => (allPrices.length > 0 ? Math.max(...allPrices) : 100000), [allPrices])

  useEffect(() => {
    if (internationalCombinedFlights.length > 0) {
      setOutboundPriceRange([minOverallPrice, maxOverallPrice])
      setReturnPriceRange([minOverallPrice, maxOverallPrice])
    }
  }, [internationalCombinedFlights, minOverallPrice, maxOverallPrice])

  // Derive unique airlines for filter options
  const allAirlines = useMemo(() => {
    const uniqueAirlines = new Map<string, string>()
    internationalCombinedFlights.forEach((flight) => {
      flight.Segments.flat().forEach((segment) => {
        uniqueAirlines.set(segment.Airline.AirlineCode, segment.Airline.AirlineName)
      })
    })
    return Array.from(uniqueAirlines).map(([code, name]) => ({ code, name }))
  }, [internationalCombinedFlights])

  // Helper function to check if a segment's departure time falls within a range
  const checkDepartureTime = (departureTimeStr: string | undefined | null, selectedTimeRanges: string[]) => {
    if (selectedTimeRanges.length === 0) return true
    try {
      const departureTime = departureTimeStr ? new Date(departureTimeStr) : null
      if (!departureTime) return false

      const hours = departureTime.getHours()
      const minutes = departureTime.getMinutes()
      const totalMinutes = hours * 60 + minutes

      return selectedTimeRanges.some((timeRange) => {
        const [startTime, endTime] = timeRange.split(" - ")
        const [startHour, startMinute = "00"] = startTime.split(":")
        const [endHour, endMinute = "00"] = endTime.split(":")

        const rangeStart = Number.parseInt(startHour) * 60 + Number.parseInt(startMinute)
        const rangeEnd = Number.parseInt(endHour) * 60 + Number.parseInt(endMinute)

        return totalMinutes >= rangeStart && totalMinutes < rangeEnd
      })
    } catch (error) {
      console.error("Error checking departure time:", error)
      return false
    }
  }

  // Filter combined flights based on both outbound and return criteria
  const filteredInternationalCombinedFlights = useMemo(() => {
    return internationalCombinedFlights.filter((flight) => {
      const outboundLeg = flight.Segments[0]
      const returnLeg = flight.Segments[1]

      // Apply outbound filters
      const passesOutboundPrice =
        flight.Fare.PublishedFare >= outboundPriceRange[0] && flight.Fare.PublishedFare <= outboundPriceRange[1]

      const outboundStops = outboundLeg.length > 0 ? outboundLeg.length - 1 : 0
      const passesOutboundStops = outboundSelectedStops.length === 0 || outboundSelectedStops.includes(outboundStops)

      const outboundAirlines = new Set(outboundLeg.map((s) => s.Airline.AirlineCode))
      const passesOutboundAirlines =
        outboundSelectedAirlines.length === 0 || outboundSelectedAirlines.some((code) => outboundAirlines.has(code))

      const passesOutboundDepartureTime = checkDepartureTime(
        outboundLeg[0]?.Origin?.DepTime,
        outboundSelectedDepartureTimes,
      )

      // Apply return filters
      const passesReturnPrice =
        flight.Fare.PublishedFare >= returnPriceRange[0] && flight.Fare.PublishedFare <= returnPriceRange[1]

      const returnStops = returnLeg.length > 0 ? returnLeg.length - 1 : 0
      const passesReturnStops = returnSelectedStops.length === 0 || returnSelectedStops.includes(returnStops)

      const returnAirlines = new Set(returnLeg.map((s) => s.Airline.AirlineCode))
      const passesReturnAirlines =
        returnSelectedAirlines.length === 0 || returnSelectedAirlines.some((code) => returnAirlines.has(code))

      const passesReturnDepartureTime = checkDepartureTime(returnLeg[0]?.Origin?.DepTime, returnSelectedDepartureTimes)

      return (
        passesOutboundPrice &&
        passesOutboundStops &&
        passesOutboundAirlines &&
        passesOutboundDepartureTime &&
        passesReturnPrice &&
        passesReturnStops &&
        passesReturnAirlines &&
        passesReturnDepartureTime
      )
    })
  }, [
    internationalCombinedFlights,
    outboundPriceRange,
    returnPriceRange,
    outboundSelectedStops,
    returnSelectedStops,
    outboundSelectedAirlines,
    returnSelectedAirlines,
    outboundSelectedDepartureTimes,
    returnSelectedDepartureTimes,
  ])

  const resetOutboundFilters = () => {
    setOutboundPriceRange([minOverallPrice, maxOverallPrice])
    setOutboundSelectedStops([])
    setOutboundSelectedAirlines([])
    setOutboundSelectedDepartureTimes([])
  }

  const resetReturnFilters = () => {
    setReturnPriceRange([minOverallPrice, maxOverallPrice])
    setReturnSelectedStops([])
    setReturnSelectedAirlines([])
    setReturnSelectedDepartureTimes([])
  }

  const handleOutboundDepartureTimeChange = (timeRange: string) => {
    setOutboundSelectedDepartureTimes((prev) => {
      if (prev.includes(timeRange)) {
        return prev.filter((t) => t !== timeRange)
      }
      return [...prev, timeRange]
    })
  }

  const handleReturnDepartureTimeChange = (timeRange: string) => {
    setReturnSelectedDepartureTimes((prev) => {
      if (prev.includes(timeRange)) {
        return prev.filter((t) => t !== timeRange)
      }
      return [...prev, timeRange]
    })
  }

  const handleBookNow = () => {
    if (selectedCombinedFlight) {
      onBookFlight(selectedCombinedFlight)
    }
  }

  const renderFilterSection = (
    isOutbound: boolean,
    showFiltersState: boolean,
    setShowFiltersState: React.Dispatch<React.SetStateAction<boolean>>,
    priceRangeState: number[],
    setPriceRangeState: React.Dispatch<React.SetStateAction<number[]>>,
    selectedStopsState: number[],
    setSelectedStopsState: React.Dispatch<React.SetStateAction<number[]>>,
    selectedAirlinesState: string[],
    setSelectedAirlinesState: React.Dispatch<React.SetStateAction<string[]>>,
    selectedDepartureTimesState: string[],
    handleDepartureTimeChangeFunc: (timeRange: string) => void,
    resetFiltersFunc: () => void,
    minPriceVal: number,
    maxPriceVal: number,
    airlinesList: { code: string; name: string }[],
  ) => {
    return (
      <div className="mb-4">
        <button
          onClick={() => setShowFiltersState(!showFiltersState)}
          className="flex items-center gap-2 text-[#007aff] hover:text-[#0056b3] mb-2"
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">{showFiltersState ? "Hide Filters" : "Show Filters"}</span>
          {showFiltersState ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFiltersState && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-4">
              <h3 className="text-sm font-medium">Filters</h3>
              <button onClick={resetFiltersFunc} className="text-sm text-[#007aff] hover:text-[#0056b3]">
                Reset All
              </button>
            </div>

            {/* Price Range */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Price Range</h4>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={minPriceVal}
                  max={maxPriceVal}
                  value={priceRangeState[0]}
                  onChange={(e) => setPriceRangeState([Number(e.target.value), priceRangeState[1]])}
                  className="w-full"
                />
                <span className="text-sm">₹{priceRangeState[0]}</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={minPriceVal}
                  max={maxPriceVal}
                  value={priceRangeState[1]}
                  onChange={(e) => setPriceRangeState([priceRangeState[0], Number(e.target.value)])}
                  className="w-full"
                />
                <span className="text-sm">₹{priceRangeState[1]}</span>
              </div>
            </div>

            {/* Stops */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Stops</h4>
              <div className="space-y-2">
                {[0, 1, 2].map((stop) => (
                  <label key={stop} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStopsState.includes(stop)}
                      onChange={() => {
                        setSelectedStopsState((prev) => {
                          if (prev.includes(stop)) {
                            return prev.filter((s) => s !== stop)
                          }
                          return [...prev, stop]
                        })
                      }}
                      className="w-4 h-4 accent-[#007aff]"
                    />
                    <span className="text-sm">{stop === 0 ? "Non-stop" : stop === 1 ? "1 Stop" : `${stop} Stops`}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Airlines */}
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Airlines</h4>
              <div className="space-y-2">
                {airlinesList.map((airline) => (
                  <label key={airline.code} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAirlinesState.includes(airline.code)}
                      onChange={() => {
                        setSelectedAirlinesState((prev) => {
                          if (prev.includes(airline.code)) {
                            return prev.filter((a) => a !== airline.code)
                          }
                          return [...prev, airline.code]
                        })
                      }}
                      className="w-4 h-4 accent-[#007aff]"
                    />
                    <span className="text-sm">{airline.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Departure Times */}
            <div>
              <h4 className="text-sm font-medium mb-2">Departure Time</h4>
              <div className="space-y-2">
                {["00:00 - 06:00", "06:00 - 12:00", "12:00 - 18:00", "18:00 - 24:00"].map((timeRange) => (
                  <label key={timeRange} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDepartureTimesState.includes(timeRange)}
                      onChange={() => handleDepartureTimeChangeFunc(timeRange)}
                      className="w-4 h-4 accent-[#007aff]"
                    />
                    <span className="text-sm">{timeRange}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderFlightCard = (flight: FlightResult, isSelected: boolean, onSelect: () => void, isOutbound: boolean) => {
    const segments = isOutbound ? flight.Segments[0] : flight.Segments[1]
    if (!segments || segments.length === 0) {
      return null // Should not happen with valid data
    }
    const firstSegment = segments[0]
    const lastSegment = segments[segments.length - 1]
    const totalStops = segments.length - 1

    return (
      <div
        key={`flight-${flight.ResultIndex}-${isOutbound ? "out" : "ret"}`}
        className={`border rounded-lg p-4 mb-3 transition-all ${
          isSelected ? "border-[#007aff] bg-blue-50" : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={onSelect}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full border ${isSelected ? "bg-[#007aff] border-[#007aff]" : "border-gray-300"} flex items-center justify-center`}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <AirlineLogo airlineCode={firstSegment.Airline.AirlineCode} size="sm" />
            <div>
              <div className="font-medium">{firstSegment.Airline.AirlineName}</div>
              <div className="text-xs text-gray-500">{firstSegment.Airline.FlightNumber}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">₹{flight.Fare.PublishedFare.toLocaleString()}</div>
            <div className="text-xs text-gray-500">per adult</div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-center">
            <div className="text-xl font-semibold">{formatTime(firstSegment.Origin.DepTime)}</div>
            <div className="text-sm text-gray-600">{firstSegment.Origin.Airport.AirportCode}</div>
          </div>

          <div className="flex-1 px-4">
            <div className="text-center text-xs text-gray-500">
              {formatDuration(segments.reduce((sum, seg) => sum + seg.Duration, 0))}
            </div>
            <div className="relative">
              <div className="border-t border-gray-300 absolute w-full top-1/2"></div>
            </div>
            <div className="text-center text-xs text-gray-500">
              {totalStops === 0 ? "Non stop" : `${totalStops} Stop${totalStops > 1 ? "s" : ""}`}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xl font-semibold">{formatTime(lastSegment.Destination.ArrTime)}</div>
            <div className="text-sm text-gray-600">{lastSegment.Destination.Airport.AirportCode}</div>
          </div>
        </div>

        {/* You can add conditional elements like "Free Meal" if applicable to international flights */}
        {/* {flight.IsNonStop && (
          <div className="mt-2">
            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Free Meal</span>
          </div>
        )} */}
      </div>
    )
  }

  return (
    <div className="container mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Outbound Flights Column */}
        <div>
          <div className="bg-gray-100 p-4 mb-4 rounded-lg">
            <h2 className="text-lg font-bold">
              {searchParams.from} → {searchParams.to}
              <span className="ml-2 text-sm font-normal text-gray-600">
                {searchParams.date && format(new Date(searchParams.date), "EEE, dd MMM")}
              </span>
            </h2>
          </div>

          {/* Outbound Filters */}
          {renderFilterSection(
            true,
            showOutboundFilters,
            setShowOutboundFilters,
            outboundPriceRange,
            setOutboundPriceRange,
            outboundSelectedStops,
            setOutboundSelectedStops,
            outboundSelectedAirlines,
            setOutboundSelectedAirlines,
            outboundSelectedDepartureTimes,
            handleOutboundDepartureTimeChange,
            resetOutboundFilters,
            minOverallPrice,
            maxOverallPrice,
            allAirlines,
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {(filteredInternationalCombinedFlights.length > 0
              ? filteredInternationalCombinedFlights
              : internationalCombinedFlights
            ).map((flight) =>
              renderFlightCard(
                flight,
                selectedCombinedFlightIndex === flight.ResultIndex,
                () => setSelectedCombinedFlightIndex(flight.ResultIndex),
                true, // isOutbound
              ),
            )}

            {filteredInternationalCombinedFlights.length === 0 && internationalCombinedFlights.length > 0 && (
              <div className="p-4 text-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">No flights match your filter criteria</p>
                <button onClick={resetOutboundFilters} className="mt-2 text-[#007aff] hover:text-[#0056b3] text-sm">
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Return Flights Column */}
        <div>
          <div className="bg-gray-100 p-4 mb-4 rounded-lg">
            <h2 className="text-lg font-bold">
              {searchParams.to} → {searchParams.from}
              <span className="ml-2 text-sm font-normal text-gray-600">
                {searchParams.returnDate && format(new Date(searchParams.returnDate), "EEE, dd MMM")}
              </span>
            </h2>
          </div>

          {/* Return Filters */}
          {renderFilterSection(
            false,
            showReturnFilters,
            setShowReturnFilters,
            returnPriceRange,
            setReturnPriceRange,
            returnSelectedStops,
            setReturnSelectedStops,
            returnSelectedAirlines,
            setReturnSelectedAirlines,
            returnSelectedDepartureTimes,
            handleReturnDepartureTimeChange,
            resetReturnFilters,
            minOverallPrice,
            maxOverallPrice,
            allAirlines,
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {(filteredInternationalCombinedFlights.length > 0
              ? filteredInternationalCombinedFlights
              : internationalCombinedFlights
            ).map((flight) =>
              renderFlightCard(
                flight,
                selectedCombinedFlightIndex === flight.ResultIndex,
                () => setSelectedCombinedFlightIndex(flight.ResultIndex),
                false, // isOutbound
              ),
            )}

            {filteredInternationalCombinedFlights.length === 0 && internationalCombinedFlights.length > 0 && (
              <div className="p-4 text-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">No flights match your filter criteria</p>
                <button onClick={resetReturnFilters} className="mt-2 text-[#007aff] hover:text-[#0056b3] text-sm">
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      {selectedCombinedFlight && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a2158] text-white p-4 shadow-lg">
          <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
              {selectedCombinedFlight.Segments[0] && selectedCombinedFlight.Segments[0][0] && (
                <div className="flex items-center gap-2">
                  <div className="font-medium">Departure</div>
                  <div className="text-gray-300">•</div>
                  <AirlineLogo airlineCode={selectedCombinedFlight.Segments[0][0].Airline.AirlineCode} size="sm" />
                  <div>
                    {formatTime(selectedCombinedFlight.Segments[0][0].Origin.DepTime)} →{" "}
                    {formatTime(
                      selectedCombinedFlight.Segments[0][selectedCombinedFlight.Segments[0].length - 1].Destination
                        .ArrTime,
                    )}
                  </div>
                  <button
                    className="text-blue-300 text-sm underline"
                    onClick={() => setShowFlightDetails(!showFlightDetails)}
                  >
                    Flight Details
                  </button>
                </div>
              )}

              {selectedCombinedFlight.Segments[1] && selectedCombinedFlight.Segments[1][0] && (
                <div className="flex items-center gap-2">
                  <div className="font-medium">Return</div>
                  <div className="text-gray-300">•</div>
                  <AirlineLogo airlineCode={selectedCombinedFlight.Segments[1][0].Airline.AirlineCode} size="sm" />
                  <div>
                    {formatTime(selectedCombinedFlight.Segments[1][0].Origin.DepTime)} →{" "}
                    {formatTime(
                      selectedCombinedFlight.Segments[1][selectedCombinedFlight.Segments[1].length - 1].Destination
                        .ArrTime,
                    )}
                  </div>
                  <button
                    className="text-blue-300 text-sm underline"
                    onClick={() => setShowFlightDetails(!showFlightDetails)}
                  >
                    Flight Details
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">₹{selectedCombinedFlight.Fare.PublishedFare.toLocaleString()}</div>
                <div className="text-sm">per adult</div>
                <button
                  className="text-blue-300 text-sm underline"
                  onClick={() => setShowFlightDetails(!showFlightDetails)}
                >
                  Fare Details
                </button>
              </div>

              <button
                className="bg-[#007aff] text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
                disabled={!selectedCombinedFlight}
                onClick={handleBookNow}
              >
                BOOK NOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flight Details Modal for International Combined */}
      {showFlightDetails && selectedCombinedFlight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Flight & Fare Details</h3>
              <button className="text-gray-500" onClick={() => setShowFlightDetails(false)}>
                ✕
              </button>
            </div>

            {/* Outbound Details */}
            {selectedCombinedFlight.Segments[0] && selectedCombinedFlight.Segments[0].length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium mb-2">Outbound Journey</h4>
                {selectedCombinedFlight.Segments[0].map((segment, index) => (
                  <div key={`modal-out-${index}`} className="border rounded p-4 mb-2 last:mb-0">
                    <div className="flex items-center gap-3 mb-3">
                      <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
                      <div>
                        <div className="font-medium">{segment.Airline.AirlineName}</div>
                        <div className="text-sm text-gray-500">{segment.Airline.FlightNumber}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xl font-semibold">{formatTime(segment.Origin.DepTime)}</div>
                        <div className="text-sm">{segment.Origin.Airport.AirportCode}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500">{formatDuration(segment.Duration)}</div>
                        <div className="border-t border-gray-300 w-32 my-1"></div>
                        <div className="text-xs text-gray-500">
                          {segment.StopOver ? `Stop at ${segment.StopPoint || "N/A"}` : "Non-stop"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold">{formatTime(segment.Destination.ArrTime)}</div>
                        <div className="text-sm">{segment.Destination.Airport.AirportCode}</div>
                      </div>
                    </div>
                    {index < selectedCombinedFlight.Segments[0].length - 1 && (
                      <div className="text-center text-xs text-gray-500 mt-2">
                        Layover: {formatDuration(selectedCombinedFlight.Segments[0][index + 1].GroundTime)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Return Details */}
            {selectedCombinedFlight.Segments[1] && selectedCombinedFlight.Segments[1].length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium mb-2">Return Journey</h4>
                {selectedCombinedFlight.Segments[1].map((segment, index) => (
                  <div key={`modal-ret-${index}`} className="border rounded p-4 mb-2 last:mb-0">
                    <div className="flex items-center gap-3 mb-3">
                      <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
                      <div>
                        <div className="font-medium">{segment.Airline.AirlineName}</div>
                        <div className="text-sm text-gray-500">{segment.Airline.FlightNumber}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xl font-semibold">{formatTime(segment.Origin.DepTime)}</div>
                        <div className="text-sm">{segment.Origin.Airport.AirportCode}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500">{formatDuration(segment.Duration)}</div>
                        <div className="border-t border-gray-300 w-32 my-1"></div>
                        <div className="text-xs text-gray-500">
                          {segment.StopOver ? `Stop at ${segment.StopPoint || "N/A"}` : "Non-stop"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold">{formatTime(segment.Destination.ArrTime)}</div>
                        <div className="text-sm">{segment.Destination.Airport.AirportCode}</div>
                      </div>
                    </div>
                    {index < selectedCombinedFlight.Segments[1].length - 1 && (
                      <div className="text-center text-xs text-gray-500 mt-2">
                        Layover: {formatDuration(selectedCombinedFlight.Segments[1][index + 1].GroundTime)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">Fare Summary</h4>
              <div className="border rounded p-4">
                <div className="flex justify-between mb-2">
                  <span>Base Fare</span>
                  <span>₹{selectedCombinedFlight.Fare.BaseFare.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Taxes & Fees</span>
                  <span>₹{selectedCombinedFlight.Fare.Tax.toLocaleString()}</span>
                </div>
                <div className="border-t my-2"></div>
                <div className="flex justify-between font-bold">
                  <span>Total Amount</span>
                  <span>₹{selectedCombinedFlight.Fare.PublishedFare.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                className="bg-[#007aff] text-white px-6 py-2 rounded-lg font-medium"
                onClick={() => {
                  setShowFlightDetails(false)
                  handleBookNow()
                }}
              >
                CONTINUE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InternationalRoundTripSelectionView
