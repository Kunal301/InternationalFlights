"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
  flightLeg?: 1 | 2
}

interface SSROption {
  Code: string
  Description: string
  Amount?: number
  PassengerType?: string
  SegmentIndicator?: string
  Type: "BAGGAGE" | "MEAL" | "SEAT" | string
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
  flightLeg?: 1 | 2
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
  flightLeg,
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

  // guards to avoid loops
  const isFirstRender = useRef(true)
  const isFetchingRef = useRef(false)
  const fetchAttemptRef = useRef(0)
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9))
  const lastTraceIdAppliedRef = useRef<string | null>(null)
  const suppressNextFetchRef = useRef(false)

  const lastNotifyKeyRef = useRef<string>("")

  const componentId = componentIdRef.current

  const fetchSSROptions = useCallback(async () => {
    if (isFetchingRef.current) {
      return
    }

    if (!tokenId || !traceId || !resultIndex) {
      setError("Missing required parameters for additional services.")
      setIsLoading(false)
      return
    }

    isFetchingRef.current = true
    fetchAttemptRef.current = 0
    const currentAttempt = fetchAttemptRef.current

    try {
      setIsLoading(true)
      setError(null)

      // 1) Refresh via FareQuote
      const fareQuoteResponse = await getFareQuote(tokenId, traceId, resultIndex)

      if (fareQuoteResponse.Response?.ResponseStatus !== 1 || !fareQuoteResponse.Response?.Results) {
        const fareQuoteError =
          fareQuoteResponse.Response?.Error?.ErrorMessage ||
          fareQuoteResponse.Error?.ErrorMessage ||
          "Unknown FareQuote error"
        setError(`Failed to validate flight details: ${fareQuoteError}. Please try again.`)
        setIsLoading(false)
        isFetchingRef.current = false
        return
      }

      const newTraceIdFromQuote = fareQuoteResponse.Response?.TraceId || null
      const newResultIndex = fareQuoteResponse.Response.Results.ResultIndex

      // Use the freshest trace id immediately for SSR call
      const traceIdForSSR = newTraceIdFromQuote || traceId

      // If supplier gave a new trace id, notify parent ONCE and skip the next fetch
      if (newTraceIdFromQuote && newTraceIdFromQuote !== traceId) {
        lastTraceIdAppliedRef.current = newTraceIdFromQuote
        suppressNextFetchRef.current = true
        onTraceIdUpdate(newTraceIdFromQuote)
      }

      // 2) Fetch SSR options using the fresh trace id/result index
      const response = await getSSROptions(tokenId, traceIdForSSR, newResultIndex)

      if (response.Response?.ResponseStatus !== 1) {
        const ssrApiError =
          response.Response?.Error?.ErrorMessage || response.Error?.ErrorMessage || "Unknown SSR API error"
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
        // Baggage
        if (response.Response.Baggage && Array.isArray(response.Response.Baggage)) {
          response.Response.Baggage.forEach((baggageGroup: BaggageOption[]) => {
            if (Array.isArray(baggageGroup)) {
              const filtered = flightLeg ? baggageGroup.filter((b) => b.WayType === flightLeg) : baggageGroup
              filtered.forEach((baggage: BaggageOption) => {
                if (baggage.Code !== "NoBaggage" && baggage.Price > 0) {
                  options.push({
                    Code: baggage.Code,
                    Description: `${baggage.Weight}kg Extra Baggage`,
                    Amount: baggage.Price,
                    Type: "BAGGAGE",
                    PassengerType: "ADT",
                    SegmentIndicator: `${baggage.Origin}-${baggage.Destination}`,
                  })
                }
              })
            }
          })
        }

        // Meals
        if (response.Response.MealDynamic && Array.isArray(response.Response.MealDynamic)) {
          response.Response.MealDynamic.forEach((mealGroup: MealOption[]) => {
            if (Array.isArray(mealGroup)) {
              const filtered = flightLeg ? mealGroup.filter((m) => m.WayType === flightLeg) : mealGroup
              filtered.forEach((meal: MealOption) => {
                if (meal.Code !== "NoMeal") {
                  options.push({
                    Code: meal.Code,
                    Description: meal.AirlineDescription || `Meal option (${meal.Code})`,
                    Amount: meal.Price || 0, // 0 => Included
                    Type: "MEAL",
                    PassengerType: "ADT",
                    SegmentIndicator: `${meal.Origin}-${meal.Destination}`,
                  })
                }
              })
            }
          })
        }

        // Seats (+ seat map)
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
        // Non-LCC: keep preferences, no priced SSR
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

      setSSROptions(options)
    } catch (err: any) {
      setError(err?.message || "Failed to fetch additional services. Please try again.")
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
      // eslint-disable-next-line no-unused-expressions
      currentAttempt // keeps TS quiet if you log it elsewhere
    }
  }, [tokenId, traceId, resultIndex, isLCC, onTraceIdUpdate, flightLeg])

  // Trigger fetch; skip once when the rerender came only from our traceId update
  useEffect(() => {
    if (suppressNextFetchRef.current && traceId === lastTraceIdAppliedRef.current) {
      suppressNextFetchRef.current = false
      return
    }
    fetchSSROptions()
    // include fetchSSROptions so the effect responds to relevant changes
  }, [tokenId, traceId, resultIndex, fetchSSROptions])

  // Price calculator
  const calculateTotalPrice = useMemo(() => {
    let total = 0
    Object.values(selectedOptions).forEach((option) => (total += option.Amount || 0))
    Object.values(selectedSeats).forEach((seat) => (total += seat.Price))
    return total
  }, [selectedOptions, selectedSeats])

  // Combined (options + seats-as-options)
  const getCombinedOptions = useMemo(() => {
    return {
      ...selectedOptions,
      ...Object.entries(selectedSeats).reduce((acc, [key, seat]) => {
        acc[`SEAT-${key}`] = {
          Code: seat.Code,
          Description: `Seat ${seat.RowNo}${seat.SeatNo}`,
          Amount: seat.Price,
          Type: "SEAT",
          PassengerType: "ADT",
          SegmentIndicator: `${seat.Origin}-${seat.Destination}`,
        }
        return acc
      }, {} as Record<string, SSROption>),
    }
  }, [selectedOptions, selectedSeats])

  // Notify parent (stable, de-looped)
  useEffect(() => {
    setTotalAdditionalPrice(calculateTotalPrice)

    if (isFirstRender.current) {
      isFirstRender.current = false
      if (!isLCC) {
        onSSRSelect({ baggage: [], meals: [], seats: [] }, 0)
      }
      return
    }

    const list = Object.values(getCombinedOptions || {})
    const grouped = {
      baggage: list.filter((o: any) => o.Type === "BAGGAGE"),
      meals: list.filter((o: any) => o.Type === "MEAL"),
      seats: list.filter((o: any) => o.Type === "SEAT"),
    }

    const key = JSON.stringify({
      total: calculateTotalPrice,
      b: grouped.baggage.map((x: any) => `${x.Type}:${x.Code}`).sort(),
      m: grouped.meals.map((x: any) => `${x.Type}:${x.Code}`).sort(),
      s: grouped.seats.map((x: any) => `${x.Type}:${x.Code}`).sort(),
    })

    if (key !== lastNotifyKeyRef.current) {
      lastNotifyKeyRef.current = key
      onSSRSelect(grouped, calculateTotalPrice)
    }
  }, [calculateTotalPrice, getCombinedOptions, isLCC, onSSRSelect])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const handleOptionSelect = useCallback((option: SSROption) => {
    setSelectedOptions((prev) => {
      const newOptions = { ...prev }
      const key = `${option.Type}-${option.Code}`
      if (newOptions[key]) delete newOptions[key]
      else newOptions[key] = option
      return newOptions
    })
  }, [])

  const handleSeatSelect = useCallback((seat: SeatOption) => {
    setSelectedSeats((prev) => {
      const newSelectedSeats = { ...prev }
      const seatKey = `${seat.RowNo}${seat.SeatNo}`
      if (newSelectedSeats[seatKey]) delete newSelectedSeats[seatKey]
      else newSelectedSeats[seatKey] = seat
      return newSelectedSeats
    })
  }, [])

  const handleRetry = useCallback(() => {
    fetchSSROptions()
  }, [fetchSSROptions])

  const isOptionSelected = useCallback(
    (option: SSROption): boolean => {
      const key = `${option.Type}-${option.Code}`
      return !!selectedOptions[key]
    },
    [selectedOptions],
  )

  const getBaggageOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "BAGGAGE"), [ssrOptions])
  const getMealOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "MEAL"), [ssrOptions])
  const getSeatOptions = useMemo(() => ssrOptions.filter((option) => option.Type === "SEAT"), [ssrOptions])

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
              <p className="text-sm text-amber-700 mt-2">You may request special services directly at the airport check-in counter.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isLCC ? (
        <>
          {/* Baggage */}
          {getBaggageOptions.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer" onClick={() => toggleSection("baggage")}>
                <div className="flex items-center">
                  <Luggage className="w-5 h-5 mr-2 text-gray-600" />
                  <h3 className="font-medium">Extra Baggage</h3>
                </div>
                {expandedSections.baggage ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
              </div>

              {expandedSections.baggage && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getBaggageOptions.map((option, index) => (
                      <div
                        key={`${option.Type}-${option.Code}-${index}`}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isOptionSelected(option) ? "border-[#007aff] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => handleOptionSelect(option)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            <Luggage className="w-5 h-5 mr-2 text-gray-600" />
                            <div>
                              <div className="font-medium">{option.Description}</div>
                              <div className="text-xs text-gray-500">{option.PassengerType || "All Passengers"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">₹{option.Amount}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    <p>Select additional baggage allowance if needed. Standard baggage allowance is included in your fare.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Meals */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer" onClick={() => toggleSection("meal")}>
              <div className="flex items-center">
                <Coffee className="w-5 h-5 mr-2 text-gray-600" />
                <h3 className="font-medium">Meal selection</h3>
              </div>
              {expandedSections.meal ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>

            {expandedSections.meal && (
              <div className="p-4">
                {getMealOptions.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {getMealOptions.map((option, index) => (
                      <div
                        key={`${option.Type}-${option.Code}-${index}`}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isOptionSelected(option) ? "border-[#007aff] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => handleOptionSelect(option)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            <Coffee className="w-5 h-5 mr-2 text-gray-600" />
                            <div>
                              <div className="font-medium">{option.Description}</div>
                              <div className="text-xs text-gray-500">{option.SegmentIndicator || "All Segments"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            {option.Amount && option.Amount > 0 ? (
                              <div className="font-bold">₹{option.Amount}</div>
                            ) : (
                              <div className="text-xs font-medium text-gray-600">Included</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No pre-bookable meals are available for this flight. Some airlines include meals by default.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Seats */}
          {(getSeatOptions.length > 0 || seatMapData) && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer" onClick={() => toggleSection("seat")}>
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M12 4v16" />
                  </svg>
                  <h3 className="font-medium">Seat Selection</h3>
                </div>
                {expandedSections.seat ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
              </div>

              {expandedSections.seat && (
                <div className="p-4">
                  <div className="flex items-center space-x-4">
                    <img src="/images/seat.gif" alt="Seat Map Preview" className="w-32 h-20 object-contain" />
                  </div>

                  {seatMapData && (
                    <div className="mb-4 flex justify-end">
                      <button onClick={() => setShowSeatMap(!showSeatMap)} className="px-4 py-2 bg-[#007aff] text-white rounded-md hover:bg-blue-600">
                        {showSeatMap ? "Show List View" : "Show Seat Map"}
                      </button>
                    </div>
                  )}

                  {showSeatMap && seatMapData ? (
                    <SeatMap seatData={seatMapData[0]} selectedSeats={selectedSeats} onSeatSelect={handleSeatSelect} passengerCount={1} />
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getSeatOptions.map((option, index) => (
                          <div
                            key={`${option.Type}-${option.Code}-${index}`}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                              isOptionSelected(option) ? "border-[#007aff] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => handleOptionSelect(option)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center">
                                <svg className="w-5 h-5 mr-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="4" y="4" width="16" height="16" rx="2" />
                                  <path d="M12 4v16" />
                                </svg>
                                <div>
                                  <div className="font-medium">{option.Description}</div>
                                  <div className="text-xs text-gray-500">{option.SegmentIndicator || "All Segments"}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">₹{option.Amount}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {seatMapData && (
                        <div className="mt-4 flex justify-center">
                          <button
                            onClick={() => setShowSeatMap(true)}
                            className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 flex items-center"
                          >
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <p>Select your preferred seat. Additional charges may apply for premium seats.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
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
        // Non-LCC
        <div className="space-y-4">
          {nonLCCMeals.length > 0 || nonLCCSeatPreferences.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer" onClick={() => toggleSection("nonLCCServices")}>
                <div className="flex items-center">
                  <Coffee className="w-5 h-5 mr-2 text-gray-600" />
                  <h3 className="font-medium">Meal & Seat Preferences (Indicative)</h3>
                </div>
                {expandedSections.nonLCCServices ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
              </div>

              {expandedSections.nonLCCServices && (
                <div className="p-4">
                  {nonLCCMeals.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-2">Available Meal Preferences:</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {nonLCCMeals.map((meal, index) => (
                          <li key={`nonlcc-meal-${index}`}>{meal.Description} ({meal.Code})</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {nonLCCSeatPreferences.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Available Seat Preferences:</h4>
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {nonLCCSeatPreferences.map((seat, index) => (
                          <li key={`nonlcc-seat-${index}`}>{seat.Description} ({seat.Code})</li>
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
                  <p className="text-sm text-amber-700 mt-1">This non-LCC flight does not offer any online meal or seat preferences.</p>
                  <p className="text-sm text-amber-700 mt-2">You may request special services directly at the airport check-in counter.</p>
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
