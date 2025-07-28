import mongoose from "mongoose"
import Airline from "../models/Airline.js" // Adjust path if necessary
import dotenv from "dotenv"

dotenv.config({ path: "./Backend/.env" }) // Load environment variables from Backend/.env

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set.")
  process.exit(1)
}

const initialAirlines = [
  { iataCode: "AI", icaoCode: "AIC", airlineName: "Air India", countryName: "India", isActive: true },
  { iataCode: "6E", icaoCode: "IGO", airlineName: "IndiGo", countryName: "India", isActive: true },
  { iataCode: "SG", icaoCode: "SEJ", airlineName: "SpiceJet", countryName: "India", isActive: true },
  { iataCode: "UK", icaoCode: "VTI", airlineName: "Vistara", countryName: "India", isActive: true },
  { iataCode: "G8", icaoCode: "GOI", airlineName: "Go First", countryName: "India", isActive: true },
  { iataCode: "EK", icaoCode: "UAE", airlineName: "Emirates", countryName: "United Arab Emirates", isActive: true },
  { iataCode: "FZ", icaoCode: "FDB", airlineName: "flydubai", countryName: "United Arab Emirates", isActive: true },
  { iataCode: "QR", icaoCode: "QTR", airlineName: "Qatar Airways", countryName: "Qatar", isActive: true },
  {
    iataCode: "EY",
    icaoCode: "ETD",
    airlineName: "Etihad Airways",
    countryName: "United Arab Emirates",
    isActive: true,
  },
  { iataCode: "BA", icaoCode: "BAW", airlineName: "British Airways", countryName: "United Kingdom", isActive: true },
  { iataCode: "LH", icaoCode: "DLH", airlineName: "Lufthansa", countryName: "Germany", isActive: true },
  { iataCode: "AA", icaoCode: "AAL", airlineName: "American Airlines", countryName: "United States", isActive: true },
  { iataCode: "UA", icaoCode: "UAL", airlineName: "United Airlines", countryName: "United States", isActive: true },
  { iataCode: "DL", icaoCode: "DAL", airlineName: "Delta Air Lines", countryName: "United States", isActive: true },
  { iataCode: "SQ", icaoCode: "SIA", airlineName: "Singapore Airlines", countryName: "Singapore", isActive: true },
  { iataCode: "CX", icaoCode: "CPA", airlineName: "Cathay Pacific", countryName: "Hong Kong", isActive: true },
  { iataCode: "TK", icaoCode: "THY", airlineName: "Turkish Airlines", countryName: "Turkey", isActive: true },
  { iataCode: "AF", icaoCode: "AFR", airlineName: "Air France", countryName: "France", isActive: true },
  {
    iataCode: "KL",
    icaoCode: "KLM",
    airlineName: "KLM Royal Dutch Airlines",
    countryName: "Netherlands",
    isActive: true,
  },
  {
    iataCode: "SA",
    icaoCode: "SAA",
    airlineName: "South African Airways",
    countryName: "South Africa",
    isActive: true,
  },
  { iataCode: "NZ", icaoCode: "ANZ", airlineName: "Air New Zealand", countryName: "New Zealand", isActive: true },
  { iataCode: "QF", icaoCode: "QFA", airlineName: "Qantas", countryName: "Australia", isActive: true },
  { iataCode: "AC", icaoCode: "ACA", airlineName: "Air Canada", countryName: "Canada", isActive: true },
  { iataCode: "LA", icaoCode: "LAN", airlineName: "LATAM Airlines", countryName: "Chile", isActive: true },
  { iataCode: "JL", icaoCode: "JAL", airlineName: "Japan Airlines", countryName: "Japan", isActive: true },
  { iataCode: "NH", icaoCode: "ANA", airlineName: "All Nippon Airways", countryName: "Japan", isActive: true },
  { iataCode: "KE", icaoCode: "KAL", airlineName: "Korean Air", countryName: "South Korea", isActive: true },
  { iataCode: "CA", icaoCode: "CCA", airlineName: "Air China", countryName: "China", isActive: true },
  { iataCode: "MU", icaoCode: "CES", airlineName: "China Eastern Airlines", countryName: "China", isActive: true },
  { iataCode: "CZ", icaoCode: "CSN", airlineName: "China Southern Airlines", countryName: "China", isActive: true },
  { iataCode: "SU", icaoCode: "AFL", airlineName: "Aeroflot", countryName: "Russia", isActive: true },
  { iataCode: "TP", icaoCode: "TAP", airlineName: "TAP Air Portugal", countryName: "Portugal", isActive: true },
  { iataCode: "SK", icaoCode: "SAS", airlineName: "SAS Scandinavian Airlines", countryName: "Sweden", isActive: true },
  { iataCode: "OS", icaoCode: "AUA", airlineName: "Austrian Airlines", countryName: "Austria", isActive: true },
  { iataCode: "LX", icaoCode: "SWR", airlineName: "SWISS", countryName: "Switzerland", isActive: true },
  { iataCode: "IB", icaoCode: "IBE", airlineName: "Iberia", countryName: "Spain", isActive: true },
  { iataCode: "AZ", icaoCode: "ITY", airlineName: "ITA Airways", countryName: "Italy", isActive: true },
  { iataCode: "EI", icaoCode: "EIN", airlineName: "Aer Lingus", countryName: "Ireland", isActive: true },
  { iataCode: "FI", icaoCode: "ICE", airlineName: "Icelandair", countryName: "Iceland", isActive: true },
  { iataCode: "AY", icaoCode: "FIN", airlineName: "Finnair", countryName: "Finland", isActive: true },
  { iataCode: "LO", icaoCode: "LOT", airlineName: "LOT Polish Airlines", countryName: "Poland", isActive: true },
  { iataCode: "OK", icaoCode: "CSA", airlineName: "Czech Airlines", countryName: "Czech Republic", isActive: true },
  { iataCode: "RO", icaoCode: "ROT", airlineName: "TAROM", countryName: "Romania", isActive: true },
  { iataCode: "JU", icaoCode: "ASL", airlineName: "Air Serbia", countryName: "Serbia", isActive: true },
  { iataCode: "OU", icaoCode: "CTN", airlineName: "Croatia Airlines", countryName: "Croatia", isActive: true },
  { iataCode: "JP", icaoCode: "ADR", airlineName: "Adria Airways", countryName: "Slovenia", isActive: true },
  { iataCode: "KM", icaoCode: "AMC", airlineName: "Air Malta", countryName: "Malta", isActive: true },
  { iataCode: "CY", icaoCode: "CYP", airlineName: "Cyprus Airways", countryName: "Cyprus", isActive: true },
  {
    iataCode: "BG",
    icaoCode: "BGD",
    airlineName: "Biman Bangladesh Airlines",
    countryName: "Bangladesh",
    isActive: true,
  },
  { iataCode: "UL", icaoCode: "ALK", airlineName: "SriLankan Airlines", countryName: "Sri Lanka", isActive: true },
  {
    iataCode: "PK",
    icaoCode: "PIA",
    airlineName: "Pakistan International Airlines",
    countryName: "Pakistan",
    isActive: true,
  },
  { iataCode: "IR", icaoCode: "IRA", airlineName: "Iran Air", countryName: "Iran", isActive: true },
  { iataCode: "SV", icaoCode: "SVA", airlineName: "Saudia", countryName: "Saudi Arabia", isActive: true },
  { iataCode: "MS", icaoCode: "MSR", airlineName: "EgyptAir", countryName: "Egypt", isActive: true },
  { iataCode: "ET", icaoCode: "ETH", airlineName: "Ethiopian Airlines", countryName: "Ethiopia", isActive: true },
  { iataCode: "KQ", icaoCode: "KQA", airlineName: "Kenya Airways", countryName: "Kenya", isActive: true },
]

const seedInitialAirlines = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("Connected to MongoDB for initial airline seeding.")

    // Clear existing data to prevent duplicate key errors on re-runs
    await Airline.deleteMany({})
    console.log("Cleared existing airline data.")

    await Airline.insertMany(initialAirlines)
    console.log("Initial airline data seeded successfully.")
  } catch (error) {
    console.error("Error during initial airline seeding:", error)
  } finally {
    await mongoose.disconnect()
    console.log("Disconnected from MongoDB.")
  }
}

seedInitialAirlines()
