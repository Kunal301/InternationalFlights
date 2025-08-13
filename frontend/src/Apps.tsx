"use client"

import React, { useEffect, useState } from "react"
import { Routes, Route, Navigate, useNavigate } from "react-router-dom"
import Login from "./components/login"
import Dashboard from "./components/common/dashboard"
import SearchResults from "./components/SearchResults"
import BookingPage from "./components/booking/BookingPage"
import BookingConfirmation from "./components/booking/BookingConfirmation" // Re-added import
import TicketDetails from "./components/ticket/TicketDetails" // Re-added import
import BackendTest from "./components/Debug/BackendTest" // Re-added import
import ApiDebugger from "./components/Debug/ApiDebugger" // Re-added import
import BookingHistory from "./components/booking/BookingHistory" // Re-added import
import { SessionTimeoutProvider } from "./context/SessionTimeoutProvider"
import FlightNotAvailablePage from "./components/FlightNotAvailablePage"

const App: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const storedSessionId = localStorage.getItem("sessionId")
    const storedTokenId = localStorage.getItem("tokenId") || localStorage.getItem("TokenId")

    if (storedSessionId && storedTokenId) {
      setSessionId(storedSessionId)
    } else {
      localStorage.removeItem("sessionId")
      localStorage.removeItem("tokenId")
      localStorage.removeItem("TokenId")
      setSessionId(null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "sessionId" || event.key === "tokenId" || event.key === "TokenId") {
        const storedSessionId = localStorage.getItem("sessionId")
        const storedTokenId = localStorage.getItem("tokenId") || localStorage.getItem("TokenId")
        if (storedSessionId && storedTokenId) {
          if (storedSessionId !== sessionId) {
            setSessionId(storedSessionId)
          }
        } else {
          setSessionId(null)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [sessionId])

  const handleLoginSuccess = (tokenId: string, memberInfo: any) => {
    setSessionId(tokenId)
    localStorage.setItem("tokenId", tokenId)
    localStorage.setItem("memberInfo", JSON.stringify(memberInfo))
    navigate("/dashboard")
  }

  const ProtectedRoute = React.memo(({ children }: { children: React.ReactNode }) => {
    if (!sessionId) {
      return <Navigate to="/login" replace />
    }
    return <>{children}</>
  })

  if (loading) return null

  return (
    <SessionTimeoutProvider timeoutMinutes={15}>
      <Routes>
        <Route path="/" element={<Navigate to={sessionId ? "/dashboard" : "/login"} replace />} />

        <Route
          path="/login"
          element={
            sessionId && (localStorage.getItem("tokenId") || localStorage.getItem("TokenId")) ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard sessionId={sessionId || ""} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flight-not-available"
          element={
            <ProtectedRoute>
              <FlightNotAvailablePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-results"
          element={
            <ProtectedRoute>
              <SearchResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking"
          element={
            <ProtectedRoute>
              <BookingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking-confirmation"
          element={
            <ProtectedRoute>
              <BookingConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ticket-details"
          element={
            <ProtectedRoute>
              <TicketDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking-history"
          element={
            <ProtectedRoute>
              <BookingHistory />
            </ProtectedRoute>
          }
        />
        {/* Debug Routes */}
        <Route path="/debug/backend-test" element={<BackendTest />} />
        <Route path="/debug/api-debugger" element={<ApiDebugger />} />

        {/* Catch-all for 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionTimeoutProvider>
  )
}

export default App
