import { Request, Response } from "express";
import { DomainService } from "../DomainService.js";
import { FunctionalDomain } from "../common/domain/FunctionalDomain.js";
import { FunctionalUnit } from "../common/domain/FunctionalUnit.js";
import { UnitTemplateRegistry } from "../common/domain/UnitTemplateRegistry.js";
import { CommunityRole } from "../common/CommunityRole.js";
import { RoleType } from "../common/RoleType.js";
import { LeaderPool } from "@ecf/core";
import type { BudgetCategory } from "../common/domain/FunctionalDomain.js";
import { PersonService } from "../person/PersonService.js";
import { LocationService } from "../location/LocationService.js";

const svc = () => DomainService.getInstance();

// ── Domains ───────────────────────────────────────────────────────────────────

// GET /api/domains
export function listDomains(_req: Request, res: Response): void {
    res.json(svc().getDomains().map(toDomainDto));
}

// GET /api/domains/:id
export function getDomain(req: Request, res: Response): void {
    const domain = svc().getDomain(req.params.id as string);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    res.json(toDomainDto(domain));
}

// PATCH /api/domains/:id
// Body: { poolId? }
export function updateDomain(req: Request, res: Response): void {
    const domain = svc().getDomain(req.params.id as string);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    const { poolId } = req.body ?? {};
    if (poolId !== undefined) {
        if (poolId !== null && typeof poolId !== "string") {
            res.status(400).json({ error: "poolId must be a string or null" }); return;
        }
        domain.poolId = poolId;
        svc().saveDomain(domain);
    }
    res.json(toDomainDto(domain));
}

// ── Units ─────────────────────────────────────────────────────────────────────

// GET /api/units
export function listUnits(_req: Request, res: Response): void {
    res.json(svc().getUnits().map(toUnitDto));
}

// GET /api/units/:id
export function getUnit(req: Request, res: Response): void {
    const unit = svc().getUnit(req.params.id as string);
    if (!unit) { res.status(404).json({ error: "Unit not found" }); return; }
    res.json(toUnitDto(unit));
}

// POST /api/units
// Body: { type, domainId, name?, description? }
// Creates a unit from a registered template and attaches it to the domain.
// Optional name/description override the template defaults.
export function createUnit(req: Request, res: Response): void {
    const { type, domainId, name, description } = req.body ?? {};
    if (typeof type !== "string" || !type.trim()) {
        res.status(400).json({ error: "type is required" }); return;
    }
    if (typeof domainId !== "string" || !domainId) {
        res.status(400).json({ error: "domainId is required" }); return;
    }
    const domain = svc().getDomain(domainId);
    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    const unit = UnitTemplateRegistry.create(type.trim());
    if (!unit) { res.status(400).json({ error: `Unknown unit type "${type}"` }); return; }

    unit.applyOverrides(
        typeof name === "string" && name.trim() ? name.trim() : undefined,
        typeof description === "string" ? description : undefined,
    );

    svc().createUnit(unit, domainId);
    res.status(201).json(toUnitDto(unit));
}

// DELETE /api/units/:id
export function deleteUnit(req: Request, res: Response): void {
    const deleted = svc().deleteUnit(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: "Unit not found" }); return; }
    res.status(204).send();
}

// PATCH /api/units/:id
// Body: { name?, description?, locationId? }
export function updateUnit(req: Request, res: Response): void {
    const unit = svc().getUnit(req.params.id as string);
    if (!unit) { res.status(404).json({ error: "Unit not found" }); return; }
    const { name, description, locationId } = req.body ?? {};
    if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
            res.status(400).json({ error: "name must be a non-empty string" }); return;
        }
        (unit as unknown as Record<string, unknown>)["name"] = name.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") {
            res.status(400).json({ error: "description must be a string" }); return;
        }
        (unit as unknown as Record<string, unknown>)["description"] = description;
    }
    if (locationId !== undefined) {
        if (locationId !== null && typeof locationId !== "string") {
            res.status(400).json({ error: "locationId must be a string or null" }); return;
        }
        if (locationId !== null && !LocationService.getInstance().get(locationId)) {
            res.status(404).json({ error: "Location not found" }); return;
        }
        unit.locationId = locationId;
    }
    svc().saveUnit(unit);
    res.json(toUnitDto(unit));
}

// GET /api/templates
// Returns all registered unit templates (type, label, description).
export function listTemplates(_req: Request, res: Response): void {
    const templates = UnitTemplateRegistry.getAll().map(t => ({
        type:        t.type,
        label:       t.label,
        description: t.description,
    }));
    res.json(templates);
}

