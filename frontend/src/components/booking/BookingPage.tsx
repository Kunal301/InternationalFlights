"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useLocation, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Check } from 'lucide-react'
import { format, isValid, parseISO } from "date-fns"
import { Header } from "./BookingHeader"
import { AirlineLogo } from "../common/AirlineLogo"
import FareRules from "./FareRules"
import SSROptions from "./ssrOptions"
import RefundableBookingOption from "./Pricing/RefundableBookingOptions"
import { EcomPaymentService } from "../../services/ecomPaymentServices"
import { preparePassengerData, createBooking } from "../../services/bookingService"
import { handleTicketingProcess } from "../../services/ticketService"
import { getFareQuote } from "../../services/fareService"
import axios from "axios"

const DEBUG = true // Set to true to enable debug logs

interface IndividualPassenger {
title: string
firstName: string
middleName: string
lastName: string
gender: string
dateOfBirth: string
type: "adult" | "child" | "infant"
// Add more fields like passport, etc. if validationInfo requires it
passportNumber?: string
passportExpiry?: string
nationality?: string
// Add any other specific fields for children/infants if needed
}

interface BookingPageProps {
flight?: {
  SearchSegmentId?: number | string // Make optional and accept string
  JourneyTime: number
  OptionSegmentsInfo: {
    DepartureAirport: string
    ArrivalAirport: string
    DepartureTime: string
    ArrivalTime: string
    MarketingAirline: string
    FlightNumber: string
    Baggage?: string // Make optional
    CabinBaggage?: string // Make optional
  }[]
  OptionPriceInfo: {
    TotalPrice: string
    TotalBasePrice: string
    TotalTax: string
  }
  IsLCC?: boolean
  SelectedFare?: {
    name: string
    benefits: {
      priorityCheckIn: boolean
      priorityBoarding: boolean
      extraBaggage: string
      expressCheckIn: boolean
    }
    baggage: {
      cabinBaggage: string
      checkInBaggage: string
    }
    flexibility: {
      cancellationFee: string
      dateChangeFee: string
    }
    seats: {
      free: boolean
      complimentaryMeals: boolean
    }
  }
  OptionId?: string | number // Make optional and accept number
  ResultIndex?: string // Added ResultIndex here as it's often used
}
}

interface MultiCityFlightSegmentData {
flight: BookingPageProps["flight"] // The adapted flight data
traceId: string // The unique traceId for this segment
resultIndex: string // The ResultIndex of the selected flight in this segment
}

const parseDateString = (dateStr: string) => {
try {
  // First try direct ISO parsing
  let date = parseISO(dateStr)

  // If invalid, try parsing dd/MM/yyyy, HH:mm format
  if (!isValid(date)) {
    const [datePart, timePart] = dateStr.split(", ")
    if (datePart && timePart) {
      const [day, month, year] = datePart.split("/")
      const [hours, minutes] = timePart.split(":")
      date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
    }
  }

  // If still invalid, return current date as fallback
  if (!isValid(date)) {
    console.warn(`Invalid date string: ${dateStr}, using current date as fallback`)
    return new Date()
  }

  return date
} catch (error) {
  console.error(`Error parsing date: ${dateStr}`, error)
  return new Date()
}
}

const addDatePickerStyles = () => {
const style = document.createElement("style")
style.textContent = `
.air-datepicker-cell.-disabled- {
color: #ccc !important;
cursor: not-allowed !important;
background-color: #f5f5f5 !important;
}
`
document.head.appendChild(style)
}

