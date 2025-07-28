/**
 * Formats fare rule text for better readability
 * @param ruleText The raw fare rule text from the API
 * @returns Formatted HTML-safe text with proper line breaks and sections
 */
export const formatFareRules = (ruleText: string): string => {
  if (!ruleText || ruleText.trim() === "") {
    return "No fare rules available."
  }

  // Replace multiple newlines with a single one
  let formatted = ruleText.replace(/\n{3,}/g, "\n\n")

  // Convert URLs to clickable links
  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>',
  )

  // Add section headers (assuming sections start with capital letters followed by ":")
  formatted = formatted.replace(
    /([A-Z][A-Z\s]+):/g,
    '<strong class="text-lg font-semibold block mt-4 mb-2">$1:</strong>',
  )

  // Convert newlines to <br> tags
  formatted = formatted.replace(/\n/g, "<br>")

  // Highlight important information
  formatted = formatted.replace(/(IMPORTANT|NOTE|WARNING):/gi, '<span class="text-red-600 font-bold">$1:</span>')

  return formatted
}

/**
 * Extracts and formats baggage information from fare rules
 * @param ruleText The raw fare rule text
 * @returns Formatted baggage information or null if not found
 */
export const extractBaggageInfo = (ruleText: string): string | null => {
  if (!ruleText) return null

  // Look for baggage information using a broader regex
  // This regex tries to capture sections related to BAGGAGE, CHECK-IN, CABIN, etc.
  const baggageRegex = /(BAGGAGE|CHECK-IN|CABIN|LUGGAGE)[\s\S]+?(?=\n\n|\n[A-Z]|$)/i
  const match = ruleText.match(baggageRegex)

  if (match && match[0]) {
    return match[0].replace(/\n/g, "<br>")
  }

  // Fallback: try to find specific check-in and cabin baggage mentions
  const checkInMatch = ruleText.match(/(?:CHECK-IN|CHECKED) BAGGAGE:?\s*([^\n]+)/i)
  const cabinMatch = ruleText.match(/(?:CABIN|HAND) BAGGAGE:?\s*([^\n]+)/i)

  let constructedBaggage = ""
  if (checkInMatch && checkInMatch[1]) {
    constructedBaggage += `<strong>Check-in Baggage:</strong> ${checkInMatch[1].trim()}<br>`
  }
  if (cabinMatch && cabinMatch[1]) {
    constructedBaggage += `<strong>Cabin Baggage:</strong> ${cabinMatch[1].trim()}<br>`
  }

  if (constructedBaggage) {
    return constructedBaggage
  }

  return null
}

/**
 * Extracts and formats cancellation policy from fare rules
 * @param ruleText The raw fare rule text
 * @returns Formatted cancellation policy or null if not found
 */
export const extractCancellationPolicy = (ruleText: string): string | null => {
  if (!ruleText) return null

  // Look for cancellation information in the text
  const cancellationRegex = /CANCELL?ATION[\s\S]+?(?=\n\n|\n[A-Z]|$)/i
  const match = ruleText.match(cancellationRegex)

  if (match && match[0]) {
    return match[0].replace(/\n/g, "<br>")
  }

  return null
}