// GET /api/unit-types
// Returns all unit types (built-ins + custom DB-persisted), with a custom flag.
export function listUnitTypes(_req: Request, res: Response): void {
    const customSet = new Set(svc().getUnitTypes().map(u => u.type));
    const types = UnitTemplateRegistry.getAll().map(t => ({
        type:        t.type,
        label:       t.label,
        description: t.description,
        custom:      customSet.has(t.type),
    }));
    res.json(types);
}

// ── Roles ─────────────────────────────────────────────────────────────────────

// GET /api/roles
export function listRoles(_req: Request, res: Response): void {
    res.json(svc().getRoles().map(toRoleDto));
}

// GET /api/roles/:id
export function getRole(req: Request, res: Response): void {
    const role = svc().getRole(req.params.id as string);
    if (!role) { res.status(404).json({ error: "Role not found" }); return; }
    res.json(toRoleDto(role));
}

// POST /api/roles
// Body: { unitId, roleTypeId?, title?, description?, kinPerMonth? }
// Creates a role slot in a unit. Either roleTypeId (from the bank) or title must be supplied.
export function createRole(req: Request, res: Response): void {
    const { unitId, roleTypeId, title, description, kinPerMonth } = req.body ?? {};
    if (typeof unitId !== "string" || !unitId) {
        res.status(400).json({ error: "unitId is required" }); return;
    }
    const unit = svc().getUnit(unitId);
    if (!unit) { res.status(404).json({ error: "Unit not found" }); return; }

    let resolvedTitle: string;
    let resolvedDescription: string;
    let resolvedRoleTypeId: string | null = null;
    let resolvedKinPerMonth: number = kinPerMonth ?? 0;

    if (typeof roleTypeId === "string" && roleTypeId) {
        const rt = svc().getRoleType(roleTypeId);
        if (!rt) { res.status(404).json({ error: "Role type not found" }); return; }
        resolvedTitle       = rt.title;
        resolvedDescription = rt.description;
        resolvedRoleTypeId  = rt.id;
        resolvedKinPerMonth = kinPerMonth ?? rt.defaultKinPerMonth;
    } else if (typeof title === "string" && title.trim()) {
        resolvedTitle       = title.trim();
        resolvedDescription = description ?? "";
    } else {
        res.status(400).json({ error: "Either roleTypeId or title is required" }); return;
    }

    const role = new CommunityRole(resolvedTitle, resolvedDescription, resolvedKinPerMonth, resolvedRoleTypeId);
    svc().createRole(role, unitId);
    res.status(201).json(toRoleDto(role));
}

// PATCH /api/roles/:id
// Body: { memberHandle?, kinPerMonth?, funded?, termStartDate?, termEndDate?, title?, description?, weeklySchedule? }
export function updateRole(req: Request, res: Response): void {
    const role = svc().getRole(req.params.id as string);
    if (!role) { res.status(404).json({ error: "Role not found" }); return; }
    const { memberHandle, kinPerMonth, funded, termStartDate, termEndDate, title, description, weeklySchedule } = req.body ?? {};
    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
            res.status(400).json({ error: "title must be a non-empty string" }); return;
        }
        role.title = title.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") {
            res.status(400).json({ error: "description must be a string" }); return;
        }
        role.description = description;
    }
    if (memberHandle !== undefined) {
        if (memberHandle === null) {
            role.memberId = null;
        } else {
            const person = PersonService.getInstance().getByHandle(memberHandle);
            if (!person) { res.status(404).json({ error: "Person not found" }); return; }
            role.memberId = person.id;
        }
    }
    if (kinPerMonth  !== undefined) {
        if (typeof kinPerMonth !== "number" || kinPerMonth < 0) {
            res.status(400).json({ error: "kinPerMonth must be a non-negative number" }); return;
        }
        role.kinPerMonth = kinPerMonth;
    }
    if (funded       !== undefined) role.funded       = funded;
    if (termStartDate !== undefined) role.termStartDate = termStartDate ? new Date(termStartDate) : null;
    if (termEndDate   !== undefined) role.termEndDate   = termEndDate   ? new Date(termEndDate)   : null;
    if (weeklySchedule !== undefined) {
        if (!Array.isArray(weeklySchedule)) {
            res.status(400).json({ error: "weeklySchedule must be an array" }); return;
        }
        role.weeklySchedule = weeklySchedule;
    }
    svc().saveRole(role);
    res.json(toRoleDto(role));
}

// DELETE /api/roles/:id
export function deleteRole(req: Request, res: Response): void {
    const deleted = svc().deleteRole(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: "Role not found" }); return; }
    res.status(204).send();
}

// ── Role Types (the bank) ─────────────────────────────────────────────────────

