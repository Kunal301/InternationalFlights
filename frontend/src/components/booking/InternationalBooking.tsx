// "use client"

// import React, { useState, useEffect, useCallback } from "react"
// import { useLocation, Link, useNavigate } from "react-router-dom"
// import { ArrowLeft, Check } from "lucide-react"
// import { format, isValid, parseISO } from "date-fns"
// import { Header } from "./BookingHeader"
// import { AirlineLogo } from "../common/AirlineLogo"
// import FareRules from "./FareRules"
// import SSROptions from "./ssrOptions"
// import RefundableBookingOption from "./Pricing/RefundableBookingOptions"
// import { EcomPaymentService } from "../../services/ecomPaymentServices"
// import { preparePassengerData, createBooking } from "../../services/bookingService"
// import { handleTicketingProcess } from "../../services/ticketService"
// import { getFareQuote } from "../../services/fareService"
// import axios from "axios"

// const DEBUG = true // Set to true to enable debug logs

// interface IndividualPassenger {
//   title: string
//   firstName: string
//   middleName: string
//   lastName: string
//   gender: string
//   dateOfBirth: string
//   type: "adult" | "child" | "infant"
//   passportNumber?: string
//   passportExpiry?: string
//   nationality?: string
// }

// interface BookingPageProps {
//   flight?: {
//     SearchSegmentId?: number | string
//     JourneyTime?: number
//     OptionSegmentsInfo?: {
//       DepartureAirport: string
//       ArrivalAirport: string
//       DepartureTime: string
//       ArrivalTime: string
//       MarketingAirline: string
//       FlightNumber: string
//       Baggage?: string
//       CabinBaggage?: string
//       Origin?: any
//       Destination?: any
//       Airline?: any
//     }[]
//     OptionPriceInfo?: {
//       TotalPrice: string
//       TotalBasePrice: string
//       TotalTax: string
//     }
//     IsLCC?: boolean
//     SelectedFare?: {
//       name: string
//       benefits: {
//         priorityCheckIn: boolean
//         priorityBoarding: boolean
//         extraBaggage: string
//         expressCheckIn: boolean
//       }
//       baggage: {
//         cabinBaggage: string
//         checkInBaggage: string
//       }
//       flexibility: {
//         cancellationFee: string
//         dateChangeFee: string
//       }
//       seats: {
//         free: boolean
//         complimentaryMeals: boolean
//       }
//     }
//     OptionId?: string | number
//     ResultIndex?: string
//     Segments?: any[][] // For international combined: [outbound_segments[], return_segments[]]
//     Fare?: {
//       PublishedFare: number
//       CommissionEarned: number
//       ServiceFee: number
//     }
//   }
// }

// interface MultiCityFlightSegmentData {
//   flight: BookingPageProps["flight"]
//   traceId: string
//   resultIndex: string
// }

// const parseDateString = (dateStr: string) => {
//   try {
//     let date = parseISO(dateStr)

//     if (!isValid(date)) {
//       const [datePart, timePart] = dateStr.split(", ")
//       if (datePart && timePart) {
//         const [day, month, year] = datePart.split("/")
//         const [hours, minutes] = timePart.split(":")
//         date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
//       }
//     }

//     if (!isValid(date)) {
//       console.warn(`Invalid date string: ${dateStr}, using current date as fallback`)
//       return new Date()
//     }

//     return date
//   } catch (error) {
//     console.error(`Error parsing date: ${dateStr}`, error)
//     return new Date()
//   }
// }

// const addDatePickerStyles = () => {
//   const style = document.createElement("style")
//   style.textContent = `
// .air-datepicker-cell.-disabled- {
// color: #ccc !important;
// cursor: not-allowed !important;
// background-color: #f5f5f5 !important;
// }
// `
//   document.head.appendChild(style)
// }

// const InternationalBookingPage: React.FC<BookingPageProps> = () => {
//   const location = useLocation()
//   const navigate = useNavigate()

//   if (DEBUG) {
//     console.log("InternationalBookingPage initial location.state:", location.state)
//   }

//   const [searchParams, setSearchParams] = useState<any>(null)
//   const [sessionId, setSessionId] = useState<string | null>(null)
//   const [traceIdState, setTraceIdState] = useState<string | null>(null)
//   const [flight, setFlight] = useState<BookingPageProps["flight"] | null>(null)
//   const [isMultiCity, setIsMultiCity] = useState(false)
//   const [multiCityFlights, setMultiCityFlights] = useState<MultiCityFlightSegmentData[] | null>(null)
//   const [returnFlight, setReturnFlight] = useState<BookingPageProps["flight"] | null>(null) // Only for domestic round trip
//   const [isRoundTrip, setIsRoundTrip] = useState(false) // General round trip flag (domestic or international combined)
//   const [isInternationalRoundTrip, setIsInternationalRoundTrip] = useState(false) // Specific flag for international combined
//   const [totalPrice, setTotalPrice] = useState<number | null>(null)
//   const [previousFare, setPreviousFare] = useState<number | null>(null)
//   const [updatedFare, setUpdatedFare] = useState<number | null>(null)
//   const [showAlert, setShowAlert] = useState(true)
//   const [selectedFare, setSelectedFare] = useState<any>(null)
//   const [email, setEmail] = useState("")
//   const [mobile, setMobile] = useState("")
//   const [receiveOffers, setReceiveOffers] = useState(true)
//   const [promoCode, setPromoCode] = useState("")

//   const [passengerCounts, setPassengerCounts] = useState({
//     adults: 1,
//     children: 0,
//     infants: 0,
//   })
//   const [passengersData, setPassengersData] = useState<IndividualPassenger[]>([])

//   const [validationInfo, setValidationInfo] = useState({
//     isGSTMandatory: false,
//     isPanRequiredAtBook: false,
//     isPanRequiredAtTicket: false,
//     isPassportRequiredAtBook: false,
//     isPassportRequiredAtTicket: false,
//     isHoldAllowed: false,
//     isRefundable: true,
//   })

//   const [bookingOptions, setBookingOptions] = useState({
//     fareType: "refundable",
//     seatSelection: false,
//     useGST: false,
//     gstNumber: "",
//   })

//   const [activeFareRulesFlight, setActiveFareRulesFlight] = useState<"outbound" | "return" | number>("outbound")

//   const [selectedSSROptions, setSelectedSSROptions] = useState<any>({
//     outbound: {},
//     return: {},
//     segments: {},
//     internationalCombined: {}, // New for international combined
//   })
//   const [ssrTotalPrice, setSSRTotalPrice] = useState<{
//     outbound: number
//     return: number
//     segments: Record<number, number>
//     internationalCombined: number // New for international combined
//     total: number
//   }>({
//     outbound: 0,
//     return: 0,
//     segments: {},
//     internationalCombined: 0,
//     total: 0,
//   })
//   const [showSSROptions, setShowSSROptions] = useState<boolean>(false)

//   const [showFlightDetails, setShowFlightDetails] = useState(true)
//   const [isLoading, setIsLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   const [showFareRulesModal, setShowFareRulesModal] = useState(false)

//   const [isRefundableSelected, setIsRefundableSelected] = useState(false)
//   const [refundablePrice, setRefundablePrice] = useState(0)

//   const [isEMISelected, setIsEMISelected] = useState(false)
//   const [showEMIForm, setShowEMIForm] = useState(false)
//   const [emiProcessing, setEmiProcessing] = useState(false)
//   const [emiResponse, setEmiResponse] = useState<any>(null)

//   const [ssrComponentKeys, setSSRComponentKeys] = useState<{
//     outbound: string
//     return: string
//     segments: Record<number, string>
//     internationalCombined: string // New for international combined
//   }>({
//     outbound: `outbound-${Date.now()}`,
//     return: `return-${Date.now()}`,
//     segments: {},
//     internationalCombined: `international-combined-${Date.now()}`,
//   })

//   useEffect(() => {
//     try {
//       if (location.state) {
//         const flightData = location.state.flight || null
//         const returnFlightData = location.state.returnFlight || null
//         const multiCitySelectedFlightsWithTraceIds = location.state.multiCitySelectedFlightsWithTraceIds || null
//         const isRoundTripBooking = location.state.isRoundTrip || false
//         const isMultiCityBooking = location.state.isMultiCity || false
//         const isInternationalCombinedRoundTrip = location.state.isInternationalCombinedRoundTrip || false
//         const combinedPrice = location.state.totalPrice || null
//         const prevFare = location.state.previousFare || null
//         const updFare = location.state.updatedFare || null
//         const showAlertFlag = location.state.showAlert || false
//         const validationInfoData = location.state.validationInfo || null
//         const selectedFareData = location.state.selectedFare || null

//         const storedSearchParams = localStorage.getItem("searchParams")
//         const parsedSearchParams = storedSearchParams ? JSON.parse(storedSearchParams) : {}

//         const searchParams = location.state.searchParams || parsedSearchParams

//         const initialPassengerCounts = {
//           adults: searchParams.passengers?.adults || searchParams.passengers || 1,
//           children: searchParams.passengers?.children || 0,
//           infants: searchParams.passengers?.infants || 0,
//         }
//         setPassengerCounts(initialPassengerCounts)

//         const totalPassengers =
//           initialPassengerCounts.adults + initialPassengerCounts.children + initialPassengerCounts.infants
//         const initialPassengersArray: IndividualPassenger[] = Array.from({ length: totalPassengers }, (_, index) => {
//           let type: "adult" | "child" | "infant" = "adult"
//           if (
//             index >= initialPassengerCounts.adults &&
//             index < initialPassengerCounts.adults + initialPassengerCounts.children
//           ) {
//             type = "child"
//           } else if (index >= initialPassengerCounts.adults + initialPassengerCounts.children) {
//             type = "infant"
//           }
//           return {
//             title: "Mr",
//             firstName: "",
//             middleName: "",
//             lastName: "",
//             gender: "",
//             dateOfBirth: "",
//             type: type,
//           }
//         })
//         setPassengersData(initialPassengersArray)

//         const actuallyRoundTrip = Boolean(
//           isRoundTripBooking &&
//             !isInternationalCombinedRoundTrip &&
//             returnFlightData &&
//             searchParams?.tripType === "round-trip",
//         )

//         const actuallyMultiCity = Boolean(
//           isMultiCityBooking && multiCitySelectedFlightsWithTraceIds && searchParams?.tripType === "multi-city",
//         )

//         const actuallyInternationalCombinedRoundTrip = Boolean(
//           isInternationalCombinedRoundTrip && flightData && searchParams?.tripType === "round-trip",
//         )

//         if (DEBUG) {
//           console.log("InternationalBookingPage validation:", {
//             searchTripType: searchParams?.tripType,
//             hasReturnFlight: !!returnFlightData,
//             hasMultiCityFlights: !!multiCitySelectedFlightsWithTraceIds,
//             isRoundTripFromState: location.state?.isRoundTrip,
//             isInternationalCombinedRoundTrip,
//             actuallyRoundTrip,
//             actuallyMultiCity,
//             actuallyInternationalCombinedRoundTrip,
//           })
//         }

//         setFlight(flightData)
//         setIsMultiCity(actuallyMultiCity)
//         setIsInternationalRoundTrip(actuallyInternationalCombinedRoundTrip)

//         if (actuallyRoundTrip) {
//           setReturnFlight(returnFlightData)
//           setIsRoundTrip(true)
//         } else if (actuallyInternationalCombinedRoundTrip) {
//           setReturnFlight(null) // For international combined, 'flight' holds both legs
//           setIsRoundTrip(true) // Treat as round-trip for general UI logic
//         } else {
//           setReturnFlight(null)
//           setIsRoundTrip(isRoundTripBooking)
//         }

//         setMultiCityFlights(actuallyMultiCity ? multiCitySelectedFlightsWithTraceIds : null)
//         setTotalPrice(combinedPrice)
//         setPreviousFare(prevFare)
//         setUpdatedFare(updFare)
//         setShowAlert(showAlertFlag)
//         setSelectedFare(selectedFareData)

//         if (validationInfoData) {
//           setValidationInfo(validationInfoData)
//         }

//         const newKeys = {
//           outbound: `outbound-${flightData?.ResultIndex || flightData?.SearchSegmentId || Date.now()}`,
//           return: `return-${returnFlightData?.ResultIndex || returnFlightData?.SearchSegmentId || Date.now()}`,
//           segments: {} as Record<number, string>,
//           internationalCombined: `international-combined-${flightData?.ResultIndex || Date.now()}`,
//         }

//         if (actuallyMultiCity && multiCitySelectedFlightsWithTraceIds) {
//           multiCitySelectedFlightsWithTraceIds.forEach((segmentData: MultiCityFlightSegmentData, index: number) => {
//             newKeys.segments[index] = `segment-${index}-${segmentData.resultIndex || Date.now()}`
//           })
//         }

//         setSSRComponentKeys(newKeys)

//         if (DEBUG) {
//           console.log("InternationalBookingPage final state (from useEffect):", {
//             isRoundTrip: actuallyRoundTrip || actuallyInternationalCombinedRoundTrip,
//             isInternationalRoundTrip: actuallyInternationalCombinedRoundTrip,
//             isMultiCity: actuallyMultiCity,
//             hasReturnFlight: !!returnFlightData || actuallyInternationalCombinedRoundTrip,
//             searchTripType: searchParams?.tripType,
//             ssrKeys: newKeys,
//             receivedMultiCityFlights: multiCitySelectedFlightsWithTraceIds,
//             finalFlightState: flightData,
//             finalReturnFlightState: actuallyInternationalCombinedRoundTrip ? flightData : returnFlightData,
//           })
//         }
//       }
//     } catch (err) {
//       console.error("Error loading flight data:", err)
//       setError("Failed to load flight details")
//     } finally {
//       setIsLoading(false)
//     }
//   }, [location.state])

//   const handleContinueBooking = () => {
//     setShowAlert(false)
//   }

//   const handleGoBack = () => {
//     navigate("/search-results")
//   }

//   useEffect(() => {
//     try {
//       const storedSearchParams = localStorage.getItem("searchParams")
//       const storedSessionId = localStorage.getItem("sessionId")
//       const storedTraceId = localStorage.getItem("traceId")

//       const newSearchParams =
//         location.state?.searchParams || (storedSearchParams ? JSON.parse(storedSearchParams) : null)
//       const newSessionId = location.state?.sessionId || storedSessionId
//       const newTraceId = location.state?.traceId || storedTraceId

//       setSearchParams(newSearchParams)
//       setSessionId(newSessionId)
//       setTraceIdState(newTraceId)
//     } catch (err) {
//       console.error("Error loading from localStorage:", err)
//     }
//   }, [location.state])

//   useEffect(() => {
//     if (flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
//       if (DEBUG) {
//         console.log("Flight departure time:", flight.OptionSegmentsInfo[0].DepartureTime)
//         console.log("Flight arrival time:", flight.OptionSegmentsInfo[0].ArrivalTime)
//         console.log("Parsed departure time:", parseDateString(flight.OptionSegmentsInfo[0].DepartureTime))
//         console.log("Parsed arrival time:", parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime))
//       }
//     }
//   }, [flight])

//   useEffect(() => {
//     addDatePickerStyles()
//   }, [])

//   const handleGeneralInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value, type, checked } = e.target
//     if (name === "email") setEmail(value)
//     else if (name === "mobile") setMobile(value)
//     else if (name === "receiveOffers") setReceiveOffers(checked)
//     else if (name === "promoCode") setPromoCode(value)
//   }

//   const handlePassengerInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
//     const { name, value } = e.target
//     setPassengersData((prev) => prev.map((pax, i) => (i === index ? { ...pax, [name]: value } : pax)))
//   }

//   const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name, value, type, checked } = e.target
//     setBookingOptions((prev) => ({
//       ...prev,
//       [name]: type === "checkbox" ? checked : value,
//     }))
//   }

