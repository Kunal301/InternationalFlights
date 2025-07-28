// AirlineLogo.tsx
"use client"

import type React from "react"
import { useState, useEffect } from "react"

interface AirlineLogoProps {
  airlineCode: string;
  airlineName?: string;
  size?: "small" | "medium" | "large" | "sm" | "md" | "lg";
}

const sizeClasses = {
  small: "w-8 h-8 text-xs",
  medium: "w-10 h-10 text-sm",
  large: "w-12 h-12 text-base",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export const AirlineLogo: React.FC<AirlineLogoProps> = ({ airlineCode, airlineName, size = "medium" }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const selectedSizeClass = sizeClasses[size] || sizeClasses.medium;

  useEffect(() => {
    const fetchLogo = async () => {
      if (!airlineCode) {
        setIsLoading(false);
        setError(true);
        return;
      }

      setIsLoading(true);
      setError(false);

      try {
        // The backend expects a two-letter IATA code
        // The parent component might pass a full name, so this logic is needed
        // to find the IATA code if a full name is passed.
        let codeToFetch = airlineCode;

        if (airlineCode.length > 2) { // It's likely a name, not a code
            const allAirlinesRes = await fetch(`http://localhost:5000/api/airlines`);
            if (!allAirlinesRes.ok) throw new Error("Could not fetch all airlines list");
            
            const { airlines } = await allAirlinesRes.json();
            const foundAirline = airlines.find((a: any) => a.airlineName.toLowerCase() === airlineCode.toLowerCase());
            
            if (foundAirline) {
                codeToFetch = foundAirline.iataCode;
            } else {
                throw new Error(`Airline name '${airlineCode}' not found`);
            }
        }
        
        const response = await fetch(`http://localhost:5000/api/airlines/${codeToFetch}`);
        if (!response.ok) {
          throw new Error(`Airline with code ${codeToFetch} not found`);
        }
        const airlineData = await response.json();
        
        if (airlineData && airlineData.logoUrl) {
          setLogoUrl(airlineData.logoUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error fetching airline logo:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogo();
  }, [airlineCode]);

  if (isLoading || error || !logoUrl) {
    const displayCode = airlineCode.substring(0, 2).toUpperCase();
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 text-gray-600 font-semibold rounded-full ${selectedSizeClass} flex-shrink-0`}
        title={airlineName || airlineCode}
      >
        {displayCode}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${airlineName || airlineCode} logo`}
      className={`object-contain ${selectedSizeClass} flex-shrink-0`}
      title={airlineName || airlineCode}
      onError={() => setError(true)}
    />
  );
};