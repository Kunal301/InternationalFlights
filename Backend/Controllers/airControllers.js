import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import dotenv from "dotenv" // Import dotenv

dotenv.config() // Load environment variables

// Get booking details
export const getBookingDetails = async (req, res) => {
  try {
    const { EndUserIp, TokenId, BookingId, PNR, FirstName, LastName, TraceId } = req.body

    // Validate required fields
    if (!EndUserIp || !TokenId) {
      return res.status(400).json({
        Error: {
          ErrorCode: 1,
          ErrorMessage: "EndUserIp and TokenId are required",
        },
      })
    }

    // At least one of BookingId, PNR, or TraceId is required
    if (!BookingId && !PNR && !TraceId) {
      return res.status(400).json({
        Error: {
          ErrorCode: 1,
          ErrorMessage: "At least one of BookingId, PNR, or TraceId is required",
        },
      })
    }

    // Prepare request body
    const requestBody = {
      EndUserIp,
      TokenId,
      BookingId,
      PNR,
      FirstName,
      LastName,
      TraceId,
    }

    // Remove undefined properties
    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key] === undefined) {
        delete requestBody[key]
      }
    })

    // Make API request
    // Ensure process.env.API_BASE_URL is correctly used, assuming it points to the main flight API
    const response = await axios.post(
      `${process.env.AIR_API_BASE_URL}/GetBookingDetails`, // Use AIR_API_BASE_URL here
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    // Return the response
    return res.json(response.data)
  } catch (error) {
    console.error("Error in getBookingDetails:", error)

    // Return error response
    return res.status(500).json({
      Error: {
        ErrorCode: 1,
        ErrorMessage: error.message || "Failed to get booking details",
      },
    })
  }
}

// Ticket booking function
export const ticket = async (req, res) => {
  console.log("Received ticket request:", JSON.stringify(req.body, null, 2))

  try {
    const requestBody = {
      FlightDetails: req.body.FlightDetails,
      TravelerDetails: req.body.TravelerDetails,
      PNRReference: req.body.PNRReference || uuidv4(),
      Provider: req.body.Provider,
      AdditionalServices: req.body.AdditionalServices || null,
      // Add EndUserIp and TokenId as they are required for Ticket API
      EndUserIp: req.body.EndUserIp,
      TokenId: req.body.TokenId,
      TraceId: req.body.TraceId,
      ResultIndex: req.body.ResultIndex, // Required for LCC
      Passengers: req.body.Passengers, // Required for LCC
      BookingId: req.body.BookingId, // Required for Non-LCC
      PNR: req.body.PNR, // Required for Non-LCC
      IsPriceChangeAccepted: req.body.IsPriceChangeAccepted,
    }

    // Remove undefined properties
    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key] === undefined) {
        delete requestBody[key]
      }
    })

    console.log("Sending ticket request to API:", JSON.stringify(requestBody, null, 2))

    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    }

    // FIX: Use process.env.AIR_API_BASE_URL for consistency
    const { data } = await axios.post(`${process.env.AIR_API_BASE_URL}/Ticket`, requestBody, config)

    console.log("Ticket API response:", JSON.stringify(data, null, 2))
    res.json(data)
  } catch (error) {
    console.error("Error in ticket endpoint:", error)

    if (error.response) {
      console.error("API Error Status:", error.response.status)
      console.error("API Error Response:", JSON.stringify(error.response.data, null, 2))
      res.status(error.response.status || 500).json({
        Status: "Failed",
        Description: error.response.data?.Error?.ErrorMessage || error.response.data?.Description || "Ticketing failed",
        StatusCode: error.response.status || 500,
        Error: error.response.data,
      })
    } else {
      console.error("Network or other error:", error.message)
      res.status(500).json({
        Status: "Failed",
        Description: "Internal server error during ticketing",
        StatusCode: 500,
        Error: { ErrorMessage: error.message },
      })
    }
  }
}

// Default export for compatibility
export default {
  getBookingDetails,
  ticket,
}