//   const handleSSRSelect = useCallback((selectedOptions: any, totalPrice: number) => {
//     if (DEBUG) {
//       console.log("SSR Select - Outbound:", { selectedOptions, totalPrice })
//     }
//     setSelectedSSROptions((prev: any) => ({
//       ...prev,
//       outbound: selectedOptions,
//       return: prev.return,
//       segments: prev.segments,
//       internationalCombined: prev.internationalCombined,
//     }))
//     setSSRTotalPrice((prev) => ({
//       ...prev,
//       outbound: totalPrice,
//       total:
//         totalPrice +
//         prev.return +
//         prev.internationalCombined +
//         Object.values(prev.segments).reduce((sum: number, price: any) => sum + (price || 0), 0),
//     }))
//   }, [])

//   const handleSegmentSSRSelect = useCallback((segmentIndex: number, selectedOptions: any, totalPrice: number) => {
//     if (DEBUG) {
//       console.log(`SSR Select - Segment ${segmentIndex}:`, { selectedOptions, totalPrice })
//     }
//     setSelectedSSROptions((prev: any) => ({
//       ...prev,
//       segments: {
//         ...prev.segments,
//         [segmentIndex]: selectedOptions,
//       },
//     }))

//     setSSRTotalPrice((prev) => {
//       const newSegments = {
//         ...prev.segments,
//         [segmentIndex]: totalPrice,
//       }
//       const segmentsTotal = Object.values(newSegments).reduce((sum: number, price: any) => sum + (price || 0), 0)

//       return {
//         ...prev,
//         segments: newSegments,
//         total: prev.outbound + prev.return + prev.internationalCombined + segmentsTotal,
//       }
//     })
//   }, [])

//   const handleReturnSSRSelect = useCallback((selectedOptions: any, totalPrice: number) => {
//     if (DEBUG) {
//       console.log("SSR Select - Return:", { selectedOptions, totalPrice })
//     }
//     setSelectedSSROptions((prev: any) => ({ ...prev, return: selectedOptions }))
//     setSSRTotalPrice((prev) => ({
//       ...prev,
//       return: totalPrice,
//       total:
//         prev.outbound +
//         totalPrice +
//         prev.internationalCombined +
//         Object.values(prev.segments).reduce((sum: number, price: any) => sum + (price || 0), 0),
//     }))
//   }, [])

//   const handleOutboundSSRSelect = useCallback(
//     (options: any, price: number) => {
//       setSelectedSSROptions((prev: any) => ({ ...prev, outbound: options }))
//       setSSRTotalPrice((prev) => ({
//         ...prev,
//         outbound: price,
//         total:
//           price +
//           prev.return +
//           prev.internationalCombined +
//           Object.values(prev.segments).reduce((sum: number, segPrice: any) => sum + (segPrice || 0), 0),
//       }))
//     },
//     [setSelectedSSROptions, setSSRTotalPrice],
//   )

//   // New SSR handler for international combined flights
//   const handleInternationalCombinedSSRSelect = useCallback(
//     (selectedOptions: any, totalPrice: number) => {
//       if (DEBUG) {
//         console.log("SSR Select - International Combined:", { selectedOptions, totalPrice })
//       }
//       setSelectedSSROptions((prev: any) => ({
//         ...prev,
//         internationalCombined: selectedOptions,
//         outbound: prev.outbound,
//         return: prev.return,
//         segments: prev.segments,
//       }))
//       setSSRTotalPrice((prev) => ({
//         ...prev,
//         internationalCombined: totalPrice,
//         total:
//           prev.outbound +
//           prev.return +
//           totalPrice +
//           Object.values(prev.segments).reduce((sum: number, price: any) => sum + (price || 0), 0),
//       }))
//     },
//     [setSelectedSSROptions, setSSRTotalPrice],
//   )

//   const handleRefundableSelect = (isSelected: boolean, price: number) => {
//     if (DEBUG) {
//       console.log("RefundableBookingOption selection:", { isSelected, price })
//     }
//     setIsRefundableSelected(isSelected)
//     setRefundablePrice(price)
//   }

//   const handleEMISelect = (isSelected: boolean) => {
//     setIsEMISelected(isSelected)
//     setShowEMIForm(isSelected)
//   }

//   const handleProcessEMIPayment = async (
//     cardNumber: string,
//     mobileNumber: string,
//     tenure: string,
//     schemeId: string,
//   ) => {
//     if (!flight) return

//     setEmiProcessing(true)

//     try {
//       const requestId = EcomPaymentService.generateRequestId()
//       const orderNo = `FARECLUBS_${Date.now()}`
//       const totalAmount = totalPrice || Number(flight.OptionPriceInfo?.TotalPrice || 0)

//       const otpRequest = {
//         DEALERID: process.env.ECOM_DEALER_ID || "194",
//         VALIDATIONKEY: process.env.ECOM_VALIDATION_KEY || "6384075253966928",
//         REQUESTID: requestId,
//         CARDNUMBER: cardNumber,
//         MOBILENO: mobileNumber,
//         ORDERNO: orderNo,
//         LOANAMT: totalAmount.toFixed(2),
//         Tenure: tenure,
//         SchemeId: schemeId,
//         IPADDR: "192.168.1.1",
//         PIN: "411014",
//         PRODDESC: "Flight Booking",
//         REQUEST_DATE_TIME: EcomPaymentService.formatDateTime(),
//         RETURNURL: `${window.location.origin}/booking/emi-callback`,
//       }

//       const response = await EcomPaymentService.initiateOTP(otpRequest)
//       setEmiResponse(response)

//       if (response.RSPCODE === "0" || response.RSPCODE === "00") {
//         window.open(response.KFSURL, "_blank")

//         setTimeout(async () => {
//           const reQueryRequest = {
//             DEALERID: process.env.ECOM_DEALER_ID || "194",
//             REQID: EcomPaymentService.generateRequestId(),
//             VALKEY: process.env.ECOM_VALIDATION_KEY || "6384075253966928",
//             REQUERYID: requestId,
//             ACQCHNLID: "05",
//           }

//           const reQueryResponse = await EcomPaymentService.reQuery(reQueryRequest)

//           if (reQueryResponse.RESCODE === "0" || reQueryResponse.RESCODE === "00") {
//             const transactionStatus = reQueryResponse.ENQINFO[0]?.RSPCODE
//             if (transactionStatus === "0" || transactionStatus === "00") {
//               alert("EMI payment successful!")
//             } else {
//               alert("EMI payment failed. Please try again.")
//             }
//           } else {
//             alert("Failed to check payment status. Please contact support.")
//           }
//         }, 300000)
//       } else {
//         alert(`Failed to initiate EMI payment: ${response.RESPDESC}`)
//       }
//     } catch (error) {
//       console.error("Error processing EMI payment:", error)
//       alert("An error occurred while processing your EMI payment. Please try again.")
//     } finally {
//       setEmiProcessing(false)
//     }
//   }

//   const formatDateForApi = (dateStr: string) => {
//     try {
//       if (!dateStr || dateStr.trim() === "") {
//         return new Date().toISOString().split("T")[0] + "T00:00:00"
//       }
//       if (dateStr.includes("T")) {
//         return dateStr
//       }
//       const date = new Date(dateStr + "T00:00:00")
//       return date.toISOString().replace("Z", "")
//     } catch (error) {
//       console.error("Error formatting date:", error)
//       return new Date().toISOString().split("T")[0] + "T00:00:00"
//     }
//   }

//   const refreshSearchAndFindMatchingResult = useCallback(
//     async (
//       segmentToMatch: BookingPageProps["flight"],
//       currentTokenId: string,
//       currentTraceIdForSearch: string,
//       segmentIndex?: number,
//       isInternationalCombinedSearch = false,
//     ): Promise<{ newTraceId: string; newResultIndex: string }> => {
//       let firstLegToMatch: any
//       let lastLegToMatch: any
//       let oldNumSegments: number

//       if (
//         isInternationalCombinedSearch &&
//         segmentToMatch?.Segments &&
//         typeof segmentIndex === "number" &&
//         segmentToMatch.Segments[segmentIndex]?.length > 0
//       ) {
//         firstLegToMatch = segmentToMatch.Segments[segmentIndex][0]
//         lastLegToMatch = segmentToMatch.Segments[segmentIndex][segmentToMatch.Segments[segmentIndex].length - 1]
//         oldNumSegments = segmentToMatch.Segments[segmentIndex].length
//       } else if (segmentToMatch?.OptionSegmentsInfo && segmentToMatch.OptionSegmentsInfo.length > 0) {
//         firstLegToMatch = segmentToMatch.OptionSegmentsInfo[0]
//         lastLegToMatch = segmentToMatch.OptionSegmentsInfo[segmentToMatch.OptionSegmentsInfo.length - 1]
//         oldNumSegments = segmentToMatch.OptionSegmentsInfo.length
//       } else {
//         throw new Error("Flight segment data is missing or invalid for re-search matching.")
//       }

//       const storedSearchParams = JSON.parse(localStorage.getItem("searchParams") || "{}")

//       const totalAdults = passengerCounts.adults.toString()
//       const totalChildren = passengerCounts.children.toString()
//       const totalInfants = passengerCounts.infants.toString()

//       const oneWaySegmentRequest = {
//         EndUserIp: "192.168.1.1",
//         TokenId: currentTokenId,
//         AdultCount: totalAdults,
//         ChildCount: totalChildren,
//         InfantCount: totalInfants,
//         DirectFlight: storedSearchParams.directFlight ? "true" : "false",
//         OneStopFlight: "false",
//         JourneyType: "1",
//         Segments: [
//           {
//             Origin: firstLegToMatch.Origin.Airport.AirportCode,
//             Destination: lastLegToMatch.Destination.Airport.AirportCode,
//             FlightCabinClass: "1",
//             PreferredDepartureTime: formatDateForApi(firstLegToMatch.Origin.DepTime),
//             PreferredArrivalTime: formatDateForApi(lastLegToMatch.Destination.ArrTime),
//           },
//         ],
//         ResultFareType: storedSearchParams.resultFareType || null,
//         PreferredAirlines: storedSearchParams.preferredAirlines || null,
//         Sources: storedSearchParams.sources || null,
//       }

//       if (DEBUG) console.log("Re-search request for segment refresh:", oneWaySegmentRequest)

//       const searchResponse = await axios.post("http://localhost:5000/api/search", oneWaySegmentRequest, {
//         headers: { "Content-Type": "application/json", Accept: "application/json" },
//         timeout: 30000,
//       })

//       if (searchResponse.data?.Response?.ResponseStatus === 1 && searchResponse.data?.Response?.TraceId) {
//         const newTraceId = searchResponse.data.Response.TraceId
//         const newSearchResults = searchResponse.data.Response.Results || []
//         const resultsToSearch: any[] = newSearchResults.flat()

//         const oldOriginCode = firstLegToMatch.Origin.Airport.AirportCode
//         const oldDestinationCode = lastLegToMatch.Destination.Airport.AirportCode
//         const oldDepartureDate = format(parseDateString(firstLegToMatch.Origin.DepTime), "yyyy-MM-dd")

//         if (DEBUG) {
//           console.log("Target flight for re-match:", {
//             oldOriginCode,
//             oldDestinationCode,
//             oldDepartureDate,
//             oldNumSegments,
//             oldAirline: firstLegToMatch.Airline.AirlineCode,
//             oldFlightNumber: firstLegToMatch.FlightNumber,
//           })
//         }

//         let bestMatch: any = null
//         let bestMatchScore = -1

//         for (const newFlight of resultsToSearch) {
//           if (!newFlight || !newFlight.OptionSegmentsInfo || newFlight.OptionSegmentsInfo.length === 0) continue

//           const newFirstSegment = newFlight.OptionSegmentsInfo[0]
//           const newLastSegment = newFlight.OptionSegmentsInfo[newFlight.OptionSegmentsInfo.length - 1]

//           const newOriginCode = newFirstSegment.Origin.Airport.AirportCode
//           const newDestinationCode = newLastSegment.Destination.Airport.AirportCode
//           const newDepartureDate = format(parseDateString(newFirstSegment.Origin.DepTime), "yyyy-MM-dd")
//           const newNumSegments = newFlight.OptionSegmentsInfo.length

//           let currentScore = 0

//           const primaryMatch =
//             newOriginCode === oldOriginCode &&
//             newDestinationCode === oldDestinationCode &&
//             newDepartureDate === oldDepartureDate

//           if (DEBUG) {
//             console.log(`  Candidate newFlight (ResultIndex: ${newFlight.ResultIndex}):`, {
//               newOriginCode,
//               newDestinationCode,
//               newDepartureDate,
//               newNumSegments,
//               newAirline: newFirstSegment.Airline.AirlineCode,
//               newFlightNumber: newFirstSegment.FlightNumber,
//               primaryMatch,
//             })
//           }

//           if (primaryMatch) {
//             currentScore += 100

//             if (newNumSegments === oldNumSegments) {
//               currentScore += 50
//             } else {
//               currentScore -= Math.abs(newNumSegments - oldNumSegments) * 10
//             }

//             if (newFirstSegment.Airline.AirlineCode === firstLegToMatch.Airline.AirlineCode) {
//               currentScore += 20
//               if (newFirstSegment.FlightNumber === firstLegToMatch.FlightNumber) {
//                 currentScore += 10
//               }
//             }

//             const oldDepTime = parseDateString(firstLegToMatch.Origin.DepTime).getTime()
//             const newDepTime = parseDateString(newFirstSegment.Origin.DepTime).getTime()
//             const timeDifference = Math.abs(oldDepTime - newDepTime) / (1000 * 60)

//             if (timeDifference <= 60) {
//               currentScore += 5 - Math.floor(timeDifference / 10)
//             } else {
//               currentScore -= 5
//             }

//             if (currentScore > bestMatchScore) {
//               bestMatchScore = currentScore
//               bestMatch = newFlight
//               if (DEBUG) {
//                 console.log(`    New best match found with score: ${bestMatchScore}`)
//               }
//             }
//           }
//         }

//         if (bestMatch && bestMatch.ResultIndex) {
//           if (DEBUG) {
//             console.log(
//               `  Final best match found with new ResultIndex: ${bestMatch.ResultIndex}, Score: ${bestMatchScore}`,
//             )
//           }
//           return { newTraceId: newTraceId, newResultIndex: bestMatch.ResultIndex }
//         } else {
//           throw new Error("Could not find a suitable matching flight in fresh search results for retry.")
//         }
//       } else {
//         throw new Error("Failed to get fresh search results - missing TraceId or bad status in response")
//       }
//     },
//     [passengerCounts],
//   )

//   const retryApiCall = useCallback(
//     async <T,>(
//       apiFunction: (traceId: string, resultIndex: string) => Promise<T>,
//       segmentFlight: BookingPageProps["flight"],
//       segmentIndex: number | undefined,
//       initialTraceId: string,
//       initialResultIndex: string,
//       maxRetries = 3,
//       delay = 1000,
//     ): Promise<{ data: T; finalTraceId: string }> => {
//       let currentTraceId = initialTraceId
//       let currentResultIndex = initialResultIndex
//       let lastError: any

//       for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//           if (!currentTraceId) {
//             throw new Error("TraceId is missing before API call attempt.")
//           }
//           if (DEBUG) {
//             console.log(
//               `API call attempt ${attempt}/${maxRetries} for ResultIndex ${currentResultIndex} with TraceId: ${currentTraceId}`,
//             )
//           }
//           const result = await apiFunction(currentTraceId, currentResultIndex)
//           return { data: result, finalTraceId: currentTraceId }
//         } catch (error: any) {
//           console.error(`Attempt ${attempt} failed for ResultIndex ${currentResultIndex}:`, error)
//           lastError = error

//           const isTraceIdExpiredError =
//             error.response?.data?.Error?.ErrorCode === 5 || error.response?.data?.Response?.Error?.ErrorCode === 5

