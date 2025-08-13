import axios from "axios"
import { type FareQuoteResultData, type FareQuoteResponse } from "./fareService" // Import FareQuoteResultData and FareQuoteResponse

// Define RepriceResponse to be compatible with FareQuoteResponse
export interface RepriceResponse {
  Response?: { // Make Response optional to match FareQuoteResponse structure
    ResponseStatus: number
    Error?: {
      ErrorCode: number
      ErrorMessage: string
    }
    Results?: FareQuoteResultData // Use FareQuoteResultData here
    TraceId: string
  }
  Error?: {
    ErrorCode: number
    ErrorMessage: string
  }
}

/**
 * Calls the Reprice API to check for updated pricing and availability for a flight.
 * This is typically used when an initial fare quote fails due to availability or price changes.
 * @param tokenId The authentication token.
 * @param traceId The trace ID from the original search response.
 * @param resultIndex The result index of the flight to reprice.
 * @returns Promise with the Reprice response, which should contain updated flight data if successful.
 */
export const reprice = async (
  tokenId: string,
  traceId: string,
  resultIndex: string,
): Promise<RepriceResponse> => { // Return type is RepriceResponse
  try {
    const requestData = {
      EndUserIp: "192.168.1.1",
      TokenId: tokenId,
      TraceId: traceId,
      ResultIndex: resultIndex,
    }

    console.log("Reprice API Request:", JSON.stringify(requestData, null, 2))

    const response = await axios.post("http://localhost:5000/api/reprice", requestData, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    console.log("Reprice API Response:", JSON.stringify(response.data, null, 2))

    if (response.data.Response && response.data.Response.ResponseStatus === 1) {
      return response.data as RepriceResponse
    } else {
      const errorMessage = response.data.Response?.Error?.ErrorMessage || "Reprice failed"
      console.error("Reprice API error:", errorMessage)
      return {
        Response: {
          ResponseStatus: 2,
          Error: { ErrorCode: response.data.Response?.Error?.ErrorCode || -1, ErrorMessage: errorMessage },
          TraceId: response.data.Response?.TraceId || "",
        },
        Error: { ErrorCode: response.data.Response?.Error?.ErrorCode || -1, ErrorMessage: errorMessage },
      }
    }
  } catch (error) {
    console.error("Error during reprice API call:", error)
    if (axios.isAxiosError(error)) {
      return {
        Response: {
          ResponseStatus: 2,
          Error: { ErrorCode: -1, ErrorMessage: error.message },
          TraceId: "",
        },
        Error: { ErrorCode: -1, ErrorMessage: error.message },
      }
    }
    return {
      Response: {
        ResponseStatus: 2,
        Error: { ErrorCode: -1, ErrorMessage: "An unexpected error occurred during reprice." },
        TraceId: "",
      },
      Error: { ErrorCode: -1, ErrorMessage: "An unexpected error occurred during reprice." },
    }
  }
}
