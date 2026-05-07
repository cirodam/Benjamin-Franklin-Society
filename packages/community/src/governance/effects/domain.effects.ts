import { effectRegistry } from "@ecf/core";
import { DomainService } from "../../DomainService.js";
import { RoleType } from "../../common/RoleType.js";
import { UnitType } from "../../common/domain/UnitType.js";
import { FunctionalUnit } from "@ecf/core";
import { FunctionalRole } from "@ecf/core";
import { UnitTemplateRegistry } from "../../common/domain/UnitTemplateRegistry.js";
import { ActivityLogService } from "@ecf/core";

// ── add-role-type ─────────────────────────────────────────────────────────────
// Payload: { title, description?, defaultKinPerMonth? }

effectRegistry.register("add-role-type", {
    label:       "Add role type to bank",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.title !== "string" || !p.title.trim())
            return "payload.title must be a non-empty string";
        if (p.defaultKinPerMonth !== undefined && typeof p.defaultKinPerMonth !== "number")
            return "payload.defaultKinPerMonth must be a number";
        return null;
    },
    handler({ motion, payload }) {
        const title = (payload.title as string).trim();
        const svc   = DomainService.getInstance();
        if (svc.hasRoleTypeWithTitle(title))
            throw new Error(`Role type "${title}" already exists in the role bank`);
        const rt = new RoleType(
            title,
            typeof payload.description      === "string" ? payload.description.trim()      : "",
            typeof payload.defaultKinPerMonth === "number" ? payload.defaultKinPerMonth     : 0,
        );
        svc.createRoleType(rt);
        motion.outcomeNote = `Role type "${title}" added to the role bank (id: ${rt.id}).`;
        try {
            ActivityLogService.getInstance().write(
                "role-type-added",
                `Role type "${title}" added to the role bank.`,
                { actorId: motion.proposerId, refId: rt.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── remove-role-type ──────────────────────────────────────────────────────────
// Payload: { roleTypeId }

effectRegistry.register("remove-role-type", {
    label:       "Remove role type from bank",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.roleTypeId !== "string" || !p.roleTypeId)
            return "payload.roleTypeId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const roleTypeId = payload.roleTypeId as string;
        const svc        = DomainService.getInstance();
        const rt         = svc.getRoleType(roleTypeId);
        if (!rt) throw new Error(`Role type "${roleTypeId}" not found`);
        svc.deleteRoleType(roleTypeId);
        motion.outcomeNote = `Role type "${rt.title}" removed from the role bank.`;
        try {
            ActivityLogService.getInstance().write(
                "role-type-removed",
                `Role type "${rt.title}" removed from the role bank.`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── add-unit-type ─────────────────────────────────────────────────────────────
// Payload: { type, label, description }

effectRegistry.register("add-unit-type", {
    label:       "Add unit type to bank",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.type !== "string" || !p.type.trim())
            return "payload.type must be a non-empty string (kebab-case identifier)";
        if (typeof p.label !== "string" || !p.label.trim())
            return "payload.label must be a non-empty string";
        if (typeof p.description !== "string")
            return "payload.description must be a string";
        return null;
    },
    handler({ motion, payload }) {
        const type        = (payload.type as string).trim().toLowerCase().replace(/\s+/g, "-");
        const label       = (payload.label as string).trim();
        const description = (payload.description as string).trim();
        const svc         = DomainService.getInstance();
        if (svc.hasUnitTypeWithType(type))
            throw new Error(`Unit type "${type}" already exists in the bank`);
        const ut = new UnitType(type, label, description);
        svc.createUnitType(ut);
        motion.outcomeNote = `Unit type "${label}" (${type}) added to the unit bank.`;
        try {
            ActivityLogService.getInstance().write(
                "unit-type-added",
                `Unit type "${label}" (${type}) added to the unit bank.`,
                { actorId: motion.proposerId, refId: ut.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── remove-unit-type ──────────────────────────────────────────────────────────
// Payload: { unitType }

effectRegistry.register("remove-unit-type", {
    label:       "Remove unit type from bank",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.unitType !== "string" || !p.unitType)
            return "payload.unitType must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const unitType = payload.unitType as string;
        const svc      = DomainService.getInstance();
        const ut       = svc.getUnitType(unitType);
        if (!ut) throw new Error(
            UnitTemplateRegistry.get(unitType)
                ? `Unit type "${unitType}" is a built-in type and cannot be removed via governance`
                : `Custom unit type "${unitType}" not found`,
        );
        svc.deleteUnitType(unitType);
        motion.outcomeNote = `Unit type "${ut.label}" (${unitType}) removed from the unit bank.`;
        try {
            ActivityLogService.getInstance().write(
                "unit-type-removed",
                `Unit type "${ut.label}" removed from the unit bank.`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── deploy-unit ───────────────────────────────────────────────────────────────
// Payload: { domainId, unitType, name?, description?, roles? }

effectRegistry.register("deploy-unit", {
    label:       "Deploy functional unit",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.domainId !== "string" || !p.domainId)
            return "payload.domainId must be a non-empty string";
        if (typeof p.unitType !== "string" || !p.unitType)
            return "payload.unitType must be a non-empty string";
        if (p.roles !== undefined) {
            if (!Array.isArray(p.roles)) return "payload.roles must be an array";
            for (const slot of p.roles as unknown[]) {
                if (typeof slot !== "object" || slot === null)
                    return "each roles entry must be an object";
                const s = slot as Record<string, unknown>;
                if (typeof s.roleTypeId !== "string" || !s.roleTypeId)
                    return "each roles entry must have a roleTypeId string";
                if (s.count !== undefined && (typeof s.count !== "number" || s.count < 1))
                    return "roles[].count must be a positive number";
                if (s.kinPerMonth !== undefined && typeof s.kinPerMonth !== "number")
                    return "roles[].kinPerMonth must be a number";
            }
        }
        return null;
    },
    handler({ motion, payload }) {
        const domainId = payload.domainId as string;
        const unitType = payload.unitType as string;
        const svc      = DomainService.getInstance();

        const domain = svc.getDomain(domainId);
        if (!domain) throw new Error(`Domain "${domainId}" not found`);

        const customUt   = svc.getUnitType(unitType);
        const builtinTpl = UnitTemplateRegistry.get(unitType);
        if (!customUt && !builtinTpl)
            throw new Error(`Unit type "${unitType}" not found in the unit bank`);

        const unit = new FunctionalUnit(
            typeof payload.name        === "string" && payload.name.trim()        ? payload.name.trim()        : (customUt?.label       ?? builtinTpl!.label),
            typeof payload.description === "string" && payload.description.trim() ? payload.description.trim() : (customUt?.description ?? builtinTpl!.description),
            unitType,
        );
        svc.createUnit(unit, domainId);

        let roleCount = 0;
        const roles = payload.roles as Array<{ roleTypeId: string; count?: number; kinPerMonth?: number }> | undefined;
        if (roles && roles.length > 0) {
            for (const slot of roles) {
                const rt = svc.getRoleType(slot.roleTypeId);
                if (!rt) throw new Error(`Role type "${slot.roleTypeId}" not found`);
                const count = Math.max(1, Math.floor(slot.count ?? 1));
                for (let i = 0; i < count; i++) {
                    svc.createRole(
                        new FunctionalRole(rt.title, rt.description, slot.kinPerMonth ?? rt.defaultKinPerMonth, rt.id),
                        unit.id,
                    );
                    roleCount++;
                }
            }
        }

        const roleNote = roleCount > 0 ? ` with ${roleCount} role slot(s)` : "";
        motion.outcomeNote = `Unit "${unit.name}" deployed in domain "${domain.name}"${roleNote} (id: ${unit.id}).`;
        try {
            ActivityLogService.getInstance().write(
                "unit-deployed",
                `Functional unit "${unit.name}" deployed in ${domain.name}${roleNote}.`,
                { actorId: motion.proposerId, refId: unit.id },
            );
        } catch { /* non-fatal */ }
    },
});
