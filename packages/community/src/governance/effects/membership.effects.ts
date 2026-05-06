import { effectRegistry } from "@ecf/core";
import { Person } from "../../person/Person.js";
import { PersonService } from "../../person/PersonService.js";
import { CommunityLogService } from "../../log/CommunityLogService.js";

// ── admit-member ──────────────────────────────────────────────────────────────
// Payload: { firstName, lastName, birthDate, phone? }

effectRegistry.register("admit-member", {
    label: "Admit member",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.firstName !== "string" || !p.firstName.trim())
            return "payload.firstName must be a non-empty string";
        if (typeof p.lastName !== "string" || !p.lastName.trim())
            return "payload.lastName must be a non-empty string";
        if (typeof p.birthDate !== "string" || isNaN(new Date(p.birthDate).getTime()))
            return "payload.birthDate must be a valid ISO date string (YYYY-MM-DD)";
        return null;
    },
    handler({ motion, payload }) {
        const firstName = (payload.firstName as string).trim();
        const lastName  = (payload.lastName  as string).trim();
        const birthDate = new Date(payload.birthDate as string);
        const phone     = typeof payload.phone === "string" && payload.phone.trim()
            ? payload.phone.trim() : null;

        const svc = PersonService.getInstance();

        // Derive a unique handle
        const base = `${firstName}_${lastName}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
        let handle = base;
        let suffix = 2;
        while (svc.getByHandle(handle)) {
            handle = `${base}_${suffix++}`;
        }

        const person = new Person(firstName, lastName, birthDate, handle, false, null, phone, []);

        // Fire-and-forget: join handlers open bank accounts etc. asynchronously.
        svc.add(person).catch((err: unknown) => {
            console.error("[governance] add-person join handler failed:", err);
        });

        motion.outcomeNote = `${firstName} ${lastName} (@${handle}) added to the community.`;
        try {
            CommunityLogService.getInstance().write(
                "member-joined",
                `${firstName} ${lastName} (@${handle}) added via motion.`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── suspend-member ────────────────────────────────────────────────────────────
// Payload: { personId: string }

effectRegistry.register("suspend-member", {
    label: "Suspend member",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.personId !== "string" || !p.personId)
            return "payload.personId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const personId = payload.personId as string;
        const svc = PersonService.getInstance();
        if (!svc.get(personId)) throw new Error(`Person "${personId}" not found`);
        svc.update(personId, { disabled: true });
        motion.outcomeNote = "Member suspended.";
    },
});

// ── reinstate-member ──────────────────────────────────────────────────────────
// Payload: { personId: string }

effectRegistry.register("reinstate-member", {
    label: "Reinstate member",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.personId !== "string" || !p.personId)
            return "payload.personId must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const personId = payload.personId as string;
        const svc = PersonService.getInstance();
        if (!svc.get(personId)) throw new Error(`Person "${personId}" not found`);
        svc.update(personId, { disabled: false });
        motion.outcomeNote = "Member reinstated.";
    },
});
