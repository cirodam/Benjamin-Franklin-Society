import { effectRegistry, LocationService, Location, ActivityLogService } from "@ecf/core";
import { AssociationService } from "../../association/AssociationService.js";
import { Association } from "../../association/Association.js";

// ── found-marketplace ─────────────────────────────────────────────────────────
// Payload: { name, locationName, locationAddress, description? }

effectRegistry.register("found-marketplace", {
    label:       "Found a marketplace",
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

        const loc = new Location(locationName, locationAddress);
        LocationService.getInstance().create(loc);

        motion.outcomeNote =
            `Marketplace "${name}" at "${locationName}" approved (location id: ${loc.id}).` +
            ` Registering with market service…`;

        const marketUrl = process.env.MARKET_URL ?? "http://localhost:3003";
        fetch(`${marketUrl}/api/marketplaces`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ name, locationId: loc.id, locationName, description }),
        }).then(async res => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: string };
                console.error(`[found-marketplace] market service error: ${body.error ?? res.status}`);
            }
        }).catch(err => {
            console.error(`[found-marketplace] could not reach market service: ${(err as Error).message}`);
        });

        try {
            ActivityLogService.getInstance().write(
                "marketplace-founded",
                `Marketplace "${name}" founded at "${locationName}".`,
                { actorId: motion.proposerId },
            );
        } catch { /* non-fatal */ }
    },
});

// ── create-association ────────────────────────────────────────────────────────
// Payload: { name, handle, description?, founderPersonId? }

effectRegistry.register("create-association", {
    label:       "Create an association",
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
            ActivityLogService.getInstance().write(
                "association-created",
                `Association "${name}" (@${association.handle}) created via motion.`,
                { actorId: motion.proposerId, refId: association.id },
            );
        } catch { /* non-fatal */ }
    },
});
