import { effectRegistry } from "@ecf/core";
import { DocumentLoader } from "../DocumentLoader.js";
import { ActivityLogService } from "@ecf/core";

// ── create-bylaw ──────────────────────────────────────────────────────────────
// Payload: { title, preamble?, sunsetYears? }

effectRegistry.register("create-bylaw", {
    label: "Create bylaw",
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
        const domainId    = motion.authorityId === "assembly" ? null : motion.authorityId;
        const authorityId = motion.authorityId === "assembly" ? "assembly" : `council:${motion.authorityId}`;
        const loader      = new DocumentLoader();
        const sunsetYears = typeof payload.sunsetYears === "number" ? payload.sunsetYears : undefined;
        const bylaw       = loader.create(
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
            ActivityLogService.getInstance().write(
                "bylaw-created",
                `New bylaw adopted: "${bylaw.title}"${domainLabel}${sunsetLabel}.`,
                { actorId: motion.proposerId, refId: bylaw.id },
            );
        } catch { /* non-fatal */ }
    },
});

// ── amend-bylaw ───────────────────────────────────────────────────────────────
// Payload: { bylawId, title?, preamble?, renewYears? }

effectRegistry.register("amend-bylaw", {
    label: "Amend bylaw",
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
        const loader  = new DocumentLoader();
        const bylawId = (payload.bylawId as string).trim();
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

        const titleNote = bylaw.title !== oldTitle ? ` (renamed from "${oldTitle}")` : "";
        const renewNote = typeof payload.renewYears === "number"
            ? ` · renewed for ${payload.renewYears} year${payload.renewYears !== 1 ? "s" : ""}, expires ${new Date(bylaw.expiresAt!).toLocaleDateString()}`
            : "";
        motion.outcomeNote = `Bylaw "${bylaw.title}"${titleNote} amended to v${bylaw.version}${renewNote} (id: ${bylaw.id}).`;
        try {
            ActivityLogService.getInstance().write(
                "bylaw-amended",
                `Bylaw amended: "${bylaw.title}"${titleNote} now at v${bylaw.version}${renewNote}.`,
                { actorId: motion.proposerId, refId: bylaw.id },
            );
        } catch { /* non-fatal */ }
    },
});
