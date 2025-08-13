"use client"

import React, { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Header } from "./booking/BookingHeader" // Assuming you have a Header component

const FlightNotAvailablePage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [countdown, setCountdown] = useState(5)

  const { searchParams, sessionId, traceId, multiCityRawResponses } = location.state || {}

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    const redirectTimeout = setTimeout(() => {
      // Redirect back to search results, passing back the original search parameters
      // and potentially the raw responses for multi-city to re-render the previous state
      navigate("/search-results", {
        state: {
          searchParams: searchParams,
          shouldSearch: false, // Do not trigger a new search on redirect
          returnFromBooking: true, // Indicate returning from booking flow
          sessionId: sessionId,
          traceId: traceId,
          multiCityRawResponses: multiCityRawResponses,
        },
        replace: true, // Replace the current history entry so user can't go back to this page
      })
    }, 5000) // Redirect after 5 seconds

    return () => {
      clearInterval(timer)
      clearTimeout(redirectTimeout)
    }
  }, [navigate, searchParams, sessionId, traceId, multiCityRawResponses])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md w-full">
          <div className="text-6xl mb-4">
            <span role="img" aria-label="Oops">
              😬
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Oops! This flight is no longer available.</h1>
          <p className="text-lg text-gray-600 mb-6">
            It looks like all seats for the selected flight have been sold out or the fare has changed. Please try
            another flight.
          </p>
          <p className="text-md text-gray-500">
            Redirecting to search results page in <span className="font-bold text-[#007aff]">{countdown}</span> seconds...
          </p>
          <button
            onClick={() =>
              navigate("/search-results", {
                state: {
                  searchParams: searchParams,
                  shouldSearch: false,
                  returnFromBooking: true,
                  sessionId: sessionId,
                  traceId: traceId,
                  multiCityRawResponses: multiCityRawResponses,
                },
                replace: true,
              })
            }
            className="mt-6 px-6 py-3 bg-[#007aff] text-white font-semibold rounded-lg hover:bg-[#0056b3] transition-colors duration-200"
          >
            Go to Search Results Now
          </button>
        </div>
      </main>
    </div>
  )
}

export default FlightNotAvailablePage