//           if (isTraceIdExpiredError && attempt < maxRetries) {
//             console.warn("TraceId expired. Attempting to refresh TraceId and retry...")
//             try {
//               const { newTraceId, newResultIndex } = await refreshSearchAndFindMatchingResult(
//                 segmentFlight,
//                 localStorage.getItem("tokenId") || "",
//                 currentTraceId,
//                 segmentIndex,
//                 isInternationalRoundTrip, // Pass the new flag
//               )
//               currentTraceId = newTraceId
//               if (typeof segmentIndex === "number" && multiCityFlights) {
//                 setMultiCityFlights(
//                   (prev) =>
//                     prev?.map((item, idx) => (idx === segmentIndex ? { ...item, traceId: newTraceId } : item)) || null,
//                 )
//               } else {
//                 setTraceIdState(newTraceId)
//               }
//               localStorage.setItem("traceId", newTraceId)
//               currentResultIndex = newResultIndex
//               console.log(`TraceId refreshed. New TraceId: ${newTraceId}, New ResultIndex: ${newResultIndex}`)
//               await new Promise((resolve) => setTimeout(resolve, delay))
//               delay *= 2
//               continue
//             } catch (refreshError) {
//               console.error("Failed to refresh TraceId:", refreshError)
//               throw new Error(
//                 `Failed to refresh session during retry: ${refreshError instanceof Error ? refreshError.message : "Unknown error"}`,
//               )
//             }
//           } else if (attempt < maxRetries) {
//             if (DEBUG) {
//               console.log(`Retrying in ${delay}ms...`)
//             }
//             await new Promise((resolve) => setTimeout(resolve, delay))
//             delay *= 2
//           }
//         }
//       }
//       throw lastError
//     },
//     [setTraceIdState, refreshSearchAndFindMatchingResult, multiCityFlights, isInternationalRoundTrip],
//   )

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()

//     console.log("=== BOOKING SUBMISSION STARTED ===")
//     console.log("Contact Email:", email)
//     console.log("Contact Mobile:", mobile)
//     console.log("Passengers Data:", passengersData)
//     console.log("Flight data (for one-way/domestic round-trip/international combined):", flight)
//     console.log("Multi-city flights (selected for booking):", multiCityFlights)
//     console.log("Is multi-city:", isMultiCity)
//     console.log("Is domestic round trip:", isRoundTrip && !isInternationalRoundTrip)
//     console.log("Is international round trip:", isInternationalRoundTrip)
//     console.log("Location state:", location.state)

//     if (!flight && (!isMultiCity || !multiCityFlights || multiCityFlights.length === 0)) {
//       console.error("VALIDATION ERROR: No flight data available")
//       setError("Flight details not available. Please try again.")
//       return
//     }

//     if (isMultiCity && (!multiCityFlights || multiCityFlights.length === 0)) {
//       console.error("VALIDATION ERROR: Multi-city selected but no multi-city flights available")
//       setError("Multi-city flight details not available. Please try again.")
//       return
//     }

//     if (
//       !isMultiCity &&
//       !isInternationalRoundTrip &&
//       (!flight || !flight.OptionSegmentsInfo || flight.OptionSegmentsInfo.length === 0 || !flight.OptionPriceInfo)
//     ) {
//       console.error("VALIDATION ERROR: Single/Domestic Round-trip flight data incomplete", {
//         hasFlight: !!flight,
//         hasSegments: !!flight?.OptionSegmentsInfo?.length,
//         hasPriceInfo: !!flight?.OptionPriceInfo,
//       })
//       setError("Flight details not available. Please try again.")
//       return
//     }

//     if (isInternationalRoundTrip && (!flight || !flight.Segments || flight.Segments.length < 2 || !flight.Fare)) {
//       console.error("VALIDATION ERROR: International Round-trip flight data incomplete", {
//         hasFlight: !!flight,
//         hasSegments: !!flight?.Segments?.length,
//         hasFare: !!flight?.Fare,
//       })
//       setError("International flight details not available. Please try again.")
//       return
//     }

//     if (!email || !mobile) {
//       console.error("VALIDATION ERROR: Missing contact details")
//       setError("Please fill in email and mobile number.")
//       return
//     }

//     const missingPassengerFields: string[] = []
//     passengersData.forEach((pax, index) => {
//       if (!pax.firstName || !pax.lastName || !pax.gender || !pax.dateOfBirth) {
//         missingPassengerFields.push(`Traveller ${index + 1}`)
//       }
//       if (validationInfo.isPassportRequiredAtBook && (!pax.passportNumber || !pax.passportExpiry || !pax.nationality)) {
//         missingPassengerFields.push(`Traveller ${index + 1} (Passport details)`)
//       }
//     })

//     if (missingPassengerFields.length > 0) {
//       console.error("VALIDATION ERROR: Missing required passenger fields:", missingPassengerFields)
//       setError(`Please fill in all required fields for: ${missingPassengerFields.join(", ")}`)
//       return
//     }

//     console.log("✓ All validations passed, proceeding with booking...")

//     try {
//       setIsLoading(true)
//       setError(null)

//       const tokenId = localStorage.getItem("tokenId") || ""

//       console.log("Tokens:", {
//         tokenId: tokenId ? "Present" : "Missing",
//         traceIdState: traceIdState
//           ? "Present (for non-multi-city/international combined)"
//           : "Not applicable (multi-city uses per-segment traceId)",
//       })

//       if (!tokenId) {
//         console.error("VALIDATION ERROR: Missing tokenId")
//         setError("Session expired. Please search for flights again.")
//         return
//       }

//       const preparedPassengersForAPI = passengersData.map((pax) =>
//         preparePassengerData(
//           {
//             title: pax.title,
//             firstName: pax.firstName,
//             lastName: pax.lastName,
//             gender: pax.gender,
//             mobile: mobile,
//             email: email,
//             dateOfBirth: pax.dateOfBirth,
//             addressLine1: "123 Main St",
//             city: "Mumbai",
//             countryCode: "IN",
//             nationality: pax.nationality || "IN",
//             gstNumber: bookingOptions.useGST ? bookingOptions.gstNumber : undefined,
//             type: pax.type,
//             passportNo: pax.passportNumber, // Pass passport details
//             passportExpiry: pax.passportExpiry,
//           },
//           flight?.OptionPriceInfo || { TotalPrice: "0", TotalBasePrice: "0", TotalTax: "0" },
//         ),
//       )

//       console.log("Prepared passengers for API:", preparedPassengersForAPI)

//       let baseAmount = 0
//       if (isMultiCity && multiCityFlights) {
//         baseAmount =
//           totalPrice ||
//           multiCityFlights.reduce((sum, segmentFlightData) => {
//             return sum + Number(segmentFlightData.flight?.OptionPriceInfo?.TotalPrice || 0)
//           }, 0)
//       } else if (isInternationalRoundTrip && flight?.Fare?.PublishedFare) {
//         baseAmount = totalPrice || flight.Fare.PublishedFare
//       } else {
//         baseAmount = totalPrice || Number(flight?.OptionPriceInfo?.TotalPrice || 0)
//       }

//       const totalAmount =
//         baseAmount + ssrTotalPrice.total + (isRefundableSelected ? refundablePrice : 0) + convenienceFee // Add convenience fee to total amount for payment

//       console.log("Calculated amounts:", {
//         baseAmount,
//         ssrTotal: ssrTotalPrice.total,
//         refundablePrice,
//         convenienceFee,
//         totalAmount,
//       })

//       let finalBookingReference = ""
//       let finalBookingId: number | string = ""

//       const allTicketResponses: any[] = []

//       if (isMultiCity) {
//         console.log("=== PROCESSING MULTI-CITY BOOKING ===")

//         if (!multiCityFlights || multiCityFlights.length === 0) {
//           throw new Error("No multi-city flights available for booking")
//         }

//         for (let i = 0; i < multiCityFlights.length; i++) {
//           const segmentData = multiCityFlights[i]
//           const segmentFlight = segmentData.flight
//           let currentTraceIdForSegment = segmentData.traceId
//           const currentResultIndexForSegment = segmentData.resultIndex

//           console.log(`\n--- Processing Segment ${i + 1} ---`)
//           console.log(`Segment ${i + 1} initial TraceId:`, currentTraceIdForSegment)
//           console.log(`Segment ${i + 1} initial ResultIndex:`, currentResultIndexForSegment)

//           if (!segmentFlight || !segmentFlight.OptionSegmentsInfo || !segmentFlight.OptionPriceInfo) {
//             throw new Error(`Segment ${i + 1} has incomplete data`)
//           }

//           let currentBookingId = 0
//           let currentPNR = ""

//           const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
//             (traceId, resultIndex) => getFareQuote(tokenId, traceId, resultIndex),
//             segmentFlight,
//             i,
//             currentTraceIdForSegment,
//             currentResultIndexForSegment,
//           )
//           currentTraceIdForSegment = updatedTraceIdAfterFareQuote

//           if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
//             throw new Error(
//               `Failed to get updated pricing for segment ${i + 1}: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
//             )
//           }

//           const updatedResultIndexFromFareQuote = fareQuoteResponse.Response.Results.ResultIndex
//           const isLCCSegment = fareQuoteResponse.Response.Results.IsLCC || false
//           console.log(`Segment ${i + 1} updated ResultIndex from FareQuote:`, updatedResultIndexFromFareQuote)
//           console.log(`Segment ${i + 1} isLCC:`, isLCCSegment)

//           if (!isLCCSegment) {
//             console.log(`Segment ${i + 1} is Non-LCC. Calling Book API...`)
//             const bookRequest = {
//               EndUserIp: "192.168.10.10",
//               TokenId: tokenId,
//               TraceId: currentTraceIdForSegment,
//               ResultIndex: updatedResultIndexFromFareQuote,
//               Passengers: preparedPassengersForAPI,
//             }
//             const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
//               (traceId, resultIndex) =>
//                 createBooking({
//                   ...bookRequest,
//                   TraceId: traceId,
//                   ResultIndex: resultIndex,
//                 }),
//               segmentFlight,
//               i,
//               currentTraceIdForSegment,
//               updatedResultIndexFromFareQuote,
//             )
//             currentTraceIdForSegment = updatedTraceIdAfterBook

//             if (bookResponse.Error || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
//               throw new Error(
//                 `Failed to book segment ${i + 1}: ${bookResponse.Error?.ErrorMessage || "Unknown booking error"}`,
//               )
//             }
//             currentBookingId = bookResponse.Response.BookingId
//             currentPNR = bookResponse.Response.PNR
//             console.log(`Segment ${i + 1} booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
//           }

//           const { data: segmentTicketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
//             (traceId, resultIndex) =>
//               handleTicketingProcess(
//                 currentBookingId,
//                 currentPNR,
//                 tokenId,
//                 traceId,
//                 isLCCSegment,
//                 resultIndex,
//                 preparedPassengersForAPI,
//               ),
//             segmentFlight,
//             i,
//             currentTraceIdForSegment,
//             updatedResultIndexFromFareQuote,
//           )
//           currentTraceIdForSegment = updatedTraceIdAfterTicket

//           const isSuccess =
//             segmentTicketResponse.Response?.ResponseStatus === 1 ||
//             segmentTicketResponse.Response?.Response?.Status === 1 ||
//             (segmentTicketResponse.Response && segmentTicketResponse.Response.ResponseStatus !== 3)

//           if (isSuccess) {
//             console.log(`✓ Segment ${i + 1} ticketed successfully`)
//             allTicketResponses.push(segmentTicketResponse)
//             if (!finalBookingReference && segmentTicketResponse.Response?.Response?.FlightItinerary?.PNR) {
//               finalBookingReference = segmentTicketResponse.Response.Response.FlightItinerary.PNR
//             }
//             if (!finalBookingId && segmentTicketResponse.Response?.Response?.FlightItinerary?.BookingId) {
//               finalBookingId = segmentTicketResponse.Response.Response.FlightItinerary.BookingId
//             }
//           } else {
//             const errorMessage =
//               segmentTicketResponse.Response?.Error?.ErrorMessage ||
//               segmentTicketResponse.Error?.ErrorMessage ||
//               "Ticketing failed - invalid response"
//             throw new Error(`Segment ${i + 1} ticketing failed: ${errorMessage}`)
//           }
//         }
//       } else if (isInternationalRoundTrip) {
//         console.log("=== PROCESSING INTERNATIONAL ROUND-TRIP BOOKING ===")
//         if (!flight || !flight.ResultIndex || !flight.Fare) {
//           throw new Error("International flight details missing for booking.")
//         }

//         const originalResultIndex = flight.ResultIndex
//         console.log("International Round-trip initial ResultIndex:", originalResultIndex)

//         if (!traceIdState) {
//           throw new Error("TraceId is missing for international round-trip booking.")
//         }

//         let currentTraceIdForInternational = traceIdState

//         const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
//           (traceId, resultIndex) => getFareQuote(tokenId, traceId, originalResultIndex),
//           flight,
//           undefined,
//           currentTraceIdForInternational,
//           originalResultIndex,
//           true, // Indicate international combined search
//         )
//         currentTraceIdForInternational = updatedTraceIdAfterFareQuote
//         setTraceIdState(updatedTraceIdAfterFareQuote)

//         if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
//           throw new Error(
//             `Failed to get updated pricing for international flight: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
//           )
//         }

//         const updatedResultIndex = fareQuoteResponse.Response.Results.ResultIndex
//         const isLCCFlight = fareQuoteResponse.Response.Results.IsLCC || false
//         console.log("International Round-trip updated ResultIndex from FareQuote:", updatedResultIndex)
//         console.log("International Round-trip isLCC:", isLCCFlight)

//         let currentBookingId = 0
//         let currentPNR = ""

//         if (!isLCCFlight) {
//           console.log("International Round-trip is Non-LCC. Calling Book API...")
//           const bookRequest = {
//             EndUserIp: "192.168.10.10",
//             TokenId: tokenId,
//             TraceId: currentTraceIdForInternational,
//             ResultIndex: updatedResultIndex,
//             Passengers: preparedPassengersForAPI,
//           }
//           const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
//             (traceId, resultIndex) =>
//               createBooking({
//                 ...bookRequest,
//                 TraceId: traceId,
//                 ResultIndex: resultIndex,
//               }),
//             flight,
//             undefined,
//             currentTraceIdForInternational,
//             updatedResultIndex,
//             true,
//           )
//           currentTraceIdForInternational = updatedTraceIdAfterBook
//           setTraceIdState(updatedTraceIdAfterBook)

//           if (bookResponse.Error || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
//             throw new Error(
//               `Failed to book international flight: ${bookResponse.Error?.ErrorMessage || "Unknown booking error"}`,
//             )
//           }
//           currentBookingId = bookResponse.Response.BookingId
//           currentPNR = bookResponse.Response.PNR
//           console.log(`International Round-trip booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
//         }

//         const { data: ticketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
//           (traceId, resultIndex) =>
//             handleTicketingProcess(
//               currentBookingId,
//               currentPNR,
//               tokenId,
//               traceId,
//               isLCCFlight,
//               resultIndex,
//               preparedPassengersForAPI,
//             ),
//           flight,
//           undefined,
//           currentTraceIdForInternational,
//           updatedResultIndex,
//           true,
//         )
//         setTraceIdState(updatedTraceIdAfterTicket)

//         const isSuccess =
//           ticketResponse.Response?.ResponseStatus === 1 ||
//           ticketResponse.Response?.Response?.Status === 1 ||
//           (ticketResponse.Response && ticketResponse.Response.ResponseStatus !== 3)

//         if (!isSuccess) {
//           const errorMessage =
//             ticketResponse.Response?.Error?.ErrorMessage ||
//             ticketResponse.Error?.ErrorMessage ||
//             "Ticketing failed - invalid response"
//           throw new Error(`International Round-trip ticketing failed: ${errorMessage}`)
//         }
//         allTicketResponses.push(ticketResponse)
//         finalBookingReference = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.PNR
//         finalBookingId = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.BookingId
//       } else if (isRoundTrip) {
//         console.log("=== PROCESSING DOMESTIC ROUND-TRIP BOOKING ===")
//         if (!flight || !returnFlight) {
//           throw new Error("Outbound or return flight details missing for domestic round-trip booking.")
//         }

//         const processFlightLeg = async (
//           legFlight: BookingPageProps["flight"],
//           legName: string,
//           originalResultIndex: string,
//           initialLegTraceId: string,
//         ) => {
//           console.log(`\n--- Processing ${legName} Flight ---`)
//           console.log(`${legName} initial ResultIndex:`, originalResultIndex)

//           let currentTraceIdForLeg = initialLegTraceId
//           const currentResultIndexForLeg = originalResultIndex

