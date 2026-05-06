/**
 * Built-in motion effect handlers.
 * Import this module once at startup (in index.ts) to register all effects.
 */

import { effectRegistry, LeaderPool, currentTermWindow } from "@ecf/core";
import { DocumentLoader } from "../DocumentLoader.js";
import { Person } from "../../person/Person.js";
import { PersonService } from "../../person/PersonService.js";
import { DomainService } from "../../DomainService.js";
import { NominationService } from "../../nomination/NominationService.js";
import { CalendarService } from "../../calendar/CalendarService.js";
import { CommunityLogService } from "../../log/CommunityLogService.js";
import { RoleType } from "../../common/RoleType.js";
import { UnitType } from "../../common/domain/UnitType.js";
import { FunctionalUnit } from "../../common/domain/FunctionalUnit.js";
import { CommunityRole } from "../../common/CommunityRole.js";
import { UnitTemplateRegistry } from "../../common/domain/UnitTemplateRegistry.js";
import { LocationService } from "../../location/LocationService.js";
import { Location } from "../../location/Location.js";
import { AssociationService } from "../../association/AssociationService.js";
import { Association } from "../../association/Association.js";

// ── amend-document-parameter ──────────────────────────────────────────────────
// Payload: { docId: string, parameter: string, newValue: number | boolean }

effectRegistry.register("amend-document-parameter", {
    label:     "Amend document parameter",
    authorityId:  "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.docId !== "string" || !p.docId)
            return "payload.docId must be a non-empty string";
        if (typeof p.parameter !== "string" || !p.parameter)
            return "payload.parameter must be a non-empty string";
        if (typeof p.newValue !== "number" && typeof p.newValue !== "boolean")
            return "payload.newValue must be a number or boolean";
        return null;
    },
    handler({ motion, payload }) {
        const docId     = payload.docId     as string;
        const parameter = payload.parameter as string;
        const newValue  = payload.newValue  as number | boolean;

        const docs     = new DocumentLoader();
        const oldValue = docs.getParams(docId)[parameter]?.value;
        const doc      = docs.amend(docId, parameter, newValue, motion.id);

        motion.outcomeNote =
            `Document "${docId}" amended: "${parameter}" changed from ${oldValue} to ${newValue} ` +
            `(v${doc.version}).`;
    },
});

// ── set-dues-rate ─────────────────────────────────────────────────────────────
// Payload: { rate: number }  — a percentage value, e.g. 2 means 2% per month
// Authority: referendum (the whole community votes on dues).

