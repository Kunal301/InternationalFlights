// Backend/scripts/updatedlogos.js

import mongoose from "mongoose";
import Airline from "../models/Airline.js";
import { put } from "@vercel/blob";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

// Setup path variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX #1: Correctly locate the .env file by going up one directory from /scripts
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function updatedLogos() {
  if (!process.env.MONGODB_URI || !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Error: MONGODB_URI or BLOB_READ_WRITE_TOKEN is not set. Check your Backend/.env file.");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // FIX #2: Correctly locate the 'logos' folder by going up one directory from /scripts
    const logosDirPath = path.resolve(__dirname, "../logos");
    const localFiles = await fs.readdir(logosDirPath);

    console.log(`Found ${localFiles.length} logos in the local 'logos' folder.`);

    for (const fileName of localFiles) {
      const iataCode = path.parse(fileName).name.toUpperCase();
      const airline = await Airline.findOne({ iataCode });

      if (!airline) {
        console.warn(`- Skipping ${fileName}: No matching airline found in database for IATA code ${iataCode}.`);
        continue;
      }

      try {
        const filePath = path.join(logosDirPath, fileName);
        const fileBuffer = await fs.readFile(filePath);

        console.log(`Uploading ${fileName} for ${airline.airlineName}...`);

        const { url } = await put(fileName, fileBuffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        airline.logoUrl = url;
        await airline.save();
        console.log(`✅ Synced logo for ${airline.airlineName}: ${url}`);

      } catch (uploadError) {
        console.error(`❌ Failed to upload logo for ${airline.airlineName}:`, uploadError);
      }
    }

    console.log("\nLogo upload and sync process complete.");

  } catch (error) {
    console.error("An error occurred during the process:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

updatedLogos();