//           const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
//             (traceId, resultIndex) => getFareQuote(tokenId, traceId, resultIndex),
//             legFlight,
//             undefined,
//             currentTraceIdForLeg,
//             currentResultIndexForLeg,
//           )
//           currentTraceIdForLeg = updatedTraceIdAfterFareQuote
//           setTraceIdState(updatedTraceIdAfterFareQuote)

//           if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
//             throw new Error(
//               `Failed to get updated pricing for ${legName} flight: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
//             )
//           }

//           const updatedResultIndex = fareQuoteResponse.Response.Results.ResultIndex
//           const isLCCLeg = fareQuoteResponse.Response.Results.IsLCC || false
//           console.log(`${legName} updated ResultIndex from FareQuote:`, updatedResultIndex)
//           console.log(`${legName} isLCC:`, isLCCLeg)

//           let currentBookingId = 0
//           let currentPNR = ""

//           if (!isLCCLeg) {
//             console.log(`${legName} is Non-LCC. Calling Book API...`)
//             const bookRequest = {
//               EndUserIp: "192.168.10.10",
//               TokenId: tokenId,
//               TraceId: currentTraceIdForLeg,
//               ResultIndex: updatedResultIndex,
//               Passengers: preparedPassengersForAPI,
//             }
//             const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
//               (traceId, resultIndex) =>
//                 createBooking({
//                   ...bookRequest,
//                   TraceId: traceId,
//                   ResultIndex: resultIndex,
//                 }),
//               legFlight,
//               undefined,
//               currentTraceIdForLeg,
//               updatedResultIndex,
//             )
//             currentTraceIdForLeg = updatedTraceIdAfterBook
//             setTraceIdState(updatedTraceIdAfterBook)

//             if (bookResponse.Error || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
//               throw new Error(
//                 `Failed to book ${legName} flight: ${bookResponse.Error?.ErrorMessage || "Unknown booking error"}`,
//               )
//             }
//             currentBookingId = bookResponse.Response.BookingId
//             currentPNR = bookResponse.Response.PNR
//             console.log(`${legName} booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
//           }

//           const { data: ticketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
//             (traceId, resultIndex) =>
//               handleTicketingProcess(
//                 currentBookingId,
//                 currentPNR,
//                 tokenId,
//                 traceId,
//                 isLCCLeg,
//                 resultIndex,
//                 preparedPassengersForAPI,
//               ),
//             legFlight,
//             undefined,
//             currentTraceIdForLeg,
//             updatedResultIndex,
//           )
//           setTraceIdState(updatedTraceIdAfterTicket)

//           const isSuccess =
//             ticketResponse.Response?.ResponseStatus === 1 ||
//             ticketResponse.Response?.Response?.Status === 1 ||
//             (ticketResponse.Response && ticketResponse.Response.ResponseStatus !== 3)

//           if (isSuccess) {
//             console.log(`✓ ${legName} ticketed successfully`)
//             allTicketResponses.push(ticketResponse)
//             if (!finalBookingReference && ticketResponse.Response?.Response?.FlightItinerary?.PNR) {
//               finalBookingReference = ticketResponse.Response.Response.FlightItinerary.PNR
//             }
//             if (!finalBookingId && ticketResponse.Response?.Response?.FlightItinerary?.BookingId) {
//               finalBookingId = ticketResponse.Response.Response.FlightItinerary.BookingId
//             }
//           } else {
//             const errorMessage =
//               ticketResponse.Response?.Error?.ErrorMessage ||
//               ticketResponse.Error?.ErrorMessage ||
//               "Ticketing failed - invalid response"
//             throw new Error(`${legName} ticketing failed: ${errorMessage}`)
//           }
//         }

//         await processFlightLeg(
//           flight,
//           "Outbound",
//           (location.state?.outboundResultIndex || flight.SearchSegmentId?.toString() || "").toString(),
//           location.state?.traceId || localStorage.getItem("traceId") || "",
//         )

//         await processFlightLeg(
//           returnFlight,
//           "Return",
//           (location.state?.returnResultIndex || returnFlight.SearchSegmentId?.toString() || "").toString(),
//           traceIdState || localStorage.getItem("traceId") || "",
//         )
//       } else {
//         console.log("=== PROCESSING ONE-WAY BOOKING ===")
//         if (!flight) {
//           throw new Error("Flight details missing for one-way booking.")
//         }

//         const originalResultIndex = (location.state?.resultIndex || flight.SearchSegmentId?.toString() || "").toString()
//         console.log("One-way initial ResultIndex:", originalResultIndex)

//         if (!traceIdState) {
//           throw new Error("TraceId is missing for one-way booking.")
//         }

//         let currentTraceIdForOneWay = traceIdState

//         const { data: fareQuoteResponse, finalTraceId: updatedTraceIdAfterFareQuote } = await retryApiCall(
//           (traceId, resultIndex) => getFareQuote(tokenId, traceId, originalResultIndex),
//           flight,
//           undefined,
//           currentTraceIdForOneWay,
//           originalResultIndex,
//         )
//         currentTraceIdForOneWay = updatedTraceIdAfterFareQuote
//         setTraceIdState(updatedTraceIdAfterFareQuote)

//         if (fareQuoteResponse.Error || !fareQuoteResponse.Response?.Results) {
//           throw new Error(
//             `Failed to get updated pricing for one-way flight: ${fareQuoteResponse.Error?.ErrorMessage || "Unknown error"}`,
//           )
//         }

//         const updatedResultIndex = fareQuoteResponse.Response.Results.ResultIndex
//         const isLCCFlight = fareQuoteResponse.Response.Results.IsLCC || false
//         console.log("One-way updated ResultIndex from FareQuote:", updatedResultIndex)
//         console.log("One-way isLCC:", isLCCFlight)

//         let currentBookingId = 0
//         let currentPNR = ""

//         if (!isLCCFlight) {
//           console.log("One-way is Non-LCC. Calling Book API...")
//           const bookRequest = {
//             EndUserIp: "192.168.10.10",
//             TokenId: tokenId,
//             TraceId: currentTraceIdForOneWay,
//             ResultIndex: updatedResultIndex,
//             Passengers: preparedPassengersForAPI,
//           }
//           const { data: bookResponse, finalTraceId: updatedTraceIdAfterBook } = await retryApiCall(
//             (traceId, resultIndex) =>
//               createBooking({
//                 ...bookRequest,
//                 TraceId: traceId,
//                 ResultIndex: resultIndex,
//               }),
//             flight,
//             undefined,
//             currentTraceIdForOneWay,
//             updatedResultIndex,
//           )
//           currentTraceIdForOneWay = updatedTraceIdAfterBook
//           setTraceIdState(updatedTraceIdAfterBook)

//           if (bookResponse.Error || !bookResponse.Response?.PNR || !bookResponse.Response?.BookingId) {
//             throw new Error(
//               `Failed to book one-way flight: ${bookResponse.Error?.ErrorMessage || "Unknown booking error"}`,
//             )
//           }
//           currentBookingId = bookResponse.Response.BookingId
//           currentPNR = bookResponse.Response.PNR
//           console.log(`One-way booked. PNR: ${currentPNR}, BookingId: ${currentBookingId}`)
//         }

//         const { data: ticketResponse, finalTraceId: updatedTraceIdAfterTicket } = await retryApiCall(
//           (traceId, resultIndex) =>
//             handleTicketingProcess(
//               currentBookingId,
//               currentPNR,
//               tokenId,
//               traceId,
//               isLCCFlight,
//               resultIndex,
//               preparedPassengersForAPI,
//             ),
//           flight,
//           undefined,
//           currentTraceIdForOneWay,
//           updatedResultIndex,
//         )
//         setTraceIdState(updatedTraceIdAfterTicket)

//         const isSuccess =
//           ticketResponse.Response?.ResponseStatus === 1 ||
//           ticketResponse.Response?.Response?.Status === 1 ||
//           (ticketResponse.Response && ticketResponse.Response.ResponseStatus !== 3)

//         if (!isSuccess) {
//           const errorMessage =
//             ticketResponse.Response?.Error?.ErrorMessage ||
//             ticketResponse.Error?.ErrorMessage ||
//             "Ticketing failed - invalid response"
//           throw new Error(`One-way ticketing failed: ${errorMessage}`)
//         }
//         allTicketResponses.push(ticketResponse)
//         finalBookingReference = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.PNR
//         finalBookingId = allTicketResponses[0]?.Response?.Response?.FlightItinerary?.BookingId
//       }

//       console.log("✓ All segments/flights processed successfully")
//       console.log("Navigating to confirmation...")

//       navigate("/booking/confirmation", {
//         state: {
//           bookingReference: finalBookingReference,
//           bookingId: finalBookingId,
//           totalAmount,
//           flight,
//           returnFlight,
//           multiCityFlights,
//           isMultiCity,
//           isRoundTrip,
//           isInternationalRoundTrip, // Pass this new flag
//           isRefundableSelected,
//           refundablePrice,
//           ssrOptions: selectedSSROptions,
//           ssrTotalPrice,
//           customerDetails: { email, mobile, receiveOffers, promoCode },
//           passengersData,
//           allTicketResponses,
//         },
//       })
//     } catch (err) {
//       console.error("EXCEPTION in handleSubmit:", err)
//       const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
//       setError(`Booking submission failed: ${errorMessage}`)
//     } finally {
//       console.log("=== BOOKING SUBMISSION ENDED ===")
//       setIsLoading(false)
//     }
//   }

//   useEffect(() => {
//     console.log("=== BOOKING PAGE STATE DEBUG ===")
//     console.log("isMultiCity:", isMultiCity)
//     console.log("multiCityFlights:", multiCityFlights)
//     if (multiCityFlights) {
//       multiCityFlights.forEach((segmentData, index) => {
//         console.log(`  multiCityFlights[${index}]:`, segmentData)
//         if (segmentData.flight?.OptionSegmentsInfo?.[0]) {
//           console.log(
//             `    Route: ${segmentData.flight.OptionSegmentsInfo[0].DepartureAirport} -> ${segmentData.flight.OptionSegmentsInfo[0].ArrivalAirport}`,
//           )
//         }
//       })
//     }
//     console.log("flight:", flight)
//     console.log("isRoundTrip:", isRoundTrip)
//     console.log("isInternationalRoundTrip:", isInternationalRoundTrip)
//     console.log("returnFlight:", returnFlight)
//     console.log("totalPrice:", totalPrice)
//     console.log("location.state:", location.state)
//     console.log("traceIdState:", traceIdState)
//     console.log("================================")
//   }, [
//     isMultiCity,
//     multiCityFlights,
//     flight,
//     isRoundTrip,
//     returnFlight,
//     totalPrice,
//     location.state,
//     traceIdState,
//     isInternationalRoundTrip,
//   ])

//   const convenienceFee = 149.0

//   const handleBackToResults = () => {
//     const storedSearchParams: string | null = localStorage.getItem("searchParams")
//     let storedSessionId: string | null = localStorage.getItem("sessionId")
//     const storedMultiCityRawResponses: string | null = localStorage.getItem("multiCityRawResponses")
//     const storedTraceId: string | null = localStorage.getItem("traceId")

//     let parsedSearchParams = storedSearchParams ? JSON.parse(storedSearchParams) : null
//     let initialSearchShouldBeTriggered = false

//     if (
//       !parsedSearchParams ||
//       (parsedSearchParams.tripType === "multi-city" && !storedMultiCityRawResponses) ||
//       (parsedSearchParams.tripType !== "multi-city" && !storedTraceId)
//     ) {
//       initialSearchShouldBeTriggered = true
//       if (!parsedSearchParams && flight) {
//         let fromAirport = ""
//         let toAirport = ""
//         let departureDate = ""
//         let multiCityTrips: any[] = []

//         if (isInternationalRoundTrip && flight.Segments && flight.Segments.length > 0) {
//           fromAirport = flight.Segments[0][0].Origin.Airport.AirportCode
//           toAirport = flight.Segments[0][flight.Segments[0].length - 1].Destination.Airport.AirportCode
//           departureDate = flight.Segments[0][0].Origin.DepTime.split("T")[0]
//           multiCityTrips = [
//             {
//               from: flight.Segments[0][0].Origin.Airport.AirportCode,
//               to: flight.Segments[0][flight.Segments[0].length - 1].Destination.Airport.AirportCode,
//               date: flight.Segments[0][0].Origin.DepTime.split("T")[0],
//             },
//             {
//               from: flight.Segments[1][0].Origin.Airport.AirportCode,
//               to: flight.Segments[1][flight.Segments[1].length - 1].Destination.Airport.AirportCode,
//               date: flight.Segments[1][0].Origin.DepTime.split("T")[0],
//             },
//           ]
//         } else if (flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
//           fromAirport = flight.OptionSegmentsInfo[0].DepartureAirport
//           toAirport = flight.OptionSegmentsInfo[0].ArrivalAirport
//           departureDate = flight.OptionSegmentsInfo[0].DepartureTime.split(",")[0]
//         }

//         parsedSearchParams = {
//           from: fromAirport,
//           to: toAirport,
//           date: departureDate,
//           passengers: passengerCounts.adults + passengerCounts.children + passengerCounts.infants,
//           tripType: isMultiCity
//             ? "multi-city"
//             : isInternationalRoundTrip
//               ? "round-trip"
//               : isRoundTrip
//                 ? "round-trip"
//                 : "one-way",
//           multiCityTrips: multiCityTrips,
//         }
//         localStorage.setItem("searchParams", JSON.stringify(parsedSearchParams))
//       }
//     }

//     if (!storedSessionId) {
//       storedSessionId = sessionId || "default-session"
//       localStorage.setItem("sessionId", storedSessionId)
//     }

//     navigate("/search-results", {
//       state: {
//         searchParams: parsedSearchParams,
//         sessionId: storedSessionId!,
//         traceId: storedTraceId, // Still pass global traceId for one-way/round-trip context
//         shouldSearch: initialSearchShouldBeTriggered, // Control if SearchResults re-runs search
//         returnFromBooking: true,
//       },
//     })
//   }


//   const renderValidationWarnings = () => {
//     if (!validationInfo) return null

//     const warnings = []

//     if (validationInfo.isGSTMandatory) {
//       warnings.push("GST details are mandatory for this booking.")
//     }

//     if (validationInfo.isPanRequiredAtBook) {
//       warnings.push("PAN card details are required at the time of booking.")
//     }

//     if (validationInfo.isPassportRequiredAtBook) {
//       const missingPassport = passengersData.some((pax) => !pax.passportNumber || !pax.passportExpiry)
//       if (missingPassport) {
//         warnings.push("Passport details are required at the time of booking for all travelers.")
//       }
//     }

//     if (!validationInfo.isRefundable) {
//       warnings.push("This fare is non-refundable.")
//     }

//     if (warnings.length === 0) return null

//     return (
//       <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
//         <h3 className="text-sm font-medium text-yellow-800 mb-2">Important Information</h3>
//         <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
//           {warnings.map((warning, index) => (
//             <li key={index}>{warning}</li>
//           ))}
//         </ul>
//       </div>
//          )
//   }
    

//   const renderItineraryDetails = () => {
//     const hasFlightData = flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0
//     const hasReturnFlightData =
//       isRoundTrip &&
//       !isInternationalRoundTrip &&
//       returnFlight &&
//       returnFlight.OptionSegmentsInfo &&
//       returnFlight.OptionSegmentsInfo.length > 0
//     const hasMultiCityData = isMultiCity && multiCityFlights && multiCityFlights.length > 0
//     const hasInternationalRoundTripData = isInternationalRoundTrip && flight?.Segments && flight.Segments.length >= 2

//     if (DEBUG) {
//       console.log("renderItineraryDetails validation:", {
//         hasFlightData,
//         hasReturnFlightData,
//         hasMultiCityData,
//         hasInternationalRoundTripData,
//         isRoundTrip,
//         isMultiCity,
//         isInternationalRoundTrip,
//       })
//       if (hasMultiCityData) {
//         multiCityFlights?.forEach((segmentData, index) => {
//           console.log(`  Rendering Segment ${index + 1} details:`, segmentData)
//           if (segmentData.flight?.OptionSegmentsInfo?.[0]) {
//             console.log(
//               `    Route: ${segmentData.flight.OptionSegmentsInfo[0].DepartureAirport} -> ${segmentData.flight.OptionSegmentsInfo[0].ArrivalAirport}`,
//             )
//           }
//         })
//       }
//       if (hasInternationalRoundTripData) {
//         console.log("  Rendering International Round Trip details. Outbound:", flight?.Segments?.[0])
//         console.log("  Rendering International Round Trip details. Return:", flight?.Segments?.[1])
//       }
//     }

