"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { getSSROptions } from "../../services/ssrService"
import { getFareQuote } from "../../services/fareService"
import { Luggage, Coffee, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from "lucide-react"
import SeatMap from "./SeatMap/SeatMap"

interface SSROptionsProps {
  tokenId: string
  traceId: string
  resultIndex: string
  isLCC: boolean
  onSSRSelect: (selectedOptions: any, totalPrice: number) => void
  onTraceIdUpdate: (newTraceId: string) => void
  isInternationalCombined?: boolean // New prop for international combined
  internationalSegments?: any[][] // New prop to pass segments for international combined
}

interface SSROption {
  Code: string
  Description: string
  Amount?: number
  PassengerType?: string
  SegmentIndicator?: string // e.g., "DEL-BOM"
  Type: "BAGGAGE" | "MEAL" | "SEAT" | string
  Origin?: string // Added for more direct segment identification
  Destination?: string // Added for more direct segment identification
}

interface NonLCCMealOption {
  Code: string
  Description: string
}

interface NonLCCSeatPreference {
  Code: string
  Description: string
}

interface BaggageOption {
  AirlineCode: string
  FlightNumber: string
  WayType: number
  Code: string
  Description: number | string
  Weight: number
  Currency: string
  Price: number
  Origin: string
  Destination: string
  Text?: string
}

interface MealOption {
  AirlineCode: string
  FlightNumber: string
  WayType: number
  Code: string
  Description: number | string
  AirlineDescription: string
  Quantity: number
  Currency: string
  Price: number
  Origin: string
  Destination: string
}

interface SeatOption {
  AirlineCode: string
  FlightNumber: string
  CraftType: string
  Origin: string
  Destination: string
  AvailablityType: number
  Description: number | string
  Code: string
  RowNo: string
  SeatNo: string | null
  SeatType: number
  SeatWayType: number
  Compartment: number
  Deck: number
  Currency: string
  Price: number
}

interface RowSeats {
  Seats: SeatOption[]
}

interface SegmentSeat {
  RowSeats: RowSeats[]
}

interface SeatDynamic {
  SegmentSeat: SegmentSeat[]
}

const SSROptions: React.FC<SSROptionsProps> = ({
  tokenId,
  traceId,
  resultIndex,
  isLCC,
  onSSRSelect,
  onTraceIdUpdate,
  isInternationalCombined = false,
  internationalSegments,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [ssrOptions, setSSROptions] = useState<SSROption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<string, SSROption>>({})
  const [selectedSeats, setSelectedSeats] = useState<Record<string, SeatOption>>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    baggage: true,
    meal: false,
    seat: false,
    nonLCCServices: false,
  })

  const [nonLCCMeals, setNonLCCMeals] = useState<NonLCCMealOption[]>([])
  const [nonLCCSeatPreferences, setNonLCCSeatPreferences] = useState<NonLCCSeatPreference[]>([])

  const [totalAdditionalPrice, setTotalAdditionalPrice] = useState<number>(0)
  const [seatMapData, setSeatMapData] = useState<SeatDynamic[] | null>(null)
  const [showSeatMap, setShowSeatMap] = useState<boolean>(false)

  const isFirstRender = useRef(true)
  const isFetchingRef = useRef(false)
  const fetchAttemptRef = useRef(0)
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9))

  const componentId = componentIdRef.current

  console.log(`[SSR-${componentId}] Component rendered with params:`, {
    tokenId: tokenId?.substring(0, 8) + "...",
    traceId: traceId?.substring(0, 8) + "...",
    resultIndex: resultIndex?.substring(0, 20) + "...",
    isInternationalCombined,
  })

  const fetchSSROptions = useCallback(async () => {
    if (isFetchingRef.current) {
      console.log(`[SSR-${componentId}] Fetch already in progress, skipping...`)
      return
    }

    if (!tokenId || !traceId || !resultIndex) {
      console.log(`[SSR-${componentId}] Missing required parameters`)
      setError("Missing required parameters for additional services.")
      setIsLoading(false)
      return
    }

    isFetchingRef.current = true
    fetchAttemptRef.current = 0

    console.log(`[SSR-${componentId}] Starting fetch attempt ${fetchAttemptRef.current}`)
    console.log(`[SSR-${componentId}] Initial resultIndex prop for FareQuote: ${resultIndex}`)

    try {
      setIsLoading(true)
      setError(null)

      console.log(`[SSR-${componentId}] Refreshing session with FareQuote...`)
      const fareQuoteResponse = await getFareQuote(tokenId, traceId, resultIndex)

      if (fareQuoteResponse.Response?.ResponseStatus !== 1 || !fareQuoteResponse.Response?.Results) {
        const fareQuoteError =
          fareQuoteResponse.Response?.Error?.ErrorMessage ||
          fareQuoteResponse.Error?.ErrorMessage ||
          "Unknown FareQuote error"
        console.error(`[SSR-${componentId}] FareQuote failed: ${fareQuoteError}`)
        setError(`Failed to validate flight details: ${fareQuoteError}. Please try again.`)
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      if (fareQuoteResponse.Response.TraceId && fareQuoteResponse.Response.TraceId !== traceId) {
        console.log(
          `[SSR-${componentId}] FareQuote returned new TraceId. Updating parent: ${fareQuoteResponse.Response.TraceId}`,
        )
        onTraceIdUpdate(fareQuoteResponse.Response.TraceId)
      }

      const newResultIndex = fareQuoteResponse.Response.Results.ResultIndex
      console.log(`[SSR-${componentId}] ResultIndex from FareQuote response: ${newResultIndex}`)

      console.log(`[SSR-${componentId}] Calling SSR API with new ResultIndex: ${newResultIndex}...`)
      const response = await getSSROptions(tokenId, traceId, newResultIndex)

      if (response.Response?.ResponseStatus !== 1) {
        const ssrApiError =
          response.Response?.Error?.ErrorMessage || response.Error?.ErrorMessage || "Unknown SSR API error"
        console.error(`[SSR-${componentId}] SSR API failed: ${ssrApiError}`)
        setError(`Failed to fetch additional services: ${ssrApiError}.`)
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      const options: SSROption[] = []
      setNonLCCMeals([])
      setNonLCCSeatPreferences([])
      setSeatMapData(null)

      if (isLCC) {
        console.log(`[SSR-${componentId}] Processing LCC SSR options...`)
        if (response.Response.Baggage && Array.isArray(response.Response.Baggage)) {
          response.Response.Baggage.forEach((baggageGroup: BaggageOption[]) => {
            if (Array.isArray(baggageGroup)) {
              baggageGroup.forEach((baggage: BaggageOption) => {
                if (baggage.Code !== "NoBaggage" && baggage.Price > 0) {
                  options.push({
                    Code: baggage.Code,
                    Description: `${baggage.Weight}kg Extra Baggage`,
                    Amount: baggage.Price,
                    Type: "BAGGAGE",
                    PassengerType: "ADT",
                    Origin: baggage.Origin,
                    Destination: baggage.Destination,
                    SegmentIndicator: `${baggage.Origin}-${baggage.Destination}`,
                  })
                }
              })
            }
          })
        }

        if (response.Response.MealDynamic && Array.isArray(response.Response.MealDynamic)) {
          response.Response.MealDynamic.forEach((mealGroup: MealOption[]) => {
            if (Array.isArray(mealGroup)) {
              mealGroup.forEach((meal: MealOption) => {
                if (meal.Code !== "NoMeal" && meal.Price > 0) {
                  options.push({
                    Code: meal.Code,
                    Description: meal.AirlineDescription || `Meal Option (${meal.Code})`,
                    Amount: meal.Price,
                    Type: "MEAL",
                    PassengerType: "ADT",
                    Origin: meal.Origin,
                    Destination: meal.Destination,
                    SegmentIndicator: `${meal.Origin}-${meal.Destination}`,
                  })
                }
              })
            }
          })
        }

        if (response.Response.SeatDynamic && Array.isArray(response.Response.SeatDynamic)) {
          setSeatMapData(response.Response.SeatDynamic)

          response.Response.SeatDynamic.forEach((seatGroup: SeatDynamic) => {
            if (seatGroup.SegmentSeat && Array.isArray(seatGroup.SegmentSeat)) {
              seatGroup.SegmentSeat.forEach((segment: SegmentSeat) => {
                if (segment.RowSeats && Array.isArray(segment.RowSeats)) {
                  segment.RowSeats.forEach((row: RowSeats) => {
                    if (row.Seats && Array.isArray(row.Seats)) {
                      row.Seats.forEach((seat: SeatOption) => {
                        if (seat.Code !== "NoSeat" && seat.Price > 0 && seat.AvailablityType === 3) {
                          options.push({
                            Code: seat.Code,
                            Description: `Seat ${seat.RowNo}${seat.SeatNo}`,
                            Amount: seat.Price,
                            Type: "SEAT",
                            PassengerType: "ADT",
                            Origin: seat.Origin,
                            Destination: seat.Destination,
                            SegmentIndicator: `${seat.Origin}-${seat.Destination}`,
                          })
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      } else {
        console.log(`[SSR-${componentId}] Processing Non-LCC SSR options (preferences only)...`)
        if (response.Response.Meal && Array.isArray(response.Response.Meal)) {
          setNonLCCMeals(response.Response.Meal)
        }
        if (response.Response.SeatPreference && Array.isArray(response.Response.SeatPreference)) {
          setNonLCCSeatPreferences(response.Response.SeatPreference)
        }
        setSSROptions([])
        setSelectedOptions({})
        setSelectedSeats({})
        setTotalAdditionalPrice(0)
      }

      console.log(
        `[SSR-${componentId}] Successfully processed SSR options. LCC: ${isLCC}, Options count: ${options.length}, Non-LCC Meals: ${nonLCCMeals.length}, Non-LCC Seats: ${nonLCCSeatPreferences.length}`,
      )
      setSSROptions(options)
    } catch (error) {
      console.error(`[SSR-${componentId}] Error fetching SSR options:`, error)
      setError(error instanceof Error ? error.message : "Failed to fetch additional services. Please try again.")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
      console.log(`[SSR-${componentId}] Fetch attempt ${fetchAttemptRef.current} completed`)
    }
  }, [tokenId, traceId, resultIndex, isLCC, onTraceIdUpdate, componentId])

  useEffect(() => {
    console.log(`[SSR-${componentId}] useEffect triggered`)
    fetchSSROptions()
  }, [tokenId, traceId, resultIndex, componentId, fetchSSROptions]) // Added fetchSSROptions to dependencies

  const calculateTotalPrice = useMemo(() => {
    let total = 0

    Object.values(selectedOptions).forEach((option) => {
      total += option.Amount || 0
    })

    Object.values(selectedSeats).forEach((seat) => {
      total += seat.Price
    })

    return total
  }, [selectedOptions, selectedSeats])

  const getCombinedOptions = useMemo(() => {
    return {
      ...selectedOptions,
      ...Object.entries(selectedSeats).reduce(
        (acc, [key, seat]) => {
          acc[`SEAT-${key}`] = {
            Code: seat.Code,
            Description: `Seat ${seat.RowNo}${seat.SeatNo}`,
            Amount: seat.Price,
            Type: "SEAT",
            PassengerType: "ADT",
            Origin: seat.Origin,
            Destination: seat.Destination,
            SegmentIndicator: `${seat.Origin}-${seat.Destination}`,
          }
          return acc
        },
        {} as Record<string, SSROption>,
      ),
    }
  }, [selectedOptions, selectedSeats])

  useEffect(() => {
    setTotalAdditionalPrice(calculateTotalPrice)

    if (isFirstRender.current) {
      isFirstRender.current = false
      if (!isLCC) {
        console.log(`[SSR-${componentId}] Initial notification for Non-LCC SSR (no chargeable options)`)
        onSSRSelect({}, 0)
      }
      return
    }

    console.log(`[SSR-${componentId}] Notifying parent of selection changes`)
    onSSRSelect(getCombinedOptions, calculateTotalPrice)
  }, [calculateTotalPrice, getCombinedOptions, isLCC, onSSRSelect, componentId])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }, [])

  const handleOptionSelect = useCallback((option: SSROption) => {
    setSelectedOptions((prev) => {
      const newOptions = { ...prev }
      const key = `${option.Type}-${option.Code}-${option.Origin}-${option.Destination}` // More specific key

      if (newOptions[key]) {
        delete newOptions[key]
      } else {
        newOptions[key] = option
      }

      return newOptions
    })
  }, [])

  const handleSeatSelect = useCallback((seat: SeatOption) => {
    setSelectedSeats((prev) => {
      const newSelectedSeats = { ...prev }
      const seatKey = `${seat.RowNo}${seat.SeatNo}-${seat.Origin}-${seat.Destination}` // More specific key

      if (newSelectedSeats[seatKey]) {
        delete newSelectedSeats[seatKey]
      } else {
        newSelectedSeats[seatKey] = seat
      }

      return newSelectedSeats
    })
  }, [])

  const handleRetry = useCallback(() => {
    console.log(`[SSR-${componentId}] Manual retry triggered`)
    fetchSSROptions()
  }, [fetchSSROptions, componentId])

  const isOptionSelected = useCallback(
    (option: SSROption): boolean => {
      const key = `${option.Type}-${option.Code}-${option.Origin}-${option.Destination}`
      return !!selectedOptions[key]
    },
    [selectedOptions],
  )

  const getBaggageOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "BAGGAGE"), [ssrOptions])
  const getMealOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "MEAL"), [ssrOptions])
  const getSeatOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "SEAT"), [ssrOptions])

  // Group options by segment for international combined flights
  const groupedLCCSSROptions = useMemo(() => {
    if (!isInternationalCombined || !internationalSegments || internationalSegments.length < 2) {
      return null
    }

    const outboundLeg = internationalSegments[0]
    const returnLeg = internationalSegments[1]

    const outboundOrigin = outboundLeg[0]?.Origin?.Airport?.AirportCode
    const outboundDestination = outboundLeg[outboundLeg.length - 1]?.Destination?.Airport?.AirportCode
    const returnOrigin = returnLeg[0]?.Origin?.Airport?.AirportCode
    const returnDestination = returnLeg[returnLeg.length - 1]?.Destination?.Airport?.AirportCode

    const outboundOptions = ssrOptions.filter(
      (option) => option.Origin === outboundOrigin && option.Destination === outboundDestination,
    )
    const returnOptions = ssrOptions.filter(
      (option) => option.Origin === returnOrigin && option.Destination === returnDestination,
    )

    const outboundSeatMap = seatMapData?.find(
      (data) =>
        data.SegmentSeat?.[0]?.RowSeats?.[0]?.Seats?.[0]?.Origin === outboundOrigin &&
        data.SegmentSeat?.[0]?.RowSeats?.[0]?.Seats?.[0]?.Destination === outboundDestination,
    )
    const returnSeatMap = seatMapData?.find(
      (data) =>
        data.SegmentSeat?.[0]?.RowSeats?.[0]?.Seats?.[0]?.Origin === returnOrigin &&
        data.SegmentSeat?.[0]?.RowSeats?.[0]?.Seats?.[0]?.Destination === returnDestination,
    )

    return {
      outbound: {
        baggage: outboundOptions.filter((o) => o.Type === "BAGGAGE"),
        meal: outboundOptions.filter((o) => o.Type === "MEAL"),
        seat: outboundOptions.filter((o) => o.Type === "SEAT"),
        seatMap: outboundSeatMap,
      },
      return: {
        baggage: returnOptions.filter((o) => o.Type === "BAGGAGE"),
        meal: returnOptions.filter((o) => o.Type === "MEAL"),
        seat: returnOptions.filter((o) => o.Type === "SEAT"),
        seatMap: returnSeatMap,
      },
    }
  }, [isInternationalCombined, internationalSegments, ssrOptions, seatMapData])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#007aff]"></div>
        <span className="ml-2">Loading available options...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-amber-800">Unable to load additional options</h3>
            <p className="text-sm text-amber-700 mt-1">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 flex items-center text-sm text-amber-800 hover:text-amber-900 font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Try Again
            </button>
            {!isLCC && (
              <p className="text-sm text-amber-700 mt-2">
                For non-LCC airlines, special services are indicative and can be requested directly at the airport
                check-in counter.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (ssrOptions.length === 0 && !seatMapData && nonLCCMeals.length === 0 && nonLCCSeatPreferences.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">No additional options available</h3>
            <p className="text-sm text-amber-700 mt-1">
              {isLCC
                ? "This flight does not offer online selection of baggage, meals, or seats."
                : "This non-LCC flight does not offer any online meal or seat preferences."}
            </p>
            {!isLCC && (
              <p className="text-sm text-amber-700 mt-2">
                You may request special services directly at the airport check-in counter.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderLCCSection = (
    options: SSROption[],
    sectionType: string,
    sectionTitle: string,
    sectionIcon: React.ReactNode,
    currentSeatMapData?: SeatDynamic | null,
  ) => {
    const filteredOptions = options.filter((option) => option.Type === sectionType.toUpperCase())
    const hasOptions = filteredOptions.length > 0 || (sectionType === "seat" && currentSeatMapData)

    if (!hasOptions) return null

    return (
      <div className="border rounded-lg overflow-hidden">
        <div
          className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
          onClick={() => toggleSection(sectionType)}
        >
          <div className="flex items-center">
            {sectionIcon}
            <h3 className="font-medium">{sectionTitle}</h3>
          </div>
          {expandedSections[sectionType] ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </div>

        {expandedSections[sectionType] && (
          <div className="p-4">
            {sectionType === "seat" && currentSeatMapData && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setShowSeatMap(!showSeatMap)}
                  className="px-4 py-2 bg-[#007aff] text-white rounded-md hover:bg-blue-600"
                >
                  {showSeatMap ? "Show List View" : "Show Seat Map"}
                </button>
              </div>
            )}

            {sectionType === "seat" && showSeatMap && currentSeatMapData ? (
              <SeatMap
                seatData={currentSeatMapData}
                selectedSeats={selectedSeats}
                onSeatSelect={handleSeatSelect}
                passengerCount={1}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOptions.map((option, index) => (
                    <div
                      key={`${option.Type}-${option.Code}-${option.Origin}-${option.Destination}-${index}`}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        isOptionSelected(option)
                          ? "border-[#007aff] bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => handleOptionSelect(option)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          {sectionIcon}
                          <div>
                            <div className="font-medium">{option.Description}</div>
                            <div className="text-xs text-gray-500">
                              {option.Origin && option.Destination
                                ? `${option.Origin}-${option.Destination}`
                                : "All Segments"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">₹{option.Amount}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sectionType === "seat" && currentSeatMapData && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => setShowSeatMap(true)}
                      className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 flex items-center"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M12 4v16" />
                        <path d="M2 12h20" />
                      </svg>
                      View Interactive Seat Map
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="mt-4 text-sm text-gray-500">
              <p>
                {sectionType === "baggage" &&
                  "Select additional baggage allowance if needed. Standard baggage allowance is included in your fare."}
                {sectionType === "meal" && "Select your preferred meal option. Additional charges may apply."}
                {sectionType === "seat" &&
                  "Select your preferred seat. Additional charges may apply for premium seats."}
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isLCC ? (
        <>
          {isInternationalCombined && groupedLCCSSROptions ? (
            <>
              <h3 className="font-medium text-lg mb-4">Outbound Flight Services</h3>
              {renderLCCSection(
                groupedLCCSSROptions.outbound.baggage,
                "baggage",
                "Extra Baggage",
                <Luggage className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                groupedLCCSSROptions.outbound.meal,
                "meal",
                "Meal Selection",
                <Coffee className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                groupedLCCSSROptions.outbound.seat,
                "seat",
                "Seat Selection",
                <svg
                  className="w-5 h-5 mr-2 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>,
                groupedLCCSSROptions.outbound.seatMap,
              )}

              <h3 className="font-medium text-lg mb-4 mt-8">Return Flight Services</h3>
              {renderLCCSection(
                groupedLCCSSROptions.return.baggage,
                "baggage",
                "Extra Baggage",
                <Luggage className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                groupedLCCSSROptions.return.meal,
                "meal",
                "Meal Selection",
                <Coffee className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                groupedLCCSSROptions.return.seat,
                "seat",
                "Seat Selection",
                <svg
                  className="w-5 h-5 mr-2 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>,
                groupedLCCSSROptions.return.seatMap,
              )}
            </>
          ) : (
            <>
              {renderLCCSection(
                getBaggageOptions,
                "baggage",
                "Extra Baggage",
                <Luggage className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                getMealOptions,
                "meal",
                "Meal Selection",
                <Coffee className="w-5 h-5 mr-2 text-gray-600" />,
              )}
              {renderLCCSection(
                getSeatOptions,
                "seat",
                "Seat Selection",
                <svg
                  className="w-5 h-5 mr-2 text-gray-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M12 4v16" />
                </svg>,
                seatMapData?.[0],
              )}
            </>
          )}

          {(Object.keys(selectedOptions).length > 0 || Object.keys(selectedSeats).length > 0) && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium mb-2">Selected Options</h3>
              <div className="space-y-2">
                {Object.values(selectedOptions).map((option, index) => (
                  <div key={`option-${index}`} className="flex justify-between">
                    <span>{option.Description}</span>
                    <span className="font-medium">₹{option.Amount}</span>
                  </div>
                ))}

                {Object.values(selectedSeats).map((seat, index) => (
                  <div key={`seat-${index}`} className="flex justify-between">
                    <span>
                      Seat {seat.RowNo}
                      {seat.SeatNo}
                    </span>
                    <span className="font-medium">₹{seat.Price}</span>
                  </div>
                ))}

                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total Additional Charges</span>
                  <span>₹{totalAdditionalPrice}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500">
            <p>For LCC airlines, the selected options will be added to your booking with the applicable charges.</p>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {nonLCCMeals.length > 0 || nonLCCSeatPreferences.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div
                className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                onClick={() => toggleSection("nonLCCServices")}
              >
                <div className="flex items-center">
                  <Coffee className="w-5 h-5 mr-2 text-gray-600" />
                  <h3 className="font-medium">Meal & Seat Preferences (Indicative)</h3>
                </div>
                {expandedSections.nonLCCServices ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </div>

              {expandedSections.nonLCCServices && (
                <div className="p-4">
                  {nonLCCMeals.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-2">Available Meal Preferences:</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {nonLCCMeals.map((meal, index) => (
                          <li key={`nonlcc-meal-${index}`}>
                            {meal.Description} ({meal.Code})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {nonLCCSeatPreferences.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Available Seat Preferences:</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {nonLCCSeatPreferences.map((seat, index) => (
                          <li key={`nonlcc-seat-${index}`}>
                            {seat.Description} ({seat.Code})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-amber-700">
                    <p>
                      Note: For non-LCC airlines, meal and seat selections are indicative only and subject to
                      availability. These services can be requested directly at the airport check-in counter.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800">No additional options available</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    This non-LCC flight does not offer any online meal or seat preferences.
                  </p>
                  <p className="text-sm text-amber-700 mt-2">
                    You may request special services directly at the airport check-in counter.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(SSROptions)
