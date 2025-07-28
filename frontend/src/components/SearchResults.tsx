"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import axios from "axios"
import { format, parse, isValid, addDays } from "date-fns"
import { SearchHeader } from "./Search/SearchHeader"
import { FilterSection } from "./Search/FilterSection"
import { SortingTabs, type SortOption } from "./Search/SortingTabs"
import { Pagination } from "./Search/Pagination"
import { Header } from "./booking/BookingHeader"
import NoFlightsFound from "./Search/NotFlightFound"
import { getFareQuote, type FareQuoteResponse } from "../services/fareService"
import RoundTripSelectionView from "./Search/RoundTripSelection"
import MultiCitySelectionView from "./Search/MultiCitySelection"
import InternationalRoundTripSelectionView from "./Search/InternationalRoundTripSelection" // Import the new component
import { FlightCard } from "./Search/FlightCard" // Ensure FlightCard is imported

// Define types for the new API structure
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

interface SearchResponse {
  ResponseStatus: number
  Error: {
    ErrorCode: number
    ErrorMessage: string
  }
  TraceId: string
  Origin: string
  Destination: string
  Results: FlightResult[][]
}

// Define CityPair interface for multi-city trips
interface CityPair {
  from: string
  to: string
  date: string
}

// Define SearchFormData interface
interface SearchFormData {
  from: string
  to: string
  date: string
  returnDate?: string
  passengers: number
  tripType: "one-way" | "round-trip" | "multi-city" // Updated to union type
  fareType?: string
  preferredAirlines?: string[]
  directFlight?: boolean
  multiCityTrips?: CityPair[]
  journeyType?: string
  resultFareType?: string
  sources?: string[] | null
}

