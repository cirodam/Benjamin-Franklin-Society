import { effectRegistry, LeaderPool, currentTermWindow } from "@ecf/core";
import { DocumentLoader } from "../DocumentLoader.js";
import { DomainService } from "../../DomainService.js";
import { NominationService } from "../../nomination/NominationService.js";
import { PersonService } from "../../person/PersonService.js";
import { CommunityLogService } from "../../log/CommunityLogService.js";

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

// ── accept-nomination ─────────────────────────────────────────────────────────
// Payload: { nominationId: string }

effectRegistry.register("accept-nomination", {
    label: "Accept nomination",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.nominationId !== "string" || !p.nominationId)
            return "payload.nominationId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const nominationId = payload.nominationId as string;
        const domainSvc    = DomainService.getInstance();

        const n = NominationService.getInstance().confirm(nominationId, motion.id);
        if (!n) throw new Error(`Nomination "${nominationId}" not found or already resolved`);

        if (n.type === "pool" && n.poolId) {
            const pool = domainSvc.getPool(n.poolId);
            if (pool) {
                pool.addPerson(n.nomineeId);
                domainSvc.savePool(pool);
            }
        } else if (n.roleId) {
            const role = domainSvc.getRole(n.roleId);
            if (role) {
                role.memberId      = n.nomineeId;
                role.termStartDate = new Date();
                const cp2 = (k: string) => new DocumentLoader().getParam("constitution", k) as number;
                role.termEndDate   = currentTermWindow({
                    startMonth: cp2("assemblyTermStartMonth"),
                    startDay:   cp2("assemblyTermStartDay"),
                    termMonths: cp2("assemblyTermMonths"),
                }).end;
                domainSvc.saveRole(role);
            }
        }

        motion.outcomeNote = `Nomination confirmed. Nominee added to ${n.type === "pool" ? "pool" : "role"}.`;
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
            CommunityLogService.getInstance().write(
                "pool-member-added",
                `${person.firstName} ${person.lastName} added to pool "${pool.name}" via petition.`,
                { actorId: motion.proposerId, refId: pool.id },
            );
        } catch { /* non-fatal */ }
    },
});