const BookingPage: React.FC<BookingPageProps> = () => {
const location = useLocation()
const navigate = useNavigate()

if (DEBUG) {
  console.log("BookingPage initial location.state:", location.state)
}

const [searchParams, setSearchParams] = useState<any>(null)
const [sessionId, setSessionId] = useState<string | null>(null)
const [traceIdState, setTraceIdState] = useState<string | null>(null) // New state for traceId for non-multi-city bookings
const [flight, setFlight] = useState<BookingPageProps["flight"] | null>(null)
const [isMultiCity, setIsMultiCity] = useState(false)
const [multiCityFlights, setMultiCityFlights] = useState<MultiCityFlightSegmentData[] | null>(null) // Updated type
const [returnFlight, setReturnFlight] = useState<BookingPageProps["flight"] | null>(null)
const [isRoundTrip, setIsRoundTrip] = useState(false)
const [totalPrice, setTotalPrice] = useState<number | null>(null)
const [previousFare, setPreviousFare] = useState<number | null>(null)
const [updatedFare, setUpdatedFare] = useState<number | null>(null)
const [showAlert, setShowAlert] = useState(true)
const [selectedFare, setSelectedFare] = useState<any>(null)
const [email, setEmail] = useState("")
const [mobile, setMobile] = useState("")
const [receiveOffers, setReceiveOffers] = useState(true)
const [promoCode, setPromoCode] = useState("")
const [isCombinedTrip, setIsCombinedTrip] = useState(false);
const [passengerCounts, setPassengerCounts] = useState({
  adults: 1,
  children: 0,
  infants: 0,
})
const [passengersData, setPassengersData] = useState<IndividualPassenger[]>([])

// Add validation info state from FareQuote
const [validationInfo, setValidationInfo] = useState({
  isGSTMandatory: false,
  isPanRequiredAtBook: false,
  isPanRequiredAtTicket: false,
  isPassportRequiredAtBook: false,
  isPassportRequiredAtTicket: false,
  isHoldAllowed: false,
  isRefundable: true,
  isMealMandatory: false, // New state for mandatory meals
})

const [bookingOptions, setBookingOptions] = useState({
  fareType: "refundable",
  seatSelection: false,
  useGST: false,
  gstNumber: "",
})

// Update state for multi-city fare rules
const [activeFareRulesFlight, setActiveFareRulesFlight] = useState<"outbound" | "return" | number>("outbound")

// Update SSR options state for multi-city
const [selectedSSROptions, setSelectedSSROptions] = useState<any>({
  outbound: { baggage: [], meals: [], seats: [] },
  return: { baggage: [], meals: [], seats: [] },
  segments: {}, // Add segments for multi-city
})
const [ssrTotalPrice, setSSRTotalPrice] = useState<{
  outbound: number
  return: number
  segments: Record<number, number> // Add segments pricing
  total: number
}>({
  outbound: 0,
  return: 0,
  segments: {},
  total: 0,
})
const [showSSROptions, setShowSSROptions] = useState<boolean>(false)
const [showMealWarning, setShowMealWarning] = useState(false) // New state for meal warning

const [showFlightDetails, setShowFlightDetails] = useState(true)
const [isLoading, setIsLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [showFareRulesModal, setShowFareRulesModal] = useState(false)

// New state for refundable booking
const [isRefundableSelected, setIsRefundableSelected] = useState(false)
const [refundablePrice, setRefundablePrice] = useState(0)

// New state for EMI payment
const [isEMISelected, setIsEMISelected] = useState(false)
const [showEMIForm, setShowEMIForm] = useState(false)
const [emiProcessing, setEmiProcessing] = useState(false)
const [emiResponse, setEmiResponse] = useState<any>(null)

// Add state to track SSR component keys to prevent multiple instances
const [ssrComponentKeys, setSSRComponentKeys] = useState<{
  outbound: string
  return: string
  segments: Record<number, string>
}>({
  outbound: `outbound-${Date.now()}`,
  return: `return-${Date.now()}`,
  segments: {},
})

// Helper for re-searching and finding new ResultIndex/TraceId
const refreshSearchAndFindMatchingResult = useCallback(
  async (
    segmentToMatch: BookingPageProps["flight"],
    currentTokenId: string,
    currentTraceIdForSearch: string, // This is the traceId that was active when the re-search was triggered
    segmentIndex?: number,
  ): Promise<{ newTraceId: string; newResultIndex: string }> => {
    if (!segmentToMatch || !segmentToMatch.OptionSegmentsInfo || segmentToMatch.OptionSegmentsInfo.length === 0) {
      throw new Error("Flight segment data is missing or invalid for re-search matching.")
    }

    const storedSearchParams = JSON.parse(localStorage.getItem("searchParams") || "{}")

    const totalAdults = passengerCounts.adults.toString()
    const totalChildren = passengerCounts.children.toString()
    const totalInfants = passengerCounts.infants.toString()

    // When re-searching a specific segment, it's always a one-way search
    const firstLegToMatch = segmentToMatch.OptionSegmentsInfo[0]
    const lastLegToMatch = segmentToMatch.OptionSegmentsInfo[segmentToMatch.OptionSegmentsInfo.length - 1] // For multi-stop

    const oneWaySegmentRequest = {
      EndUserIp: "192.168.1.1",
      TokenId: currentTokenId,
      AdultCount: totalAdults,
      ChildCount: totalChildren,
      InfantCount: totalInfants,
      DirectFlight: storedSearchParams.directFlight ? "true" : "false",
      OneStopFlight: "false",
      JourneyType: "1", // Always one-way for refreshing a specific segment
      Segments: [
        {
          Origin: firstLegToMatch.DepartureAirport,
          Destination: lastLegToMatch.ArrivalAirport,
          FlightCabinClass: "1",
          PreferredDepartureTime: formatDateForApi(firstLegToMatch.DepartureTime),
          PreferredArrivalTime: formatDateForApi(lastLegToMatch.ArrivalTime),
        },
      ],
      ResultFareType: storedSearchParams.resultFareType || null,
      PreferredAirlines: storedSearchParams.preferredAirlines || null,
      Sources: storedSearchParams.sources || null,
    }

    if (DEBUG) console.log("Re-search request for segment refresh:", oneWaySegmentRequest)

    const searchResponse = await axios.post("http://localhost:5000/api/search", oneWaySegmentRequest, {
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      timeout: 30000,
    })

    if (searchResponse.data?.Response?.ResponseStatus === 1 && searchResponse.data?.Response?.TraceId) {
      const newTraceId = searchResponse.data.Response.TraceId
      // For JourneyType: "1", Results should be a flat array (FlightResult[])
      const newSearchResults = searchResponse.data.Response.Results || []
      const resultsToSearch: any[] = newSearchResults.flat() // Ensure it's always flat

      const oldFirstSegment = segmentToMatch.OptionSegmentsInfo[0]
      const oldLastSegment = segmentToMatch.OptionSegmentsInfo[segmentToMatch.OptionSegmentsInfo.length - 1]

      const oldOriginCode = oldFirstSegment.DepartureAirport
      const oldDestinationCode = oldLastSegment.ArrivalAirport
      const oldDepartureDate = format(parseDateString(oldFirstSegment.DepartureTime), "yyyy-MM-dd")
      const oldNumSegments = segmentToMatch.OptionSegmentsInfo.length

      if (DEBUG) {
        console.log("Target flight for re-match:", {
          oldOriginCode,
          oldDestinationCode,
          oldDepartureDate,
          oldNumSegments,
          oldAirline: oldFirstSegment.MarketingAirline,
          oldFlightNumber: oldFirstSegment.FlightNumber,
        })
      }

      let bestMatch: any = null
      let bestMatchScore = -1 // Higher score is better

      for (const newFlight of resultsToSearch) {
        if (!newFlight || !newFlight.OptionSegmentsInfo || newFlight.OptionSegmentsInfo.length === 0) continue

        const newFirstSegment = newFlight.OptionSegmentsInfo[0]
        const newLastSegment = newFlight.OptionSegmentsInfo[newFlight.OptionSegmentsInfo.length - 1]

        // Corrected access based on BookingPageProps["flight"] structure (which is adapted)
        const newOriginCode = newFirstSegment.DepartureAirport
        const newDestinationCode = newLastSegment.ArrivalAirport
        const newDepartureDate = format(parseDateString(newFirstSegment.DepartureTime), "yyyy-MM-dd")
        const newNumSegments = newFlight.OptionSegmentsInfo.length

        let currentScore = 0

        // Primary matching criteria: Origin, Destination, and Date
        const primaryMatch =
          newOriginCode === oldOriginCode &&
          newDestinationCode === oldDestinationCode &&
          newDepartureDate === oldDepartureDate

        if (DEBUG) {
          console.log(`  Candidate newFlight (ResultIndex: ${newFlight.ResultIndex}):`, {
            newOriginCode,
            newDestinationCode,
            newDepartureDate,
            newNumSegments,
            newAirline: newFirstSegment.MarketingAirline,
            newFlightNumber: newFirstSegment.FlightNumber,
            primaryMatch,
          })
        }

        if (primaryMatch) {
          currentScore += 100 // Base score for matching primary criteria

          // Secondary criteria: Number of segments
          if (newNumSegments === oldNumSegments) {
            currentScore += 50
          } else {
            currentScore -= Math.abs(newNumSegments - oldNumSegments) * 10 // Penalize for different number of stops
          }

          // Tertiary criteria: First segment airline and flight number
          if (newFirstSegment.MarketingAirline === oldFirstSegment.MarketingAirline) {
            currentScore += 20
            if (newFirstSegment.FlightNumber === oldFirstSegment.FlightNumber) {
              currentScore += 10
            }
          }

          // Compare departure times within a tolerance (e.g., 60 minutes)
          const oldDepTime = parseDateString(oldFirstSegment.DepartureTime).getTime()
          const newDepTime = parseDateString(newFirstSegment.DepartureTime).getTime()
          const timeDifference = Math.abs(oldDepTime - newDepTime) / (1000 * 60) // Difference in minutes

          if (timeDifference <= 60) {
            // Within 60 minutes
            currentScore += 5 - Math.floor(timeDifference / 10) // Higher score for smaller difference
          } else {
            currentScore -= 5 // Penalize if outside tolerance
          }

          if (currentScore > bestMatchScore) {
            bestMatchScore = currentScore
            bestMatch = newFlight
            if (DEBUG) {
              console.log(`    New best match found with score: ${bestMatchScore}`)
            }
          }
        }
      }

      if (bestMatch && bestMatch.OptionId) {
        // Changed to OptionId as adapted flights use it
        if (DEBUG) {
          console.log(
            `  Final best match found with new ResultIndex: ${bestMatch.OptionId}, Score: ${bestMatchScore}`,
          )
        }
        return { newTraceId: newTraceId, newResultIndex: bestMatch.OptionId } // Return OptionId
      } else {
        throw new Error("Could not find a suitable matching flight in fresh search results for retry.")
      }
    } else {
      throw new Error("Failed to get fresh search results - missing TraceId or bad status in response")
    }
  },
  [passengerCounts],
) // Dependencies for useCallback

// Update the useEffect that loads flight data
useEffect(() => {
  try {
    if (location.state) {
      let flightData = null;
      let returnFlightData = null;
      let actuallyRoundTrip = false;
      let totalPriceToSet = location.state.totalPrice || null;
      let validationInfoToSet = null;

      const isMultiCityBooking = location.state.isMultiCity || false;
      const isCombinedInternationalRoundTrip = location.state?.isInternationalCombined === true && !isMultiCityBooking;

      if (isCombinedInternationalRoundTrip) {
          if (DEBUG) console.log("Detected a combined international round-trip flight. Adapting data...");
          setIsCombinedTrip(true);

          // **FIX**: Intelligently find the correct data source with the 'Segments' array.
          const rawFlightDataFromQuote = 
              location.state?.fareQuoteOutboundResponse?.Response?.Results?.Segments ? location.state.fareQuoteOutboundResponse.Response.Results 
              : location.state.flight?.Segments ? location.state.flight
              : null;

          if (!rawFlightDataFromQuote) {
              // **FIX**: Instead of throwing an error that crashes the app, set the error state gracefully.
              setError("International round-trip data is missing or incomplete. Cannot proceed.");
              setIsLoading(false);
              return; 
          }

          actuallyRoundTrip = true;

          const adaptSegmentToFlight = (segmentGroup: any[], fareInfo: any, resultIndex: string, isLCC: boolean) => {
              if (!segmentGroup || segmentGroup.length === 0) return null;
              return {
                  ResultIndex: resultIndex,
                  SearchSegmentId: resultIndex,
                  JourneyTime: segmentGroup.reduce((acc: number, seg: any) => acc + (seg.Duration || 0), 0),
                  OptionSegmentsInfo: segmentGroup.map((seg: any) => ({
                      DepartureAirport: seg.Origin.Airport.AirportCode,
                      ArrivalAirport: seg.Destination.Airport.AirportCode,
                      DepartureTime: seg.Origin.DepTime,
                      ArrivalTime: seg.Destination.ArrTime,
                      MarketingAirline: seg.Airline.AirlineCode,
                      FlightNumber: seg.Airline.FlightNumber,
                      Baggage: seg.Baggage,
                      CabinBaggage: seg.CabinBaggage,
                  })),
                  OptionPriceInfo: {
                      TotalPrice: fareInfo.PublishedFare.toString(),
                      TotalBasePrice: fareInfo.BaseFare.toString(),
                      TotalTax: fareInfo.Tax.toString(),
                  },
                  IsLCC: isLCC,
              };
          };

          flightData = adaptSegmentToFlight(rawFlightDataFromQuote.Segments[0], rawFlightDataFromQuote.Fare, rawFlightDataFromQuote.ResultIndex, rawFlightDataFromQuote.IsLCC);
          returnFlightData = adaptSegmentToFlight(rawFlightDataFromQuote.Segments[1], rawFlightDataFromQuote.Fare, rawFlightDataFromQuote.ResultIndex, rawFlightDataFromQuote.IsLCC);
          const outboundPrice = Number(flightData?.OptionPriceInfo?.TotalPrice) || 0;
          const returnPrice  = Number(returnFlightData?.OptionPriceInfo?.TotalPrice) || 0;
          const passedTotal  = Number(location.state?.totalPrice) || 0;
          const quotedTotal  = Number(rawFlightDataFromQuote?.Fare?.PublishedFare) || 0;
          totalPriceToSet = outboundPrice && returnPrice
           ? outboundPrice + returnPrice
            : (passedTotal || quotedTotal);

          validationInfoToSet = {
              isGSTMandatory: rawFlightDataFromQuote.IsGSTMandatory,
              isPanRequiredAtBook: rawFlightDataFromQuote.IsPanRequiredAtBook,
              isPanRequiredAtTicket: rawFlightDataFromQuote.IsPassportRequiredAtBook,
              isPassportRequiredAtTicket: rawFlightDataFromQuote.IsPassportRequiredAtTicket,
              isHoldAllowed: rawFlightDataFromQuote.IsHoldAllowed,
              isRefundable: rawFlightDataFromQuote.IsRefundable,
              isMealMandatory: rawFlightDataFromQuote.IsMealMandatory || false, // Set mandatory meal flag
          };

      } else {
          setIsCombinedTrip(false);
          flightData = location.state.flight || null;
          returnFlightData = location.state.returnFlight || null;
          
          const searchParams = location.state.searchParams || JSON.parse(localStorage.getItem("searchParams") || "{}");
          
          actuallyRoundTrip = Boolean(
              location.state.isRoundTrip &&
              returnFlightData &&
              searchParams?.tripType === "round-trip"
          );

          validationInfoToSet = location.state.validationInfo || null;
      }

      const storedSearchParams = localStorage.getItem("searchParams");
      const parsedSearchParams = storedSearchParams ? JSON.parse(storedSearchParams) : {};
      const searchParams = location.state.searchParams || parsedSearchParams;

      const initialPassengerCounts = {
          adults: searchParams.passengers?.adults || searchParams.passengers || 1,
          children: searchParams.passengers?.children || 0,
          infants: searchParams.passengers?.infants || 0,
      };
      setPassengerCounts(initialPassengerCounts);

      const totalPassengers = initialPassengerCounts.adults + initialPassengerCounts.children + initialPassengerCounts.infants;
      const initialPassengersArray: IndividualPassenger[] = Array.from({ length: totalPassengers }, (_, index): IndividualPassenger => {
          let type: "adult" | "child" | "infant" = "adult";
          if (index >= initialPassengerCounts.adults && index < initialPassengerCounts.adults + initialPassengerCounts.children) {
              type = "child";
          } else if (index >= initialPassengerCounts.adults + initialPassengerCounts.children) {
              type = "infant";
          }
          return {
              title: "Mr",
              firstName: "",
              middleName: "",
              lastName: "",
              gender: "",
              dateOfBirth: "",
              type: type,
          };
      });
      setPassengersData(initialPassengersArray);

      const multiCitySelectedFlightsWithTraceIds = location.state.multiCitySelectedFlightsWithTraceIds || null;
      const actuallyMultiCity = Boolean(
          isMultiCityBooking && multiCitySelectedFlightsWithTraceIds && searchParams?.tripType === "multi-city"
      );

      setFlight(flightData);
      setReturnFlight(actuallyRoundTrip ? returnFlightData : null);
      setMultiCityFlights(actuallyMultiCity ? multiCitySelectedFlightsWithTraceIds : null);
      setIsRoundTrip(actuallyRoundTrip);
      setIsMultiCity(actuallyMultiCity);
      setTotalPrice(totalPriceToSet);

      if (DEBUG) console.log("Setting Validation Info with:", validationInfoToSet);
      if (validationInfoToSet) {
          setValidationInfo(validationInfoToSet);
          // Set initial meal warning based on validationInfo
          if (validationInfoToSet.isMealMandatory && flightData?.IsLCC) {
            setShowMealWarning(true);
          }
      }

      setPreviousFare(location.state.previousFare || null);
      setUpdatedFare(location.state.updatedFare || null);
      setShowAlert(location.state.showAlert || false);
      setSelectedFare(location.state.selectedFare || null);

      const newKeys = {
          outbound: `outbound-${flightData?.ResultIndex || Date.now()}`,
          return: `return-${returnFlightData?.ResultIndex || Date.now()}`,
          segments: {} as Record<number, string>,
      };

      if (actuallyMultiCity && multiCitySelectedFlightsWithTraceIds) {
          multiCitySelectedFlightsWithTraceIds.forEach((segmentData: any, index: number) => {
              newKeys.segments[index] = `segment-${index}-${segmentData.resultIndex || Date.now()}`;
          });
      }
      setSSRComponentKeys(newKeys);
    }
  } catch (err) {
    console.error("Error loading flight data:", err);
    setError(err instanceof Error ? err.message : "Failed to load flight details");
  } finally {
    setIsLoading(false);
  }
}, [location.state]); // Added refreshSearchAndFindMatchingResult to dependencies

const handleContinueBooking = () => {
  setShowAlert(false)
}

const handleGoBack = () => {
  navigate("/search-results")
}

// Update the useEffect that loads from localStorage
useEffect(() => {
  try {
    const storedSearchParams = localStorage.getItem("searchParams")
    const storedSessionId = localStorage.getItem("sessionId")
    // TraceId for non-multi-city is handled here
    const storedTraceId = localStorage.getItem("traceId")

    const newSearchParams =
      location.state?.searchParams || (storedSearchParams ? JSON.parse(storedSearchParams) : null)
    const newSessionId = location.state?.sessionId || storedSessionId
    // traceId from location.state is now only relevant for one-way/round-trip
    const newTraceId = location.state?.traceId || storedTraceId

    setSearchParams(newSearchParams)
    setSessionId(newSessionId)
    // Only set global traceIdState if not multi-city. For multi-city, traceId is per-segment.
    if (!location.state?.isMultiCity) {
      setTraceIdState(newTraceId)
    }
  } catch (err) {
    console.error("Error loading from localStorage:", err)
  }
}, [location.state])

useEffect(() => {
  if (flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
    if (DEBUG) {
      console.log("Flight departure time:", flight.OptionSegmentsInfo[0].DepartureTime)
      console.log("Flight arrival time:", flight.OptionSegmentsInfo[0].ArrivalTime)
      console.log("Parsed departure time:", parseDateString(flight.OptionSegmentsInfo[0].DepartureTime))
      console.log("Parsed arrival time:", parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime))
    }
  }
}, [flight])

useEffect(() => {
  addDatePickerStyles()
}, [])

const handleGeneralInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value, type, checked } = e.target
  if (name === "email") setEmail(value)
  else if (name === "mobile") setMobile(value)
  else if (name === "receiveOffers") setReceiveOffers(checked)
  else if (name === "promoCode") setPromoCode(value)
}

const handlePassengerInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target
  setPassengersData((prev) => prev.map((pax, i) => (i === index ? { ...pax, [name]: value } : pax)))
}

const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value, type, checked } = e.target
  setBookingOptions((prev) => ({
    ...prev,
    [name]: type === "checkbox" ? checked : value,
  }))
}

// Handle SSR option selection with memoization to prevent unnecessary re-renders
const handleSSRSelect = useCallback((selectedOptions: any, totalPrice: number, isMealMandatory?: boolean) => {
  if (DEBUG) {
    console.log("SSR Select - Outbound:", { selectedOptions, totalPrice, isMealMandatory })
  }
  setSelectedSSROptions((prev: any) => ({
    ...prev,
    outbound: selectedOptions,
    return: prev.return,
    segments: prev.segments,
  }))
  setSSRTotalPrice((prev) => ({
    ...prev,
    outbound: totalPrice,
    total:
      totalPrice +
      prev.return +
      Object.values(prev.segments).reduce((sum: number, price: any) => sum + (price || 0), 0),
  }))
  // Update meal mandatory status for one-way/outbound
  if (isMealMandatory !== undefined) {
    setValidationInfo(prev => ({ ...prev, isMealMandatory: isMealMandatory }));
    setShowMealWarning(isMealMandatory && selectedOptions.meals.length === 0);
  }
}, [])

// Handle SSR option selection for multi-city segments with memoization
const handleSegmentSSRSelect = useCallback((segmentIndex: number, selectedOptions: any, totalPrice: number, isMealMandatory?: boolean) => {
  if (DEBUG) {
    console.log(`SSR Select - Segment ${segmentIndex}:`, { selectedOptions, totalPrice, isMealMandatory })
  }
  setSelectedSSROptions((prev: any) => ({
    ...prev,
    segments: {
      ...prev.segments,
      [segmentIndex]: selectedOptions,
    },
  }))

  setSSRTotalPrice((prev) => {
    const newSegments = {
      ...prev.segments,
      [segmentIndex]: totalPrice,
    }
    const segmentsTotal = Object.values(newSegments).reduce((sum: number, price: any) => sum + (price || 0), 0)

    return {
      ...prev,
      segments: newSegments,
      total: prev.outbound + prev.return + segmentsTotal,
    }
  })
  // Update meal mandatory status for multi-city segments
  if (isMealMandatory !== undefined) {
    // For multi-city, we need to check if ANY segment has mandatory meals and none are selected
    const anySegmentMealMandatory = (multiCityFlights || []).some((_, idx) => {
      if (idx === segmentIndex) return isMealMandatory;
      // Check previously set mandatory status for other segments
      return validationInfo.isMealMandatory; // This might need a more granular state per segment
    });
    const anySegmentMealNotSelected = (multiCityFlights || []).some((_, idx) => {
      if (idx === segmentIndex) return isMealMandatory && selectedOptions.meals.length === 0;
      // Check if other segments that are mandatory have no meals selected
      return validationInfo.isMealMandatory && (!selectedSSROptions.segments[idx] || selectedSSROptions.segments[idx].meals.length === 0);
    });

    setValidationInfo(prev => ({ ...prev, isMealMandatory: anySegmentMealMandatory }));
    setShowMealWarning(anySegmentMealNotSelected);
  }
}, [multiCityFlights, selectedSSROptions.segments, validationInfo.isMealMandatory])