//     if (!hasFlightData && !hasMultiCityData && !hasInternationalRoundTripData) {
//       return (
//         <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
//           <div className="text-center py-8">
//             <p className="text-gray-500">No flight details available to display</p>
//           </div>
//         </div>
//       )
//     }

//     return (
//       <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-lg font-semibold">Itinerary Details</h2>
//           <button
//             onClick={() => setShowFlightDetails(!showFlightDetails)}
//             className="px-4 py-2 bg-[#007AFF] text-white rounded-md hover:bg-[#007aff]"
//           >
//             {showFlightDetails ? "Hide Detail" : "Flight Detail"}
//           </button>
//         </div>
//         <div className="flex justify-end mb-6">
//           {isMultiCity ? (
//             <div className="flex flex-wrap gap-2">
//               {multiCityFlights &&
//                 multiCityFlights.map((segmentData, index) => (
//                   <button
//                     key={index}
//                     onClick={() => {
//                       setShowFareRulesModal(true)
//                       setActiveFareRulesFlight(index)
//                     }}
//                     className="px-3 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50 text-sm"
//                   >
//                     Segment {index + 1} Fare Rules
//                   </button>
//                 ))}
//             </div>
//           ) : isRoundTrip && (hasFlightData || hasInternationalRoundTripData) ? (
//             <div className="flex space-x-4">
//               <button
//                 onClick={() => {
//                   setShowFareRulesModal(true)
//                   setActiveFareRulesFlight("outbound")
//                 }}
//                 className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
//               >
//                 View Outbound Fare Rules
//               </button>
//               <button
//                 onClick={() => {
//                   setShowFareRulesModal(true)
//                   setActiveFareRulesFlight("return")
//                 }}
//                 className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
//               >
//                 View Return Fare Rules
//               </button>
//             </div>
//           ) : (
//             <button
//               onClick={() => setShowFareRulesModal(true)}
//               className="px-4 py-2 border border-[#007AFF] text-[#007AFF] rounded-md hover:bg-blue-50"
//             >
//               View Fare Rules
//             </button>
//           )}
//         </div>
//         {renderValidationWarnings()}
//         {error && (
//           <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//             <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center">
//               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
//                 <path
//                   fillRule="evenodd"
//                   d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
//                   clipRule="evenodd"
//                 />
//               </svg>
//               Error
//             </h3>
//             <p className="text-sm text-red-700">{error}</p>
//             <div className="mt-3">
//               <button onClick={() => setError(null)} className="text-sm text-red-600 hover:text-red-800 font-medium">
//                 Dismiss
//               </button>
//               <button
//                 onClick={handleSubmit}
//                 className="ml-4 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-medium"
//               >
//                 Retry
//               </button>
//             </div>
//           </div>
//         )}

//         {showFlightDetails ? (
//           <div className="space-y-6">
//             {/* Multi-city Flights */}
//             {isMultiCity &&
//               multiCityFlights &&
//               multiCityFlights.map((segmentData, index) => {
//                 const segmentFlight = segmentData.flight
//                 if (
//                   !segmentFlight ||
//                   !segmentFlight.OptionSegmentsInfo ||
//                   segmentFlight.OptionSegmentsInfo.length === 0
//                 ) {
//                   return null
//                 }

//                 const firstLeg = segmentFlight.OptionSegmentsInfo[0]
//                 const lastLeg = segmentFlight.OptionSegmentsInfo[segmentFlight.OptionSegmentsInfo.length - 1]
//                 const numStops = segmentFlight.OptionSegmentsInfo.length - 1

//                 return (
//                   <React.Fragment key={index}>
//                     <div className="flex items-center gap-2 text-sm">
//                       <div className="bg-[#007aff] rounded-full p-2">
//                         <svg
//                           className="w-5 h-5 text-white"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                           stroke="currentColor"
//                           strokeWidth="2"
//                         >
//                           <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
//                         </svg>
//                       </div>
//                       <div>
//                         <div className="font-medium">
//                           Segment {index + 1} : {format(parseDateString(firstLeg.DepartureTime), "EEE, dd MMM yyyy")}
//                         </div>
//                         <div className="text-gray-600">
//                           {firstLeg.DepartureAirport} - {lastLeg.ArrivalAirport}
//                           {numStops > 0 && ` (${numStops} Stop${numStops > 1 ? "s" : ""})`}
//                         </div>
//                       </div>
//                     </div>

//                     <div className="border rounded-lg p-4 space-y-6">
//                       {segmentFlight.OptionSegmentsInfo.map((subSegment, subIndex) => (
//                         <React.Fragment key={subIndex}>
//                           {subIndex > 0 && (
//                             <div className="flex items-center justify-center py-2">
//                               <div className="w-px h-8 bg-gray-300"></div>
//                               <div className="mx-4 text-sm text-gray-500">Layover at {subSegment.DepartureAirport}</div>
//                               <div className="w-px h-8 bg-gray-300"></div>
//                             </div>
//                           )}
//                           <div className="flex items-start justify-between mb-4">
//                             <div className="flex items-center gap-4">
//                               <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
//                                 <AirlineLogo airlineCode={subSegment.MarketingAirline} size="md" />
//                               </div>
//                               <div>
//                                 <div className="font-medium">
//                                   {subSegment.MarketingAirline}, {subSegment.FlightNumber}
//                                 </div>
//                                 <div className="text-sm text-gray-500">
//                                   <svg
//                                     className="w-4 h-4 inline-block mr-1"
//                                     viewBox="0 0 24 24"
//                                     fill="none"
//                                     stroke="currentColor"
//                                     strokeWidth="2"
//                                   >
//                                     <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
//                                   </svg>
//                                   {subSegment.Baggage || "N/A"} Check-in, {subSegment.CabinBaggage || "N/A"} handbag
//                                 </div>
//                               </div>
//                             </div>
//                           </div>

//                           <div className="relative mt-6">
//                             <div className="flex items-center justify-between">
//                               <div className="flex-1">
//                                 <div className="text-3xl font-bold mb-1">
//                                   {format(parseDateString(subSegment.DepartureTime), "HH:mm")}
//                                 </div>
//                                 <div className="space-y-1">
//                                   <div className="font-medium">{subSegment.DepartureAirport}</div>
//                                   <div className="text-sm text-gray-600">Terminal - 1</div>
//                                 </div>
//                               </div>

//                               <div className="flex-1 px-8">
//                                 <div className="flex items-center justify-center mb-2">
//                                   <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
//                                     <AirlineLogo airlineCode={subSegment.MarketingAirline} size="md" />
//                                   </div>
//                                 </div>
//                                 <div className="text-center">
//                                   <div className="font-medium text-sm">
//                                     {subSegment.MarketingAirline}, {subSegment.FlightNumber}
//                                   </div>
//                                 </div>
//                               </div>

//                               <div className="flex-1 text-right">
//                                 <div className="text-3xl font-bold mb-1">
//                                   {format(parseDateString(subSegment.ArrivalTime), "HH:mm")}
//                                 </div>
//                                 <div className="space-y-1">
//                                   <div className="font-medium">{subSegment.ArrivalAirport}</div>
//                                   <div className="text-sm text-gray-600">Terminal - 1</div>
//                                 </div>
//                               </div>
//                             </div>

//                             <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
//                               <div className="flex items-center gap-1">
//                                 <svg
//                                   className="w-4 h-4"
//                                   viewBox="0 0 24 24"
//                                   fill="none"
//                                   stroke="currentColor"
//                                   strokeWidth="2"
//                                 >
//                                   <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
//                                   <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
//                                 </svg>
//                                 Economy
//                               </div>
//                             </div>
//                           </div>
//                         </React.Fragment>
//                       ))}
//                     </div>
//                   </React.Fragment>
//                 )
//               })}

//             {/* Domestic Round Trip / One-Way Flights */}
//             {!isMultiCity &&
//               !isInternationalRoundTrip &&
//               flight &&
//               flight.OptionSegmentsInfo &&
//               flight.OptionSegmentsInfo.length > 0 && (
//                 <>
//                   <div className="flex items-center gap-2 text-sm">
//                     <div className="bg-[#007aff] rounded-full p-2">
//                       <svg
//                         className="w-5 h-5 text-white"
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="2"
//                       >
//                         <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
//                       </svg>
//                     </div>
//                     <div>
//                       <div className="font-medium">
//                         Outbound Flight :{" "}
//                         {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "EEE, dd MMM yyyy")}
//                       </div>
//                       <div className="text-gray-600">
//                         {flight.OptionSegmentsInfo[0].DepartureAirport} - {flight.OptionSegmentsInfo[0].ArrivalAirport}
//                       </div>
//                     </div>
//                   </div>

//                   <div className="border rounded-lg p-4">
//                     <div className="flex items-start justify-between mb-4">
//                       <div className="flex items-center gap-4">
//                         <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
//                           <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
//                         </div>
//                         <div>
//                           <div className="font-medium">
//                             {flight.OptionSegmentsInfo[0].MarketingAirline}, {flight.OptionSegmentsInfo[0].FlightNumber}
//                           </div>
//                           <div className="text-sm text-gray-500">
//                             <svg
//                               className="w-4 h-4 inline-block mr-1"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="currentColor"
//                               strokeWidth="2"
//                             >
//                               <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
//                             </svg>
//                             {flight.OptionSegmentsInfo[0].Baggage || "N/A"} Check-in,{" "}
//                             {flight.OptionSegmentsInfo[0].CabinBaggage || "N/A"} handbag
//                           </div>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="relative mt-6">
//                       <div className="flex items-center justify-between">
//                         <div className="flex-1">
//                           <div className="text-3xl font-bold mb-1">
//                             {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
//                           </div>
//                           <div className="space-y-1">
//                             <div className="font-medium">{flight.OptionSegmentsInfo[0].DepartureAirport}</div>
//                             <div className="text-sm text-gray-600">Terminal - 1</div>
//                           </div>
//                         </div>

//                         <div className="flex-1 px-8">
//                           <div className="flex items-center justify-center mb-2">
//                             <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
//                               <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
//                             </div>
//                           </div>
//                           <div className="text-center">
//                             <div className="font-medium text-sm">
//                               {flight.OptionSegmentsInfo[0].MarketingAirline},{" "}
//                               {flight.OptionSegmentsInfo[0].FlightNumber}
//                             </div>
//                           </div>
//                         </div>

//                         <div className="flex-1 text-right">
//                           <div className="text-3xl font-bold mb-1">
//                             {format(parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
//                           </div>
//                           <div className="space-y-1">
//                             <div className="font-medium">{flight.OptionSegmentsInfo[0].ArrivalAirport}</div>
//                             <div className="text-sm text-gray-600">Terminal - 1</div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
//                         <div className="flex items-center gap-1">
//                           <svg
//                             className="w-4 h-4"
//                             viewBox="0 0 24 24"
//                             fill="none"
//                             stroke="currentColor"
//                             strokeWidth="2"
//                           >
//                             <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
//                             <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
//                           </svg>
//                           Economy
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </>
//               )}

//             {/* Domestic Return Flight */}
//             {isRoundTrip &&
//               !isInternationalRoundTrip &&
//               returnFlight &&
//               returnFlight.OptionSegmentsInfo &&
//               returnFlight.OptionSegmentsInfo.length > 0 && (
//                 <>
//                   <div className="flex items-center gap-2 text-sm mt-6">
//                     <div className="bg-[#eb0066] rounded-full p-2">
//                       <svg
//                         className="w-5 h-5 text-white"
//                         viewBox="0 0 24 24"
//                         fill="none"
//                         stroke="currentColor"
//                         strokeWidth="2"
//                       >
//                         <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
//                       </svg>
//                     </div>
//                     <div>
//                       <div className="font-medium">
//                         Return Flight :{" "}
//                         {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "EEE, dd MMM yyyy")}
//                       </div>
//                       <div className="text-gray-600">
//                         {returnFlight.OptionSegmentsInfo[0].DepartureAirport} -{" "}
//                         {returnFlight.OptionSegmentsInfo[0].ArrivalAirport}
//                       </div>
//                     </div>
//                   </div>

//                   <div className="border rounded-lg p-4">
//                     <div className="flex items-start justify-between mb-4">
//                       <div className="flex items-center gap-4">
//                         <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
//                           <AirlineLogo airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline} size="md" />
//                         </div>
//                         <div>
//                           <div className="font-medium">
//                             {returnFlight.OptionSegmentsInfo[0].MarketingAirline},{" "}
//                             {returnFlight.OptionSegmentsInfo[0].FlightNumber}
//                           </div>
//                           <div className="text-sm text-gray-500">
//                             <svg
//                               className="w-4 h-4 inline-block mr-1"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="currentColor"
//                               strokeWidth="2"
//                             >
//                               <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
//                             </svg>
//                             {returnFlight.OptionSegmentsInfo[0].Baggage || "N/A"} Check-in,{" "}
//                             {returnFlight.OptionSegmentsInfo[0].CabinBaggage || "N/A"} handbag
//                           </div>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="relative mt-6">
//                       <div className="flex items-center justify-between">
//                         <div className="flex-1">
//                           <div className="text-3xl font-bold mb-1">
//                             {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
//                           </div>
//                           <div className="space-y-1">
//                             <div className="font-medium">{returnFlight.OptionSegmentsInfo[0].DepartureAirport}</div>
//                             <div className="text-sm text-gray-600">Terminal - 1</div>
//                           </div>
//                         </div>

//                         <div className="flex-1 px-8">
//                           <div className="flex items-center justify-center mb-2">
//                             <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
//                               <AirlineLogo
//                                 airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline}
//                                 size="md"
//                               />
//                             </div>
//                           </div>
//                           <div className="text-center">
//                             <div className="font-medium text-sm">
//                               {returnFlight.OptionSegmentsInfo[0].MarketingAirline},{" "}
//                               {returnFlight.OptionSegmentsInfo[0].FlightNumber}
//                             </div>
//                           </div>
//                         </div>

//                         <div className="flex-1 text-right">
//                           <div className="text-3xl font-bold mb-1">
//                             {format(parseDateString(returnFlight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
//                           </div>
//                           <div className="space-y-1">
//                             <div className="font-medium">{returnFlight.OptionSegmentsInfo[0].ArrivalAirport}</div>
//                             <div className="text-sm text-gray-600">Terminal - 1</div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
//                         <div className="flex items-center gap-1">
//                           <svg
//                             className="w-4 h-4"
//                             viewBox="0 0 24 24"
//                             fill="none"
//                             stroke="currentColor"
//                             strokeWidth="2"
//                           >
//                             <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
//                             <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
//                           </svg>
//                           Economy
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </>
//               )}

