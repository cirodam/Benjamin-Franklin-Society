import { Router } from "express";
import { requireAuth, requireSteward } from "./middleware.js";
import * as domains from "./DomainController.js";
const router = Router();

// Domains
router.get(  "/domains",     domains.listDomains);
router.get(  "/domains/:id", domains.getDomain);
router.patch("/domains/:id", ...requireSteward, domains.updateDomain);

// Domain budgets
router.get(   "/domains/:id/budget",               domains.getDomainBudget);
router.post(  "/domains/:id/budget/items",          ...requireSteward, domains.addBudgetItem);
router.patch( "/domains/:id/budget/items/:itemId",  ...requireSteward, domains.updateBudgetItem);
router.delete("/domains/:id/budget/items/:itemId",  ...requireSteward, domains.removeBudgetItem);

// Units
router.get(   "/units",     domains.listUnits);
router.get(   "/units/:id", domains.getUnit);
router.post(  "/units",     ...requireSteward, domains.createUnit);
router.patch( "/units/:id", ...requireSteward, domains.updateUnit);
router.delete("/units/:id", ...requireSteward, domains.deleteUnit);

// Unit templates
router.get("/templates",   domains.listTemplates);
router.get("/unit-types",  domains.listUnitTypes);

// Roles
router.get(   "/roles/vacancies",     domains.listVacancies);
router.get(   "/roles/expiring",      domains.listExpiringRoles);
router.get(   "/roles",     domains.listRoles);
router.get(   "/roles/:id", domains.getRole);
router.post(  "/roles",     ...requireSteward, domains.createRole);
router.patch( "/roles/:id", ...requireSteward, domains.updateRole);
router.delete("/roles/:id", ...requireSteward, domains.deleteRole);

// Role types
router.get(   "/role-types",     domains.listRoleTypes);
router.get(   "/role-types/:id", domains.getRoleType);
router.post(  "/role-types",     ...requireSteward, domains.createRoleType);
router.patch( "/role-types/:id", ...requireSteward, domains.updateRoleType);
router.delete("/role-types/:id", ...requireSteward, domains.deleteRoleType);

// Pools
router.get(   "/pools",                       domains.listPools);
router.get(   "/pools/:id",                   domains.getPool);
router.post(  "/pools",                       ...requireSteward, domains.createPool);
router.patch( "/pools/:id",                   ...requireSteward, domains.updatePool);
router.post(  "/pools/:id/members",           ...requireSteward, domains.addPoolMember);
router.delete("/pools/:id/members/:handle", ...requireSteward, domains.removePoolMember);
router.delete("/pools/:id",                   ...requireSteward, domains.deletePool);

export default router;
