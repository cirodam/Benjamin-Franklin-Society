import { Router } from "express";
import * as setup from "./SetupController.js";
import * as sms from "./SmsController.js";
import personRoutes from "./personRoutes.js";
import applicationRoutes from "./applicationRoutes.js";
import domainRoutes from "./domainRoutes.js";
import economicsRoutes from "./economicsRoutes.js";
import associationRoutes from "./associationRoutes.js";
import calendarRoutes from "./calendarRoutes.js";
import governanceRoutes from "./governanceRoutes.js";
import shiftRoutes from "./shiftRoutes.js";
import { ActivityLogService } from "@ecf/core";
import { Request, Response } from "express";

const router = Router();

// Setup (first-boot only)
router.get( "/setup/status", setup.getSetupStatus);
router.post("/setup",        setup.setup);

// SMS banking (inbound webhook — for testing or gammu-smsd RunOnReceive)
router.post("/sms/inbound", sms.smsInbound);

// Community timeline — public transparency log
// GET /api/log?limit=50&before=<ISO timestamp>
router.get("/log", (_req: Request, res: Response) => {
    const limit  = Math.min(200, Math.max(1, Number(_req.query["limit"] ?? 50)));
    const before = typeof _req.query["before"] === "string" ? _req.query["before"] : undefined;
    res.json(ActivityLogService.getInstance().recent(limit, before));
});

router.use("/", personRoutes);
router.use("/", applicationRoutes);
router.use("/", domainRoutes);
router.use("/", economicsRoutes);
router.use("/", associationRoutes);
router.use("/", calendarRoutes);
router.use("/", governanceRoutes);
router.use("/", shiftRoutes);

export default router;