//             {/* International Round Trip */}
//             {isInternationalRoundTrip && flight && flight.Segments && flight.Segments.length >= 2 && (
//               <>
//                 {/* Outbound Flight */}
//                 <div className="flex items-center gap-2 text-sm">
//                   <div className="bg-[#007aff] rounded-full p-2">
//                     <svg
//                       className="w-5 h-5 text-white"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="currentColor"
//                       strokeWidth="2"
//                     >
//                       <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="font-medium">
//                       Outbound Flight :{" "}
//                       {format(parseDateString(flight.Segments[0][0].Origin.DepTime), "EEE, dd MMM yyyy")}
//                     </div>
//                     <div className="text-gray-600">
//                       {flight.Segments[0][0].Origin.Airport.AirportCode} -{" "}
//                       {flight.Segments[0][flight.Segments[0].length - 1].Destination.Airport.AirportCode}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="border rounded-lg p-4 space-y-6">
//                   {flight.Segments[0].map((segment, index) => (
//                     <React.Fragment key={index}>
//                       {index > 0 && (
//                         <div className="flex items-center justify-center py-2">
//                           <div className="w-px h-8 bg-gray-300"></div>
//                           <div className="mx-4 text-sm text-gray-500">Layover at {segment.Origin.Airport.CityName}</div>
//                           <div className="w-px h-8 bg-gray-300"></div>
//                         </div>
//                       )}
//                       <div className="flex items-start justify-between mb-4">
//                         <div className="flex items-center gap-4">
//                           <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
//                             <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
//                           </div>
//                           <div>
//                             <div className="font-medium">
//                               {segment.Airline.AirlineName}, {segment.FlightNumber}
//                             </div>
//                             <div className="text-sm text-gray-500">
//                               <svg
//                                 className="w-4 h-4 inline-block mr-1"
//                                 viewBox="0 0 24 24"
//                                 fill="none"
//                                 stroke="currentColor"
//                                 strokeWidth="2"
//                               >
//                                 <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
//                               </svg>
//                               {segment.Baggage || "N/A"} Check-in, {segment.CabinBaggage || "N/A"} handbag
//                             </div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="relative mt-6">
//                         <div className="flex items-center justify-between">
//                           <div className="flex-1">
//                             <div className="text-3xl font-bold mb-1">
//                               {format(parseDateString(segment.Origin.DepTime), "HH:mm")}
//                             </div>
//                             <div className="space-y-1">
//                               <div className="font-medium">{segment.Origin.Airport.AirportCode}</div>
//                               <div className="text-sm text-gray-600">{segment.Origin.Airport.Terminal}</div>
//                             </div>
//                           </div>

//                           <div className="flex-1 px-8">
//                             <div className="flex items-center justify-center mb-2">
//                               <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
//                                 <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
//                               </div>
//                             </div>
//                             <div className="text-center">
//                               <div className="font-medium text-sm">
//                                 {segment.Airline.AirlineName}, {segment.FlightNumber}
//                               </div>
//                             </div>
//                           </div>

//                           <div className="flex-1 text-right">
//                             <div className="text-3xl font-bold mb-1">
//                               {format(parseDateString(segment.Destination.ArrTime), "HH:mm")}
//                             </div>
//                             <div className="space-y-1">
//                               <div className="font-medium">{segment.Destination.Airport.AirportCode}</div>
//                               <div className="text-sm text-gray-600">{segment.Destination.Airport.Terminal}</div>
//                             </div>
//                           </div>
//                         </div>

//                         <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
//                           <div className="flex items-center gap-1">
//                             <svg
//                               className="w-4 h-4"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="currentColor"
//                               strokeWidth="2"
//                             >
//                               <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
//                               <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
//                             </svg>
//                             Economy
//                           </div>
//                         </div>
//                       </div>
//                     </React.Fragment>
//                   ))}
//                 </div>

//                 {/* Return Flight */}
//                 <div className="flex items-center gap-2 text-sm mt-6">
//                   <div className="bg-[#eb0066] rounded-full p-2">
//                     <svg
//                       className="w-5 h-5 text-white"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="currentColor"
//                       strokeWidth="2"
//                     >
//                       <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
//                     </svg>
//                   </div>
//                   <div>
//                     <div className="font-medium">
//                       Return Flight :{" "}
//                       {format(parseDateString(flight.Segments[1][0].Origin.DepTime), "EEE, dd MMM yyyy")}
//                     </div>
//                     <div className="text-gray-600">
//                       {flight.Segments[1][0].Origin.Airport.AirportCode} -{" "}
//                       {flight.Segments[1][flight.Segments[1].length - 1].Destination.Airport.AirportCode}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="border rounded-lg p-4 space-y-6">
//                   {flight.Segments[1].map((segment, index) => (
//                     <React.Fragment key={index}>
//                       {index > 0 && (
//                         <div className="flex items-center justify-center py-2">
//                           <div className="w-px h-8 bg-gray-300"></div>
//                           <div className="mx-4 text-sm text-gray-500">Layover at {segment.Origin.Airport.CityName}</div>
//                           <div className="w-px h-8 bg-gray-300"></div>
//                         </div>
//                       )}
//                       <div className="flex items-start justify-between mb-4">
//                         <div className="flex items-center gap-4">
//                           <div className="w-12 h-12 bg-white rounded border flex items-center justify-center">
//                             <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
//                           </div>
//                           <div>
//                             <div className="font-medium">
//                               {segment.Airline.AirlineName}, {segment.FlightNumber}
//                             </div>
//                             <div className="text-sm text-gray-500">
//                               <svg
//                                 className="w-4 h-4 inline-block mr-1"
//                                 viewBox="0 0 24 24"
//                                 fill="none"
//                                 stroke="currentColor"
//                                 strokeWidth="2"
//                               >
//                                 <path d="M20 8h-9m9 4h-9m9 4h-9M4 8h1m-1 4h1m-1 4h1" />
//                               </svg>
//                               {segment.Baggage || "N/A"} Check-in, {segment.CabinBaggage || "N/A"} handbag
//                             </div>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="relative mt-6">
//                         <div className="flex items-center justify-between">
//                           <div className="flex-1">
//                             <div className="text-3xl font-bold mb-1">
//                               {format(parseDateString(segment.Origin.DepTime), "HH:mm")}
//                             </div>
//                             <div className="space-y-1">
//                               <div className="font-medium">{segment.Origin.Airport.AirportCode}</div>
//                               <div className="text-sm text-gray-600">{segment.Origin.Airport.Terminal}</div>
//                             </div>
//                           </div>

//                           <div className="flex-1 px-8">
//                             <div className="flex items-center justify-center mb-2">
//                               <div className="w-12 h-12 bg-white rounded-lg border flex items-center justify-center">
//                                 <AirlineLogo airlineCode={segment.Airline.AirlineCode} size="md" />
//                               </div>
//                             </div>
//                             <div className="text-center">
//                               <div className="font-medium text-sm">
//                                 {segment.Airline.AirlineName}, {segment.FlightNumber}
//                               </div>
//                             </div>
//                           </div>

//                           <div className="flex-1 text-right">
//                             <div className="text-3xl font-bold mb-1">
//                               {format(parseDateString(segment.Destination.ArrTime), "HH:mm")}
//                             </div>
//                             <div className="space-y-1">
//                               <div className="font-medium">{segment.Destination.Airport.AirportCode}</div>
//                               <div className="text-sm text-gray-600">{segment.Destination.Airport.Terminal}</div>
//                             </div>
//                           </div>
//                         </div>

//                         <div className="absolute right-0 top-0 -mt-6 flex items-center gap-4 text-sm text-gray-600">
//                           <div className="flex items-center gap-1">
//                             <svg
//                               className="w-4 h-4"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="currentColor"
//                               strokeWidth="2"
//                             >
//                               <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
//                               <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
//                             </svg>
//                             Economy
//                           </div>
//                         </div>
//                       </div>
//                     </React.Fragment>
//                   ))}
//                 </div>
//               </>
//             )}

//             <div className="mt-8 text-sm text-gray-500 border-t pt-4">
//               The baggage information is just for reference. Please Check with airline before check-in. For more
//               information, visit the airline's official website.
//             </div>
//           </div>
//         ) : (
//           <div>
//             {/* Collapsed view for multi-city flights */}
//             {isMultiCity &&
//               multiCityFlights &&
//               multiCityFlights.map((segmentData, index) => {
//                 const segmentFlight = segmentData.flight
//                 if (!segmentFlight || !segmentFlight.OptionSegmentsInfo || !segmentFlight.OptionSegmentsInfo[0]) {
//                   return null
//                 }
//                 const firstLeg = segmentFlight.OptionSegmentsInfo[0]
//                 const lastLeg = segmentFlight.OptionSegmentsInfo[segmentFlight.OptionSegmentsInfo.length - 1]

//                 return (
//                   <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
//                     <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
//                       <AirlineLogo airlineCode={firstLeg.MarketingAirline} size="lg" />
//                     </div>
//                     <div className="flex-1">
//                       <div className="flex justify-between items-start">
//                         <div>
//                           <p className="font-medium">
//                             {firstLeg.MarketingAirline} {firstLeg.FlightNumber}
//                           </p>
//                           <p className="text-sm text-gray-600">
//                             {firstLeg.DepartureAirport} - {lastLeg.ArrivalAirport}
//                           </p>
//                         </div>
//                         <div className="text-right">
//                           <p className="font-medium">{format(parseDateString(firstLeg.DepartureTime), "HH:mm")}</p>
//                           <p className="text-sm text-gray-600">
//                             {segmentFlight.OptionSegmentsInfo.length > 1
//                               ? `${segmentFlight.OptionSegmentsInfo.length - 1} Stop${segmentFlight.OptionSegmentsInfo.length - 1 > 1 ? "s" : ""}`
//                               : "Non-Stop"}
//                           </p>
//                           <p className="font-medium">{format(parseDateString(lastLeg.ArrivalTime), "HH:mm")}</p>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 )
//               })}

//             {/* Collapsed view for domestic one-way/round-trip outbound flight */}
//             {!isMultiCity &&
//               !isInternationalRoundTrip &&
//               flight &&
//               flight.OptionSegmentsInfo &&
//               flight.OptionSegmentsInfo.length > 0 && (
//                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
//                   <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
//                     <AirlineLogo airlineCode={flight.OptionSegmentsInfo[0].MarketingAirline} size="lg" />
//                   </div>
//                   <div className="flex-1">
//                     <div className="flex justify-between items-start">
//                       <div>
//                         <p className="font-medium">
//                           {flight.OptionSegmentsInfo[0].MarketingAirline} {flight.OptionSegmentsInfo[0].FlightNumber}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {flight.OptionSegmentsInfo[0].DepartureAirport} -{" "}
//                           {flight.OptionSegmentsInfo[0].ArrivalAirport}
//                         </p>
//                       </div>
//                       <div className="text-right">
//                         <p className="font-medium">
//                           {format(parseDateString(flight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
//                         </p>
//                         <p className="text-sm text-gray-600">Non-Stop</p>
//                         <p className="font-medium">
//                           {format(parseDateString(flight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}

//             {/* Collapsed view for domestic round-trip return flight */}
//             {isRoundTrip &&
//               !isInternationalRoundTrip &&
//               returnFlight &&
//               returnFlight.OptionSegmentsInfo &&
//               returnFlight.OptionSegmentsInfo.length > 0 && (
//                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
//                   <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
//                     <AirlineLogo airlineCode={returnFlight.OptionSegmentsInfo[0].MarketingAirline} size="lg" />
//                   </div>
//                   <div className="flex-1">
//                     <div className="flex justify-between items-start">
//                       <div>
//                         <p className="font-medium">
//                           {returnFlight.OptionSegmentsInfo[0].MarketingAirline}{" "}
//                           {returnFlight.OptionSegmentsInfo[0].FlightNumber}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {returnFlight.OptionSegmentsInfo[0].DepartureAirport} -{" "}
//                           {returnFlight.OptionSegmentsInfo[0].ArrivalAirport}
//                         </p>
//                       </div>
//                       <div className="text-right">
//                         <p className="font-medium">
//                           {format(parseDateString(returnFlight.OptionSegmentsInfo[0].DepartureTime), "HH:mm")}
//                         </p>
//                         <p className="text-sm text-gray-600">Non-Stop</p>
//                         <p className="font-medium">
//                           {format(parseDateString(returnFlight.OptionSegmentsInfo[0].ArrivalTime), "HH:mm")}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}

//             {/* Collapsed view for International Round Trip */}
//             {isInternationalRoundTrip && flight && flight.Segments && flight.Segments.length >= 2 && (
//               <>
//                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
//                   <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
//                     <AirlineLogo airlineCode={flight.Segments[0][0].Airline.AirlineCode} size="lg" />
//                   </div>
//                   <div className="flex-1">
//                     <div className="flex justify-between items-start">
//                       <div>
//                         <p className="font-medium">
//                           {flight.Segments[0][0].Airline.AirlineName} {flight.Segments[0][0].FlightNumber}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {flight.Segments[0][0].Origin.Airport.AirportCode} -{" "}
//                           {flight.Segments[0][flight.Segments[0].length - 1].Destination.Airport.AirportCode}
//                         </p>
//                       </div>
//                       <div className="text-right">
//                         <p className="font-medium">
//                           {format(parseDateString(flight.Segments[0][0].Origin.DepTime), "HH:mm")}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {flight.Segments[0].length > 1
//                             ? `${flight.Segments[0].length - 1} Stop${flight.Segments[0].length - 1 > 1 ? "s" : ""}`
//                             : "Non-Stop"}
//                         </p>
//                         <p className="font-medium">
//                           {format(
//                             parseDateString(flight.Segments[0][flight.Segments[0].length - 1].Destination.ArrTime),
//                             "HH:mm",
//                           )}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
//                   <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
//                     <AirlineLogo airlineCode={flight.Segments[1][0].Airline.AirlineCode} size="lg" />
//                   </div>
//                   <div className="flex-1">
//                     <div className="flex justify-between items-start">
//                       <div>
//                         <p className="font-medium">
//                           {flight.Segments[1][0].Airline.AirlineName} {flight.Segments[1][0].FlightNumber}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {flight.Segments[1][0].Origin.Airport.AirportCode} -{" "}
//                           {flight.Segments[1][flight.Segments[1].length - 1].Destination.Airport.AirportCode}
//                         </p>
//                       </div>
//                       <div className="text-right">
//                         <p className="font-medium">
//                           {format(parseDateString(flight.Segments[1][0].Origin.DepTime), "HH:mm")}
//                         </p>
//                         <p className="text-sm text-gray-600">
//                           {flight.Segments[1].length > 1
//                             ? `${flight.Segments[1].length - 1} Stop${flight.Segments[1].length - 1 > 1 ? "s" : ""}`
//                             : "Non-Stop"}
//                         </p>
//                         <p className="font-medium">
//                           {format(
//                             parseDateString(flight.Segments[1][flight.Segments[1].length - 1].Destination.ArrTime),
//                             "HH:mm",
//                           )}
//                         </p>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </>
//             )}
//           </div>
//         )}
//       </div>
//     )
//   }

//   const renderSelectedFareDetails = () => {
//     if (!flight?.SelectedFare && !selectedFare) return null

//     const fare = flight?.SelectedFare || selectedFare

//     return (
//       <div className="bg-white rounded-lg shadow p-6 mb-6">
//         <h2 className="text-lg font-semibold mb-4">Selected Fare: {fare.name}</h2>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div>
//             <h3 className="font-medium mb-2 text-[#007aff]">Baggage</h3>
//             <div className="space-y-2">
//               <div className="flex items-start">
//                 <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                 <span className="text-sm">{fare.baggage.cabinBaggage} Cabin Baggage</span>
//               </div>
//               <div className="flex items-start">
//                 <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                 <span className="text-sm">{fare.baggage.checkInBaggage} Check-in Baggage</span>
//               </div>
//             </div>
//           </div>

//           <div>
//             <h3 className="font-medium mb-2 text-[#007aff]">Flexibility</h3>
//             <div className="space-y-2">
//               <div className="flex items-start">
//                 <div className="w-4 h-4 mr-2 flex-shrink-0" />
//                 <span className="text-sm">{fare.flexibility.cancellationFee}</span>
//               </div>
//               <div className="flex items-start">
//                 <div className="w-4 h-4 mr-2 flex-shrink-0" />
//                 <span className="text-sm">{fare.flexibility.dateChangeFee}</span>
//               </div>
//             </div>
//           </div>