// Handle return flight SSR selection with memoization
const handleReturnSSRSelect = useCallback((selectedOptions: any, totalPrice: number, isMealMandatory?: boolean) => {
  if (DEBUG) {
    console.log("SSR Select - Return:", { selectedOptions, totalPrice, isMealMandatory })
  }
  setSelectedSSROptions((prev: any) => ({ ...prev, return: selectedOptions }))
  setSSRTotalPrice((prev) => ({
    ...prev,
    return: totalPrice,
    total:
      prev.outbound +
      totalPrice +
      Object.values(prev.segments).reduce((sum: number, price: any) => sum + (price || 0), 0),
  }))
  // Update meal mandatory status for return flight
  if (isMealMandatory !== undefined) {
    // For round trip, check if outbound OR return has mandatory meals and none selected
    const outboundMealsSelected = selectedSSROptions.outbound.meals.length > 0;
    const returnMealsSelected = selectedOptions.meals.length > 0;
    const isOutboundMealMandatory = validationInfo.isMealMandatory; // Assuming this is set by outbound SSR
    
    const anyMealMandatory = isOutboundMealMandatory || isMealMandatory;
    const anyMealNotSelected = (isOutboundMealMandatory && !outboundMealsSelected) || (isMealMandatory && !returnMealsSelected);

    setValidationInfo(prev => ({ ...prev, isMealMandatory: anyMealMandatory }));
    setShowMealWarning(anyMealNotSelected);
  }
}, [selectedSSROptions.outbound.meals, validationInfo.isMealMandatory])

// New memoized callback for outbound flight SSR in round trip
const handleOutboundSSRSelect = useCallback(
  (options: any, price: number, isMealMandatory?: boolean) => {
    setSelectedSSROptions((prev: any) => ({ ...prev, outbound: options }))
    setSSRTotalPrice((prev) => ({
      ...prev,
      outbound: price,
      total:
        price +
        prev.return +
        Object.values(prev.segments).reduce((sum: number, segPrice: any) => sum + (segPrice || 0), 0),
    }))
    // Update meal mandatory status for outbound flight
    if (isMealMandatory !== undefined) {
      const returnMealsSelected = selectedSSROptions.return.meals.length > 0;
      const isReturnMealMandatory = validationInfo.isMealMandatory; // Assuming this is set by return SSR

      const anyMealMandatory = isMealMandatory || isReturnMealMandatory;
      const anyMealNotSelected = (isMealMandatory && options.meals.length === 0) || (isReturnMealMandatory && !returnMealsSelected);

      setValidationInfo(prev => ({ ...prev, isMealMandatory: anyMealMandatory }));
      setShowMealWarning(anyMealNotSelected);
    }
  },
  [setSelectedSSROptions, setSSRTotalPrice, selectedSSROptions.return.meals, validationInfo.isMealMandatory],
)

// Handle refundable booking selection
const handleRefundableSelect = (isSelected: boolean, price: number) => {
  if (DEBUG) {
    console.log("RefundableBookingOption selection:", { isSelected, price })
  }
  setIsRefundableSelected(isSelected)
  setRefundablePrice(price)
}

// Handle EMI payment selection
const handleEMISelect = (isSelected: boolean) => {
  setIsEMISelected(isSelected)
  setShowEMIForm(isSelected)
}

// Process EMI payment
const handleProcessEMIPayment = async (
  cardNumber: string,
  mobileNumber: string,
  tenure: string,
  schemeId: string,
) => {
  if (!flight) return

  setEmiProcessing(true)

  try {
    // Create request for OTP API
    const requestId = EcomPaymentService.generateRequestId()
    const orderNo = `FARECLUBS_${Date.now()}`
    const totalAmount = totalPrice || Number(flight.OptionPriceInfo?.TotalPrice || 0)

    const otpRequest = {
      DEALERID: process.env.ECOM_DEALER_ID || "194",
      VALIDATIONKEY: process.env.ECOM_VALIDATION_KEY || "6384075253966928",
      REQUESTID: requestId,
      CARDNUMBER: cardNumber,
      MOBILENO: mobileNumber,
      ORDERNO: orderNo,
      LOANAMT: totalAmount.toFixed(2),
      Tenure: tenure,
      SchemeId: schemeId,
      IPADDR: "192.168.1.1",
      PIN: "411014",
      PRODDESC: "Flight Booking",
      REQUEST_DATE_TIME: EcomPaymentService.formatDateTime(),
      RETURNURL: `${window.location.origin}/booking/emi-callback`,
    }

    // Call OTP API
    const response = await EcomPaymentService.initiateOTP(otpRequest)
    setEmiResponse(response)

    // If successful, open KFS URL in a new window
    if (response.RSPCODE === "0" || response.RSPCODE === "00") {
      window.open(response.KFSURL, "_blank")

      // After 5 minutes, check the status using Re-Query API
      setTimeout(async () => {
        const reQueryRequest = {
          DEALERID: process.env.ECOM_DEALER_ID || "194",
          REQID: EcomPaymentService.generateRequestId(),
          VALKEY: process.env.ECOM_VALIDATION_KEY || "6384075253966928",
          REQUERYID: requestId,
          ACQCHNLID: "05",
        }

        const reQueryResponse = await EcomPaymentService.reQuery(reQueryRequest)

        // Process re-query response
        if (reQueryResponse.RESCODE === "0" || reQueryResponse.RESCODE === "00") {
          const transactionStatus = reQueryResponse.ENQINFO[0]?.RSPCODE
          if (transactionStatus === "0" || transactionStatus === "00") {
            alert("EMI payment successful!")
          } else {
            alert("EMI payment failed. Please try again.")
          }
        } else {
          alert("Failed to check payment status. Please contact support.")
        }
      }, 300000) // 5 minutes
    } else {
      alert(`Failed to initiate EMI payment: ${response.RESPDESC}`)
    }
  } catch (error) {
    console.error("Error processing EMI payment:", error)
    alert("An error occurred while processing your EMI payment. Please try again.")
  } finally {
    setEmiProcessing(false)
  }
}
// Treat leg names as a narrow type everywhere we compare
type LegNameLiteral = "Outbound" | "Return";

// Be tolerant of different shapes when checking if meals are selected
const countMeals = (group: any): number => {
  if (!group) return 0;
  if (Array.isArray(group.meals)) return group.meals.length;          // our SSROptions shape
  if (Array.isArray(group)) return group.filter((x: any) => x?.Type === "MEAL").length; // raw SSR list fallback
  return 0;
};

const formatDateForApi = (dateStr: string) => {
  try {
    if (!dateStr || dateStr.trim() === "") {
      return new Date().toISOString().split("T")[0] + "T00:00:00"
    }
    if (dateStr.includes("T")) {
      return dateStr
    }
    const date = new Date(dateStr + "T00:00:00")
    return date.toISOString().replace("Z", "")
  } catch (error) {
    console.error("Error formatting date:", error)
    return new Date().toISOString().split("T")[0] + "T00:00:00"
  }
}

