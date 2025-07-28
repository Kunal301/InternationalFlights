import Airline from "../models/Airline.js"

// Get all airlines
export const getAllAirlines = async (req, res) => {
  try {
    const airlines = await Airline.find({})
    res.status(200).json({ airlines }) // Ensure it returns an object with an 'airlines' key
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Get airline by IATA code
export const getAirlineByIataCode = async (req, res) => {
  try {
    const { iataCode } = req.params
    const airline = await Airline.findOne({ iataCode: iataCode.toUpperCase() })

    if (!airline) {
      return res.status(404).json({ message: "Airline not found" })
    }
    res.status(200).json(airline) // Return the airline object directly
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// Create a new airline
export const createAirline = async (req, res) => {
  const { iataCode, icaoCode, airlineName, countryName, isActive, logoUrl } = req.body
  try {
    const newAirline = new Airline({
      iataCode,
      icaoCode,
      airlineName,
      countryName,
      isActive,
      logoUrl,
    })
    await newAirline.save()
    res.status(201).json(newAirline)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Update an airline
export const updateAirline = async (req, res) => {
  const { iataCode } = req.params
  try {
    const updatedAirline = await Airline.findOneAndUpdate({ iataCode: iataCode.toUpperCase() }, req.body, {
      new: true,
    })
    if (!updatedAirline) {
      return res.status(404).json({ message: "Airline not found" })
    }
    res.status(200).json(updatedAirline)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
}

// Delete an airline
export const deleteAirline = async (req, res) => {
  const { iataCode } = req.params
  try {
    const deletedAirline = await Airline.findOneAndDelete({ iataCode: iataCode.toUpperCase() })
    if (!deletedAirline) {
      return res.status(404).json({ message: "Airline not found" })
    }
    res.status(200).json({ message: "Airline deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
