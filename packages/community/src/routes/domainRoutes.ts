import { Router } from "express";
import { requireAuth, requireAdmin } from "./middleware.js";
import * as domains from "./DomainController.js";
const router = Router();

// Domains
router.get(  "/domains",     domains.listDomains);
router.get(  "/domains/:id", domains.getDomain);
router.patch("/domains/:id", ...requireAdmin, domains.updateDomain);

// Domain budgets
router.get(   "/domains/:id/budget",               domains.getDomainBudget);
router.post(  "/domains/:id/budget/items",          ...requireAdmin, domains.addBudgetItem);
router.patch( "/domains/:id/budget/items/:itemId",  ...requireAdmin, domains.updateBudgetItem);
router.delete("/domains/:id/budget/items/:itemId",  ...requireAdmin, domains.removeBudgetItem);

// Units
router.get(   "/units",     domains.listUnits);
router.get(   "/units/:id", domains.getUnit);
router.post(  "/units",     ...requireAdmin, domains.createUnit);
router.patch( "/units/:id", ...requireAdmin, domains.updateUnit);
router.delete("/units/:id", ...requireAdmin, domains.deleteUnit);

// Unit templates
router.get("/templates",   domains.listTemplates);
router.get("/unit-types",  domains.listUnitTypes);

// Roles
router.get(   "/roles/vacancies",     domains.listVacancies);
router.get(   "/roles/expiring",      domains.listExpiringRoles);
router.get(   "/roles",     domains.listRoles);
router.get(   "/roles/:id", domains.getRole);
router.post(  "/roles",     ...requireAdmin, domains.createRole);
router.patch( "/roles/:id", ...requireAdmin, domains.updateRole);
router.delete("/roles/:id", ...requireAdmin, domains.deleteRole);

// Role types
router.get(   "/role-types",     domains.listRoleTypes);
router.get(   "/role-types/:id", domains.getRoleType);
router.post(  "/role-types",     ...requireAdmin, domains.createRoleType);
router.patch( "/role-types/:id", ...requireAdmin, domains.updateRoleType);
router.delete("/role-types/:id", ...requireAdmin, domains.deleteRoleType);

// Pools
router.get(   "/pools",                       domains.listPools);
router.get(   "/pools/:id",                   domains.getPool);
router.post(  "/pools",                       ...requireAdmin, domains.createPool);
router.patch( "/pools/:id",                   ...requireAdmin, domains.updatePool);
router.post(  "/pools/:id/members",           ...requireAdmin, domains.addPoolMember);
router.delete("/pools/:id/members/:handle", ...requireAdmin, domains.removePoolMember);
router.delete("/pools/:id",                   ...requireAdmin, domains.deletePool);

export default router;
