import express from "express"
import { getAllAirlines, getAirlineByIataCode } from "../Controllers/airlineControllers.js"

const router = express.Router()

router.get("/", getAllAirlines)
router.get("/:iataCode", getAirlineByIataCode)

export default router
