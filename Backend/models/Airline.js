import mongoose from "mongoose"

const airlineSchema = new mongoose.Schema(
  {
    iataCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    icaoCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    airlineName: {
      type: String,
      required: true,
      trim: true,
    },
    countryName: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "", // Default to empty string if no logo is available
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  },
)

const Airline = mongoose.model("Airline", airlineSchema)

export default Airline