// GET /api/role-types
export function listRoleTypes(_req: Request, res: Response): void {
    res.json(svc().getRoleTypes().map(toRoleTypeDto));
}

// GET /api/role-types/:id
export function getRoleType(req: Request, res: Response): void {
    const rt = svc().getRoleType(req.params.id as string);
    if (!rt) { res.status(404).json({ error: "Role type not found" }); return; }
    res.json(toRoleTypeDto(rt));
}

// POST /api/role-types
// Body: { title, description?, defaultKinPerMonth? }
export function createRoleType(req: Request, res: Response): void {
    const { title, description, defaultKinPerMonth } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "title is required" }); return;
    }
    if (svc().hasRoleTypeWithTitle(title.trim())) {
        res.status(409).json({ error: `A role type named "${title.trim()}" already exists` }); return;
    }
    const rt = new RoleType(title.trim(), description ?? "", defaultKinPerMonth ?? 0);
    svc().createRoleType(rt);
    res.status(201).json(toRoleTypeDto(rt));
}

// PATCH /api/role-types/:id
// Body: { title?, description?, defaultKinPerMonth? }
export function updateRoleType(req: Request, res: Response): void {
    const rt = svc().getRoleType(req.params.id as string);
    if (!rt) { res.status(404).json({ error: "Role type not found" }); return; }
    const { title, description, defaultKinPerMonth } = req.body ?? {};
    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
            res.status(400).json({ error: "title must be a non-empty string" }); return;
        }
        rt.title = title.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") {
            res.status(400).json({ error: "description must be a string" }); return;
        }
        rt.description = description;
    }
    if (defaultKinPerMonth !== undefined) {
        if (typeof defaultKinPerMonth !== "number" || defaultKinPerMonth < 0) {
            res.status(400).json({ error: "defaultKinPerMonth must be a non-negative number" }); return;
        }
        rt.defaultKinPerMonth = defaultKinPerMonth;
    }
    svc().saveRoleType(rt);
    res.json(toRoleTypeDto(rt));
}

// DELETE /api/role-types/:id
export function deleteRoleType(req: Request, res: Response): void {
    const deleted = svc().deleteRoleType(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: "Role type not found" }); return; }
    res.status(204).send();
}

// ── Pools ─────────────────────────────────────────────────────────────────────

// GET /api/pools
export function listPools(_req: Request, res: Response): void {
    res.json(svc().getPools().map(toPoolDto));
}

// GET /api/pools/:id
export function getPool(req: Request, res: Response): void {
    const pool = svc().getPool(req.params.id as string);
    if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
    res.json(toPoolDto(pool));
}

// POST /api/pools
// Body: { name, description? }
export function createPool(req: Request, res: Response): void {
    const { name, description } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" }); return;
    }
    const pool = new LeaderPool(name.trim(), description ?? "");
    svc().createPool(pool);
    res.status(201).json(toPoolDto(pool));
}

// PATCH /api/pools/:id
// Body: { mandate?, name?, description? }
export function updatePool(req: Request, res: Response): void {
    const pool = svc().getPool(req.params.id as string);
    if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
    const { mandate, name, description } = req.body ?? {};
    if (mandate !== undefined) {
        if (typeof mandate !== "string") { res.status(400).json({ error: "mandate must be a string" }); return; }
        pool.mandate = mandate;
    }
    if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) { res.status(400).json({ error: "name must be a non-empty string" }); return; }
        (pool as unknown as Record<string, unknown>)["name"] = name.trim();
    }
    if (description !== undefined) {
        if (typeof description !== "string") { res.status(400).json({ error: "description must be a string" }); return; }
        (pool as unknown as Record<string, unknown>)["description"] = description;
    }
    svc().savePool(pool);
    res.json(toPoolDto(pool));
}

// POST /api/pools/:id/members
// Body: { handle }
export function addPoolMember(req: Request, res: Response): void {
    const pool = svc().getPool(req.params.id as string);
    if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
    const { handle } = req.body ?? {};
    if (typeof handle !== "string" || !handle) {
        res.status(400).json({ error: "handle is required" }); return;
    }
    const person = PersonService.getInstance().getByHandle(handle);
    if (!person) {
        res.status(404).json({ error: "Person not found" }); return;
    }
    pool.addPerson(person.id);
    svc().savePool(pool);
    res.json(toPoolDto(pool));
}

// DELETE /api/pools/:id/members/:handle
export function removePoolMember(req: Request, res: Response): void {
    const pool = svc().getPool(req.params.id as string);
    if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
    const person = PersonService.getInstance().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    pool.removePerson(person.id);
    svc().savePool(pool);
    res.json(toPoolDto(pool));
}

