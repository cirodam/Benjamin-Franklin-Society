import { Router } from "express";
import { requireAuth, requireAdmin, requireGrangeAccess } from "./middleware.js";
import {
    listFarms, getFarm, registerFarm, updateFarmStatus, updateFarmPractices, approveFarm,
} from "./FarmController.js";
import {
    listProjections, getProjection, getProjectionCoverage, publishProjection, approveProjection,
} from "./ProjectionController.js";
import {
    listContracts, getContract, submitContract, updateContractStatus,
    recordDelivery, recordInspection, settleContract,
} from "./ContractController.js";

const router = Router();

// ── Farm associations ─────────────────────────────────────────────────────────
router.get(   "/farms",                        listFarms);
router.get(   "/farms/:id",                    getFarm);
router.post(  "/farms",                        ...requireGrangeAccess, registerFarm);
router.patch( "/farms/:id/practices",          ...requireGrangeAccess, updateFarmPractices);
router.patch( "/farms/:id/status",             ...requireAdmin,      updateFarmStatus);
router.post(  "/farms/:id/approve",            ...requireAdmin,      approveFarm);

// ── Needs projections ─────────────────────────────────────────────────────────
router.get(   "/projections",                  listProjections);
router.get(   "/projections/:id",              getProjection);
router.get(   "/projections/:id/coverage",     getProjectionCoverage);
router.post(  "/projections",                  ...requireAdmin,      publishProjection);
router.patch( "/projections/:id/approve",      ...requireAdmin,      approveProjection);

// ── Contracts ─────────────────────────────────────────────────────────────────
router.get(   "/contracts",                    listContracts);
router.get(   "/contracts/:id",                getContract);
router.post(  "/contracts",                    ...requireGrangeAccess, submitContract);
router.patch( "/contracts/:id/status",         ...requireAdmin,      updateContractStatus);
router.post(  "/contracts/:id/deliveries",     ...requireGrangeAccess, recordDelivery);
router.post(  "/contracts/:id/inspections",    ...requireAdmin,      recordInspection);
router.post(  "/contracts/:id/settle",         ...requireAdmin,      settleContract);

export default router;
