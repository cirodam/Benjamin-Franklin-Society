import { effectRegistry, LeaderPool, currentTermWindow } from "@ecf/core";
import { DocumentLoader } from "../DocumentLoader.js";
import { DomainService } from "../../DomainService.js";
import { PersonService } from "../../person/PersonService.js";
import { ActivityLogService } from "@ecf/core";

// ── add-pool ──────────────────────────────────────────────────────────────────
// Payload: { name: string, description?: string }

effectRegistry.register("add-pool", {
    label:       "Add leadership pool",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.name !== "string" || !p.name.trim())
            return "payload.name must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const name        = (payload.name as string).trim();
        const description = typeof payload.description === "string" ? payload.description.trim() : "";
        const pool        = new LeaderPool(undefined, name, "simple-majority", description);
        DomainService.getInstance().createPool(pool);
        motion.outcomeNote = `Leadership pool "${name}" created (id: ${pool.id}).`;
    },
});

// ── remove-pool ───────────────────────────────────────────────────────────────
// Payload: { poolId: string }

effectRegistry.register("remove-pool", {
    label:       "Remove leadership pool",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.poolId !== "string" || !p.poolId)
            return "payload.poolId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const poolId = payload.poolId as string;
        const pool   = DomainService.getInstance().getPool(poolId);
        if (!pool) throw new Error(`Leadership pool "${poolId}" not found`);
        DomainService.getInstance().deletePool(poolId);
        motion.outcomeNote = `Leadership pool "${pool.name}" removed.`;
    },
});

// ── nominate-for-role ─────────────────────────────────────────────────────────
// Payload: { roleId: string, nomineeHandle: string, statement?: string }

effectRegistry.register("nominate-for-role", {
    label: "Nominate for role",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.roleId !== "string" || !p.roleId)
            return "payload.roleId must be a non-empty string";
        if (typeof p.nomineeHandle !== "string" || !p.nomineeHandle)
            return "payload.nomineeHandle must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const roleId        = payload.roleId        as string;
        const nomineeHandle = payload.nomineeHandle as string;
        const domainSvc     = DomainService.getInstance();

        const role = domainSvc.getRole(roleId);
        if (!role) throw new Error(`Role "${roleId}" not found`);

        const person = PersonService.getInstance().getByHandle(nomineeHandle);
        if (!person) throw new Error(`Person "@${nomineeHandle}" not found`);

        role.memberId      = person.id;
        role.termStartDate = new Date();
        const cp = (k: string) => new DocumentLoader().getParam("constitution", k) as number;
        role.termEndDate   = currentTermWindow({
            startMonth: cp("assemblyTermStartMonth"),
            startDay:   cp("assemblyTermStartDay"),
            termMonths: cp("assemblyTermMonths"),
        }).end;
        domainSvc.saveRole(role);

        motion.outcomeNote = `${person.firstName} ${person.lastName} (@${nomineeHandle}) appointed to ${role.title}.`;
    },
});

// ── add-pool-member ───────────────────────────────────────────────────────────
// Adds an existing person directly to a leader pool via a petition vote.
// Payload: { poolId: string, personId: string }

effectRegistry.register("add-pool-member", {
    label:       "Add person to leader pool",
    authorityId: "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.poolId !== "string" || !p.poolId)
            return "payload.poolId must be a non-empty string";
        if (typeof p.personId !== "string" || !p.personId)
            return "payload.personId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const poolId   = payload.poolId   as string;
        const personId = payload.personId as string;

        const domainSvc = DomainService.getInstance();
        const pool      = domainSvc.getPool(poolId);
        if (!pool) throw new Error(`Leader pool "${poolId}" not found`);

        const person = PersonService.getInstance().get(personId);
        if (!person) throw new Error(`Person "${personId}" not found`);

        pool.addPerson(personId);
        domainSvc.savePool(pool);

        motion.outcomeNote = `${person.firstName} ${person.lastName} added to pool "${pool.name}".`;
        try {
            ActivityLogService.getInstance().write(
                "pool-member-added",
                `${person.firstName} ${person.lastName} added to pool "${pool.name}" via petition.`,
                { actorId: motion.proposerId, refId: pool.id },
            );
        } catch { /* non-fatal */ }
    },
});
