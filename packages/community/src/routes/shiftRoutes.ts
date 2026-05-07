import { Router } from "express";
import { requireAuth, requireAdmin } from "./middleware.js";
import * as shifts from "./ShiftController.js";

const router = Router();

router.get(   "/shifts",              shifts.listShifts);
router.get(   "/shifts/:id",          shifts.getShift);
router.post(  "/shifts",              requireAdmin, shifts.createShift);
router.post(  "/shifts/:id/claim",    requireAuth, shifts.claimShift);
router.post(  "/shifts/:id/unclaim",  requireAuth, shifts.unclaimShift);
router.patch( "/shifts/:id/assign",   requireAdmin, shifts.reassignShift);
router.delete("/shifts/:id",          requireAdmin, shifts.deleteShift);

export default router;