effectRegistry.register("set-dues-rate", {
    label:    "Set dues rate",
    authorityId: "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.rate !== "number" || isNaN(p.rate) || p.rate < 0 || p.rate > 10)
            return "payload.rate must be a number between 0 and 10 (percent)";
        return null;
    },
    handler({ motion, payload }) {
        const pct          = payload.rate as number;
        const rateDecimal  = pct / 100;
        const docs         = new DocumentLoader();
        const oldPct       = Math.round(docs.getParam<number>("constitution", "communityDuesRate") * 10_000) / 100;
        docs.amend("constitution", "communityDuesRate", rateDecimal, motion.id);
        motion.outcomeNote = `Community dues rate changed from ${oldPct}% to ${pct}% per month.`;
        try {
            CommunityLogService.getInstance().write(
                "constitution-amended",
                `Dues rate set to ${pct}% per month (was ${oldPct}%).`,                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── set-retirement-age ────────────────────────────────────────────────────────
// Payload: { age: number }  — whole years, 55–75.
// Authority: referendum.

effectRegistry.register("set-retirement-age", {
    label:    "Set retirement age",
    authorityId: "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (
            typeof p.age !== "number" || isNaN(p.age) ||
            !Number.isInteger(p.age) || p.age < 55 || p.age > 75
        ) return "payload.age must be a whole number between 55 and 75";
        return null;
    },
    handler({ motion, payload }) {
        const age          = payload.age as number;
        const docs         = new DocumentLoader();
        const oldAge       = docs.getParam<number>("constitution", "retirementAge");
        docs.amend("constitution", "retirementAge", age, motion.id);
        motion.outcomeNote = `Retirement age changed from ${oldAge} to ${age} years.`;
        try {
            CommunityLogService.getInstance().write(
                "constitution-amended",
                `Retirement age set to ${age} years (was ${oldAge}).`,                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── set-retirement-payout ─────────────────────────────────────────────────────
// Payload: { amount: number }  — kin per month per retiree, 0–100,000.
// Authority: referendum.

effectRegistry.register("set-retirement-payout", {
    label:    "Set retirement payout",
    authorityId: "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (
            typeof p.amount !== "number" || isNaN(p.amount) ||
            !Number.isInteger(p.amount) || p.amount < 0 || p.amount > 100_000
        ) return "payload.amount must be a whole number between 0 and 100,000";
        return null;
    },
    handler({ motion, payload }) {
        const amount       = payload.amount as number;
        const docs         = new DocumentLoader();
        const oldAmount    = docs.getParam<number>("constitution", "retirementPayoutRate");
        docs.amend("constitution", "retirementPayoutRate", amount, motion.id);
        motion.outcomeNote = `Monthly retirement payout changed from ${oldAmount} to ${amount} kin/month.`;
        try {
            CommunityLogService.getInstance().write(
                "constitution-amended",
                `Monthly retirement payout set to ${amount} kin/month (was ${oldAmount}).`,                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── add-person ────────────────────────────────────────────────────────────────
// Adds a new person to the community via motion rather than direct admin action.
// Different from membership applications: this is a deliberate community decision
// to bring someone in (e.g. a newborn, a transfer from another community, etc.).
// Payload: { firstName, lastName, birthDate, phone? }

effectRegistry.register("add-person", {
    label:    "Add person",
    authorityId: "referendum",
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

        const svc  = PersonService.getInstance();

        // Derive a unique handle
        const base = `${firstName}_${lastName}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
        let handle = base;
        let suffix = 2;
        while (svc.getByHandle(handle)) {
            handle = `${base}_${suffix++}`;
        }

        const person = new Person(
            firstName,
            lastName,
            birthDate,
            handle,
            false,
            null,
            phone,
            [],
        );

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
    label:    "Suspend member",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.personId !== "string" || !p.personId) return "payload.personId must be a non-empty string";
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
    label:    "Reinstate member",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.personId !== "string" || !p.personId) return "payload.personId must be a non-empty string";
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

// ── add-pool ──────────────────────────────────────────────────────────────────
// Creates a new LeaderPool (a named governing group).
// Payload: { name: string, description?: string }

effectRegistry.register("add-pool", {
    label:    "Add leadership pool",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.name !== "string" || !p.name.trim()) return "payload.name must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const name        = (payload.name as string).trim();
        const description = typeof payload.description === "string" ? payload.description.trim() : "";
        const pool = new LeaderPool(undefined, name, "simple-majority", description);
        DomainService.getInstance().createPool(pool);
        motion.outcomeNote = `Leadership pool "${name}" created (id: ${pool.id}).`;
    },
});

// ── remove-pool ───────────────────────────────────────────────────────────────
// Deletes an existing LeaderPool by ID.
// Payload: { poolId: string }

effectRegistry.register("remove-pool", {
    label:    "Remove leadership pool",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.poolId !== "string" || !p.poolId) return "payload.poolId must be a non-empty string";
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
// Confirms a pending nomination and adds the nominee to their pool or role.
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
                role.termEndDate   = currentTermWindow({ startMonth: cp2("assemblyTermStartMonth"), startDay: cp2("assemblyTermStartDay"), termMonths: cp2("assemblyTermMonths") }).end;
                domainSvc.saveRole(role);
            }
        }

        motion.outcomeNote = `Nomination confirmed. Nominee added to ${n.type === "pool" ? "pool" : "role"}.`;
    },
});

// ── schedule-community-event ──────────────────────────────────────────────────
// Creates a calendar event (one-off or recurring) when the motion passes.
// Payload: {
//   title:            string
//   startAt:          string  (ISO 8601)
//   endAt?:           string  (ISO 8601)
//   allDay?:          boolean
//   description?:     string
//   location?:        string
//   recurrence?:      "daily"|"weekly"|"biweekly"|"monthly"|"yearly"
//   recurrenceEndsAt?: string (ISO 8601)
// }

const VALID_RECURRENCE = new Set(["daily", "weekly", "biweekly", "monthly", "yearly"]);

effectRegistry.register("schedule-community-event", {
    label:    "Schedule community event",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;

        if (typeof p.title !== "string" || !p.title.trim())
            return "payload.title must be a non-empty string";

        if (typeof p.startAt !== "string" || isNaN(new Date(p.startAt).getTime()))
            return "payload.startAt must be a valid ISO 8601 date string";

        if (p.endAt !== undefined && p.endAt !== null) {
            if (typeof p.endAt !== "string" || isNaN(new Date(p.endAt).getTime()))
                return "payload.endAt must be a valid ISO 8601 date string";
            if (new Date(p.endAt) <= new Date(p.startAt as string))
                return "payload.endAt must be after startAt";
        }

        if (p.recurrence !== undefined && p.recurrence !== null) {
            if (typeof p.recurrence !== "string" || !VALID_RECURRENCE.has(p.recurrence))
                return "payload.recurrence must be daily|weekly|biweekly|monthly|yearly";
        }

        if (p.recurrenceEndsAt !== undefined && p.recurrenceEndsAt !== null) {
            if (typeof p.recurrenceEndsAt !== "string" || isNaN(new Date(p.recurrenceEndsAt).getTime()))
                return "payload.recurrenceEndsAt must be a valid ISO 8601 date string";
        }

        return null;
    },
    handler({ motion, payload }) {
        const svc = CalendarService.getInstance();

        // Use the motion proposer as the organizer
        const organizerId = motion.proposerId;

        const event = svc.create({
            title:            (payload.title as string).trim(),
            startAt:          payload.startAt as string,
            createdBy:        organizerId,
            organizerId,
            organizerType:    "person",
            endAt:            (payload.endAt   as string | null | undefined)   ?? null,
            allDay:           (payload.allDay  as boolean | undefined)         ?? false,
            description:      (payload.description as string | null | undefined) ?? null,
            location:         (payload.location    as string | null | undefined) ?? null,
            recurrence:       (payload.recurrence  as "daily"|"weekly"|"biweekly"|"monthly"|"yearly"|null|undefined) ?? null,
            recurrenceEndsAt: (payload.recurrenceEndsAt as string | null | undefined) ?? null,
        });

        const recLabel = event.recurrence ? ` (repeats ${event.recurrence})` : "";
        motion.outcomeNote = `Community event scheduled: "${event.title}"${recLabel} starting ${event.startAt.slice(0, 10)} (id: ${event.id}).`;
    },
});

// ── create-bylaw ──────────────────────────────────────────────────────────────
// Payload: { title: string, preamble?: string }
// Scope:   assembly can create universal bylaws (scope=null).
//          Any other body creates bylaws scoped to itself.

effectRegistry.register("create-bylaw", {
    label:    "Create bylaw",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.title !== "string" || !p.title.trim())
            return "payload.title must be a non-empty string";
        if (p.preamble !== undefined && p.preamble !== null && typeof p.preamble !== "string")
            return "payload.preamble must be a string";
        if (p.sunsetYears !== undefined && p.sunsetYears !== null) {
            if (typeof p.sunsetYears !== "number" || !Number.isInteger(p.sunsetYears) || p.sunsetYears < 1)
                return "payload.sunsetYears must be a positive integer";
        }
        return null;
    },
    handler({ motion, payload }) {
        const domainId   = motion.authorityId === "assembly" ? null : motion.authorityId;
        const authorityId = motion.authorityId === "assembly" ? "assembly" : `council:${motion.authorityId}`;
        const loader = new DocumentLoader();
        const sunsetYears = typeof payload.sunsetYears === "number" ? payload.sunsetYears : undefined;
        const bylaw  = loader.create(
            (payload.title as string).trim(),
            (payload.preamble as string | undefined)?.trim() || undefined,
            authorityId,
            domainId,
            sunsetYears,
        );

        const domainLabel = domainId ? ` (domain: ${domainId})` : " (universal)";
        const sunsetLabel = bylaw.expiresAt ? ` · expires ${new Date(bylaw.expiresAt).toLocaleDateString()}` : "";
        motion.outcomeNote = `Bylaw created: "${bylaw.title}"${domainLabel}${sunsetLabel} (id: ${bylaw.id}).`;

        try {
            CommunityLogService.getInstance().write(
                "bylaw-created",
                `New bylaw adopted: "${bylaw.title}"${domainLabel}${sunsetLabel}.`,
                { actorId: motion.proposerId, refId: bylaw.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── amend-bylaw ───────────────────────────────────────────────────────────────
// Payload: { bylawId: string, title?: string, preamble?: string }
// Scope:   assembly may amend any bylaw.
//          A pool/body may only amend bylaws scoped to itself.

effectRegistry.register("amend-bylaw", {
    label:    "Amend bylaw",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.bylawId !== "string" || !p.bylawId.trim())
            return "payload.bylawId must be a non-empty string";
        if (p.title !== undefined && p.title !== null) {
            if (typeof p.title !== "string" || !p.title.trim())
                return "payload.title must be a non-empty string when provided";
        }
        if (p.preamble !== undefined && p.preamble !== null && typeof p.preamble !== "string")
            return "payload.preamble must be a string";
        if (p.renewYears !== undefined && p.renewYears !== null) {
            if (typeof p.renewYears !== "number" || !Number.isInteger(p.renewYears) || p.renewYears < 1)
                return "payload.renewYears must be a positive integer";
        }
        return null;
    },
    handler({ motion, payload }) {
        const loader = new DocumentLoader();
        const bylawId   = (payload.bylawId as string).trim();
        const bylaw   = loader.load(bylawId);
        if (!bylaw) throw new Error(`Bylaw ${bylawId} not found`);

        // Authority check: non-assembly bodies may only amend their own domain bylaws
        if (motion.authorityId !== "assembly" && bylaw.domainId !== motion.authorityId) {
            throw new Error(
                `Body "${motion.authorityId}" may not amend bylaw "${bylaw.title}" ` +
                `(domain: "${bylaw.domainId ?? "universal"}")`,
            );
        }

        const oldTitle = bylaw.title;
        if (typeof payload.title === "string" && payload.title.trim()) {
            bylaw.title = payload.title.trim();
        }
        if (payload.preamble !== undefined) {
            bylaw.preamble = typeof payload.preamble === "string" && payload.preamble.trim()
                ? payload.preamble.trim()
                : undefined;
        }
        if (typeof payload.renewYears === "number" && payload.renewYears > 0) {
            bylaw.expiresAt = new Date(
                Date.now() + payload.renewYears * 365.25 * 24 * 3600 * 1000,
            ).toISOString();
        }
        bylaw.version += 1;
        loader.save(bylaw);

        const titleNote  = bylaw.title !== oldTitle ? ` (renamed from "${oldTitle}")` : "";
        const renewNote  = typeof payload.renewYears === "number"
            ? ` · renewed for ${payload.renewYears} year${payload.renewYears !== 1 ? "s" : ""}, expires ${new Date(bylaw.expiresAt!).toLocaleDateString()}`
            : "";
        motion.outcomeNote = `Bylaw "${bylaw.title}"${titleNote} amended to v${bylaw.version}${renewNote} (id: ${bylaw.id}).`;

        try {
            CommunityLogService.getInstance().write(
                "bylaw-amended",
                `Bylaw amended: "${bylaw.title}"${titleNote} now at v${bylaw.version}${renewNote}.`,
                { actorId: motion.proposerId, refId: bylaw.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── add-role-type ─────────────────────────────────────────────────────────
// Payload: { title, description?, defaultKinPerMonth?, preferredUnitTypes? }
// Adds a new occupational role type to the role bank.

effectRegistry.register("add-role-type", {
    label:    "Add role type to bank",
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
            throw new Error(`Role type “${title}” already exists in the role bank`);
        const rt = new RoleType(
            title,
            typeof payload.description === "string" ? payload.description.trim() : "",
            typeof payload.defaultKinPerMonth === "number" ? payload.defaultKinPerMonth : 0,
        );
        svc.createRoleType(rt);
        motion.outcomeNote = `Role type “${title}” added to the role bank (id: ${rt.id}).`;
        try {
            CommunityLogService.getInstance().write(
                "role-type-added",
                `Role type “${title}” added to the role bank.`,
                { actorId: motion.proposerId, refId: rt.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── remove-role-type ────────────────────────────────────────────────────
// Payload: { roleTypeId }
// Removes a role type from the role bank.

effectRegistry.register("remove-role-type", {
    label:    "Remove role type from bank",
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
        if (!rt) throw new Error(`Role type “${roleTypeId}” not found`);
        svc.deleteRoleType(roleTypeId);
        motion.outcomeNote = `Role type “${rt.title}” removed from the role bank.`;
        try {
            CommunityLogService.getInstance().write(
                "role-type-removed",
                `Role type “${rt.title}” removed from the role bank.`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── add-unit-type ───────────────────────────────────────────────────────────
// Payload: { type, label, description }
// Adds a custom unit type to the unit bank.

effectRegistry.register("add-unit-type", {
    label:    "Add unit type to bank",
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
            throw new Error(`Unit type “${type}” already exists in the bank`);
        const ut = new UnitType(type, label, description);
        svc.createUnitType(ut);
        motion.outcomeNote = `Unit type “${label}” (${type}) added to the unit bank.`;
        try {
            CommunityLogService.getInstance().write(
                "unit-type-added",
                `Unit type “${label}” (${type}) added to the unit bank.`,
                { actorId: motion.proposerId, refId: ut.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── remove-unit-type ──────────────────────────────────────────────────────
// Payload: { unitType }
// Removes a custom unit type from the unit bank. Built-in types cannot be removed.

effectRegistry.register("remove-unit-type", {
    label:    "Remove unit type from bank",
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
                ? `Unit type “${unitType}” is a built-in type and cannot be removed via governance`
                : `Custom unit type “${unitType}” not found`
        );
        svc.deleteUnitType(unitType);
        motion.outcomeNote = `Unit type “${ut.label}” (${unitType}) removed from the unit bank.`;
        try {
            CommunityLogService.getInstance().write(
                "unit-type-removed",
                `Unit type “${ut.label}” removed from the unit bank.`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── deploy-unit ─────────────────────────────────────────────────────────────
// Payload: {
//   domainId:    string
//   unitType:    string
//   name?:       string  (override displayed name)
//   description?: string (override description)
//   roles?: Array<{ roleTypeId: string, count?: number, kinPerMonth?: number }>
// }
// Instantiates a functional unit in the given domain, with optional role slots.

effectRegistry.register("deploy-unit", {
    label:    "Deploy functional unit",
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
        if (!domain) throw new Error(`Domain “${domainId}” not found`);

        // Resolve label/description from custom bank first, then built-in registry
        const customUt   = svc.getUnitType(unitType);
        const builtinTpl = UnitTemplateRegistry.get(unitType);
        if (!customUt && !builtinTpl)
            throw new Error(`Unit type “${unitType}” not found in the unit bank`);

        const defaultLabel = customUt?.label       ?? builtinTpl!.label;
        const defaultDesc  = customUt?.description ?? builtinTpl!.description;

        const unit = new FunctionalUnit(
            typeof payload.name        === "string" && payload.name.trim()        ? payload.name.trim()        : defaultLabel,
            typeof payload.description === "string" && payload.description.trim() ? payload.description.trim() : defaultDesc,
            unitType,
        );
        svc.createUnit(unit, domainId);

        let roleCount = 0;
        const roles = payload.roles as Array<{ roleTypeId: string; count?: number; kinPerMonth?: number }> | undefined;
        if (roles && roles.length > 0) {
            for (const slot of roles) {
                const rt = svc.getRoleType(slot.roleTypeId);
                if (!rt) throw new Error(`Role type “${slot.roleTypeId}” not found`);
                const count = Math.max(1, Math.floor(slot.count ?? 1));
                for (let i = 0; i < count; i++) {
                    svc.createRole(
                        new CommunityRole(rt.title, rt.description, slot.kinPerMonth ?? rt.defaultKinPerMonth, rt.id),
                        unit.id,
                    );
                    roleCount++;
                }
            }
        }

        const roleNote = roleCount > 0 ? ` with ${roleCount} role slot(s)` : "";
        motion.outcomeNote = `Unit “${unit.name}” deployed in domain “${domain.name}”${roleNote} (id: ${unit.id}).`;
        try {
            CommunityLogService.getInstance().write(
                "unit-deployed",
                `Functional unit “${unit.name}” deployed in ${domain.name}${roleNote}.`,
                { actorId: motion.proposerId, refId: unit.id },
            );
        } catch { /* non-fatal */ }
    },
});
// ── found-marketplace ─────────────────────────────────────────────────────────
// Payload: { name, locationName, locationAddress, description? }
// Creates a community location and registers a new marketplace in the market
// service. Market service is called fire-and-forget via MARKET_URL.

effectRegistry.register("found-marketplace", {
    label:    "Found a marketplace",
    authorityId: "assembly",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.name !== "string" || !p.name.trim())
            return "payload.name must be a non-empty string";
        if (typeof p.locationName !== "string" || !p.locationName.trim())
            return "payload.locationName must be a non-empty string";
        if (typeof p.locationAddress !== "string" || !p.locationAddress.trim())
            return "payload.locationAddress must be a non-empty string";
        return null;
    },
    handler({ motion, payload }) {
        const name            = (payload.name            as string).trim();
        const locationName    = (payload.locationName    as string).trim();
        const locationAddress = (payload.locationAddress as string).trim();
        const description     = typeof payload.description === "string" ? payload.description.trim() : "";

        // Create the location in the community service (same process).
        const loc = new Location(locationName, locationAddress);
        LocationService.getInstance().create(loc);

        motion.outcomeNote =
            `Marketplace "${name}" at "${locationName}" approved (location id: ${loc.id}).` +
            ` Registering with market service…`;

        // Fire-and-forget: create the marketplace in the market service.
        const marketUrl = process.env.MARKET_URL ?? "http://localhost:3003";
        fetch(`${marketUrl}/api/marketplaces`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                name,
                locationId:   loc.id,
                locationName,
                description,
            }),
        }).then(async res => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: string };
                console.error(`[found-marketplace] market service error: ${body.error ?? res.status}`);
            }
        }).catch(err => {
            console.error(`[found-marketplace] could not reach market service: ${(err as Error).message}`);
        });

        try {
            CommunityLogService.getInstance().write(
                "marketplace-founded",
                `Marketplace "${name}" founded at "${locationName}".`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── create-association ────────────────────────────────────────────────────────
// Payload: { name: string, handle: string, description?: string, founderPersonId?: string }
// Registers a new association (business, church, cooperative, club, etc.) and
// optionally makes the given person its first admin.

effectRegistry.register("create-association", {
    label:    "Create an association",
    authorityId: "referendum",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.name !== "string" || !p.name.trim())
            return "payload.name must be a non-empty string";
        if (typeof p.handle !== "string" || !p.handle.trim())
            return "payload.handle must be a non-empty string";
        if (p.founderPersonId !== undefined && typeof p.founderPersonId !== "string")
            return "payload.founderPersonId must be a string";
        return null;
    },
    handler({ motion, payload }) {
        const name        = (payload.name   as string).trim();
        const handle      = (payload.handle as string).trim();
        const description = typeof payload.description === "string" ? payload.description.trim() : "";

        const svc = AssociationService.getInstance();
        if (svc.isHandleTaken(handle)) {
            throw new Error(`Handle "@${handle}" is already in use.`);
        }

        const association = new Association(name, handle, description);
        svc.create(association);

        const founderPersonId = typeof payload.founderPersonId === "string" && payload.founderPersonId
            ? payload.founderPersonId
            : motion.proposerId;
        if (founderPersonId) {
            svc.addAdmin(association.id, founderPersonId);
        }

        motion.outcomeNote = `Association "${name}" (@${association.handle}) registered (id: ${association.id}).`;

        try {
            CommunityLogService.getInstance().write(
                "association-created",
                `Association "${name}" (@${association.handle}) created via motion.`,
                { actorId: motion.proposerId, refId: association.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── add-pool-member ───────────────────────────────────────────────────────────
// Adds an existing person directly to a leader pool via a petition vote.
// Bypasses the nomination/consent flow — assumes consent was established
// outside of the governance system (e.g. in-person or offline).
// Payload: { poolId: string, personId: string }

effectRegistry.register("add-pool-member", {
    label:    "Add person to leader pool",
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