import { effectRegistry } from "@ecf/core";
import { DocumentLoader } from "../DocumentLoader.js";
import { ActivityLogService } from "@ecf/core";

// ── amend-document-parameter ──────────────────────────────────────────────────
// Payload: { docId: string, parameter: string, newValue: number | boolean }

effectRegistry.register("amend-document-parameter", {
    label:       "Amend document parameter",
    authorityId: "community",
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
    label:       "Set dues rate",
    authorityId: "community",
    validate(raw) {
        if (typeof raw !== "object" || raw === null) return "Payload must be an object";
        const p = raw as Record<string, unknown>;
        if (typeof p.rate !== "number" || isNaN(p.rate) || p.rate < 0 || p.rate > 10)
            return "payload.rate must be a number between 0 and 10 (percent)";
        return null;
    },
    handler({ motion, payload }) {
        const pct         = payload.rate as number;
        const rateDecimal = pct / 100;
        const docs        = new DocumentLoader();
        const oldPct      = Math.round(docs.getParam<number>("constitution", "communityDuesRate") * 10_000) / 100;
        docs.amend("constitution", "communityDuesRate", rateDecimal, motion.id);
        motion.outcomeNote = `Community dues rate changed from ${oldPct}% to ${pct}% per month.`;
        try {
            ActivityLogService.getInstance().write(
                "constitution-amended",
                `Dues rate set to ${pct}% per month (was ${oldPct}%).`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── set-retirement-age ────────────────────────────────────────────────────────
// Payload: { age: number }  — whole years, 55–75.

effectRegistry.register("set-retirement-age", {
    label:       "Set retirement age",
    authorityId: "community",
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
        const age     = payload.age as number;
        const docs    = new DocumentLoader();
        const oldAge  = docs.getParam<number>("constitution", "retirementAge");
        docs.amend("constitution", "retirementAge", age, motion.id);
        motion.outcomeNote = `Retirement age changed from ${oldAge} to ${age} years.`;
        try {
            ActivityLogService.getInstance().write(
                "constitution-amended",
                `Retirement age set to ${age} years (was ${oldAge}).`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── set-retirement-payout ─────────────────────────────────────────────────────
// Payload: { amount: number }  — kin per month per retiree, 0–100,000.

effectRegistry.register("set-retirement-payout", {
    label:       "Set retirement payout",
    authorityId: "community",
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
        const amount    = payload.amount as number;
        const docs      = new DocumentLoader();
        const oldAmount = docs.getParam<number>("constitution", "retirementPayoutRate");
        docs.amend("constitution", "retirementPayoutRate", amount, motion.id);
        motion.outcomeNote = `Monthly retirement payout changed from ${oldAmount} to ${amount} kin/month.`;
        try {
            ActivityLogService.getInstance().write(
                "constitution-amended",
                `Monthly retirement payout set to ${amount} kin/month (was ${oldAmount}).`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});
