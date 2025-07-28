// import mongoose from "mongoose"
// import Airline from "../models/Airline.js" // Adjust path as necessary
// import { put } from "@vercel/blob"
// import dotenv from "dotenv"
// import path from "path"
// import { fileURLToPath } from "url"

// // Get __dirname equivalent in ES modules
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

// // Load environment variables from Backend/.env
// dotenv.config({ path: path.resolve(__dirname, "../.env") })

// async function seedAirlineLogosAutomated() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI)
//     console.log("Connected to MongoDB for automated logo seeding.")

//     const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

//     if (!BLOB_READ_WRITE_TOKEN) {
//       console.error("Error: BLOB_READ_WRITE_TOKEN environment variable is not set.")
//       console.error("Please ensure you have configured it in your Backend/.env file or Vercel project settings.")
//       return // Exit if token is not found
//     }

//     const airlines = await Airline.find({})
//     console.log(`Found ${airlines.length} airlines in the database.`)

//     for (const airline of airlines) {
//       // Only process if logoUrl is not set or is a placeholder from a previous run
//       // Or if we want to force overwrite existing logos
//       if (!airline.logoUrl || airline.logoUrl.includes("placeholder.svg?text=")) {
//         try {
//           // Function to generate a simple SVG placeholder for an airline code
//           const generateSvgPlaceholder = (iataCode, width = 100, height = 100) => {
//             const bgColor = "#e0e0e0" // Light gray background
//             const textColor = "#606060" // Darker gray text
//             const fontSize = 30 // Font size

//             return `
//               <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
//                 <rect width="${width}" height="${height}" fill="${bgColor}" />
//                 <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
//                   ${iataCode.substring(0, 2).toUpperCase()}
//                 </text>
//               </svg>
//             `.trim()
//           }

//           const svgContent = generateSvgPlaceholder(airline.iataCode)
//           const { url } = await put(`${airline.iataCode.toUpperCase()}.svg`, svgContent, {
//             access: "public",
//             token: BLOB_READ_WRITE_TOKEN,
//             contentType: "image/svg+xml",
//             allowOverwrite: true, // IMPORTANT: Allow overwriting existing blobs
//           })

//           airline.logoUrl = url
//           await airline.save()
//           console.log(`Updated logo for ${airline.airlineName} (${airline.iataCode}): ${url}`)
//         } catch (error) {
//           console.error(`Failed to generate and upload logo for ${airline.airlineName} (${airline.iataCode}):`, error)
//         }
//       }
//     }
//     console.log("Automated airline logo seeding complete.")
//   } catch (error) {
//     console.error("Error during automated airline logo seeding:", error)
//   } finally {
//     await mongoose.disconnect()
//     console.log("Disconnected from MongoDB.")
//   }
// }

// seedAirlineLogosAutomated()