//           <div>
//             <h3 className="font-medium mb-2 text-[#007aff]">Seats & Meals</h3>
//             <div className="space-y-2">
//               <div className="flex items-start">
//                 {fare.seats.free ? (
//                   <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                 ) : (
//                   <div className="w-4 h-4 mr-2 flex-shrink-0" />
//                 )}
//                 <span className="text-sm">{fare.seats.free ? "Free Seats" : "Chargeable Seats"}</span>
//               </div>
//               <div className="flex items-start">
//                 {fare.seats.complimentaryMeals ? (
//                   <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                 ) : (
//                   <div className="w-4 h-4 mr-2 flex-shrink-0" />
//                 )}
//                 <span className="text-sm">
//                   {fare.seats.complimentaryMeals ? "Complimentary Meals" : "Chargeable Meals"}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {(fare.benefits.priorityCheckIn ||
//             fare.benefits.priorityBoarding ||
//             fare.benefits.expressCheckIn ||
//             fare.benefits.extraBaggage) && (
//             <div>
//               <h3 className="font-medium mb-2 text-[#007aff]">Exclusive Benefits</h3>
//               <div className="space-y-2">
//                 {fare.benefits.expressCheckIn && (
//                   <div className="flex items-start">
//                     <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                     <span className="text-sm">Express Check-In</span>
//                   </div>
//                 )}
//                 {fare.benefits.priorityBoarding && (
//                   <div className="flex items-start">
//                     <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                     <span className="text-sm">Priority Boarding</span>
//                   </div>
//                 )}
//                 {fare.benefits.priorityCheckIn && (
//                   <div className="flex items-start">
//                     <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                     <span className="text-sm">Priority Check-In</span>
//                   </div>
//                 )}
//                 {fare.benefits.extraBaggage && (
//                   <div className="flex items-start">
//                     <Check className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
//                     <span className="text-sm">Extra {fare.benefits.extraBaggage} Baggage</span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     )
//   }

//   const calculateRefundablePrice = () => {
//     if (DEBUG) {
//       console.log("Calculating refundable price with:", {
//         isRoundTrip,
//         isMultiCity,
//         isInternationalRoundTrip,
//         totalPrice,
//         flightPrice: flight?.OptionPriceInfo?.TotalPrice,
//         returnFlightPrice: returnFlight?.OptionPriceInfo?.TotalPrice,
//         multiCityFlights: multiCityFlights?.length,
//         internationalFare: flight?.Fare?.PublishedFare,
//       })
//     }

//     if (isInternationalRoundTrip && flight?.Fare?.PublishedFare) {
//       const calculatedTotal = totalPrice || flight.Fare.PublishedFare
//       if (DEBUG) {
//         console.log("International round-trip refundable price:", calculatedTotal)
//       }
//       return calculatedTotal
//     } else if (isRoundTrip && returnFlight && returnFlight.OptionPriceInfo) {
//       const calculatedTotal =
//         totalPrice ||
//         Number(flight?.OptionPriceInfo?.TotalPrice || 0) + Number(returnFlight.OptionPriceInfo?.TotalPrice || 0)

//       if (DEBUG) {
//         console.log("Domestic round-trip refundable price:", calculatedTotal)
//       }
//       return calculatedTotal
//     } else if (isMultiCity && multiCityFlights && multiCityFlights.length > 0) {
//       const calculatedTotal =
//         totalPrice ||
//         multiCityFlights.reduce((sum, segmentFlightData) => {
//           return sum + Number(segmentFlightData.flight?.OptionPriceInfo?.TotalPrice || 0)
//         }, 0)

//       if (DEBUG) {
//         console.log("Multi-city refundable price:", calculatedTotal)
//       }
//       return calculatedTotal
//     } else {
//       const calculatedTotal = totalPrice || Number(flight?.OptionPriceInfo?.TotalPrice || 0)

//       if (DEBUG) {
//         console.log("One-way refundable price:", calculatedTotal)
//       }
//       return calculatedTotal
//     }
//   }

//   const calculateStartDate = () => {
//     if (isInternationalRoundTrip && flight?.Segments && flight.Segments.length > 0) {
//       const firstSegmentOfOutbound = flight.Segments[0][0]
//       if (firstSegmentOfOutbound && firstSegmentOfOutbound.Origin?.DepTime) {
//         const startDate = parseDateString(firstSegmentOfOutbound.Origin.DepTime)
//         if (DEBUG) {
//           console.log("Calculated start date (international combined):", startDate)
//         }
//         return startDate
//       }
//     } else if (isMultiCity && multiCityFlights && multiCityFlights.length > 0) {
//       const firstSegmentFlight = multiCityFlights[0].flight
//       if (
//         firstSegmentFlight &&
//         firstSegmentFlight.OptionSegmentsInfo &&
//         firstSegmentFlight.OptionSegmentsInfo.length > 0
//       ) {
//         const startDate = parseDateString(firstSegmentFlight.OptionSegmentsInfo[0].DepartureTime)
//         if (DEBUG) {
//           console.log("Calculated start date (multi-city):", startDate)
//         }
//         return startDate
//       }
//     } else if (flight && flight.OptionSegmentsInfo && flight.OptionSegmentsInfo.length > 0) {
//       const startDate = parseDateString(flight.OptionSegmentsInfo[0].DepartureTime)
//       if (DEBUG) {
//         console.log("Calculated start date (domestic single/round-trip):", startDate)
//       }
//       return startDate
//     }

//     if (DEBUG) {
//       console.log("Using fallback start date (current date)")
//     }
//     return new Date()
//   }

//   if (isLoading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#007aff] mx-auto mb-4"></div>
//           <h2 className="text-xl font-medium">Loading flight details...</h2>
//         </div>
//       </div>
//     )
//   }

//   if (error) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="text-center bg-red-50 p-8 rounded-lg max-w-md">
//           <div className="text-red-500 text-5xl mb-4">⚠️</div>
//           <h1 className="text-2xl font-bold mb-4">Error Loading Flight Details</h1>
//           <p className="text-gray-600 mb-6">{error}</p>
//           <Link to="/" className="text-[#007aff] hover:text-[#007aff] font-medium">
//             Return to search
//           </Link>
//         </div>
//       </div>
//     )
//   }

//   if (!flight && !isMultiCity && (!multiCityFlights || multiCityFlights.length === 0)) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         <div className="text-center">
//           <h1 className="text-2xl font-bold mb-4">No flight details available</h1>
//           <Link to="/" className="text-[#007aff] hover:text-[#007aff]">
//             Return to search
//           </Link>
//         </div>
//       </div>
//     )
//   }

//   const totalAmountBasedOnLoadedData =
//     isMultiCity && multiCityFlights
//       ? multiCityFlights.reduce((sum, item) => sum + Number(item.flight?.OptionPriceInfo?.TotalPrice || 0), 0)
//       : isInternationalRoundTrip && flight?.Fare?.PublishedFare
//         ? flight.Fare.PublishedFare
//         : flight && flight.OptionPriceInfo
//           ? Number(flight.OptionPriceInfo.TotalPrice)
//           : 0

//   if (DEBUG) {
//     console.log("About to render RefundableBookingOption with:", {
//       totalPrice: calculateRefundablePrice(),
//       startDate: calculateStartDate(),
//       isRoundTrip,
//       isMultiCity,
//       isInternationalRoundTrip,
//     })
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <Header />
//       {showAlert && previousFare && updatedFare && (
//         <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
//           <div className="bg-white p-6 rounded-lg shadow-lg text-center w-96">
//             <div className="flex justify-center mb-4">
//               <img
//                 src="/images/logo.png"
//                 alt="FareClubs Logo"
//                 className="h-16"
//                 onError={(e) => {
//                   e.currentTarget.src = "/community-travel-deals.png"
//                 }}
//               />
//             </div>

//             <h2 className="text-xl font-semibold mb-6">Fare Update</h2>

//             <div className="flex justify-between items-center p-4 bg-gray-100 rounded mb-6">
//               <div className="text-left">
//                 <p className="text-gray-600 text-sm">Previous Fare:</p>
//                 <p className="text-lg font-semibold text-red-500">₹{previousFare?.toFixed(2)}</p>
//               </div>
//               <div className="text-2xl font-bold text-gray-400">→</div>
//               <div className="text-right">
//                 <p className="text-gray-600 text-sm">Updated Fare:</p>
//                 <p className="text-lg font-semibold text-green-500">₹{updatedFare?.toFixed(2)}</p>
//               </div>
//             </div>

//             <div className="flex justify-between gap-4">
//               <button
//                 onClick={handleContinueBooking}
//                 className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded hover:bg-blue-600 transition-colors"
//               >
//                 Continue Booking
//               </button>
//               <button
//                 onClick={handleGoBack}
//                 className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
//               >
//                 Go Back
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="max-w-7xl mx-auto px-4 py-8">
//         <div className="mb-8">
//           <div className="flex items-center gap-4 mb-2">
//             <button onClick={handleBackToResults} className="text-gray-600 hover:text-gray-800 flex items-center">
//               <ArrowLeft className="w-5 h-5" />
//               <span className="ml-1">Back to Results</span>
//             </button>
//           </div>
//           <div className="flex items-center gap-2">
//             <h1 className="text-xl font-semibold">Almost done!</h1>
//             <p className="text-gray-600">Enter your details and complete your booking now.</p>
//           </div>
//         </div>

//         <div className="grid grid-cols-3 gap-8">
//           <div className="col-span-2">
//             {renderItineraryDetails()}

//             {renderSelectedFareDetails()}

//             <div className="bg-white rounded-lg shadow p-6 mb-6">
//               <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-lg font-semibold">Additional Services</h2>
//                 <button
//                   onClick={() => setShowSSROptions(!showSSROptions)}
//                   className="px-4 py-2 bg-[#007AFF] text-white rounded-md hover:bg-[#007aff]"
//                 >
//                   {showSSROptions ? "Hide Options" : "Show Options"}
//                 </button>
//               </div>

//               {showSSROptions && (
//                 <>
//                   {isMultiCity ? (
//                     <div className="space-y-6">
//                       {multiCityFlights &&
//                         multiCityFlights.map((segmentData, index) => {
//                           const segmentResultIndex = segmentData.resultIndex
//                           const segmentTraceId = segmentData.traceId
//                           const segmentFlight = segmentData.flight

//                           return (
//                             <div key={`multi-city-${index}`}>
//                               <h3 className="font-medium text-lg mb-4">
//                                 Segment {index + 1} Services ({segmentFlight?.OptionSegmentsInfo?.[0]?.DepartureAirport}{" "}
//                                 - {segmentFlight?.OptionSegmentsInfo?.[0]?.ArrivalAirport})
//                               </h3>
//                               <SSROptions
//                                 key={ssrComponentKeys.segments[index] || `segment-${index}-${Date.now()}`}
//                                 tokenId={sessionId || ""}
//                                 traceId={segmentTraceId || ""}
//                                 resultIndex={segmentResultIndex}
//                                 isLCC={segmentFlight?.IsLCC || false}
//                                 onSSRSelect={(options, price) => handleSegmentSSRSelect(index, options, price)}
//                                 onTraceIdUpdate={(newTraceId) => {
//                                   setMultiCityFlights(
//                                     (prev) =>
//                                       prev?.map((item, idx) =>
//                                         idx === index ? { ...item, traceId: newTraceId } : item,
//                                       ) || null,
//                                   )
//                                 }}
//                               />
//                             </div>
//                           )
//                         })}
//                     </div>
//                   ) : isInternationalRoundTrip ? (
//                     <div className="space-y-6">
//                       <h3 className="font-medium text-lg mb-4">International Flight Services</h3>
//                       <SSROptions
//                         key={ssrComponentKeys.internationalCombined}
//                         tokenId={sessionId || ""}
//                         traceId={traceIdState || ""}
//                         resultIndex={flight?.ResultIndex || ""}
//                         isLCC={flight?.IsLCC || false}
//                         onSSRSelect={handleInternationalCombinedSSRSelect}
//                         onTraceIdUpdate={setTraceIdState}
//                         isInternationalCombined={true}
//                         internationalSegments={flight?.Segments} // Pass the combined segments
//                       />
//                     </div>
//                   ) : isRoundTrip ? (
//                     <div className="space-y-6">
//                       <div>
//                         <h3 className="font-medium text-lg mb-4">Outbound Flight Services</h3>
//                         <SSROptions
//                           key={ssrComponentKeys.outbound}
//                           tokenId={sessionId || ""}
//                           traceId={traceIdState || ""}
//                           resultIndex={location.state?.outboundResultIndex || flight?.SearchSegmentId?.toString() || ""}
//                           isLCC={flight?.IsLCC || false}
//                           onSSRSelect={handleOutboundSSRSelect}
//                           onTraceIdUpdate={setTraceIdState}
//                         />
//                       </div>
//                       <div>
//                         <h3 className="font-medium text-lg mb-4">Return Flight Services</h3>
//                         <SSROptions
//                           key={ssrComponentKeys.return}
//                           tokenId={sessionId || ""}
//                           traceId={traceIdState || ""}
//                           resultIndex={
//                             location.state?.returnResultIndex || returnFlight?.SearchSegmentId?.toString() || ""
//                           }
//                           isLCC={returnFlight?.IsLCC || false}
//                           onSSRSelect={handleReturnSSRSelect}
//                           onTraceIdUpdate={setTraceIdState}
//                         />
//                       </div>
//                     </div>
//                   ) : (
//                     <SSROptions
//                       key={ssrComponentKeys.outbound}
//                       tokenId={sessionId || ""}
//                       traceId={traceIdState || ""}
//                       resultIndex={location.state?.resultIndex || flight?.SearchSegmentId?.toString() || ""}
//                       isLCC={flight?.IsLCC || false}
//                       onSSRSelect={handleSSRSelect}
//                       onTraceIdUpdate={setTraceIdState}
//                     />
//                   )}
//                 </>
//               )}
//             </div>

//             <div className="bg-white rounded-lg shadow p-6 mb-6">
//               <h2 className="text-lg font-semibold mb-4">Contact Details</h2>
//               <p className="text-sm text-gray-600 mb-4">
//                 Your mobile number will be used only for sending flight related communication
//               </p>
//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Email <span className="text-[#eb0066]">*</span>
//                   </label>
//                   <input
//                     type="email"
//                     name="email"
//                     value={email}
//                     onChange={handleGeneralInputChange}
//                     className="w-full p-2 border rounded-md"
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Mobile number <span className="text-[#eb0066]">*</span>
//                   </label>
//                   <input
//                     type="tel"
//                     name="mobile"
//                     value={mobile}
//                     onChange={handleGeneralInputChange}
//                     className="w-full p-2 border rounded-md"
//                     required
//                   />
//                 </div>
//               </div>
//               <div className="mt-4">
//                 <label className="flex items-center">
//                   <input
//                     type="checkbox"
//                     name="receiveOffers"
//                     checked={receiveOffers}
//                     onChange={handleGeneralInputChange}
//                     className="rounded text-[#007aff]"
//                   />
//                   <span className="ml-2 text-sm text-gray-600">
//                     Send me the latest travel deals and special offers via email and/or SMS.
//                   </span>
//                 </label>
//               </div>
//             </div>