const SearchResults: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const [results, setResults] = useState<FlightResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [priceRange, setPriceRange] = useState<number[]>([0, 100000])
  const [selectedStops, setSelectedStops] = useState<number[]>([])
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([])
  const [selectedFlight, setSelectedFlight] = useState<{
    id: string | null
    tab: string | null
  }>({
    id: null,
    tab: null,
  })
  const [sortOption, setSortOption] = useState<SortOption>("CHEAPEST")
  const [searchForm, setSearchForm] = useState<SearchFormData>({
    from: "",
    to: "",
    date: "",
    returnDate: "",
    passengers: 1,
    tripType: "one-way",
    fareType: "regular",
    directFlight: false,
    multiCityTrips: [],
    journeyType: "",
    resultFareType: "",
    sources: null,
  })

  // Explicitly type lastSearchedType as a union
  const [lastSearchedType, setLastSearchedType] = useState<"one-way" | "round-trip" | "multi-city">("one-way")
  const [isInternationalCombinedRoundTrip, setIsInternationalCombinedRoundTrip] = useState(false) // New state for international combined

  const [currentPage, setCurrentPage] = useState(1)
  const [flightsPerPage] = useState(15)
  const [shouldSearch, setShouldSearch] = useState(false)
  const [selectedDepartureTimes, setSelectedDepartureTimes] = useState<string[]>([])
  const [selectedFlightIds, setSelectedFlightIds] = useState<string[]>([])
  const [repricedResults, setRepricedResults] = useState<any>(null)
  const [repricingModalOpen, setRepricingModalOpen] = useState(false)
  const [repricingFlight, setRepricingFlight] = useState<FlightResult | null>(null)
  const [initialSearchParams, setInitialSearchParams] = useState<any>(null)
  const [tokenId, setTokenId] = useState<string | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"outbound" | "return">("outbound")
  const [outboundResults, setOutboundResults] = useState<FlightResult[]>([])
  const [returnResults, setReturnResults] = useState<FlightResult[]>([])
  const [internationalCombinedFlights, setInternationalCombinedFlights] = useState<FlightResult[]>([]) // New state for combined international flights
  const [multiCityResults, setMultiCityResults] = useState<FlightResult[][]>([])

  // New state to store raw responses for multi-city, including per-segment trace IDs
  const [multiCityRawResponses, setMultiCityRawResponses] = useState<
    { traceId: string; flights: FlightResult[]; segmentIndex: number }[]
  >([])

  const [rawApiResponse, setRawApiResponse] = useState<any>(null)
  const [savedResultsLoaded, setSavedResultsLoaded] = useState(false)
  const [returningFromBooking, setReturningFromBooking] = useState(false)

  // Function to ensure ResultIndex is always a string and prevent scientific notation
  const ensureResultIndexAsString = (resultIndex: any): string => {
    if (typeof resultIndex === "number") {
      return resultIndex.toFixed(0)
    }
    return String(resultIndex)
  }

  // Function to process flight results and ensure ResultIndex is always a string
  const processFlightResults = (flights: FlightResult[]): FlightResult[] => {
    return flights.map((flight) => ({
      ...flight,
      ResultIndex: ensureResultIndexAsString(flight.ResultIndex),
    }))
  }

  // Function to determine if we should show domestic round trip view
  const shouldShowDomesticRoundTripView = () => {
    return (
      lastSearchedType === "round-trip" &&
      !isInternationalCombinedRoundTrip &&
      outboundResults.length > 0 &&
      returnResults.length > 0
    )
  }

  // Function to determine if we should show multi-city view
  const shouldShowMultiCityView = () => {
    return (
      lastSearchedType === "multi-city" &&
      multiCityResults.length > 0 &&
      multiCityResults.some((segment) => segment.length > 0)
    )
  }

  // Function to determine if we should show international combined round trip view
  const shouldShowInternationalCombinedRoundTripView = () => {
    return (
      lastSearchedType === "round-trip" && isInternationalCombinedRoundTrip && internationalCombinedFlights.length > 0
    )
  }

  // Get search params from location state or localStorage
  const getInitialSearchParams = useCallback(() => {
    if (location.state?.searchParams) {
      localStorage.setItem("searchParams", JSON.stringify(location.state.searchParams))
      return location.state.searchParams
    }

    const savedParams = localStorage.getItem("searchParams")
    if (savedParams) {
      return JSON.parse(savedParams)
    }

    navigate("/")
    return null
  }, [location.state, navigate])

  const getTokenId = useCallback(() => {
    return localStorage.getItem("tokenId")
  }, [])

  const loadSavedResults = useCallback(
    (params: any) => {
      if (
        !params?.date ||
        params.date.trim() === "" ||
        (params.tripType === "round-trip" && (!params.returnDate || params.returnDate.trim() === ""))
      ) {
        console.warn("Missing departure or return date. Not showing saved results.")
        return false
      }

      const savedResults = localStorage.getItem("searchResults")
      const savedMultiCityRawResponses = localStorage.getItem("multiCityRawResponses") // Load multi-city raw responses

      if (savedResults) {
        try {
          const parsedResults = JSON.parse(savedResults)
          const processedResults = processFlightResults(parsedResults)

          if (params?.tripType === "round-trip") {
            // Check for international combined round trip structure
            if (
              processedResults.length > 0 &&
              processedResults[0].Segments.length === 2 &&
              (processedResults[0].Segments[0]?.[0]?.TripIndicator === 1 ||
                processedResults[0].Segments[0]?.[0]?.TripIndicator === undefined) && // Outbound indicator (or undefined if not set)
              (processedResults[0].Segments[1]?.[0]?.TripIndicator === 2 ||
                processedResults[0].Segments[1]?.[0]?.TripIndicator === undefined) // Return indicator (or undefined if not set)
            ) {
              setInternationalCombinedFlights(processedResults)
              setLastSearchedType("round-trip")
              setIsInternationalCombinedRoundTrip(true)
              setOutboundResults([])
              setReturnResults([])
              setResults([]) // Clear main results for this type
              console.log("Loaded saved international combined round-trip results.")
            } else {
              // Domestic round trip
              const isTripIndicator = (flight: FlightResult, indicator: number): boolean => {
                try {
                  if (!flight.Segments || !flight.Segments.length || !flight.Segments[0].length) {
                    return false
                  }

                  const firstSegment = flight.Segments[0][0]
                  const lastSegment = flight.Segments[0]?.[flight.Segments[0].length - 1]

                  if (indicator === 1) {
                    return (
                      firstSegment.Origin.Airport.AirportCode === params.from &&
                      lastSegment.Destination.Airport.AirportCode === params.to
                    )
                  }

                  if (indicator === 2) {
                    return (
                      firstSegment.Origin.Airport.AirportCode === params.to &&
                      lastSegment.Destination.Airport.AirportCode === params.from
                    )
                  }

                  return false
                } catch (e) {
                  console.error("Error checking trip indicator in loadSavedResults:", e)
                  return false
                }
              }

              const outbound = processedResults.filter((flight) => isTripIndicator(flight, 1))
              const returnFlights = processedResults.filter((flight) => isTripIndicator(flight, 2))

              setOutboundResults(outbound)
              setReturnResults(returnFlights)
              setIsInternationalCombinedRoundTrip(false)
              setLastSearchedType("round-trip")
              setResults([]) // Clear main results for this type
              setInternationalCombinedFlights([]) // Clear combined flights
              console.log("Loaded saved domestic round-trip results.")
            }
          } else {
            // One-way trip
            setResults(processedResults)
            setLastSearchedType("one-way")
            setIsInternationalCombinedRoundTrip(false)
            setOutboundResults([])
            setReturnResults([])
            setInternationalCombinedFlights([])
            console.log("Loaded saved one-way results.")
          }
          return true
        } catch (e) {
          console.error("Error parsing saved results:", e)
          return false
        }
      } else if (savedMultiCityRawResponses && params?.tripType === "multi-city") {
        try {
          const parsedMultiCityRawResponses = JSON.parse(savedMultiCityRawResponses)
          setMultiCityRawResponses(parsedMultiCityRawResponses)

          const multiCitySegments: FlightResult[][] = Array(params.multiCityTrips?.length || 0)
            .fill(null)
            .map(() => [])

          parsedMultiCityRawResponses.forEach(
            (segmentRawData: { traceId: string; flights: FlightResult[]; segmentIndex: number }) => {
              if (segmentRawData.segmentIndex !== undefined) {
                multiCitySegments[segmentRawData.segmentIndex] = processFlightResults(segmentRawData.flights)
              }
            },
          )

          if (multiCitySegments.length > 0 && multiCitySegments.every((segment) => segment.length > 0)) {
            setMultiCityResults(multiCitySegments)
            setLastSearchedType("multi-city")
            setIsInternationalCombinedRoundTrip(false)
            console.log("Loaded saved multi-city raw responses.")
          } else {
            setLastSearchedType("one-way") // Fallback if multi-city results are incomplete
            setIsInternationalCombinedRoundTrip(false)
          }
          setResults([]) // Clear the main results state for multi-city view
          setOutboundResults([])
          setReturnResults([])
          setInternationalCombinedFlights([])
          return true
        } catch (e) {
          console.error("Error parsing saved multi-city raw responses:", e)
          return false
        }
      }
      return false
    },
    [], // Dependencies for useCallback
  )

  useEffect(() => {
    const params = getInitialSearchParams()
    const token = getTokenId()
    setInitialSearchParams(params)
    setTokenId(token)

    const isReturningFromBooking = location.state?.returnFromBooking === true
    setReturningFromBooking(isReturningFromBooking)

    if (params) {
      localStorage.setItem("searchParams", JSON.stringify(params))
      setSearchForm({
        from: params.from || "",
        to: params.to || "",
        date: params.date || "",
        returnDate: params.returnDate || "",
        passengers: params.passengers || 1,
        tripType: params.tripType === "round-trip" || params.tripType === "multi-city" ? params.tripType : "one-way",
        fareType: params.fareType || "regular",
        preferredAirlines: params.preferredAirlines || [],
        directFlight: params.directFlight || false,
        multiCityTrips: params.multiCityTrips || [],
        journeyType: params.journeyType,
        resultFareType: params.resultFareType,
        sources: params.sources,
      })

      if (isReturningFromBooking || (!location.state?.shouldSearch && !savedResultsLoaded)) {
        const loaded = loadSavedResults(params)
        setSavedResultsLoaded(loaded)
      }
    }

    if (location.state?.shouldSearch) {
      setShouldSearch(true)
    }
  }, [getInitialSearchParams, getTokenId, location.state, loadSavedResults, savedResultsLoaded])

  // Format date for the API (yyyy-MM-ddTHH:mm:ss)
  const formatDateForApi = useCallback((dateStr: string) => {
    try {
      if (!dateStr || dateStr.trim() === "") {
        console.error("Empty date string provided to formatDateForApi")
        return new Date().toISOString().split("T")[0] + "T00:00:00"
      }

      if (dateStr.includes("T")) {
        return dateStr
      }

      const date = parse(dateStr, "yyyy-MM-dd", new Date())
      if (!isValid(date)) {
        console.error("Invalid date parsed:", dateStr)
        return new Date().toISOString().split("T")[0] + "T00:00:00"
      }

      return format(date, "yyyy-MM-dd'T'HH:mm:ss")
    } catch (error) {
      console.error("Error formatting date:", error, "for date string:", dateStr)
      return new Date().toISOString().split("T")[0] + "T00:00:00"
    }
  }, [])

  const searchFlights = useCallback(async () => {
    console.log("searchFlights called with tokenId:", tokenId, "and shouldSearch:", shouldSearch)
    if (!shouldSearch || !tokenId) return

    setLoading(true)
    setError("")
    setOutboundResults([]) // Clear previous results
    setReturnResults([])
    setResults([])
    setInternationalCombinedFlights([]) // Clear combined international flights
    setMultiCityResults([])
    setIsInternationalCombinedRoundTrip(false) // Reset international flag

    try {
      let journeyType = searchForm.journeyType || "1"
      let segments: {
        Origin: string
        Destination: string
        FlightCabinClass: string
        PreferredDepartureTime: string
        PreferredArrivalTime: string
      }[] = []

      if (searchForm.tripType === "one-way") {
        journeyType = "1"
        segments = [
          {
            Origin: searchForm.from,
            Destination: searchForm.to,
            FlightCabinClass: "1",
            PreferredDepartureTime: formatDateForApi(searchForm.date),
            PreferredArrivalTime: formatDateForApi(searchForm.date),
          },
        ]
        console.log("One-way search segments:", segments)

        const requestData: any = {
          EndUserIp: "192.168.1.1",
          TokenId: tokenId,
          AdultCount: searchForm.passengers.toString(),
          ChildCount: "0",
          InfantCount: "0",
          DirectFlight: searchForm.directFlight ? "true" : "false",
          OneStopFlight: "false",
          JourneyType: journeyType,
          Segments: segments,
        }

        if (searchForm.resultFareType) {
          requestData.ResultFareType = searchForm.resultFareType
        }

        if (searchForm.preferredAirlines && searchForm.preferredAirlines.length > 0) {
          requestData.PreferredAirlines = searchForm.preferredAirlines
        } else {
          requestData.PreferredAirlines = null
        }

        if (searchForm.sources && searchForm.sources.length > 0) {
          requestData.Sources = searchForm.sources
        } else {
          requestData.Sources = null
        }

        console.log("Making API request with data:", JSON.stringify(requestData, null, 2))

        const response = await axios.post("http://localhost:5000/api/search", requestData, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })

        setRawApiResponse(response.data)
        console.log("Raw Search API Response:", JSON.stringify(response.data, null, 2))

        if (response.data.Response && response.data.Response.ResponseStatus === 1) {
          setTraceId(response.data.Response.TraceId)
          localStorage.setItem("traceId", response.data.Response.TraceId)

          let flattened: FlightResult[] = []

          if (Array.isArray(response.data.Response.Results)) {
            if (Array.isArray(response.data.Response.Results[0])) {
              flattened = response.data.Response.Results.flat()
            } else {
              flattened = response.data.Response.Results
            }
          }

          const processedFlattened = processFlightResults(flattened)
          let finalResultsForDisplay: FlightResult[] = processedFlattened

          // Filter for one-way to ensure origin/destination match
          finalResultsForDisplay = processedFlattened.filter((flight) => {
            try {
              const firstSegment = flight.Segments[0]?.[0]
              const lastSegment = flight.Segments[0]?.[flight.Segments[0].length - 1]
              if (!firstSegment || !lastSegment) return false

              const flightOrigin = firstSegment.Origin.Airport.AirportCode.trim().toUpperCase()
              const flightDest = lastSegment.Destination.Airport.AirportCode.trim().toUpperCase()
              const searchOrigin = searchForm.from.trim().toUpperCase()
              const searchDest = searchForm.to.trim().toUpperCase()

              return flightOrigin === searchOrigin && flightDest === searchDest
            } catch (e) {
              console.error("Error filtering one-way flight by origin/destination:", e)
              return false
            }
          })
          console.log(
            `One-way results filtered: ${finalResultsForDisplay.length} flights matching ${searchForm.from}-${searchForm.to}`,
          )

          console.log("Flattened results:", finalResultsForDisplay.length)
          localStorage.setItem("searchResults", JSON.stringify(finalResultsForDisplay))
          setResults(finalResultsForDisplay)
          setLastSearchedType("one-way") // Explicitly set for one-way
          setIsInternationalCombinedRoundTrip(false)
          setOutboundResults([])
          setReturnResults([])
          setInternationalCombinedFlights([])
        } else {
          const errorMsg = response.data.Response?.Error?.ErrorMessage || "Search failed"
          setError(errorMsg)
          console.error("Search API error:", errorMsg)
        }
      } else if (searchForm.tripType === "round-trip") {
        journeyType = "2" // Correctly set journeyType for round-trip
        segments = [
          {
            Origin: searchForm.from,
            Destination: searchForm.to,
            FlightCabinClass: "1",
            PreferredDepartureTime: formatDateForApi(searchForm.date),
            PreferredArrivalTime: formatDateForApi(searchForm.date),
          },
          {
            Origin: searchForm.to,
            Destination: searchForm.from,
            FlightCabinClass: "1",
            PreferredDepartureTime: formatDateForApi(searchForm.returnDate || ""), // Ensure returnDate is used
            PreferredArrivalTime: formatDateForApi(searchForm.returnDate || ""),
          },
        ]
        console.log("Round-trip search segments:", segments)

        const requestData: any = {
          EndUserIp: "192.168.1.1",
          TokenId: tokenId,
          AdultCount: searchForm.passengers.toString(),
          ChildCount: "0",
          InfantCount: "0",
          DirectFlight: searchForm.directFlight ? "true" : "false",
          OneStopFlight: "false",
          JourneyType: journeyType, // This is now correctly "2"
          Segments: segments,
        }

        if (searchForm.resultFareType) {
          requestData.ResultFareType = searchForm.resultFareType
        }

        if (searchForm.preferredAirlines && searchForm.preferredAirlines.length > 0) {
          requestData.PreferredAirlines = searchForm.preferredAirlines
        } else {
          requestData.PreferredAirlines = null
        }

        if (searchForm.sources && searchForm.sources.length > 0) {
          requestData.Sources = searchForm.sources
        } else {
          requestData.Sources = null
        }

        console.log("Making API request with data:", JSON.stringify(requestData, null, 2))

        const response = await axios.post("http://localhost:5000/api/search", requestData, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })

        setRawApiResponse(response.data)
        console.log("Raw Search API Response:", JSON.stringify(response.data, null, 2))

        if (response.data.Response && response.data.Response.ResponseStatus === 1) {
          setTraceId(response.data.Response.TraceId)
          localStorage.setItem("traceId", response.data.Response.TraceId)

          // Check if it's an international round-trip (combined in one FlightResult)
          if (
            response.data.Response.Results.length === 1 &&
            Array.isArray(response.data.Response.Results[0]) &&
            response.data.Response.Results[0].length > 0 &&
            response.data.Response.Results[0][0].Segments.length === 2 && // Expecting 2 segment arrays for combined
            (response.data.Response.Results[0][0].Segments[0]?.[0]?.TripIndicator === 1 ||
              response.data.Response.Results[0][0].Segments[0]?.[0]?.TripIndicator === undefined) && // Outbound indicator (or undefined if not set)
            (response.data.Response.Results[0][0].Segments[1]?.[0]?.TripIndicator === 2 ||
              response.data.Response.Results[0][0].Segments[1]?.[0]?.TripIndicator === undefined) // Return indicator (or undefined if not set)
          ) {
            const combinedRoundTripFlights = processFlightResults(response.data.Response.Results[0])
            setInternationalCombinedFlights(combinedRoundTripFlights) // Store combined flights here
            setLastSearchedType("round-trip")
            setIsInternationalCombinedRoundTrip(true) // Mark as combined international
            setOutboundResults([]) // Clear these as they are not used for this type
            setReturnResults([]) // Clear these
            setResults([]) // Clear main results
            localStorage.setItem("searchResults", JSON.stringify(combinedRoundTripFlights))
            console.log("International Combined Round-trip results found:", combinedRoundTripFlights.length)
          } else if (
            response.data.Response.Results.length === 2 &&
            Array.isArray(response.data.Response.Results[0]) &&
            Array.isArray(response.data.Response.Results[1])
          ) {
            // This is a domestic round-trip where results are separated into outbound and return arrays
            const outbound = processFlightResults(response.data.Response.Results[0])
            const returnFlights = processFlightResults(response.data.Response.Results[1])

            setOutboundResults(outbound)
            setReturnResults(returnFlights)
            setActiveTab("outbound")
            setLastSearchedType("round-trip")
            setIsInternationalCombinedRoundTrip(false) // Not international combined type
            setResults([]) // Clear main results
            setInternationalCombinedFlights([]) // Clear combined flights
            localStorage.setItem("searchResults", JSON.stringify([...outbound, ...returnFlights])) // Save all for consistency
            console.log(
              "Domestic Round-trip results found - Outbound:",
              outbound.length,
              "Return:",
              returnFlights.length,
            )
          } else {
            // Fallback for unexpected round-trip structure or single-leg round-trip
            const flattened = processFlightResults(response.data.Response.Results.flat())
            setResults(flattened)
            setLastSearchedType("one-way") // Treat as one-way if structure is ambiguous
            setIsInternationalCombinedRoundTrip(false)
            setOutboundResults([])
            setReturnResults([])
            setInternationalCombinedFlights([])
            localStorage.setItem("searchResults", JSON.stringify(flattened))
            console.warn(
              "Ambiguous round-trip response structure, treating as one-way or unexpected:",
              flattened.length,
            )
          }
        } else {
          const errorMsg = response.data.Response?.Error?.ErrorMessage || "Search failed"
          setError(errorMsg)
          console.error("Search API error:", errorMsg)
        }
      } else if (searchForm.tripType === "multi-city" && searchForm.multiCityTrips) {
        const segmentResponses: { traceId: string; flights: FlightResult[]; segmentIndex: number }[] = []
        const newMultiCityResults: FlightResult[][] = Array(searchForm.multiCityTrips.length)
          .fill(null)
          .map(() => [])

        for (let i = 0; i < searchForm.multiCityTrips.length; i++) {
          const trip = searchForm.multiCityTrips[i]
          if (!trip.from || !trip.to || !trip.date) {
            console.warn(`Skipping multi-city segment ${i + 1} due to incomplete data.`)
            setError((prev) => `${prev} | Segment ${i + 1}: Incomplete trip data.`)
            continue
          }

          const oneWaySegmentRequest = {
            EndUserIp: "192.168.1.1",
            TokenId: tokenId,
            AdultCount: searchForm.passengers.toString(),
            ChildCount: "0",
            InfantCount: "0",
            DirectFlight: searchForm.directFlight ? "true" : "false",
            OneStopFlight: "false",
            JourneyType: "1", // Each multi-city leg is searched as a one-way trip
            Segments: [
              {
                Origin: trip.from,
                Destination: trip.to,
                FlightCabinClass: "1",
                PreferredDepartureTime: formatDateForApi(trip.date),
                PreferredArrivalTime: formatDateForApi(trip.date),
              },
            ],
            ResultFareType: searchForm.resultFareType || null,
            PreferredAirlines:
              searchForm.preferredAirlines && searchForm.preferredAirlines.length > 0
                ? searchForm.preferredAirlines
                : null,
            Sources: searchForm.sources && searchForm.sources.length > 0 ? searchForm.sources : null,
          }

          console.log(
            `Making API request for multi-city segment ${i + 1}:`,
            JSON.stringify(oneWaySegmentRequest, null, 2),
          )

          try {
            const segmentResponse = await axios.post("http://localhost:5000/api/search", oneWaySegmentRequest, {
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              timeout: 30000,
            })

            console.log(`Raw API Response for segment ${i + 1}:`, JSON.stringify(segmentResponse.data, null, 2))

            if (segmentResponse.data.Response && segmentResponse.data.Response.ResponseStatus === 1) {
              const segmentTraceId = segmentResponse.data.Response.TraceId
              const segmentFlights = (segmentResponse.data.Response.Results || []).flat() // Flatten in case it's nested
              const processedSegmentFlights = processFlightResults(segmentFlights)

              newMultiCityResults[i] = processedSegmentFlights // Store for `setMultiCityResults`

              segmentResponses.push({
                traceId: segmentTraceId,
                flights: processedSegmentFlights,
                segmentIndex: i, // Store original index for mapping
              })

              console.log(
                `Segment ${i + 1} search successful. TraceId: ${segmentTraceId}, Flights found: ${processedSegmentFlights.length}`,
              )
            } else {
              const errorMsg =
                segmentResponse.data.Response?.Error?.ErrorMessage || `Search failed for segment ${i + 1}`
              console.error(`Search API error for segment ${i + 1}:`, errorMsg)
              setError((prev) => `${prev} | Segment ${i + 1}: ${errorMsg}`)
            }
          } catch (err) {
            console.error(`Error in searchFlights for segment ${i + 1}:`, err)
            if (axios.isAxiosError(err)) {
              if (err.code === "ERR_NETWORK") {
                setError("Network error: Please check if the backend server is running at http://localhost:5000")
              } else {
                setError(`Failed to fetch results for segment ${i + 1}: ${err.message}.`)
              }
            } else {
              setError(`Failed to fetch results for segment ${i + 1}.`)
            }
          }
        }

        setMultiCityRawResponses(segmentResponses) // Store the per-segment traceIds and flights
        setMultiCityResults(newMultiCityResults) // This is what MultiCitySelectionView expects
        setLastSearchedType("multi-city")
        setIsInternationalCombinedRoundTrip(false)

        // Clear other states relevant only for one-way/round-trip searches
        setResults([])
        setOutboundResults([])
        setReturnResults([])
        setInternationalCombinedFlights([])
        localStorage.removeItem("searchResults")
        localStorage.removeItem("traceId")
        localStorage.setItem("multiCityRawResponses", JSON.stringify(segmentResponses))

        console.log(
          "Final multiCityResults state after processing:",
          multiCityResults.map((s) => s.length),
        )
      } else {
        setLastSearchedType("one-way")
        setIsInternationalCombinedRoundTrip(false)
      }
    } catch (err) {
      console.error("Error in searchFlights:", err)
      if (axios.isAxiosError(err)) {
        if (err.code === "ERR_NETWORK") {
          setError("Network error: Please check if the backend server is running at http://localhost:5000")
        } else {
          setError(`Failed to fetch results: ${err.message}. Please try again.`)
        }
      } else {
        setError("Failed to fetch results. Please try again.")
      }
    } finally {
      setLoading(false)
      setShouldSearch(false)
    }
  }, [searchForm, tokenId, shouldSearch, formatDateForApi])

  useEffect(() => {
    if (shouldSearch) {
      console.log("shouldSearch is true, calling searchFlights()")
      searchFlights()
    }
  }, [searchFlights, shouldSearch])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSearchForm({ ...searchForm, [e.target.name]: e.target.value })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Search form submitted, triggering search...")

    localStorage.setItem("searchParams", JSON.stringify(searchForm))
    localStorage.removeItem("searchResults")
    localStorage.removeItem("multiCityRawResponses") // Clear old multi-city responses
    localStorage.removeItem("traceId") // Clear old traceId

    setResults([])
    setOutboundResults([])
    setReturnResults([])
    setInternationalCombinedFlights([]) // Clear combined international flights
    setMultiCityResults([])
    setMultiCityRawResponses([]) // Clear the raw responses state
    setIsInternationalCombinedRoundTrip(false) // Reset international flag

    setShouldSearch(true)
    setCurrentPage(1)
  }

  const handleTabClick = (flightId: string, tabName: string) => {
    setSelectedFlight((prev) => {
      if (prev.id === flightId && prev.tab === tabName) {
        return { id: null, tab: null }
      }
      return { id: flightId, tab: tabName }
    })
  }

  const formatDate = (date: string) => {
    const parsedDate = parse(date, "yyyy-MM-dd", new Date())
    return format(parsedDate, "dd/MM/yyyy")
  }

  const getAirlineImage = (airline: string) => {
    const airlineImageMap: { [key: string]: string } = {
      "6E": "/images/indigo.png",
      AI: "/images/airindia.png",
      IX: "/images/airindia-express.png",
      QP: "/images/akasaair.jpeg",
      SG: "/images/spicejet.png",
      "9I": "/images/allianceair.jpeg",
      UK: "/images/vistara.png",
      G8: "/images/goair.png",
    }
    return airlineImageMap[airline] || "/images/default-airline.png"
  }

  const sortFlights = (flights: FlightResult[], option: SortOption) => {
    return [...flights].sort((a, b) => {
      switch (option) {
        case "CHEAPEST":
          return a.Fare.PublishedFare - b.Fare.PublishedFare
        case "SHORTEST":
          // For combined round trips, sum durations of all segments. For others, just the first segment.
          const aDuration =
            a.Segments.length > 1
              ? a.Segments.flat().reduce((sum, seg) => sum + seg.Duration, 0)
              : a.Segments[0]?.[0]?.Duration || 0
          const bDuration =
            b.Segments.length > 1
              ? b.Segments.flat().reduce((sum, seg) => sum + seg.Duration, 0)
              : b.Segments[0]?.[0]?.Duration || 0
          return aDuration - bDuration
        case "DEPARTURE":
          const aDepTime = a.Segments[0]?.[0]?.Origin.DepTime || ""
          const bDepTime = b.Segments[0]?.[0]?.Origin.DepTime || ""
          return new Date(aDepTime).getTime() - new Date(bDepTime).getTime()
        case "ARRIVAL":
          // For combined round trips, consider the arrival time of the last segment of the return journey
          const aArrTime =
            a.Segments[a.Segments.length - 1]?.[a.Segments[a.Segments.length - 1].length - 1]?.Destination.ArrTime || ""
          const bArrTime =
            b.Segments[b.Segments.length - 1]?.[b.Segments[b.Segments.length - 1].length - 1]?.Destination.ArrTime || ""
          return new Date(aArrTime).getTime() - new Date(bArrTime).getTime()
        default:
          return 0
      }
    })
  }

  const resetFilters = () => {
    setPriceRange([minPrice, maxPrice])
    setSelectedStops([])
    setSelectedAirlines([])
    setSelectedDepartureTimes([])
  }

  const handleTimeChange = (timeRange: string) => {
    setSelectedDepartureTimes((prev) => {
      if (prev.includes(timeRange)) {
        return prev.filter((t) => t !== timeRange)
      }
      return [...prev, timeRange]
    })
  }

  // Get the current results based on active tab for domestic round trips, or main results for one-way/combined international
  const currentResults = useMemo(() => {
    if (lastSearchedType === "round-trip") {
      if (isInternationalCombinedRoundTrip) {
        return internationalCombinedFlights
      } else {
        return activeTab === "outbound" ? outboundResults : returnResults
      }
    }
    return results // For one-way
  }, [
    lastSearchedType,
    activeTab,
    outboundResults,
    returnResults,
    results,
    isInternationalCombinedRoundTrip,
    internationalCombinedFlights,
  ])

  const filteredResultsMemo = useMemo(() => {
    console.log("Selected Departure Times:", selectedDepartureTimes)
    console.log("Total results:", currentResults.length)

    return sortFlights(
      currentResults.filter((result) => {
        const price = result.Fare.PublishedFare
        const airline = result.AirlineCode
        // For combined round trips, stops should be sum of stops in all segments. For others, just the first segment.
        const stops =
          result.Segments.length > 1
            ? result.Segments.flat().filter((s) => s.StopOver).length
            : result.Segments[0]?.length - 1 || 0

        const departureTimeStr = result.Segments[0]?.[0]?.Origin.DepTime

        if (!departureTimeStr) return false

        try {
          const departureTime = new Date(departureTimeStr)
          const hours = departureTime.getHours()
          const minutes = departureTime.getMinutes()
          const totalMinutes = hours * 60 + minutes

          const isInSelectedTimeRange =
            selectedDepartureTimes.length === 0 ||
            selectedDepartureTimes.some((timeRange) => {
              const [startTime, endTime] = timeRange.split(" - ")
              const [startHour, startMinute = "00"] = startTime.split(":")
              const [endHour, endMinute = "00"] = endTime.split(":")

              const rangeStart = Number.parseInt(startHour) * 60 + Number.parseInt(startMinute)
              const rangeEnd = Number.parseInt(endHour) * 60 + Number.parseInt(endMinute)

              return totalMinutes >= rangeStart && totalMinutes < rangeEnd
            })

          return (
            price >= priceRange[0] &&
            price <= priceRange[1] &&
            (selectedAirlines.length === 0 || selectedAirlines.includes(airline)) &&
            (selectedStops.length === 0 || selectedStops.includes(stops)) &&
            isInSelectedTimeRange
          )
        } catch (error) {
          console.error("Error parsing departure time:", error, {
            departureTimeStr,
            flight: `${airline} ${result.Segments[0]?.[0]?.Airline.FlightNumber}`,
          })
          return false
        }
      }),
      sortOption,
    )
  }, [currentResults, priceRange, selectedAirlines, selectedStops, selectedDepartureTimes, sortOption])

  const totalPages = Math.ceil(filteredResultsMemo.length / flightsPerPage)

  const getCurrentPageFlights = () => {
    const indexOfLastFlight = currentPage * flightsPerPage
    const indexOfFirstFlight = indexOfLastFlight - flightsPerPage
    const lastIndexOfLastFlight = Math.min(indexOfLastFlight, filteredResultsMemo.length)
    return filteredResultsMemo.slice(indexOfFirstFlight, lastIndexOfLastFlight)
  }

  const goToNextPage = () => setCurrentPage((page) => Math.min(page + 1, totalPages))
  const goToPrevPage = () => setCurrentPage((page) => Math.max(page - 1, 1))

  const minPrice = useMemo(
    () => (currentResults.length > 0 ? Math.min(...currentResults.map((r) => r.Fare.PublishedFare)) : 0),
    [currentResults],
  )

  const maxPrice = useMemo(
    () => (currentResults.length > 0 ? Math.max(...currentResults.map((r) => r.Fare.PublishedFare)) : 100000),
    [currentResults],
  )

  useEffect(() => {
    setPriceRange([minPrice, maxPrice])
  }, [minPrice, maxPrice])

  const handleDateChange = (newDate: string) => {
    setSearchForm((prev) => ({
      ...prev,
      date: newDate,
    }))

    if (searchForm.tripType === "round-trip" && (!searchForm.returnDate || searchForm.returnDate.trim() === "")) {
      const departureDate = new Date(newDate)
      const newReturnDate = format(addDays(departureDate, 1), "yyyy-MM-dd")
      setSearchForm((prev) => ({
        ...prev,
        returnDate: newReturnDate,
      }))
    }
  }

  const handleReturnDateChange = (newDate: string) => {
    setSearchForm((prev) => ({
      ...prev,
      returnDate: newDate,
    }))
  }

  const handleTripTypeChange = (type: string) => {
    setSearchForm((prev) => {
      let returnDate = prev.returnDate
      if (type === "round-trip" && (!prev.returnDate || prev.returnDate.trim() === "")) {
        if (prev.date && prev.date.trim() !== "") {
          const departureDate = new Date(prev.date)
          returnDate = format(addDays(departureDate, 1), "yyyy-MM-dd")
        } else {
          returnDate = format(addDays(new Date(), 1), "yyyy-MM-dd")
        }
      }

      return {
        ...prev,
        tripType: type === "round-trip" || type === "multi-city" ? type : "one-way", // Cast to the union type
        returnDate: type === "round-trip" ? returnDate : "",
        multiCityTrips:
          type === "multi-city"
            ? [
                {
                  from: prev.from || "",
                  to: prev.to || "",
                  date: prev.date || "",
                },
              ]
            : [],
      }
    })
  }

  const handleMultiCityChange = (index: number, field: keyof CityPair, value: string) => {
    setSearchForm((prev) => {
      const updatedTrips = [...(prev.multiCityTrips || [])]
      if (!updatedTrips[index]) {
        updatedTrips[index] = { from: "", to: "", date: "" }
      }
      updatedTrips[index] = { ...updatedTrips[index], [field]: value }
      return { ...prev, multiCityTrips: updatedTrips }
    })
  }

  const handleAddMultiCity = () => {
    setSearchForm((prev) => {
      const updatedTrips = [...(prev.multiCityTrips || [])]
      if (updatedTrips.length < 5) {
        updatedTrips.push({ from: "", to: "", date: "" })
      }
      return { ...prev, multiCityTrips: updatedTrips }
    })
  }

  const handleRemoveMultiCity = (index: number) => {
    setSearchForm((prev) => {
      const updatedTrips = [...(prev.multiCityTrips || [])]
      if (updatedTrips.length > 1) {
        updatedTrips.splice(index, 1)
      }
      return { ...prev, multiCityTrips: updatedTrips }
    })
  }

  const handleFlightSelection = (flightId: string) => {
    setSelectedFlightIds((prev) => {
      if (prev.includes(flightId)) {
        return prev.filter((id) => id !== flightId)
      }
      return [...prev, flightId]
    })
  }

  // Handler for one-way flight booking (from FlightCard)
  const handleBookOneWayFlight = async (flightId: string) => {
    setLoading(true)
    setError("")

    try {
      const flightToBook = results.find((result) => result.ResultIndex === flightId)
      if (!flightToBook) {
        throw new Error("Flight not found")
      }

      const currentTokenId = tokenId || localStorage.getItem("tokenId")
      const currentTraceId = traceId || localStorage.getItem("traceId")

      if (!currentTokenId || !currentTraceId) {
        throw new Error("Session information is missing. Please search again.")
      }

      let finalResultIndex = ensureResultIndexAsString(flightToBook.ResultIndex)
      let fareQuoteApiResponse: FareQuoteResponse | null = null

      if (flightToBook.IsLCC) {
        console.log("SearchResults: Quoting LCC one-way flight:", flightToBook.ResultIndex)
        fareQuoteApiResponse = await getFareQuote(currentTokenId, currentTraceId, finalResultIndex)
        if (fareQuoteApiResponse.Response && fareQuoteApiResponse.Response.Results) {
          finalResultIndex = ensureResultIndexAsString(fareQuoteApiResponse.Response.Results.ResultIndex)
          console.log("SearchResults: LCC one-way flight quoted. New ResultIndex:", finalResultIndex)
        } else {
          throw new Error(
            `Failed to quote one-way LCC flight: ${fareQuoteApiResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }
      }

      const adaptedFlight = adaptFlightForCard(fareQuoteApiResponse?.Response?.Results || flightToBook)

      localStorage.setItem("selectedFlight", JSON.stringify(adaptedFlight))
      localStorage.setItem("searchParams", JSON.stringify(searchForm))
      localStorage.setItem("traceId", currentTraceId || "")

      navigate("/booking", {
        state: {
          flight: adaptedFlight,
          searchParams: searchForm,
          tokenId: currentTokenId,
          traceId: currentTraceId,
          isRoundTrip: false, // Explicitly false for one-way
          isInternationalCombined: false,
          totalPrice: adaptedFlight.OptionPriceInfo.TotalPrice,
          outboundResultIndex: finalResultIndex,
          fareQuoteOutboundResponse: fareQuoteApiResponse,
        },
      })
    } catch (err) {
      console.error("Error preparing for one-way booking:", err)
      setError("Failed to prepare flight for booking")
    } finally {
      setLoading(false)
    }
  }

  // Handler for domestic round trip booking (from RoundTripSelectionView)
  const handleBookDomesticRoundTripFlight = async (outboundFlightId: string, returnFlightId: string) => {
    setLoading(true)
    setError("")

    try {
      const outboundFlight = outboundResults.find((f) => f.ResultIndex === outboundFlightId)
      const returnFlightToBook = returnResults.find((f) => f.ResultIndex === returnFlightId)

      if (!outboundFlight || !returnFlightToBook) {
        throw new Error("Both outbound and return flights must be selected for domestic round trip booking.")
      }

      const currentTokenId = tokenId || localStorage.getItem("tokenId")
      const currentTraceId = traceId || localStorage.getItem("traceId")

      if (!currentTokenId || !currentTraceId) {
        throw new Error("Session information is missing. Please search again.")
      }

      let finalOutboundResultIndex = ensureResultIndexAsString(outboundFlight.ResultIndex)
      let fareQuoteOutboundApiResponse: FareQuoteResponse | null = null

      if (outboundFlight.IsLCC) {
        console.log("SearchResults: Quoting LCC outbound leg:", outboundFlight.ResultIndex)
        fareQuoteOutboundApiResponse = await getFareQuote(currentTokenId, currentTraceId, finalOutboundResultIndex)
        if (fareQuoteOutboundApiResponse.Response && fareQuoteOutboundApiResponse.Response.Results) {
          finalOutboundResultIndex = ensureResultIndexAsString(
            fareQuoteOutboundApiResponse.Response.Results.ResultIndex,
          )
          console.log("SearchResults: LCC outbound quoted. New ResultIndex:", finalOutboundResultIndex)
        } else {
          throw new Error(
            `Failed to quote outbound LCC flight: ${fareQuoteOutboundApiResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }
      }

      let finalReturnResultIndex = ensureResultIndexAsString(returnFlightToBook.ResultIndex)
      let fareQuoteReturnApiResponse: FareQuoteResponse | null = null
      if (returnFlightToBook.IsLCC) {
        console.log("SearchResults: Quoting LCC return leg:", returnFlightToBook.ResultIndex)
        fareQuoteReturnApiResponse = await getFareQuote(currentTokenId, currentTraceId, finalReturnResultIndex)
        if (fareQuoteReturnApiResponse.Response && fareQuoteReturnApiResponse.Response.Results) {
          finalReturnResultIndex = ensureResultIndexAsString(fareQuoteReturnApiResponse.Response.Results.ResultIndex)
          console.log("SearchResults: LCC return quoted. New ResultIndex:", finalReturnResultIndex)
        } else {
          throw new Error(
            `Failed to quote return LCC flight: ${fareQuoteReturnApiResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }
      }

      const adaptedOutboundFlight = adaptFlightForCard(
        fareQuoteOutboundApiResponse?.Response?.Results || outboundFlight,
      )
      const adaptedReturnFlight = adaptFlightForCard(
        fareQuoteReturnApiResponse?.Response?.Results || returnFlightToBook,
      )

      const finalTotalPrice =
        (fareQuoteOutboundApiResponse?.Response?.Results?.Fare.PublishedFare || outboundFlight.Fare.PublishedFare) +
        (fareQuoteReturnApiResponse?.Response?.Results?.Fare.PublishedFare || returnFlightToBook.Fare.PublishedFare)

      localStorage.setItem("selectedFlight", JSON.stringify(adaptedOutboundFlight))
      localStorage.setItem("selectedReturnFlight", JSON.stringify(adaptedReturnFlight))
      localStorage.setItem("searchParams", JSON.stringify(searchForm))
      localStorage.setItem("traceId", currentTraceId || "")

      navigate("/booking", {
        state: {
          flight: adaptedOutboundFlight,
          returnFlight: adaptedReturnFlight,
          searchParams: searchForm,
          tokenId: currentTokenId,
          traceId: currentTraceId,
          isRoundTrip: true,
          isInternationalCombined: false, // Explicitly mark as not combined international
          totalPrice: finalTotalPrice,
          outboundResultIndex: finalOutboundResultIndex,
          returnResultIndex: finalReturnResultIndex,
          fareQuoteOutboundResponse: fareQuoteOutboundApiResponse,
          fareQuoteReturnResponse: fareQuoteReturnApiResponse,
        },
      })
    } catch (err) {
      console.error("Error preparing for domestic round trip booking:", err)
      setError("Failed to prepare flight for booking")
    } finally {
      setLoading(false)
    }
  }

  // Handler for international combined round trip booking (from InternationalRoundTripSelectionView)
  const handleBookInternationalCombinedFlight = async (selectedFlight: FlightResult) => {
    setLoading(true)
    setError("")

    try {
      const currentTokenId = tokenId || localStorage.getItem("tokenId")
      const currentTraceId = traceId || localStorage.getItem("traceId")

      if (!currentTokenId || !currentTraceId) {
        throw new Error("Session information is missing. Please search again.")
      }

      let finalResultIndex = ensureResultIndexAsString(selectedFlight.ResultIndex)
      let fareQuoteApiResponse: FareQuoteResponse | null = null

      if (selectedFlight.IsLCC) {
        console.log("SearchResults: Quoting LCC combined international flight:", selectedFlight.ResultIndex)
        fareQuoteApiResponse = await getFareQuote(currentTokenId, currentTraceId, finalResultIndex)
        if (fareQuoteApiResponse.Response && fareQuoteApiResponse.Response.Results) {
          finalResultIndex = ensureResultIndexAsString(fareQuoteApiResponse.Response.Results.ResultIndex)
          console.log("SearchResults: LCC combined international flight quoted. New ResultIndex:", finalResultIndex)
        } else {
          throw new Error(
            `Failed to quote combined international LCC flight: ${fareQuoteApiResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }
      }

      const adaptedFlight = adaptFlightForCard(fareQuoteApiResponse?.Response?.Results || selectedFlight)

      localStorage.setItem("selectedFlight", JSON.stringify(adaptedFlight))
      localStorage.setItem("searchParams", JSON.stringify(searchForm))
      localStorage.setItem("traceId", currentTraceId || "")

      navigate("/booking", {
        state: {
          flight: adaptedFlight,
          searchParams: searchForm,
          tokenId: currentTokenId,
          traceId: currentTraceId,
          isRoundTrip: true,
          isInternationalCombined: true, // Explicitly mark as combined international
          totalPrice: adaptedFlight.OptionPriceInfo.TotalPrice,
          outboundResultIndex: finalResultIndex, // This is the combined result index
          fareQuoteOutboundResponse: fareQuoteApiResponse,
        },
      })
    } catch (err) {
      console.error("Error preparing for international combined booking:", err)
      setError("Failed to prepare flight for booking")
    } finally {
      setLoading(false)
    }
  }

  const handleBookMultiCityFlights = (selectedFlightIds: string[]) => {
    setLoading(true)
    setError("")

    try {
      const selectedFlightsWithTraceIds: { flight: any; traceId: string; resultIndex: string }[] = []
      const cleanSelectedFlightIds = selectedFlightIds.map((id) => ensureResultIndexAsString(id))

      cleanSelectedFlightIds.forEach((flightId, index) => {
        const segmentRawData = multiCityRawResponses.find((seg) => seg.segmentIndex === index) // Find the raw response for this segment
        const flight = segmentRawData?.flights?.find((f) => ensureResultIndexAsString(f.ResultIndex) === flightId)

        if (flight && segmentRawData) {
          const adaptedFlight = adaptFlightForCard(flight)
          selectedFlightsWithTraceIds.push({
            flight: adaptedFlight,
            traceId: segmentRawData.traceId, // Use the segment's traceId
            resultIndex: ensureResultIndexAsString(flight.ResultIndex),
          })
        } else {
          console.error(`Flight with ID ${flightId} not found in segment ${index} or raw data missing.`)
        }
      })

      if (selectedFlightsWithTraceIds.length !== cleanSelectedFlightIds.length) {
        throw new Error("Some selected multi-city flights could not be found with their trace IDs.")
      }

      localStorage.setItem("selectedMultiCityFlightsWithTraceIds", JSON.stringify(selectedFlightsWithTraceIds))
      localStorage.setItem("searchParams", JSON.stringify(searchForm))
      // No longer store a single traceId in localStorage for multi-city, as it's per segment

      const totalPrice = selectedFlightsWithTraceIds.reduce(
        (sum, item) => sum + Number(item.flight.OptionPriceInfo.TotalPrice),
        0,
      )

      console.log("Multi-city booking data to navigate with:", {
        selectedFlightsWithTraceIds,
        totalPrice,
        searchParams: searchForm,
      })

      navigate("/booking", {
        state: {
          multiCitySelectedFlightsWithTraceIds: selectedFlightsWithTraceIds, // Pass the new structure
          searchParams: searchForm,
          isMultiCity: true,
          totalPrice: totalPrice,
        },
      })
    } catch (err) {
      console.error("Error preparing for multi-city booking:", err)
      setError("Failed to prepare flights for booking")
    } finally {
      setLoading(false)
    }
  }

  // Define AdaptedFlight interface for FlightCard
  interface AdaptedFlight {
    OptionId: string
    SearchSegmentId: number
    JourneyTime: number // Total journey time for the entire flight/round trip
    OptionSegmentsInfo: Array<{
      DepartureAirport: string
      ArrivalAirport: string
      DepartureTime: string
      ArrivalTime: string
      MarketingAirline: string
      FlightNumber: string
      Baggage: string
      CabinBaggage: string
    }>
    OptionPriceInfo: {
      TotalPrice: string
      TotalBasePrice: string
      TotalTax: string
      PaxPriceDetails: Array<{
        PaxType: string
        BasePrice: string
        FuelSurcharge: string
        AirportTax: string
        UdfCharge: string
        CongestionCharge: string
        SupplierAddCharge: string
      }>
    }
    IsLCC: boolean
    ResultFareType: string
  }

  // Adapter function to convert new API flight data to the format expected by FlightCard
  const adaptFlightForCard = (flight: FlightResult): AdaptedFlight => {
    // If it's a combined international round trip, flatten all segments for JourneyTime and OptionSegmentsInfo
    const allSegments = flight.Segments.length > 1 ? flight.Segments.flat() : flight.Segments[0]

    return {
      OptionId: ensureResultIndexAsString(flight.ResultIndex),
      SearchSegmentId: Number.parseInt(ensureResultIndexAsString(flight.ResultIndex).replace(/\D/g, "")) || 0,
      JourneyTime: allSegments.reduce((sum, seg) => sum + seg.Duration, 0), // Sum of all segments
      OptionSegmentsInfo: allSegments.map((segment) => ({
        DepartureAirport: segment.Origin.Airport.AirportCode,
        ArrivalAirport: segment.Destination.Airport.AirportCode,
        DepartureTime: segment.Origin.DepTime,
        ArrivalTime: segment.Destination.ArrTime,
        MarketingAirline: segment.Airline.AirlineName,
        FlightNumber: segment.Airline.FlightNumber,
        Baggage: segment.Baggage,
        CabinBaggage: segment.CabinBaggage,
      })),
      OptionPriceInfo: {
        TotalPrice: flight.Fare.PublishedFare.toString(),
        TotalBasePrice: flight.Fare.BaseFare.toString(),
        TotalTax: flight.Fare.Tax.toString(),
        PaxPriceDetails: flight.FareBreakdown.map((breakdown) => ({
          PaxType: breakdown.PassengerType === 1 ? "Adult" : breakdown.PassengerType === 2 ? "Child" : "Infant",
          BasePrice: breakdown.BaseFare.toString(),
          FuelSurcharge: breakdown.YQTax.toString(),
          AirportTax: breakdown.Tax.toString(),
          UdfCharge: "0",
          CongestionCharge: "0",
          SupplierAddCharge: "0",
        })),
      },
      IsLCC: flight.IsLCC,
      ResultFareType: flight.ResultFareType,
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {initialSearchParams && tokenId ? (
        <>
          <Header />
          <SearchHeader
            searchForm={searchForm}
            onSearchChange={handleSearchChange}
            onSearchSubmit={handleSearchSubmit}
            onSwapLocations={() => {
              setSearchForm((prev) => ({
                ...prev,
                from: prev.to,
                to: prev.from,
              }))
            }}
            onDateChange={handleDateChange}
            onReturnDateChange={handleReturnDateChange}
            onTripTypeChange={handleTripTypeChange}
            onMultiCityChange={handleMultiCityChange}
            onAddMultiCity={handleAddMultiCity}
            onRemoveMultiCity={handleRemoveMultiCity}
          />

          <div className="container mx-auto px-4 py-2">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-[#007aff] hover:text-[#0056b3] font-medium"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              Back to Home
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-[#007aff]"></div>
            </div>
          )}

          {error && (
            <div className="min-h-screen flex items-center justify-center">
              <div className="bg-red-100 border border-red-400 text-[#eb0066] px-4 py-3 rounded relative">{error}</div>
            </div>
          )}

          {!loading && !error && (
            <div className="container mx-auto px-4 py-8">
              {process.env.NODE_ENV === "development" && (
                <div className="mb-4 p-2 bg-yellow-100 text-xs">
                  Debug: lastSearchedType={lastSearchedType}, isInternationalCombinedRoundTrip=
                  {String(isInternationalCombinedRoundTrip)}, outbound={outboundResults.length}, return=
                  {returnResults.length}, combinedInternational={internationalCombinedFlights.length}, mainResults=
                  {results.length}
                </div>
              )}
              {shouldShowInternationalCombinedRoundTripView() ? (
                <InternationalRoundTripSelectionView
                  internationalCombinedFlights={internationalCombinedFlights}
                  searchParams={searchForm}
                  onBookFlight={handleBookInternationalCombinedFlight}
                />
              ) : shouldShowDomesticRoundTripView() ? (
                <RoundTripSelectionView
                  outboundFlights={outboundResults}
                  returnFlights={returnResults}
                  searchParams={searchForm}
                  onBookFlight={handleBookDomesticRoundTripFlight}
                />
              ) : shouldShowMultiCityView() ? (
                <MultiCitySelectionView
                  multiCityFlights={multiCityResults}
                  searchParams={searchForm}
                  onBookFlight={handleBookMultiCityFlights}
                />
              ) : (
                <>
                  {currentResults.length > 0 ? (
                    <>
                      <SortingTabs
                        activeTab={sortOption}
                        onSort={(option) => {
                          setSortOption(option)
                          setCurrentPage(1)
                        }}
                      />

                      <div className="grid grid-cols-12 gap-8">
                        <FilterSection
                          priceRange={priceRange}
                          selectedStops={selectedStops}
                          selectedAirlines={selectedAirlines}
                          onPriceRangeChange={setPriceRange}
                          onStopsChange={(stops) => {
                            setSelectedStops((prev) => {
                              if (prev.includes(stops)) {
                                return prev.filter((s) => s !== stops)
                              }
                              return [...prev, stops]
                            })
                          }}
                          onAirlinesChange={(airline) => {
                            setSelectedAirlines((prev) => {
                              if (prev.includes(airline)) {
                                return prev.filter((a) => a !== airline)
                              }
                              return [...prev, airline]
                            })
                          }}
                          airlines={Array.from(new Set(currentResults.map((r) => r.AirlineCode))).map((airline) => ({
                            code: airline, // Changed from name: airline to code: airline
                            name: currentResults.find((r) => r.AirlineCode === airline)?.Segments[0][0]?.Airline.AirlineName || airline, // Extracted AirlineName from the first segment
                            minPrice: Math.min(
                              ...currentResults
                                .filter((r) => r.AirlineCode === airline)
                                .map((r) => r.Fare.PublishedFare),
                            ),
                          }))}
                          minPrice={minPrice}
                          maxPrice={maxPrice}
                          onReset={resetFilters}
                          selectedDepartureTimes={selectedDepartureTimes}
                          onDepartureTimeChange={handleTimeChange}
                        />

                        <div className="col-span-9">
                          <div className="mb-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold">
                              Showing {(currentPage - 1) * flightsPerPage + 1} -{" "}
                              {Math.min(currentPage * flightsPerPage, filteredResultsMemo.length)} of{" "}
                              {filteredResultsMemo.length} flights
                            </h2>
                          </div>
                          <div className="space-y-4">
                            {getCurrentPageFlights().map((result, index) => {
                              const adaptedFlight = adaptFlightForCard(result)
                              return (
                                <FlightCard
                                  key={index}
                                  flight={adaptedFlight}
                                  selectedTab={selectedFlight.id === result.ResultIndex ? selectedFlight.tab : null}
                                  onTabClick={(id, tab) => handleTabClick(result.ResultIndex, tab)}
                                  getAirlineImage={getAirlineImage}
                                  isSelected={selectedFlightIds.includes(result.ResultIndex)}
                                  onSelect={() => handleFlightSelection(result.ResultIndex)}
                                  onBook={() => handleBookOneWayFlight(result.ResultIndex)}
                                  OptionId={result.ResultIndex}
                                  isRoundTripCombined={isInternationalCombinedRoundTrip} // Pass this prop to FlightCard (useful for styling)
                                />
                              )
                            })}
                          </div>

                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onNextPage={goToNextPage}
                            onPrevPage={goToPrevPage}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <NoFlightsFound searchParams={searchForm} sessionId={tokenId || ""} />
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-screen">
          <p className="text-xl font-semibold">Loading...</p>
        </div>
      )}
    </div>
  )
}

export default SearchResults