// Add a retry mechanism for API
const retryApiCall = useCallback(
  async <T,>(
    apiFunction: (traceId: string, resultIndex: string) => Promise<T>, // resultIndex is now always expected
    segmentFlight: BookingPageProps["flight"],
    segmentIndex: number | undefined, // Can be undefined for one-way/round-trip
    initialTraceId: string, // Explicitly pass the traceId to use for the first attempt
    initialResultIndex: string, // Explicitly pass the resultIndex to use for the first attempt
    maxRetries = 3,
    delay = 1000,
  ): Promise<{ data: T; finalTraceId: string }> => {
    let currentTraceId = initialTraceId
    let currentResultIndex = initialResultIndex
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!currentTraceId) {
          throw new Error("TraceId is missing before API call attempt.")
        }
        if (DEBUG) {
          console.log(
            `API call attempt ${attempt}/${maxRetries} for ResultIndex ${currentResultIndex} with TraceId: ${currentTraceId}`,
          )
        }
        const result = await apiFunction(currentTraceId, currentResultIndex)
        return { data: result, finalTraceId: currentTraceId }
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed for ResultIndex ${currentResultIndex}:`, error)
        lastError = error

        const isTraceIdExpiredError =
          error.response?.data?.Error?.ErrorCode === 5 || error.response?.data?.Response?.Error?.ErrorCode === 5

        if (isTraceIdExpiredError && attempt < maxRetries) {
          console.warn("TraceId expired. Attempting to refresh TraceId and retry...")
          try {
            const { newTraceId, newResultIndex } = await refreshSearchAndFindMatchingResult(
              segmentFlight,
              localStorage.getItem("tokenId") || "",
              currentTraceId, // Pass the expired traceId for re-search context
              segmentIndex,
            )
            currentTraceId = newTraceId // Update local variable for next retry
            // For multi-city, update the specific segment's traceId in state
            if (typeof segmentIndex === "number" && multiCityFlights) {
              setMultiCityFlights(
                (prev) =>
                  prev?.map((item, idx) => (idx === segmentIndex ? { ...item, traceId: newTraceId } : item)) || null,
              )
            } else {
              // For one-way/round-trip, update global traceIdState
              setTraceIdState(newTraceId)
            }
            localStorage.setItem("traceId", newTraceId) // Keep localStorage updated for general reference
            currentResultIndex = newResultIndex // Update local variable for next retry
            console.log(`TraceId refreshed. New TraceId: ${newTraceId}, New ResultIndex: ${newResultIndex}`)
            await new Promise((resolve) => setTimeout(resolve, delay))
            delay *= 2
            continue // Retry with new TraceId and ResultIndex
          } catch (refreshError) {
            console.error("Failed to refresh TraceId:", refreshError)
            throw new Error(
              `Failed to refresh session during retry: ${refreshError instanceof Error ? refreshError.message : "Unknown error"}`,
            )
          }
        } else if (attempt < maxRetries) {
          if (DEBUG) {
            console.log(`Retrying in ${delay}ms...`)
          }
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
        }
      }
    }
    throw lastError
  },
  [setTraceIdState, refreshSearchAndFindMatchingResult, multiCityFlights],
)

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  console.log("=== BOOKING SUBMISSION STARTED ===")
  console.log("Contact Email:", email)
  console.log("Contact Mobile:", mobile)
  console.log("Passengers Data:", passengersData)
  console.log("Flight data (for one-way/round-trip):", flight)
  console.log("Multi-city flights (selected for booking):", multiCityFlights)
  console.log("Is multi-city:", isMultiCity)
  console.log("Is round trip:", isRoundTrip)
  console.log("Location state:", location.state)

  // Enhanced validation with detailed logging
  if (!flight && (!isMultiCity || !multiCityFlights || multiCityFlights.length === 0)) {
    console.error("VALIDATION ERROR: No flight data available")
    setError("Flight details not available. Please try again.")
    return
  }

  if (isMultiCity && (!multiCityFlights || multiCityFlights.length === 0)) {
    console.error("VALIDATION ERROR: Multi-city selected but no multi-city flights available")
    setError("Multi-city flight details not available. Please try again.")
    return
  }

  if (
    !isMultiCity &&
    (!flight || !flight.OptionSegmentsInfo || flight.OptionSegmentsInfo.length === 0 || !flight.OptionPriceInfo)
  ) {
    console.error("VALIDATION ERROR: Single flight data incomplete", {
      hasFlight: !!flight,
      hasSegments: !!flight?.OptionSegmentsInfo?.length,
      hasPriceInfo: !!flight?.OptionPriceInfo,
    })
    setError("Flight details not available. Please try again.")
    return
  }

  // Form validation for contact details
  if (!email || !mobile) {
    console.error("VALIDATION ERROR: Missing contact details")
    setError("Please fill in email and mobile number.")
    return
  }

  // Form validation for passenger details
  const missingPassengerFields: string[] = []
  passengersData.forEach((pax, index) => {
    if (!pax.firstName || !pax.lastName || !pax.gender || !pax.dateOfBirth) {
      missingPassengerFields.push(`Traveller ${index + 1}`)
    }
    // Add passport validation if required by API
    if (validationInfo.isPassportRequiredAtBook && (!pax.passportNumber || !pax.passportExpiry)) {
      missingPassengerFields.push(`Passport details for Traveller ${index + 1}`)
    }
  })

  if (missingPassengerFields.length > 0) {
    console.error("VALIDATION ERROR: Missing required passenger fields:", missingPassengerFields)
    setError(`Please fill in all required fields for: ${missingPassengerFields.join(", ")}`)
    return
  }

  // NEW: Meal selection validation for LCC flights
  // NEW: Meal selection validation for LCC flights
if (validationInfo.isMealMandatory) {
  let mealsSelected = false;

  if (isMultiCity && multiCityFlights) {
    mealsSelected = (multiCityFlights || []).every((_, idx) =>
      countMeals(selectedSSROptions.segments[idx]) > 0
    );
  } else if (isRoundTrip) {
    mealsSelected =
      countMeals(selectedSSROptions.outbound) > 0 &&
      countMeals(selectedSSROptions.return) > 0;
  } else { // one-way
    mealsSelected = countMeals(selectedSSROptions.outbound) > 0;
  }

  if (!mealsSelected) {
    setError("Meal selection is mandatory for this flight. Please select a meal under 'Additional Services'.");
    setShowMealWarning(true);
    return;
  }
}


  console.log("✓ All validations passed, proceeding with booking...")

  try {
    setIsLoading(true)
    setError(null)

    // Get tokenId (should be consistent throughout session)
    const tokenId = localStorage.getItem("tokenId") || ""

    console.log("Tokens:", {
      tokenId: tokenId ? "Present" : "Missing",
      traceIdState: traceIdState
        ? "Present (for non-multi-city)"
        : "Not applicable (multi-city uses per-segment traceId)",
    })

    if (!tokenId) {
      console.error("VALIDATION ERROR: Missing tokenId")
      setError("Session expired. Please search for flights again.")
      return
    }

    const outSSR = {
      baggage: Array.isArray(selectedSSROptions.outbound?.baggage) ? selectedSSROptions.outbound.baggage : [],
      meals:   Array.isArray(selectedSSROptions.outbound?.meals)   ? selectedSSROptions.outbound.meals   : [],
      seats:   Array.isArray(selectedSSROptions.outbound?.seats)   ? selectedSSROptions.outbound.seats   : [],
    };
    const retSSR = {
      baggage: Array.isArray(selectedSSROptions.return?.baggage) ? selectedSSROptions.return.baggage : [],
      meals:   Array.isArray(selectedSSROptions.return?.meals)   ? selectedSSROptions.return.meals   : [],
      seats:   Array.isArray(selectedSSROptions.return?.seats)   ? selectedSSROptions.return.seats   : [],
    };
    const segSSRFlat =
      Object.values(selectedSSROptions.segments || {}).flatMap((seg: any) => [
        ...(Array.isArray(seg?.baggage) ? seg.baggage : []),
        ...(Array.isArray(seg?.meals)   ? seg.meals   : []),
        ...(Array.isArray(seg?.seats)   ? seg.seats   : []),
      ]);
    
    const allSSR = [
      ...outSSR.baggage, ...outSSR.meals, ...outSSR.seats,
      ...retSSR.baggage, ...retSSR.meals, ...retSSR.seats,
      ...segSSRFlat,
    ];
    
    
    let finalBookingReference = ""
    let finalBookingId: number | string = "" // Ensure it can be number or string

    const allTicketResponses: any[] = []

    // Process booking based on trip type
    if (isMultiCity) {
      console.log("=== PROCESSING MULTI-CITY BOOKING ===")

      if (!multiCityFlights || multiCityFlights.length === 0) {
        throw new Error("No multi-city flights available for booking")
      }

      for (let i = 0; i < multiCityFlights.length; i++) {
        const segmentData = multiCityFlights[i] // This is { flight: adaptedFlight, traceId: string, resultIndex: string }
        const segmentFlight = segmentData.flight
        let currentTraceIdForSegment = segmentData.traceId // Use the specific traceId for this segment
        const currentResultIndexForSegment = segmentData.resultIndex // Corrected property name

        console.log(`\n--- Processing Segment ${i + 1} ---`)
        console.log(`Segment ${i + 1} initial TraceId:`, currentTraceIdForSegment)
        console.log(`Segment ${i + 1} initial ResultIndex:`, currentResultIndexForSegment)

        if (!segmentFlight || !segmentFlight.OptionSegmentsInfo || !segmentFlight.OptionPriceInfo) {
          throw new Error(`Segment ${i + 1} has incomplete data`)
        }

        let currentBookingId = 0
        let currentPNR = ""

        // Step 1: Get FareQuote using the determined TraceId and ResultIndex for this segment
        const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
          (traceId, resultIndex) => getFareQuote(tokenId, traceId, resultIndex),
          segmentFlight,
          i, // Pass segment index to refreshSearchAndFindMatchingResult
          currentTraceIdForSegment, // Initial traceId for this segment
          currentResultIndexForSegment, // Initial resultIndex for this segment
        )
        currentTraceIdForSegment = updatedTraceIdAfterFareQuote // Update for subsequent calls for this segment

        if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
          throw new Error(
            `Failed to get updated pricing for segment ${i + 1}: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }

        const updatedResultIndexFromFareQuote = fareQuoteResponse.Response.Results.ResultIndex
        const isLCCSegment = fareQuoteResponse.Response.Results.IsLCC || false
        const fullFareDetailsForSegment = fareQuoteResponse.Response.Results.Fare; // Get the full fare object for this segment
        console.log(`Segment ${i + 1} updated ResultIndex from FareQuote:`, updatedResultIndexFromFareQuote)
        console.log(`Segment ${i + 1} isLCC:`, isLCCSegment)

        // Prepare all passenger data for API *after* getting the fare quote for this segment
        const preparedPassengersForAPI = passengersData.map((pax, paxIndex) =>
          preparePassengerData(
            {
              title: pax.title,
              firstName: pax.firstName,
              lastName: pax.lastName,
              gender: pax.gender,
              mobile: mobile,
              email: email,
              dateOfBirth: pax.dateOfBirth,
              addressLine1: "123 Main St",
              city: "Mumbai",
              countryCode: "IN",
              nationality: pax.nationality || "IN",
              gstNumber: bookingOptions.useGST ? bookingOptions.gstNumber : undefined,
              type: pax.type,
              passportNumber: pax.passportNumber,
              passportExpiry: pax.passportExpiry,
              PassportIssueDate: pax.passportExpiry, // Assuming issue date is same as expiry if not provided
              Meal: allSSR.find((ssr: any) => ssr.Type === 'MEAL' && ssr.SegmentIndex === i), // Filter SSR by segment
              ExtraBaggage: allSSR.find((ssr: any) => ssr.Type === 'BAGGAGE' && ssr.SegmentIndex === i),
              Seat: allSSR.find((ssr: any) => ssr.Type === 'SEAT' && ssr.SegmentIndex === i),
              isLeadPax: paxIndex === 0, // First passenger is lead pax
            },
            fullFareDetailsForSegment, // Pass the full fare object from the segment's fare quote
          ),
        )
        console.log(`Prepared passengers for API for segment ${i + 1}:`, preparedPassengersForAPI)


        if (!isLCCSegment) {
          console.log(`Segment ${i + 1} is Non-LCC. Calling Book API...`)
          const bookRequest = {
            EndUserIp: "192.168.10.10",
            TokenId: tokenId,
            TraceId: currentTraceIdForSegment, // Use the latest traceId for this segment
            ResultIndex: updatedResultIndexFromFareQuote,
            Passengers: preparedPassengersForAPI, // Use the newly prepared passengers
          }
          const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
            (traceId, resultIndex) =>
              createBooking({
                ...bookRequest,
                TraceId: traceId,
                ResultIndex: resultIndex,
              }),
            segmentFlight,
            i,
            currentTraceIdForSegment,
            updatedResultIndexFromFareQuote,
          )
          currentTraceIdForSegment = updatedTraceIdAfterBook

          // --- START: Error Handling for Book API Response (Multi-City) ---
          if (bookResponse.Error?.ErrorCode !== 0 || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
            console.log("DEBUG (Multi-city Book Error): bookResponse.Error:", bookResponse.Error);
            let userFriendlyMessage = "Unknown booking error."; // Default fallback

            if (bookResponse.Error?.ErrorCode === 2 && bookResponse.Error?.ErrorMessage) {
              userFriendlyMessage = `Booking already exists: ${bookResponse.Error.ErrorMessage}`;
            } else if (bookResponse.Error?.ErrorMessage) {
              userFriendlyMessage = `Failed to book segment ${i + 1}: ${bookResponse.Error.ErrorMessage}`;
            } else {
              userFriendlyMessage = `Failed to book segment ${i + 1}: Unknown error occurred.`;
            }
            console.log("DEBUG (Multi-city Book Error): userFriendlyMessage before throwing:", userFriendlyMessage);
            throw new Error(userFriendlyMessage);
          }
          // --- END: Error Handling for Book API Response (Multi-City) ---

          currentBookingId = bookResponse.Response.BookingId
          currentPNR = bookResponse.Response.PNR
          console.log(`Segment ${i + 1} booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
        }

        // Step 2: Call ticketing
        const { data: segmentTicketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
          (traceId, resultIndex) =>
            handleTicketingProcess(
              currentBookingId,
              currentPNR,
              tokenId,
              traceId, // Use the latest traceId for this segment
              isLCCSegment,
              resultIndex,
              preparedPassengersForAPI, // Use the newly prepared passengers
            ),
          segmentFlight,
          i,
          currentTraceIdForSegment, // Start with the traceId from farequote/book for ticketing retry
          updatedResultIndexFromFareQuote,
        )
        currentTraceIdForSegment = updatedTraceIdAfterTicket

        const isSuccess =
          segmentTicketResponse.Response?.ResponseStatus === 1 ||
          segmentTicketResponse.Response?.Response?.Status === 1 ||
          (segmentTicketResponse.Response && segmentTicketResponse.Response.ResponseStatus !== 3)

        if (isSuccess) {
          console.log(`✓ Segment ${i + 1} ticketed successfully`)
          allTicketResponses.push(segmentTicketResponse)
          if (!finalBookingReference && segmentTicketResponse.Response?.Response?.FlightItinerary?.PNR) {
            finalBookingReference = segmentTicketResponse.Response.Response.FlightItinerary.PNR
          }
          if (!finalBookingId && segmentTicketResponse.Response?.Response?.FlightItinerary?.BookingId) {
            finalBookingId = segmentTicketResponse.Response.Response.FlightItinerary.BookingId
          }
        } else {
          const errorMessage =
            segmentTicketResponse.Response?.Error?.ErrorMessage ||
            segmentTicketResponse.Error?.ErrorMessage ||
            "Ticketing failed - invalid response"
          throw new Error(`Segment ${i + 1} ticketing failed: ${errorMessage}`)
        }
      }
    } else if (isRoundTrip) {
      console.log("=== PROCESSING ROUND-TRIP BOOKING ===")
      if (!flight || !returnFlight) {
        throw new Error("Outbound or return flight details missing for round-trip booking.")
      }
// Helper: pick SSR for a leg directly from selectedSSROptions
const pickLegSSR = (legName: "Outbound" | "Return") => {
  const group = legName === "Outbound"
    ? selectedSSROptions.outbound
    : selectedSSROptions.return;

  return {
    meal: group?.meals?.[0] || null,
    baggage: group?.baggage?.[0] || null,
    seat: group?.seats?.[0] || null,
  };
};

      const processFlightLeg = async (

        legFlight: BookingPageProps["flight"],
        legName: string,
        originalResultIndex: string,
        initialLegTraceId: string, // Pass initial traceId for this leg
      ) => {
        const legNameLiteral: LegNameLiteral = legName === "Return" ? "Return" : "Outbound";
        console.log(`\n--- Processing ${legName} Flight ---`)
        console.log(`${legName} initial ResultIndex:`, originalResultIndex)

        let currentTraceIdForLeg = initialLegTraceId
        const currentResultIndexForLeg = originalResultIndex

        // Step 1: Get FareQuote using the determined TraceId and ResultIndex for this leg
        const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
          (traceId, resultIndex) => getFareQuote(tokenId, traceId, resultIndex),
          legFlight,
          undefined, // No specific segment index for one-way/round-trip legs
          currentTraceIdForLeg,
          currentResultIndexForLeg,
        )
        currentTraceIdForLeg = updatedTraceIdAfterFareQuote
        setTraceIdState(updatedTraceIdAfterFareQuote) // Update global traceIdState

        if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
          throw new Error(
            `Failed to get updated pricing for ${legName} flight: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
          )
        }

        const updatedResultIndex = fareQuoteResponse.Response.Results.ResultIndex
        const isLCCLeg = fareQuoteResponse.Response.Results.IsLCC || false
        const fullFareDetailsForLeg = fareQuoteResponse.Response.Results.Fare; // Get the full fare object for this leg
        console.log(`${legName} updated ResultIndex from FareQuote:`, updatedResultIndex)
        console.log(`${legName} isLCC:`, isLCCLeg)

       

        // Prepare all passenger data for API *after* getting the fare quote for this leg
        const preparedPassengersForAPI = passengersData.map((pax, paxIndex) =>
          preparePassengerData(
            {
              title: pax.title,
              firstName: pax.firstName,
              lastName: pax.lastName,
              gender: pax.gender,
              mobile: mobile,
              email: email,
              dateOfBirth: pax.dateOfBirth,
              addressLine1: "123 Main St",
              city: "Mumbai",
              countryCode: "IN",
              nationality: pax.nationality || "IN",
              gstNumber: bookingOptions.useGST ? bookingOptions.gstNumber : undefined,
              type: pax.type,
              passportNumber: pax.passportNumber,
              passportExpiry: pax.passportExpiry,
              PassportIssueDate: pax.passportExpiry, // Assuming issue date is same as expiry if not provided
              isLeadPax: paxIndex === 0, // First passenger is lead pax
              Meal: allSSR.find((ssr: any) => ssr.Type === "MEAL"     && ssr.LegName === legNameLiteral),
              ExtraBaggage: allSSR.find((ssr: any) => ssr.Type === "BAGGAGE" && ssr.LegName === legNameLiteral),
              Seat: allSSR.find((ssr: any) => ssr.Type === "SEAT"     && ssr.LegName === legNameLiteral),

            },
            fullFareDetailsForLeg, // Pass the full fare object from the leg's fare quote
          ),
        )
        console.log(`Prepared passengers for API for ${legNameLiteral}:`, preparedPassengersForAPI)

        let currentBookingId = 0
        let currentPNR = ""

        if (!isLCCLeg) {
          console.log(`${legName} is Non-LCC. Calling Book API...`)
          const bookRequest = {
            EndUserIp: "192.168.10.10",
            TokenId: tokenId,
            TraceId: currentTraceIdForLeg, // Use the latest traceId for this leg
            ResultIndex: updatedResultIndex,
            Passengers: preparedPassengersForAPI, // Use the newly prepared passengers
          }
          const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
            (traceId, resultIndex) =>
              createBooking({
                ...bookRequest,
                TraceId: traceId,
                ResultIndex: resultIndex,
              }),
            legFlight,
            undefined,
            currentTraceIdForLeg,
            updatedResultIndex,
          )
          currentTraceIdForLeg = updatedTraceIdAfterBook
          setTraceIdState(updatedTraceIdAfterBook) // Update global traceIdState

          // --- START: Error Handling for Book API Response (Round-Trip) ---
          if (bookResponse.Error?.ErrorCode !== 0 || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
            console.log("DEBUG (Round-trip Book Error): bookResponse.Error:", bookResponse.Error);
            let userFriendlyMessage = "Unknown booking error."; // Default fallback

            if (bookResponse.Error?.ErrorCode === 2 && bookResponse.Error?.ErrorMessage) {
              userFriendlyMessage = `Booking already exists: ${bookResponse.Error.ErrorMessage}`;
            } else if (bookResponse.Error?.ErrorMessage) {
              userFriendlyMessage = `Failed to book ${legName} flight: ${bookResponse.Error.ErrorMessage}`;
            } else {
              userFriendlyMessage = `Failed to book ${legName} flight: Unknown error occurred.`;
            }
            console.log("DEBUG (Round-trip Book Error): userFriendlyMessage before throwing:", userFriendlyMessage);
            throw new Error(userFriendlyMessage);
          }
          // --- END: Error Handling for Book API Response (Round-Trip) ---

          currentBookingId = bookResponse.Response.BookingId
          currentPNR = bookResponse.Response.PNR
          console.log(`${legName} booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
        }

        // Step 2: Call ticketing
        const { data: ticketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
          (traceId, resultIndex) =>
            handleTicketingProcess(
              currentBookingId,
              currentPNR,
              tokenId,
              traceId, // Use the latest traceId for this leg
              isLCCLeg,
              resultIndex,
              preparedPassengersForAPI, // Use the newly prepared passengers
            ),
          legFlight,
          undefined,
          currentTraceIdForLeg, // Start with the traceId from farequote/book for ticketing retry
          updatedResultIndex,
        )
        setTraceIdState(updatedTraceIdAfterTicket) // Update global traceIdState

        const isSuccess =
          ticketResponse.Response?.ResponseStatus === 1 ||
          ticketResponse.Response?.Response?.Status === 1 ||
          (ticketResponse.Response && ticketResponse.Response.ResponseStatus !== 3)

        if (isSuccess) {
          console.log(`✓ ${legName} ticketed successfully`)
          allTicketResponses.push(ticketResponse)
          if (!finalBookingReference && ticketResponse.Response?.Response?.FlightItinerary?.PNR) {
            finalBookingReference = ticketResponse.Response.Response.FlightItinerary.PNR
          }
          if (!finalBookingId && ticketResponse.Response?.Response?.FlightItinerary?.BookingId) {
            finalBookingId = ticketResponse.Response.Response.FlightItinerary.BookingId
          }
        } else {
          const errorMessage =
            ticketResponse.Response?.Error?.ErrorMessage ||
            ticketResponse.Error?.ErrorMessage ||
            "Ticketing failed - invalid response"
          throw new Error(`${legName} ticketing failed: ${errorMessage}`)
        }
      }

      // Process outbound flight
      await processFlightLeg(
        flight,
        "Outbound",
        (location.state?.outboundResultIndex || flight.SearchSegmentId?.toString() || "").toString(),
        location.state?.traceId || localStorage.getItem("traceId") || "", // Use original global traceId
      )

      // Process return flight. traceIdState will be updated by previous leg's retryApiCall if it refreshed.
      await processFlightLeg(
        returnFlight,
        "Return",
        (location.state?.returnResultIndex || returnFlight.SearchSegmentId?.toString() || "").toString(),
        traceIdState || localStorage.getItem("traceId") || "", // Use potentially updated global traceIdState
      )
    } else {
      console.log("=== PROCESSING ONE-WAY BOOKING ===")
      if (!flight) {
        throw new Error("Flight details missing for one-way booking.")
        
      }

      const originalResultIndex = (location.state?.resultIndex || flight.SearchSegmentId?.toString() || "").toString()
      console.log("One-way initial ResultIndex:", originalResultIndex)

      if (!traceIdState) {
        throw new Error("TraceId is missing for one-way booking.")
      }

      let currentTraceIdForOneWay = traceIdState // Use the global traceIdState for one-way booking

      // Step 1: Get FareQuote
      const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
        (traceId, resultIndex) => getFareQuote(tokenId, traceId, originalResultIndex),
        flight,
        undefined,
        currentTraceIdForOneWay, // Use the current global traceIdState
        originalResultIndex,
      )
      currentTraceIdForOneWay = updatedTraceIdAfterFareQuote
      setTraceIdState(updatedTraceIdAfterFareQuote) // Update global traceIdState after FareQuote

      if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
        throw new Error(
          `Failed to get updated pricing for one-way flight: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
        )
      }

      const updatedResultIndex = fareQuoteResponse.Response.Results.ResultIndex
      const isLCCFlight = fareQuoteResponse.Response.Results.IsLCC || false
      const fullFareDetailsForOneWay = fareQuoteResponse.Response.Results.Fare; // Get the full fare object for this flight
      console.log("One-way updated ResultIndex from FareQuote:", updatedResultIndex)
      console.log("One-way isLCC:", isLCCFlight)

      // Prepare all passenger data for API *after* getting the fare quote for this flight
      const preparedPassengersForAPI = passengersData.map((pax, paxIndex) =>
        preparePassengerData(
          {
            title: pax.title,
            firstName: pax.firstName,
            lastName: pax.lastName,
            gender: pax.gender,
            mobile: mobile,
            email: email,
            dateOfBirth: pax.dateOfBirth,
            addressLine1: "123 Main St",
            city: "Mumbai",
            countryCode: "IN",
            nationality: pax.nationality || "IN",
            gstNumber: bookingOptions.useGST ? bookingOptions.gstNumber : undefined,
            type: pax.type,
            passportNumber: pax.passportNumber,
            passportExpiry: pax.passportExpiry,
            PassportIssueDate: pax.passportExpiry, // Assuming issue date is same as expiry if not provided
            isLeadPax: paxIndex === 0, // First passenger is lead pax
            Meal: allSSR.find((ssr: any) => ssr.Type === "MEAL"     && ssr.LegName === legNameLiteral),
            ExtraBaggage: allSSR.find((ssr: any) => ssr.Type === "BAGGAGE" && ssr.LegName === legNameLiteral),
            Seat: allSSR.find((ssr: any) => ssr.Type === "SEAT"     && ssr.LegName === legNameLiteral),
            
          },
          fullFareDetailsForOneWay, // Pass the full fare object from the flight's fare quote
        ),
      )
      console.log("Prepared passengers for API for one-way:", preparedPassengersForAPI)

      let currentBookingId = 0
      let currentPNR = ""

      if (!isLCCFlight) {
        console.log("One-way is Non-LCC. Calling Book API...")
        const bookRequest = {
          EndUserIp: "192.168.10.10",
          TokenId: tokenId,
          TraceId: currentTraceIdForOneWay, // Use the latest global traceIdState
          ResultIndex: updatedResultIndex,
          Passengers: preparedPassengersForAPI, // Use the newly prepared passengers
        }
        const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
          (traceId, resultIndex) =>
            createBooking({
              ...bookRequest,
              TraceId: traceId,
              ResultIndex: resultIndex,
            }),
          flight,
          undefined,
          currentTraceIdForOneWay, // Use the latest global traceIdState
          updatedResultIndex,
        )
        currentTraceIdForOneWay = updatedTraceIdAfterBook
        setTraceIdState(updatedTraceIdAfterBook) // Update global traceIdState after Book

        // --- START: Error Handling for Book API Response (One-Way) ---
        if (bookResponse.Error?.ErrorCode !== 0 || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
          console.log("DEBUG (One-way Book Error): bookResponse.Error:", bookResponse.Error);
          let userFriendlyMessage = "Unknown booking error."; // Default fallback

          if (bookResponse.Error?.ErrorCode === 2 && bookResponse.Error?.ErrorMessage) {
            userFriendlyMessage = `Booking already exists: ${bookResponse.Error.ErrorMessage}`;
          } else if (bookResponse.Error?.ErrorMessage) {
            userFriendlyMessage = `Failed to book flight: ${bookResponse.Error.ErrorMessage}`;
          } else {
            userFriendlyMessage = `Failed to book flight: Unknown error occurred.`;
          }
          console.log("DEBUG (One-way Book Error): userFriendlyMessage before throwing:", userFriendlyMessage);
          throw new Error(userFriendlyMessage);
        }
        // --- END: Error Handling for Book API Response (One-Way) ---

        currentBookingId = bookResponse.Response.BookingId
        currentPNR = bookResponse.Response.PNR
        console.log(`One-way booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
      }

      // Step 2: Call ticketing
      const { data: ticketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
        (traceId, resultIndex) =>
          handleTicketingProcess(
            currentBookingId,
            currentPNR,
            tokenId,
            traceId, // Use the latest global traceIdState
            isLCCFlight,
            resultIndex,
            preparedPassengersForAPI, // Use the newly prepared passengers
          ),
        flight,
        undefined,
        currentTraceIdForOneWay, // Use the latest global traceIdState from farequote/book for ticketing retry
        updatedResultIndex,
      )
      setTraceIdState(updatedTraceIdAfterTicket) // Update global traceIdState after Ticket

      const isSuccess =
        ticketResponse.Response?.ResponseStatus === 1 ||
        ticketResponse.Response?.Response?.Status === 1 ||
        (ticketResponse.Response && ticketResponse.Response.ResponseStatus !== 3)

      if (!isSuccess) {
        const errorMessage =
          ticketResponse.Response?.Error?.ErrorMessage ||
          ticketResponse.Error?.ErrorMessage ||
          "Ticketing failed - invalid response"
        throw new Error(`One-way ticketing failed: ${errorMessage}`)
      }
      allTicketResponses.push(ticketResponse)
      finalBookingReference = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.PNR
      finalBookingId = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.BookingId
    }

    console.log("✓ All segments/flights processed successfully")
    console.log("Navigating to confirmation...")

    const totalAmount = totalAmountBasedOnLoadedData; // Declare totalAmount

    navigate("/booking/confirmation", {
      state: {
        bookingReference: finalBookingReference,
        bookingId: finalBookingId,
        totalAmount,
        flight,
        returnFlight,
        multiCityFlights, // This now contains selected adapted flights with per-segment traceIds
        isMultiCity,
        isRoundTrip,
        isRefundableSelected,
        refundablePrice,
        ssrOptions: selectedSSROptions,
        ssrTotalPrice,
        customerDetails: { email, mobile, receiveOffers, promoCode },
        passengersData,
        allTicketResponses,
      },
    })
  } catch (err) {
    console.error("EXCEPTION in handleSubmit:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
    setError(`Booking submission failed: ${errorMessage}`)
  } finally {
    console.log("=== BOOKING SUBMISSION ENDED ===")
    setIsLoading(false)
  }
}

// Add this useEffect after the existing ones to track state changes
useEffect(() => {
  console.log("=== BOOKING PAGE STATE DEBUG ===")
  console.log("isMultiCity:", isMultiCity)
  console.log("multiCityFlights:", multiCityFlights)
  if (multiCityFlights) {
    multiCityFlights.forEach((segmentData, index) => {
      console.log(`  multiCityFlights[${index}]:`, segmentData)
      if (segmentData.flight?.OptionSegmentsInfo?.[0]) {
        console.log(
          `    Route: ${segmentData.flight.OptionSegmentsInfo[0].DepartureAirport} -> ${segmentData.flight.OptionSegmentsInfo[0].ArrivalAirport}`,
        )
      }
    })
  }
  console.log("flight:", flight)
  console.log("isRoundTrip:", isRoundTrip)
  console.log("returnFlight:", returnFlight)
  console.log("totalPrice:", totalPrice)
  console.log("location.state:", location.state)
  console.log("traceIdState:", traceIdState) // Log the new state variable
  console.log("validationInfo.isMealMandatory:", validationInfo.isMealMandatory); // Log new validation info
  console.log("showMealWarning:", showMealWarning); // Log new warning state
  console.log("================================")
}, [isMultiCity, multiCityFlights, flight, isRoundTrip, returnFlight, totalPrice, location.state, traceIdState, validationInfo.isMealMandatory, showMealWarning])

const convenienceFee = 149.0

const handleBackToResults = () => {
  const storedSearchParams: string | null = localStorage.getItem("searchParams")
  let storedSessionId: string | null = localStorage.getItem("sessionId")
  // Retrieve multi-city raw responses if available, for search results page to load
  const storedMultiCityRawResponses: string | null = localStorage.getItem("multiCityRawResponses")
  const storedTraceId: string | null = localStorage.getItem("traceId") // For non-multi-city

  let parsedSearchParams = storedSearchParams ? JSON.parse(storedSearchParams) : null
  let initialSearchShouldBeTriggered = false

  // If searchParams is not available or multiCityRawResponses are not loaded,
  // we need to set `shouldSearch: true` for the SearchResults page to re-fetch
  if (
    !parsedSearchParams ||
    (parsedSearchParams.tripType === "multi-city" && !storedMultiCityRawResponses) ||
    (parsedSearchParams.tripType !== "multi-city" && !storedTraceId)
  ) {
    initialSearchShouldBeTriggered = true
    if (!parsedSearchParams && flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
      parsedSearchParams = {
        from: flight.OptionSegmentsInfo[0].DepartureAirport,
        to: flight.OptionSegmentsInfo[0].ArrivalAirport,
        date: flight.OptionSegmentsInfo[0].DepartureTime.split(",")[0],
        passengers: 1,
        tripType: isMultiCity ? "multi-city" : isRoundTrip ? "round-trip" : "one-way",
        // Add minimal multi-city trips for re-search if needed
        multiCityTrips:
          isMultiCity && multiCityFlights
            ? multiCityFlights.map((data) => ({
                from: data.flight?.OptionSegmentsInfo?.[0]?.DepartureAirport || "",
                to:
                  data.flight?.OptionSegmentsInfo?.[data.flight.OptionSegmentsInfo.length - 1]?.ArrivalAirport || "",
                date: data.flight?.OptionSegmentsInfo?.[0]?.DepartureTime.split(",")[0] || "",
              }))
            : [],
      }
      localStorage.setItem("searchParams", JSON.stringify(parsedSearchParams))
    }
  }

  if (!storedSessionId) {
    storedSessionId = sessionId || "default-session"
    localStorage.setItem("sessionId", storedSessionId)
  }

  // Now, pass the searchParams and whether a search should be triggered
  navigate("/search-results", {
    state: {
      searchParams: parsedSearchParams,
      sessionId: storedSessionId!,
      traceId: storedTraceId, // Still pass global traceId for one-way/round-trip context
      shouldSearch: initialSearchShouldBeTriggered, // Control if SearchResults re-runs search
      returnFromBooking: true,
    },
  })
}

// Render validation warnings based on FareQuote response
const renderValidationWarnings = () => {
  if (!validationInfo) return null

  const warnings = []

  if (validationInfo.isGSTMandatory) {
    warnings.push("GST details are mandatory for this booking.")
  }

  if (validationInfo.isPanRequiredAtBook) {
    warnings.push("PAN card details are required at the time of booking.")
  }

  if (validationInfo.isPassportRequiredAtBook) {
    const missingPassport = passengersData.some((pax) => !pax.passportNumber || !pax.passportExpiry)
    if (missingPassport) {
      warnings.push("Passport details are required at the time of booking for all travelers.")
    }
  }

  if (!validationInfo.isRefundable) {
    warnings.push("This fare is non-refundable.")
  }

  if (warnings.length === 0) return null

  return (
    <div></div>
  )
}

// Update the renderItineraryDetails function to include multi-city trips
const renderItineraryDetails = () => {
  const hasFlightData = flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0
  const hasReturnFlightData =
    isRoundTrip && returnFlight && returnFlight.OptionSegmentsInfo && returnFlight.OptionSegmentsInfo.length > 0
  const hasMultiCityData = isMultiCity && multiCityFlights && multiCityFlights.length > 0

  if (DEBUG) {
    console.log("renderItineraryDetails validation:", {
      hasFlightData,
      hasReturnFlightData,
      hasMultiCityData,
      isRoundTrip,
      isMultiCity,
    })
    if (hasMultiCityData) {
      multiCityFlights?.forEach((segmentData, index) => {
        console.log(`  Rendering Segment ${index + 1} details:`, segmentData)
        if (segmentData.flight?.OptionSegmentsInfo?.[0]) {
          console.log(
            `    Route: ${segmentData.flight.OptionSegmentsInfo[0].DepartureAirport} -> ${segmentData.flight.OptionSegmentsInfo[0].ArrivalAirport}`,
          )
        }
      })
    }
  }

  if (!hasFlightData && !hasMultiCityData) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No flight details available to display</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Itinerary Details</h2>
        <button
          onClick={() => setShowFlightDetails(!showFlightDetails)}
          className="px-4 py-2 bg-[#007AFF] text-white rounded-md hover:bg-[#007aff]"
        >
          {showFlightDetails ? "Hide Detail" : "Flight Detail"}
        </button>
      </div>
      <div className="flex justify-end mb-6">
        {isMultiCity ? (
          // Multi-city fare rules buttons
          <div className="flex flex-wrap gap-2">
            {multiCityFlights &&
              multiCityFlights.map((segmentData, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setShowFareRulesModal(true)
                    setActiveFareRulesFlight(index)
                  }}
                  className="px-3 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50 text-sm"
                >
                  Segment {index + 1} Fare Rules
                </button>
              ))}
          </div>
        ) : isRoundTrip ? (
          <div className="flex space-x-4">
            <button
              onClick={() => {
                setShowFareRulesModal(true)
                setActiveFareRulesFlight("outbound")
              }}
              className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
            >
              View Outbound Fare Rules
            </button>
            <button
              onClick={() => {
                setShowFareRulesModal(true)
                setActiveFareRulesFlight("return")
              }}
              className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
            >
              View Return Fare Rules
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowFareRulesModal(true)}
            className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
          >
            View Fare Rules
          </button>
        )}
      </div>
      {renderValidationWarnings()}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Error
          </h3>
          <p className="text-sm text-red-700">{error}</p>
          <div className="mt-3">
            <button onClick={() => setError(null)} className="text-sm text-red-600 hover:text-red-800 font-medium">
              Dismiss
            </button>
            <button
              onClick={handleSubmit}
              className="ml-4 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {showFlightDetails ? (
        <div className="space-y-6">
          {/* Multi-city Flights */}
          {isMultiCity &&
            multiCityFlights &&
            multiCityFlights.map((segmentData, index) => {
              const segmentFlight = segmentData.flight
              if (
                !segmentFlight ||
                !segmentFlight.OptionSegmentsInfo ||
                segmentFlight.OptionSegmentsInfo.length === 0
              ) {
                return null
              }

              const firstLeg = segmentFlight.OptionSegmentsInfo[0]
              const lastLeg = segmentFlight.OptionSegmentsInfo[segmentFlight.OptionSegmentsInfo.length - 1]
              const numStops = segmentFlight.OptionSegmentsInfo.length - 1

              return (
                <React.Fragment key={index}>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="bg-[#007aff] rounded-full p-2">
                      <svg
                        className="w-5 h-5 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-medium">
                        Segment {index + 1} : {format(parseDateString(firstLeg.DepartureTime), "EEE, dd MMM yyyy")}
                      </div>
                      <div className="text-gray-600">
                        {firstLeg.DepartureAirport} - {lastLeg.ArrivalAirport}
                        {numStops > 0 && ` (${numStops} Stop${numStops > 1 ? "s" : ""})`}
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 space-y-6">
                    {" "}
                    {/* Added space-y-6 for spacing between sub-segments */}
                    {segmentFlight.OptionSegmentsInfo.map((subSegment, subIndex) => (
                      <React.Fragment key={subIndex}>
                        {subIndex > 0 && (
                          <div className="flex items-center justify-center py-2">
                            <div className="w-px h-8 bg-gray-300"></div>
                            <div className="mx-4 text-sm text-gray-500">
                              {/* Calculate layover time if needed, for now just "Layover" */}
                              Layover at {subSegment.DepartureAirport}
                            </div>
                            <div className="w-px h-8 bg-gray-300"></div>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
                              <AirlineLogo airlineCode={subSegment.MarketingAirline} size="md" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {subSegment.MarketingAirline}, {subSegment.FlightNumber}
                              </div>
                              <div className="text-sm text-gray-500">
                                <svg
                                  className="w-4 h-4 inline-block mr-1"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
                                </svg>
                                {subSegment.Baggage || "N/A"} Check-in, {subSegment.CabinBaggage || "N/A"} handbag
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="relative mt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-3xl font-bold mb-1">
                                {format(parseDateString(subSegment.DepartureTime), "HH:mm")}
                              </div>
                              <div className="space-y-1">
                                <div className="font-medium">{subSegment.DepartureAirport}</div>
                                <div className="text-sm text-gray-600">Terminal - 1</div>
                              </div>
                            </div>

                            <div className="flex-1 px-8">
                              <div className="flex items-center justify-center mb-2">
                                <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
                                  <AirlineLogo airlineCode={subSegment.MarketingAirline} size="md" />
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-sm">
                                  {subSegment.MarketingAirline}, {subSegment.FlightNumber}
                                </div>
                              </div>
                            </div>

                            <div className="flex-1 text-right">
                              <div className="text-3xl font-bold mb-1">
                                {format(parseDateString(subSegment.ArrivalTime), "HH:mm")}
                              </div>
                              <div className="space-y-1">
                                <div className="font-medium">{subSegment.ArrivalAirport}</div>
                                <div className="text-sm text-gray-600">Terminal - 1</div>
                              </div>
                            </div>
                          </div>

                          <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                              </svg>
                              Economy
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </React.Fragment>
              )
            })}

          {/* Outbound Flight (if not multi-city) */}
          {!isMultiCity && flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="bg-[#007aff] rounded-full p-2">
                  <svg
                    className="w-5 h-5 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">
                    Outbound Flight :{" "}
                    {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "EEE, dd MMM yyyy")}
                  </div>
                  {/* --- FIX for wrong route display --- */}
                  <div className="text-gray-600">
                    {flight.OptionSegmentsInfo[0].DepartureAirport} - {flight.OptionSegmentsInfo[flight.OptionSegmentsInfo.length - 1].ArrivalAirport}
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
                      <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {flight.OptionSegmentsInfo[0].MarketingAirline}, {flight.OptionSegmentsInfo[0].FlightNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        <svg
                          className="w-4 h-4 inline-block mr-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
                        </svg>
                        {flight.OptionSegmentsInfo[0].Baggage || "N/A"} Check-in,{" "}
                        {flight.OptionSegmentsInfo[0].CabinBaggage || "N/A"} handbag
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-3xl font-bold mb-1">
                        {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{flight.OptionSegmentsInfo[0].DepartureAirport}</div>
                        <div className="text-sm text-gray-600">Terminal - 1</div>
                      </div>
                    </div>

                    <div className="flex-1 px-8">
                      <div className="flex items-center justify-center mb-2">
                        <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
                          <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-sm">
                          {flight.OptionSegmentsInfo[0].MarketingAirline}, {flight.OptionSegmentsInfo[0].FlightNumber}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-right">
                      <div className="text-3xl font-bold mb-1">
                        {format(parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">{flight.OptionSegmentsInfo[0].ArrivalAirport}</div>
                        <div className="text-sm text-gray-600">Terminal - 1</div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      </svg>
                      Economy
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Return Flight (if round trip) */}
          {isRoundTrip &&
            returnFlight &&
            returnFlight.OptionSegmentsInfo &&
            returnFlight.OptionSegmentsInfo.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm mt-6">
                  <div className="bg-[#eb0066] rounded-full p-2">
                    <svg
                      className="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">
                      Return Flight :{" "}
                      {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "EEE, dd MMM yyyy")}
                    </div>
                    {/* --- FIX for wrong route display --- */}
                    <div className="text-gray-600">
                      {returnFlight.OptionSegmentsInfo[0].DepartureAirport} -{" "}
                      {returnFlight.OptionSegmentsInfo[returnFlight.OptionSegmentsInfo.length - 1].ArrivalAirport}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
                        <AirlineLogo airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {returnFlight.OptionSegmentsInfo[0].MarketingAirline},{" "}
                          {returnFlight.OptionSegmentsInfo[0].FlightNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          <svg
                            className="w-4 h-4 inline-block mr-1"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
                          </svg>
                          {returnFlight.OptionSegmentsInfo[0].Baggage || "N/A"} Check-in,{" "}
                          {returnFlight.OptionSegmentsInfo[0].CabinBaggage || "N/A"} handbag
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-3xl font-bold mb-1">
                          {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">{returnFlight.OptionSegmentsInfo[0].DepartureAirport}</div>
                          <div className="text-sm text-gray-600">Terminal - 1</div>
                        </div>
                      </div>

                      <div className="flex-1 px-8">
                        <div className="flex items-center justify-center mb-2">
                          <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
                            <AirlineLogo airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-sm">
                            {returnFlight.OptionSegmentsInfo[0].MarketingAirline},{" "}
                            {returnFlight.OptionSegmentsInfo[0].FlightNumber}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 text-right">
                        <div className="text-3xl font-bold mb-1">
                          {format(parseDateString(returnFlight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">{returnFlight.OptionSegmentsInfo[0].ArrivalAirport}</div>
                          <div className="text-sm text-gray-600">Terminal - 1</div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        </svg>
                        Economy
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          <div className="mt-8 text-sm text-gray-500 border-t pt-4">
            The baggage information is just for reference. Please Check with airline before check-in. For more
            information, visit the airline's official website.
          </div>
        </div>
      ) : (
        <div>
          {/* Collapsed view for multi-city flights */}
          {isMultiCity &&
            multiCityFlights &&
            multiCityFlights.map((segmentData, index) => {
              const segmentFlight = segmentData.flight
              if (!segmentFlight || !segmentFlight.OptionSegmentsInfo || !segmentFlight.OptionSegmentsInfo[0]) {
                return null
              }
              const firstLeg = segmentFlight.OptionSegmentsInfo[0]
              const lastLeg = segmentFlight.OptionSegmentsInfo[segmentFlight.OptionSegmentsInfo.length - 1]

              return (
                <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                    <AirlineLogo airlineCode={firstLeg.MarketingAirline} size="lg" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {firstLeg.MarketingAirline} {firstLeg.FlightNumber}
                        </p>
                        <p className="text-sm text-gray-600">
                          {firstLeg.DepartureAirport} - {lastLeg.ArrivalAirport}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{format(parseDateString(firstLeg.DepartureTime), "HH:mm")}</p>
                        <p className="text-sm text-gray-600">
                          {segmentFlight.OptionSegmentsInfo.length > 1
                            ? `${segmentFlight.OptionSegmentsInfo.length - 1} Stop${segmentFlight.OptionSegmentsInfo.length - 1 > 1 ? "s" : ""}`
                            : "Non-Stop"}
                        </p>
                        <p className="font-medium">{format(parseDateString(lastLeg.ArrivalTime), "HH:mm")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

          {/* Collapsed view for outbound flight (if not multi-city) */}
          {!isMultiCity && flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="lg" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {flight.OptionSegmentsInfo[0].MarketingAirline} {flight.OptionSegmentsInfo[0].FlightNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      {flight.OptionSegmentsInfo[0].DepartureAirport} - {flight.OptionSegmentsInfo[0].ArrivalAirport}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
                    </p>
                    <p className="text-sm text-gray-600">Non-Stop</p>
                    <p className="font-medium">
                      {format(parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed view for return flight (if round trip) */}
          {isRoundTrip &&
            returnFlight &&
            returnFlight.OptionSegmentsInfo &&
            returnFlight.OptionSegmentsInfo.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <AirlineLogo airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline} size="lg" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {returnFlight.OptionSegmentsInfo[0].MarketingAirline}{" "}
                        {returnFlight.OptionSegmentsInfo[0].FlightNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        {returnFlight.OptionSegmentsInfo[0].DepartureAirport} -{" "}
                        {returnFlight.OptionSegmentsInfo[0].ArrivalAirport}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
                      </p>
                      <p className="text-sm text-gray-600">Non-Stop</p>
                      <p className="font-medium">
                        {format(parseDateString(returnFlight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  )
}
// Add a new section to display selected fare details
const renderSelectedFareDetails = () => {
  if (!flight?.SelectedFare && !selectedFare) return null

  const fare = flight?.SelectedFare || selectedFare

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Selected Fare: {fare.name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baggage */}
        <div>
          <h3 className="font-medium mb-2 text-[#007aff]">Baggage</h3>
          <div className="space-y-2">
            <div className="flex items-start">
              <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-sm">{fare.baggage.cabinBaggage} Cabin Baggage</span>
            </div>
            <div className="flex items-start">
              <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-sm">{fare.baggage.checkInBaggage} Check-in Baggage</span>
            </div>
          </div>
        </div>

        {/* Flexibility */}
        <div>
          <h3 className="font-medium mb-2 text-[#007aff]">Flexibility</h3>
          <div className="space-y-2">
            <div className="flex items-start">
              <div className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm">{fare.flexibility.cancellationFee}</span>
            </div>
            <div className="flex items-start">
              <div className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm">{fare.flexibility.dateChangeFee}</span>
            </div>
          </div>
        </div>

        {/* Seats & Meals */}
        <div>
          <h3 className="font-medium mb-2 text-[#007aff]">Seats & Meals</h3>
          <div className="space-y-2">
            <div className="flex items-start">
              {fare.seats.free ? (
                <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm">{fare.seats.free ? "Free Seats" : "Chargeable Seats"}</span>
            </div>
            <div className="flex items-start">
              {fare.seats.complimentaryMeals ? (
                <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 mr-2 flex-shrink-0" />
              )}
              <span className="text-sm">
                {fare.seats.complimentaryMeals ? "Complimentary Meals" : "Chargeable Meals"}
              </span>
            </div>
          </div>
        </div>

        {/* Benefits */}
        {(fare.benefits.priorityCheckIn ||
          fare.benefits.priorityBoarding ||
          fare.benefits.expressCheckIn ||
          fare.benefits.extraBaggage) && (
          <div>
            <h3 className="font-medium mb-2 text-[#007aff]">Exclusive Benefits</h3>
            <div className="space-y-2">
              {fare.benefits.expressCheckIn && (
                <div className="flex items-start">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm">Express Check-In</span>
                </div>
              )}
              {fare.benefits.priorityBoarding && (
                <div className="flex items-start">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm">Priority Boarding</span>
                </div>
              )}
              {fare.benefits.priorityCheckIn && (
                <div className="flex items-start">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm">Priority Check-In</span>
                </div>
              )}
              {fare.benefits.extraBaggage && (
                <div className="flex items-start">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm">Extra {fare.benefits.extraBaggage} Baggage</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Calculate the total price for RefundableBookingOption
const refundablePriceValue = React.useMemo(() => {
  if (DEBUG) {
    console.log("Calculating refundable price with:", {
      isRoundTrip,
      isMultiCity,
      totalPrice,
      flightPrice: flight?.OptionPriceInfo?.TotalPrice,
      returnFlightPrice: returnFlight?.OptionPriceInfo?.TotalPrice,
      multiCityFlights: multiCityFlights?.length,
    })
  }

  if (isRoundTrip && returnFlight && returnFlight.OptionPriceInfo) {
    const calculatedTotal =
      totalPrice ||
      Number(flight?.OptionPriceInfo?.TotalPrice || 0) + Number(returnFlight.OptionPriceInfo?.TotalPrice || 0)

    if (DEBUG) {
      console.log("Round-trip refundable price:", calculatedTotal)
    }
    return calculatedTotal
  } else if (isMultiCity && multiCityFlights && multiCityFlights.length > 0) {
    const calculatedTotal =
      totalPrice ||
      multiCityFlights.reduce((sum, segmentData) => {
        return sum + Number(segmentData.flight?.OptionPriceInfo?.TotalPrice || 0)
      }, 0)

    if (DEBUG) {
      console.log("Multi-city refundable price:", calculatedTotal)
    }
    return calculatedTotal
  } else {
    const calculatedTotal = totalPrice || Number(flight?.OptionPriceInfo?.TotalPrice || 0)

    if (DEBUG) {
      console.log("One-way refundable price:", calculatedTotal)
    }
    return calculatedTotal
  }
}, [isRoundTrip, isMultiCity, totalPrice, flight, returnFlight, multiCityFlights]); // Dependencies for memoization

const startDateValue = React.useMemo(() => {
  if (isMultiCity && multiCityFlights && multiCityFlights.length > 0) {
    const firstSegmentFlight = multiCityFlights[0].flight
    if (
      firstSegmentFlight &&
      firstSegmentFlight.OptionSegmentsInfo &&
      firstSegmentFlight.OptionSegmentsInfo.length > 0
    ) {
      const startDate = parseDateString(firstSegmentFlight.OptionSegmentsInfo[0].DepartureTime)
      if (DEBUG) {
        console.log("Calculated start date (multi-city):", startDate)
      }
      return startDate
    }
  } else if (flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
    const startDate = parseDateString(flight.OptionSegmentsInfo[0].DepartureTime)
    if (DEBUG) {
      console.log("Calculated start date (single/round-trip):", startDate)
    }
    return startDate
  }

  if (DEBUG) {
    console.log("Using fallback start date (current date)")
  }
  return new Date()
}, [isMultiCity, multiCityFlights, flight]); // Dependencies for memoization

// Show loading state
if (isLoading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#007aff] mx-auto mb-4"></div>
        <h2 className="text-xl font-medium">Loading flight details...</h2>
      </div>
    </div>
  )
}

// Show error state
if (error) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center bg-red-50 p-8 rounded-lg max-w-md">
        <div className="text-red-500 text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-4">Error Loading Flight Details</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link to="/" className="text-[#007aff] hover:text-[#007aff] font-medium">
          Return to search
        </Link>
      </div>
    </div>
  )
}

// Show empty state if no flight data
if (!flight && !isMultiCity && (!multiCityFlights || multiCityFlights.length === 0)) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">No flight details available</h1>
        <Link to="/" className="text-[#007aff] hover:text-[#007aff]">
          Return to search
        </Link>
      </div>
    </div>
  )
}

const totalAmountBasedOnLoadedData =
  isMultiCity && multiCityFlights
    ? multiCityFlights.reduce((sum, item) => sum + Number(item.flight?.OptionPriceInfo?.TotalPrice || 0), 0)
    : flight && flight.OptionPriceInfo
      ? Number(flight.OptionPriceInfo.TotalPrice)
      : 0

// Debug logging for RefundableBookingOption props
if (DEBUG) {
  console.log("About to render RefundableBookingOption with:", {
    totalPrice: refundablePriceValue,
    startDate: startDateValue,
    isRoundTrip,
    isMultiCity,
  })
}

return (
  <div className="min-h-screen bg-gray-50">
    <Header />
    {showAlert && previousFare && updatedFare && (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center w-96">
          {/* Company Logo */}
          <div className="flex justify-center mb-4">
            <img
              src="/images/logo.png"
              alt="FareClubs Logo"
              className="h-16"
              onError={(e) => {
                e.currentTarget.src = "/community-travel-deals.png"
              }}
            />
          </div>

          <h2 className="text-xl font-semibold mb-6">Fare Update</h2>

          <div className="flex justify-between items-center p-4 bg-gray-100 rounded mb-6">
            <div className="text-left">
              <p className="text-gray-600 text-sm">Previous Fare:</p>
              <p className="text-lg font-semibold text-red-500">₹{previousFare?.toFixed(2)}</p>
            </div>
            <div className="text-2xl font-bold text-gray-400">→</div>
            <div className="text-right">
              <p className="text-gray-600 text-sm">Updated Fare:</p>
              <p className="text-lg font-semibold text-green-500">₹{updatedFare?.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex justify-between gap-4">
            <button
              onClick={handleContinueBooking}
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded hover:bg-blue-600 transition-colors"
            >
              Continue Booking
            </button>
            <button
              onClick={handleGoBack}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={handleBackToResults} className="text-gray-600 hover:text-gray-800 flex items-center">
            <ArrowLeft className="w-5 h-5" />
            <span className="ml-1">Back to Results</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Almost done!</h1>
          <p className="text-gray-600">Enter your details and complete your booking now.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          {renderItineraryDetails()}

          {/* Add the selected fare details section */}
          {renderSelectedFareDetails()}

          {/* SSR Options Section */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Additional Services</h2>
              <button
                onClick={() => setShowSSROptions(!showSSROptions)}
                className="px-4 py-2 bg-[#007AFF] text-white rounded-md hover:bg-[#007aff]"
              >
                {showSSROptions ? "Hide Options" : "Show Options"}
              </button>
            </div>

            {showSSROptions && (
              <>
                {isMultiCity ? (
                  // Multi-city SSR options with unique keys
                  <div className="space-y-6">
                    {multiCityFlights &&
                      multiCityFlights.map((segmentData, index) => {
                        // Get the result index and traceId for this segment
                        const segmentResultIndex = segmentData.resultIndex
                        const segmentTraceId = segmentData.traceId
                        const segmentFlight = segmentData.flight

                        return (
                          <div key={`multi-city-${index}`}>
                            <h3 className="font-medium text-lg mb-4">
                              Segment {index + 1} Services ({segmentFlight?.OptionSegmentsInfo?.[0]?.DepartureAirport}{" "}
                              - {segmentFlight?.OptionSegmentsInfo?.[0]?.ArrivalAirport})
                            </h3>
                            <SSROptions
                              key={ssrComponentKeys.segments[index] || `segment-${index}-${Date.now()}`}
                              tokenId={sessionId || ""}
                              traceId={segmentTraceId || ""} // Use segment specific traceId
                              resultIndex={segmentResultIndex}
                              isLCC={segmentFlight?.IsLCC || false}
                              onSSRSelect={(options: any, price: number, isMealMandatory?: boolean) => handleSegmentSSRSelect(index, options, price, isMealMandatory)}
                              onTraceIdUpdate={(newTraceId) => {
                                // Update the specific segment's traceId in multiCityFlights state
                                setMultiCityFlights(
                                  (prev) =>
                                    prev?.map((item, idx) =>
                                      idx === index ? { ...item, traceId: newTraceId } : item,
                                    ) || null,
                                )
                              }}
                            />
                          </div>
                        )
                      })}
                  </div>
                ) : isRoundTrip ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-medium text-lg mb-4">Outbound Flight Services</h3>
                      <SSROptions
                        key={ssrComponentKeys.outbound}
                        tokenId={sessionId || ""}
                        traceId={traceIdState || ""} // Use global traceIdState
                        resultIndex={location.state?.outboundResultIndex || flight?.ResultIndex || ""}
                        isLCC={flight?.IsLCC || false}
                        onSSRSelect={handleOutboundSSRSelect} // Use the memoized callback
                        onTraceIdUpdate={setTraceIdState} // Pass setTraceIdState
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg mb-4">Return Flight Services</h3>
                      <SSROptions
                        key={ssrComponentKeys.return}
                        tokenId={sessionId || ""}
                        traceId={traceIdState || ""} // Use global traceIdState
                        resultIndex={
                          location.state?.returnResultIndex || returnFlight?.ResultIndex || ""
                        }
                        isLCC={returnFlight?.IsLCC || false}
                        onSSRSelect={handleReturnSSRSelect}
                        onTraceIdUpdate={setTraceIdState} // Pass setTraceIdState
                      />
                    </div>
                  </div>
                ) : (
                  <SSROptions
                    key={ssrComponentKeys.outbound}
                    tokenId={sessionId || ""}
                    traceId={traceIdState || ""} // Use global traceIdState
                    resultIndex={location.state?.resultIndex || flight?.ResultIndex || ""}
                    isLCC={flight?.IsLCC || false}
                    onSSRSelect={handleSSRSelect}
                    onTraceIdUpdate={setTraceIdState} // Pass setTraceIdState
                  />
                )}
              </>
            )}
          </div>

          {/* Meal Selection Mandatory Warning */}
          {showMealWarning && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
              <div className="flex">
                <div className="py-1">
                  <svg className="fill-current h-6 w-6 text-yellow-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg>
                </div>
                <div>
                  <p className="font-bold">Meal Selection Required!</p>
                  <p className="text-sm">This LCC flight requires a meal selection. Please choose your meal(s) in the "Additional Services" section above before proceeding with the booking.</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Details */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Contact Details</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your mobile number will be used only for sending flight related communication
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-[#eb0066]">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={handleGeneralInputChange}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile number <span className="text-[#eb0066]">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={mobile}
                  onChange={handleGeneralInputChange}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="receiveOffers"
                  checked={receiveOffers}
                  onChange={handleGeneralInputChange}
                  className="rounded text-[#007aff]"
                />
                <span className="ml-2 text-sm text-gray-600">
                  Send me the latest travel deals and special offers via email and/or SMS.
                </span>
              </label>
            </div>
          </div>

          {/* Traveller Details */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Traveller Details</h2>
            <p className="text-sm text-gray-600 mb-4">Please enter name as mentioned on your government ID proof.</p>
            {passengersData.map((pax, index) => (
              <div key={index} className="mb-6 border-b pb-4 last:border-b-0 last:pb-0">
                <h3 className="text-sm font-medium mb-2">
                  Traveller {index + 1}: {pax.type.charAt(0).toUpperCase() + pax.type.slice(1)}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <select
                      name="title"
                      value={pax.title}
                      onChange={(e) => handlePassengerInputChange(index, e)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="Mr">Mr.</option>
                      <option value="Ms">Ms.</option>
                      <option value="Mrs">Mrs.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-[#eb0066]">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={pax.firstName}
                      onChange={(e) => handlePassengerInputChange(index, e)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={pax.middleName}
                      onChange={(e) => handlePassengerInputChange(index, e)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-[#eb0066]">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={pax.lastName}
                      onChange={(e) => handlePassengerInputChange(index, e)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-[#eb0066]">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={pax.gender === "male"}
                        onChange={(e) => handlePassengerInputChange(index, e)}
                        className="text-[#007aff]"
                      />
                      <span className="ml-2">Male</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={pax.gender === "female"}
                        onChange={(e) => handlePassengerInputChange(index, e)}
                        className="text-[#007aff]"
                      />
                      <span className="ml-2">Female</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth <span className="text-[#eb0066]">*</span>
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={pax.dateOfBirth}
                    onChange={(e) => handlePassengerInputChange(index, e)}
                    className="w-full p-2 border rounded-md"
                    required
                    max={
                      pax.type === "adult"
                        ? new Date(new Date().setFullYear(new Date().getFullYear() - 12)).toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0] // No max for children/infants, or adjust based on airline rules
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {pax.type === "adult" && "Passengers must be at least 12 years old."}
                    {pax.type === "child" && "Child age usually 2-11 years."}
                    {pax.type === "infant" && "Infant age usually 0-2 years (must be accompanied by an adult)."}
                  </p>
                </div>
                {/* Add optional passport fields if validationInfo.isPassportRequiredAtBook is true */}
                {/* --- START: Add Passport Fields --- */}
                {validationInfo.isPassportRequiredAtBook && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Passport Number <span className="text-[#eb0066]">*</span>
                        </label>
                        <input
                          type="text"
                          name="passportNumber"
                          value={pax.passportNumber || ""}
                          onChange={(e) => handlePassengerInputChange(index, e)}
                          className="w-full p-2 border rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Passport Expiry <span className="text-[#eb0066]">*</span>
                        </label>
                        <input
                          type="date"
                          name="passportExpiry"
                          value={pax.passportExpiry || ""}
                          onChange={(e) => handlePassengerInputChange(index, e)}
                          className="w-full p-2 border rounded-md"
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nationality <span className="text-[#eb0066]">*</span>
                      </label>
                      <input
                        type="text"
                        name="nationality"
                        value={pax.nationality || "IN"}
                        onChange={(e) => handlePassengerInputChange(index, e)}
                        className="w-full p-2 border rounded-md"
                        placeholder="e.g. IN for India"
                        required
                      />
                    </div>
                  </>
                )}
                {/* --- END: Add Passport Fields --- */}
              </div>
            ))}
          </div>

          {/* Refundable Booking Upgrade */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <RefundableBookingOption
              totalPrice={refundablePriceValue}
              onSelect={handleRefundableSelect}
              currency="₹"
              startDate={startDateValue}
            />
          </div>

          {/* GST Details */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="useGST"
                name="useGST"
                checked={bookingOptions.useGST}
                onChange={handleOptionChange}
                className="mr-2"
              />
              <label htmlFor="useGST" className="text-sm font-medium">
                Use GST for this booking {validationInfo.isGSTMandatory && "(REQUIRED)"}
              </label>
            </div>
            {(bookingOptions.useGST || validationInfo.isGSTMandatory) && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  To claim credit of GST charged by airlines/FareClubs, please enter your company's GST number
                </p>
                <input
                  type="text"
                  name="gstNumber"
                  value={bookingOptions.gstNumber}
                  onChange={handleOptionChange}
                  placeholder="Enter GST Number"
                  className="w-full p-2 border rounded-md"
                  required={validationInfo.isGSTMandatory}
                />
              </div>
            )}
          </div>
        </div>

        {/* Price Details Sidebar */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-lg font-semibold mb-4">Price Details</h2>
            {updatedFare !== null ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Price</span>
                  <span className="font-semibold">₹{updatedFare}</span>
                </div>
                <div className="flex justify-between">
                  <span>Convenience Fees</span>
                  <span className="font-semibold">₹{convenienceFee}</span>
                </div>
                {ssrTotalPrice.total > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Services</span>
                    <span className="font-semibold">₹{ssrTotalPrice.total}</span>
                  </div>
                )}
                {isRefundableSelected && (
                  <div className="flex justify-between">
                    <span>Refundable Booking</span>
                    <span className="font-semibold">₹{refundablePrice}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>You Pay</span>
                  <span>
                    ₹
                    {updatedFare +
                      convenienceFee +
                      ssrTotalPrice.total +
                      (isRefundableSelected ? refundablePrice : 0)}
                  </span>
                </div>
              </div>
            ) : isMultiCity && totalPrice ? (
              <div className="space-y-2">
                {multiCityFlights &&
                  multiCityFlights.map((segmentData, index) => (
                    <div className="flex justify-between" key={index}>
                      <span>Segment {index + 1}</span>
                      <span className="font-semibold">
                        ₹
                        {segmentData.flight && segmentData.flight.OptionPriceInfo
                          ? segmentData.flight.OptionPriceInfo.TotalPrice
                          : "0"}
                      </span>
                    </div>
                  ))}
                <div className="flex justify-between">
                  <span>Convenience Fees</span>
                  <span className="font-semibold">₹{convenienceFee}</span>
                </div>
                {ssrTotalPrice.total > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Services</span>
                    <span className="font-semibold">₹{ssrTotalPrice.total}</span>
                  </div>
                )}
                {isRefundableSelected && (
                  <div className="flex justify-between">
                    <span>Refundable Booking</span>
                    <span className="font-semibold">₹{refundablePrice}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>You Pay</span>
                  <span>
                    ₹
                    {totalPrice + convenienceFee + ssrTotalPrice.total + (isRefundableSelected ? refundablePrice : 0)}
                  </span>
                </div>
              </div>
            ) : isRoundTrip && isCombinedTrip ? (
              // **FIX**: Show a single total price for combined international trips
              <div className="space-y-2">
                  <div className="flex justify-between">
                      <span>Total Fare</span>
                      <span className="font-semibold">₹{totalPrice}</span>
                  </div>
                  <div className="flex justify-between">
                      <span>Convenience Fees</span>
                      <span className="font-semibold">₹{convenienceFee}</span>
                  </div>
                  {ssrTotalPrice.total > 0 && (
                      <div className="flex justify-between">
                      <span>Additional Services</span>
                      <span className="font-semibold">₹{ssrTotalPrice.total}</span>
                      </div>
                  )}
                  {isRefundableSelected && (
                      <div className="flex justify-between">
                      <span>Refundable Booking</span>
                      <span className="font-semibold">₹{refundablePrice}</span>
                      </div>
                  )}
                  <hr className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                      <span>You Pay</span>
                      <span>
                      ₹
                      {(totalPrice || 0) + convenienceFee + ssrTotalPrice.total + (isRefundableSelected ? refundablePrice : 0)}
                      </span>
                  </div>
              </div>
            ) : isRoundTrip && flight?.OptionPriceInfo && returnFlight?.OptionPriceInfo ? (
              // Original logic for domestic round trips
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Outbound Flight</span>
                  <span className="font-semibold">₹{flight.OptionPriceInfo.TotalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Return Flight</span>
                  <span className="font-semibold">₹{returnFlight.OptionPriceInfo.TotalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span>Convenience Fees</span>
                  <span className="font-semibold">₹{convenienceFee}</span>
                </div>
                {ssrTotalPrice.total > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Services</span>
                    <span className="font-semibold">₹{ssrTotalPrice.total}</span>
                  </div>
                )}
                {isRefundableSelected && (
                  <div className="flex justify-between">
                    <span>Refundable Booking</span>
                    <span className="font-semibold">₹{refundablePrice}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>You Pay</span>
                  <span>
                    ₹
                    {Number(flight.OptionPriceInfo.TotalPrice) + Number(returnFlight.OptionPriceInfo.TotalPrice) + convenienceFee + ssrTotalPrice.total + (isRefundableSelected ? refundablePrice : 0)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Adult (1 × ₹{flight?.OptionPriceInfo?.TotalBasePrice || 0})</span>
                  <span className="font-semibold">₹{flight?.OptionPriceInfo?.TotalBasePrice || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Airline Taxes &amp; Fees</span>
                  <span className="font-semibold">₹{flight?.OptionPriceInfo?.TotalTax || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Convenience Fees</span>
                  <span className="font-semibold">₹{convenienceFee}</span>
                </div>
                {ssrTotalPrice.total > 0 && (
                  <div className="flex justify-between">
                    <span>Additional Services</span>
                    <span className="font-semibold">₹{ssrTotalPrice.total}</span>
                  </div>
                )}
                {isRefundableSelected && (
                  <div className="flex justify-between">
                    <span>Refundable Booking</span>
                    <span className="font-semibold">₹{refundablePrice}</span>
                  </div>
                )}
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>You Pay</span>
                  <span>
                    ₹
                    {totalAmountBasedOnLoadedData +
                      convenienceFee +
                      ssrTotalPrice.total +
                      (isRefundableSelected ? refundablePrice : 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Promo Code */}
          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Promo Code</h3>
            <div className="flex gap-2">
              <input
                type="text"
                name="promoCode"
                value={promoCode}
                onChange={handleGeneralInputChange}
                placeholder="Enter promo code"
                className="flex-1 p-2 border rounded-md"
              />
              <button className="px-4 py-2 bg-[#007aff] text-white rounded-md hover:bg-[#007aff]">Apply</button>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 p-2 border rounded-md">
                <input type="radio" name="promo" className="text-[#007aff]" />
                <div>
                  <div className="font-medium">FIRST100</div>
                  <div className="text-sm text-gray-600">Save ₹100</div>
                  <div className="text-xs text-gray-500">Get Up to ₹800* Off. Valid only for UPI Payments</div>
                </div>
              </label>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full mt-6 px-6 py-3 bg-[#eb0066] text-white rounded-md hover:bg-[#eb0066] font-medium"
            >
              Pay Now
            </button>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center">
                <img src="/images/trustpilot.png" alt="Trustpilot Rating" className="h-12" />
              </div>
              <img src="/images/iata.png" alt="IATA Logo" className="h-12" />
            </div>
            <p className="mt-4 text-xs text-gray-500 text-center">
              By clicking on Pay Now, you are agreeing to our Terms & Conditions, Privacy Policy, User Agreement, and
              Covid-19 Guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Fare Rules Modal */}
    {showFareRulesModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              {isMultiCity
                ? `Fare Rules - Segment ${(activeFareRulesFlight as number) + 1}`
                : isRoundTrip
                  ? `Fare Rules - ${activeFareRulesFlight === "outbound" ? "Outbound Flight" : "Return Flight"}`
                  : "Fare Rules"}
            </h3>
            <button className="text-gray-500" onClick={() => setShowFareRulesModal(false)}>
              ✕
            </button>
          </div>
          {isMultiCity
            ? // Multi-city fare rules - use the same FareRules component
              multiCityFlights &&
              typeof activeFareRulesFlight === "number" &&
              multiCityFlights[activeFareRulesFlight] && (
                <FareRules
                  tokenId={sessionId || ""}
                  traceId={multiCityFlights[activeFareRulesFlight].traceId || ""} // Use segment specific traceId
                  resultIndex={multiCityFlights[activeFareRulesFlight].resultIndex || ""} // Use segment specific resultIndex
                />
              )
            : isRoundTrip
              ? activeFareRulesFlight === "outbound"
                ? flight && (
                    <FareRules
                      tokenId={sessionId || ""}
                      traceId={traceIdState || ""} // Use global traceIdState
                      resultIndex={location.state?.outboundResultIndex || flight?.ResultIndex || ""}
                    />
                  )
                : returnFlight && (
                    <FareRules
                      tokenId={sessionId || ""}
                      traceId={traceIdState || ""} // Use global traceIdState
                      resultIndex={
                        location.state?.returnResultIndex || returnFlight?.ResultIndex || ""
                      }
                    />
                  )
              : flight && (
                  <FareRules
                    tokenId={sessionId || ""}
                    traceId={traceIdState || ""} // Use global traceIdState
                    resultIndex={location.state?.resultIndex || flight?.ResultIndex || ""}
                  />
                )}
          <div className="mt-6 flex justify-end">
            <button
              className="bg-[#007aff] text-white px-6 py-2 rounded-lg font-medium"
              onClick={() => setShowFareRulesModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)
}

export default BookingPage