//             <div className="bg-white rounded-lg shadow p-6 mb-6">
//               <h2 className="text-lg font-semibold mb-4">Traveller Details</h2>
//               <p className="text-sm text-gray-600 mb-4">Please enter name as mentioned on your government ID proof.</p>
//               {passengersData.map((pax, index) => (
//                 <div key={index} className="mb-6 border-b pb-4 last:border-b-0 last:pb-0">
//                   <h3 className="text-sm font-medium mb-2">
//                     Traveller {index + 1}: {pax.type.charAt(0).toUpperCase() + pax.type.slice(1)}
//                   </h3>
//                   <div className="grid grid-cols-3 gap-4">
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
//                       <select
//                         name="title"
//                         value={pax.title}
//                         onChange={(e) => handlePassengerInputChange(index, e)}
//                         className="w-full p-2 border rounded-md"
//                       >
//                         <option value="Mr">Mr.</option>
//                         <option value="Ms">Ms.</option>
//                         <option value="Mrs">Mrs.</option>
//                       </select>
//                     </div>
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">
//                         First Name <span className="text-[#eb0066]">*</span>
//                       </label>
//                       <input
//                         type="text"
//                         name="firstName"
//                         value={pax.firstName}
//                         onChange={(e) => handlePassengerInputChange(index, e)}
//                         className="w-full p-2 border rounded-md"
//                         required
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
//                       <input
//                         type="text"
//                         name="middleName"
//                         value={pax.middleName}
//                         onChange={(e) => handlePassengerInputChange(index, e)}
//                         className="w-full p-2 border rounded-md"
//                       />
//                     </div>
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">
//                         Last Name <span className="text-[#eb0066]">*</span>
//                       </label>
//                       <input
//                         type="text"
//                         name="lastName"
//                         value={pax.lastName}
//                         onChange={(e) => handlePassengerInputChange(index, e)}
//                         className="w-full p-2 border rounded-md"
//                         required
//                       />
//                     </div>
//                   </div>
//                   <div className="mt-4">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       Gender <span className="text-[#eb0066]">*</span>
//                     </label>
//                     <div className="flex gap-4">
//                       <label className="flex items-center">
//                         <input
//                           type="radio"
//                           name="gender"
//                           value="male"
//                           checked={pax.gender === "male"}
//                           onChange={(e) => handlePassengerInputChange(index, e)}
//                           className="text-[#007aff]"
//                         />
//                         <span className="ml-2">Male</span>
//                       </label>
//                       <label className="flex items-center">
//                         <input
//                           type="radio"
//                           name="gender"
//                           value="female"
//                           checked={pax.gender === "female"}
//                           onChange={(e) => handlePassengerInputChange(index, e)}
//                           className="text-[#007aff]"
//                         />
//                         <span className="ml-2">Female</span>
//                       </label>
//                     </div>
//                   </div>
//                   <div className="mt-4">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       Date of Birth <span className="text-[#eb0066]">*</span>
//                     </label>
//                     <input
//                       type="date"
//                       name="dateOfBirth"
//                       value={pax.dateOfBirth}
//                       onChange={(e) => handlePassengerInputChange(index, e)}
//                       className="w-full p-2 border rounded-md"
//                       required
//                       max={
//                         pax.type === "adult"
//                           ? new Date(new Date().setFullYear(new Date().getFullYear() - 12)).toISOString().split("T")[0]
//                           : new Date().toISOString().split("T")[0]
//                       }
//                     />
//                     <p className="text-xs text-gray-500 mt-1">
//                       {pax.type === "adult" && "Passengers must be at least 12 years old."}
//                       {pax.type === "child" && "Child age usually 2-11 years."}
//                       {pax.type === "infant" && "Infant age usually 0-2 years (must be accompanied by an adult)."}
//                     </p>
//                   </div>
//                   {validationInfo.isPassportRequiredAtBook && (
//                     <>
//                       <div className="mt-4">
//                         <label className="block text-sm font-medium text-gray-700 mb-1">
//                           Passport Number <span className="text-[#eb0066]">*</span>
//                         </label>
//                         <input
//                           type="text"
//                           name="passportNumber"
//                           value={pax.passportNumber || ""}
//                           onChange={(e) => handlePassengerInputChange(index, e)}
//                           className="w-full p-2 border rounded-md"
//                           required={validationInfo.isPassportRequiredAtBook}
//                         />
//                       </div>
//                       <div className="mt-4">
//                         <label className="block text-sm font-medium text-gray-700 mb-1">
//                           Passport Expiry Date <span className="text-[#eb0066]">*</span>
//                         </label>
//                         <input
//                           type="date"
//                           name="passportExpiry"
//                           value={pax.passportExpiry || ""}
//                           onChange={(e) => handlePassengerInputChange(index, e)}
//                           className="w-full p-2 border rounded-md"
//                           required={validationInfo.isPassportRequiredAtBook}
//                         />
//                       </div>
//                       <div className="mt-4">
//                         <label className="block text-sm font-medium text-gray-700 mb-1">
//                           Nationality <span className="text-[#eb0066]">*</span>
//                         </label>
//                         <input
//                           type="text"
//                           name="nationality"
//                           value={pax.nationality || ""}
//                           onChange={(e) => handlePassengerInputChange(index, e)}
//                           placeholder="e.g., IN"
//                           className="w-full p-2 border rounded-md"
//                           required={validationInfo.isPassportRequiredAtBook}
//                         />
//                       </div>
//                     </>
//                   )}
//                 </div>
//               ))}
//             </div>

//             <div className="bg-white rounded-lg shadow p-6 mb-6">
//               <RefundableBookingOption
//                 totalPrice={calculateRefundablePrice()}
//                 onSelect={handleRefundableSelect}
//                 currency="₹"
//                 startDate={calculateStartDate()}
//               />
//             </div>

//             <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
//               <div className="flex items-center mb-4">
//                 <input
//                   type="checkbox"
//                   id="useGST"
//                   name="useGST"
//                   checked={bookingOptions.useGST}
//                   onChange={handleOptionChange}
//                   className="mr-2"
//                 />
//                 <label htmlFor="useGST" className="text-sm font-medium">
//                   Use GST for this booking {validationInfo.isGSTMandatory && "(REQUIRED)"}
//                 </label>
//               </div>
//               {(bookingOptions.useGST || validationInfo.isGSTMandatory) && (
//                 <div className="mt-4">
//                   <p className="text-sm text-gray-600 mb-2">
//                     To claim credit of GST charged by airlines/FareClubs, please enter your company's GST number
//                   </p>
//                   <input
//                     type="text"
//                     name="gstNumber"
//                     value={bookingOptions.gstNumber}
//                     onChange={handleOptionChange}
//                     placeholder="Enter GST Number"
//                     className="w-full p-2 border rounded-md"
//                     required={validationInfo.isGSTMandatory}
//                   />
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="col-span-1">
//             <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
//               <h2 className="text-lg font-semibold mb-4">Price Details</h2>
//               {updatedFare !== null ? (
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Total Price</span>
//                     <span className="font-semibold">₹{updatedFare}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Convenience Fees</span>
//                     <span className="font-semibold">₹{convenienceFee}</span>
//                   </div>
//                   {ssrTotalPrice.total > 0 && (
//                     <div className="flex justify-between">
//                       <span>Additional Services</span>
//                       <span className="font-semibold">₹{ssrTotalPrice.total}</span>
//                     </div>
//                   )}
//                   {isRefundableSelected && (
//                     <div className="flex justify-between">
//                       <span>Refundable Booking</span>
//                       <span className="font-semibold">₹{refundablePrice}</span>
//                     </div>
//                   )}
//                   <hr className="my-2" />
//                   <div className="flex justify-between text-lg font-bold">
//                     <span>You Pay</span>
//                     <span>
//                       ₹
//                       {(
//                         updatedFare +
//                         convenienceFee +
//                         ssrTotalPrice.total +
//                         (isRefundableSelected ? refundablePrice : 0)
//                       ).toFixed(2)}
//                     </span>
//                   </div>
//                 </div>
//               ) : isInternationalRoundTrip && flight?.Fare?.PublishedFare ? (
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Total Fare</span>
//                     <span className="font-semibold">₹{flight.Fare.PublishedFare.toFixed(2)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Convenience Fees</span>
//                     <span className="font-semibold">₹{convenienceFee.toFixed(2)}</span>
//                   </div>
//                   {ssrTotalPrice.total > 0 && (
//                     <div className="flex justify-between">
//                       <span>Additional Services</span>
//                       <span className="font-semibold">₹{ssrTotalPrice.total.toFixed(2)}</span>
//                     </div>
//                   )}
//                   {isRefundableSelected && (
//                     <div className="flex justify-between">
//                       <span>Refundable Booking</span>
//                       <span className="font-semibold">₹{refundablePrice.toFixed(2)}</span>
//                     </div>
//                   )}
//                   <hr className="my-2" />
//                   <div className="flex justify-between text-lg font-bold">
//                     <span>You Pay</span>
//                     <span>
//                       ₹
//                       {(
//                         flight.Fare.PublishedFare +
//                         convenienceFee +
//                         ssrTotalPrice.total +
//                         (isRefundableSelected ? refundablePrice : 0)
//                       ).toFixed(2)}
//                     </span>
//                   </div>
//                 </div>
//               ) : isMultiCity && totalPrice ? (
//                 <div className="space-y-2">
//                   {multiCityFlights &&
//                     multiCityFlights.map((segmentData, index) => (
//                       <div className="flex justify-between" key={index}>
//                         <span>Segment {index + 1}</span>
//                         <span className="font-semibold">
//                           ₹
//                           {segmentData.flight && segmentData.flight.OptionPriceInfo
//                             ? Number(segmentData.flight.OptionPriceInfo.TotalPrice).toFixed(2)
//                             : "0.00"}
//                         </span>
//                       </div>
//                     ))}
//                   <div className="flex justify-between">
//                     <span>Convenience Fees</span>
//                     <span className="font-semibold">₹{convenienceFee.toFixed(2)}</span>
//                   </div>
//                   {ssrTotalPrice.total > 0 && (
//                     <div className="flex justify-between">
//                       <span>Additional Services</span>
//                       <span className="font-semibold">₹{ssrTotalPrice.total.toFixed(2)}</span>
//                     </div>
//                   )}
//                   {isRefundableSelected && (
//                     <div className="flex justify-between">
//                       <span>Refundable Booking</span>
//                       <span className="font-semibold">₹{refundablePrice.toFixed(2)}</span>
//                     </div>
//                   )}
//                   <hr className="my-2" />
//                   <div className="flex justify-between text-lg font-bold">
//                     <span>You Pay</span>
//                     <span>
//                       ₹
//                       {(
//                         totalPrice +
//                         convenienceFee +
//                         ssrTotalPrice.total +
//                         (isRefundableSelected ? refundablePrice : 0)
//                       ).toFixed(2)}
//                     </span>
//                   </div>
//                 </div>
//               ) : isRoundTrip && totalPrice && flight?.OptionPriceInfo && returnFlight?.OptionPriceInfo ? (
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Outbound Flight</span>
//                     <span className="font-semibold">₹{Number(flight.OptionPriceInfo.TotalPrice).toFixed(2)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Return Flight</span>
//                     <span className="font-semibold">₹{Number(returnFlight.OptionPriceInfo.TotalPrice).toFixed(2)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Convenience Fees</span>
//                     <span className="font-semibold">₹{convenienceFee.toFixed(2)}</span>
//                   </div>
//                   {ssrTotalPrice.total > 0 && (
//                     <div className="flex justify-between">
//                       <span>Additional Services</span>
//                       <span className="font-semibold">₹{ssrTotalPrice.total.toFixed(2)}</span>
//                     </div>
//                   )}
//                   {isRefundableSelected && (
//                     <div className="flex justify-between">
//                       <span>Refundable Booking</span>
//                       <span className="font-semibold">₹{refundablePrice.toFixed(2)}</span>
//                     </div>
//                   )}
//                   <hr className="my-2" />
//                   <div className="flex justify-between text-lg font-bold">
//                     <span>You Pay</span>
//                     <span>
//                       ₹
//                       {(
//                         totalPrice +
//                         convenienceFee +
//                         ssrTotalPrice.total +
//                         (isRefundableSelected ? refundablePrice : 0)
//                       ).toFixed(2)}
//                     </span>
//                   </div>
//                 </div>
//               ) : (
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Adult (1 × ₹{Number(flight?.OptionPriceInfo?.TotalBasePrice || 0).toFixed(2)})</span>
//                     <span className="font-semibold">
//                       ₹{Number(flight?.OptionPriceInfo?.TotalBasePrice || 0).toFixed(2)}
//                     </span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Airline Taxes &amp; Fees</span>
//                     <span className="font-semibold">₹{Number(flight?.OptionPriceInfo?.TotalTax || 0).toFixed(2)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Convenience Fees</span>
//                     <span className="font-semibold">₹{convenienceFee.toFixed(2)}</span>
//                   </div>
//                   {ssrTotalPrice.total > 0 && (
//                     <div className="flex justify-between">
//                       <span>Additional Services</span>
//                       <span className="font-semibold">₹{ssrTotalPrice.total.toFixed(2)}</span>
//                     </div>
//                   )}
//                   {isRefundableSelected && (
//                     <div className="flex justify-between">
//                       <span>Refundable Booking</span>
//                       <span className="font-semibold">₹{refundablePrice.toFixed(2)}</span>
//                     </div>
//                   )}
//                   <hr className="my-2" />
//                   <div className="flex justify-between text-lg font-bold">
//                     <span>You Pay</span>
//                     <span>
//                       ₹
//                       {(
//                         totalAmountBasedOnLoadedData +
//                         convenienceFee +
//                         ssrTotalPrice.total +
//                         (isRefundableSelected ? refundablePrice : 0)
//                       ).toFixed(2)}
//                     </span>
//                   </div>
//                 </div>
//               )}
//             </div>

//             <div className="mt-6">
//               <h3 className="text-sm font-medium mb-2">Promo Code</h3>
//               <div className="flex gap-2">
//                 <input
//                   type="text"
//                   name="promoCode"
//                   value={promoCode}
//                   onChange={handleGeneralInputChange}
//                   placeholder="Enter promo code"
//                   className="flex-1 p-2 border rounded-md"
//                 />
//                 <button className="px-4 py-2 bg-[#007aff] text-white rounded-md hover:bg-[#007aff]">Apply</button>
//               </div>
//               <div className="mt-4">
//                 <label className="flex items-center gap-2 p-2 border rounded-md">
//                   <input type="radio" name="promo" className="text-[#007aff]" />
//                   <div>
//                     <div className="font-medium">FIRST100</div>
//                     <div className="text-sm text-gray-600">Save ₹100</div>
//                     <div className="text-xs text-gray-500">Get Up to ₹800* Off. Valid only for UPI Payments</div>
//                   </div>
//                 </label>
//               </div>

//               <button
//                 onClick={handleSubmit}
//                 className="w-full mt-6 px-6 py-3 bg-[#eb0066] text-white rounded-md hover:bg-[#eb0066] font-medium"
//               >
//                 Pay Now
//               </button>
//               <div className="mt-6 flex items-center justify-between">
//                 <div className="flex items-center">
//                   <img src="/images/trustpilot.png" alt="Trustpilot Rating" className="h-12" />
//                 </div>
//                 <img src="/images/iata.png" alt="IATA Logo" className="h-12" />
//               </div>
//               <p className="mt-4 text-xs text-gray-500 text-center">
//                 By clicking on Pay Now, you are agreeing to our Terms & Conditions, Privacy Policy, User Agreement, and
//                 Covid-19 Guidelines.
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>

//       {showFareRulesModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center mb-4">
//               <h3 className="text-xl font-bold">
//                 {isMultiCity
//                   ? `Fare Rules - Segment ${(activeFareRulesFlight as number) + 1}`
//                   : isRoundTrip
//                     ? `Fare Rules - ${activeFareRulesFlight === "outbound" ? "Outbound Flight" : "Return Flight"}`
//                     : "Fare Rules"}
//               </h3>
//               <button className="text-gray-500" onClick={() => setShowFareRulesModal(false)}>
//                 ✕
//               </button>
//             </div>
//             {isMultiCity
//               ? multiCityFlights &&
//                 typeof activeFareRulesFlight === "number" &&
//                 multiCityFlights[activeFareRulesFlight] && (
//                   <FareRules
//                     tokenId={sessionId || ""}
//                     traceId={multiCityFlights[activeFareRulesFlight].traceId || ""}
//                     resultIndex={multiCityFlights[activeFareRulesFlight].resultIndex || ""}
//                   />
//                 )
//               : isInternationalRoundTrip
//                 ? flight && (
//                     <FareRules
//                       tokenId={sessionId || ""}
//                       traceId={traceIdState || ""}
//                       resultIndex={flight?.ResultIndex || ""}
//                     />
//                   )
//                 : isRoundTrip
//                   ? activeFareRulesFlight === "outbound"
//                     ? flight && (
//                         <FareRules
//                           tokenId={sessionId || ""}
//                           traceId={traceIdState || ""}
//                           resultIndex={location.state?.outboundResultIndex || flight?.SearchSegmentId?.toString() || ""}
//                         />
//                       )
//                     : returnFlight && (
//                         <FareRules
//                           tokenId={sessionId || ""}
//                           traceId={traceIdState || ""}
//                           resultIndex={
//                             location.state?.returnResultIndex || returnFlight?.SearchSegmentId?.toString() || ""
//                           }
//                         />
//                       )
//                   : flight && (
//                       <FareRules
//                         tokenId={sessionId || ""}
//                         traceId={traceIdState || ""}
//                         resultIndex={location.state?.resultIndex || flight?.SearchSegmentId?.toString() || ""}
//                       />
//                     )}
//             <div className="mt-6 flex justify-end">
//               <button
//                 className="bg-[#007aff] text-white px-6 py-2 rounded-lg font-medium"
//                 onClick={() => setShowFareRulesModal(false)}
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default InternationalBookingPage