// DELETE /api/pools/:id
export function deletePool(req: Request, res: Response): void {
    const deleted = svc().deletePool(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: "Pool not found" }); return; }
    res.status(204).send();
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

function toDomainDto(d: FunctionalDomain) {
    return {
        id:          d.getId(),
        name:        d.getDisplayName(),
        handle:      d.getHandle(),
        description: d.description,
        unitIds:     d.unitIds,
        poolId:      d.poolId,
    };
}

function toUnitDto(u: FunctionalUnit) {
    const ppl = PersonService.getInstance();
    return {
        id:           u.id,
        name:         u.name,
        description:  u.description,
        type:         u.getType(),
        personHandles: u.personIds.map(id => ppl.get(id)?.handle ?? id),
        roleIds:      u.roleIds,
        locationId:   u.locationId,
        createdAt:    u.createdAt,
    };
}

function toRoleDto(r: CommunityRole) {
    const ppl = PersonService.getInstance();
    return {
        id:             r.id,
        roleTypeId:     r.roleTypeId,
        title:          r.title,
        description:    r.description,
        memberHandle:   r.memberId ? (ppl.get(r.memberId)?.handle ?? null) : null,
        kinPerMonth:    r.kinPerMonth,
        funded:         r.funded,
        termStartDate:  r.termStartDate,
        termEndDate:    r.termEndDate,
        isActive:       r.isActive(),
        weeklySchedule: r.weeklySchedule,
    };
}

function toRoleTypeDto(rt: RoleType) {
    return {
        id:                 rt.id,
        title:              rt.title,
        description:        rt.description,
        defaultKinPerMonth: rt.defaultKinPerMonth,
        preferredUnitTypes: rt.preferredUnitTypes,
        category:           rt.category,
        responsibilities:   rt.responsibilities,
        qualifications:     rt.qualifications,
    };
}

function toPoolDto(p: LeaderPool) {
    const ppl = PersonService.getInstance();
    return {
        id:            p.id,
        name:          p.name,
        description:   p.description,
        mandate:       p.mandate,
        personHandles: p.personIds.map(id => ppl.get(id)?.handle ?? id),
        createdAt:     p.createdAt,
    };
}

// ── Budget ────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<string>(["supplies", "equipment", "services", "other"]);

// GET /api/domains/:id/budget
export function getDomainBudget(req: Request, res: Response): void {
    const budget = svc().getDomainBudget(req.params.id as string);
    if (!budget) { res.status(404).json({ error: "Domain not found" }); return; }
    res.json(budget);
}

// POST /api/domains/:id/budget/items
// Body: { label, amount, category?, note?, perMember? }
export function addBudgetItem(req: Request, res: Response): void {
    const { label, amount, category, note, perMember } = req.body ?? {};
    if (typeof label !== "string" || !label.trim()) {
        res.status(400).json({ error: "label is required" }); return;
    }
    if (typeof amount !== "number" || amount < 0) {
        res.status(400).json({ error: "amount must be a non-negative number" }); return;
    }
    const cat: BudgetCategory = VALID_CATEGORIES.has(category) ? category : "other";
    const item = svc().addBudgetItem(req.params.id as string, {
        label:     label.trim(),
        amount,
        category:  cat,
        note:      typeof note === "string" ? note : "",
        perMember: perMember === true,
    });
    if (!item) { res.status(404).json({ error: "Domain not found" }); return; }
    res.status(201).json(item);
}

// PATCH /api/domains/:id/budget/items/:itemId
// Body: { label?, amount?, category?, note?, perMember? }
export function updateBudgetItem(req: Request, res: Response): void {
    const { label, amount, category, note, perMember } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (label     !== undefined) patch["label"]     = typeof label === "string" ? label.trim() : label;
    if (amount    !== undefined) patch["amount"]    = amount;
    if (category  !== undefined) patch["category"]  = VALID_CATEGORIES.has(category) ? category : "other";
    if (note      !== undefined) patch["note"]      = note;
    if (perMember !== undefined) patch["perMember"] = perMember === true;
    const item = svc().updateBudgetItem(req.params.id as string, req.params.itemId as string, patch);
    if (!item) { res.status(404).json({ error: "Domain or item not found" }); return; }
    res.json(item);
}

// DELETE /api/domains/:id/budget/items/:itemId
export function removeBudgetItem(req: Request, res: Response): void {
    const removed = svc().removeBudgetItem(req.params.id as string, req.params.itemId as string);
    if (!removed) { res.status(404).json({ error: "Domain or item not found" }); return; }
    res.status(204).send();
}
