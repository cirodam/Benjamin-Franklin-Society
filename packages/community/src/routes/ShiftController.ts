import { Request, Response } from "express";
import { ShiftService } from "@ecf/core";
import { Shift } from "@ecf/core";
import { PersonService } from "../person/PersonService.js";

const svc = () => ShiftService.getInstance();
const ppl = () => PersonService.getInstance();

function toDto(shift: Shift) {
    return {
        id:             shift.id,
        domainId:       shift.domainId,
        label:          shift.label,
        startAt:        shift.startAt,
        endAt:          shift.endAt,
        assignedHandle: shift.assignedPersonId
            ? (ppl().get(shift.assignedPersonId)?.handle ?? null)
            : null,
        note:           shift.note,
        createdBy:      shift.createdBy,
        createdAt:      shift.createdAt,
        isOpen:         shift.isOpen,
    };
}

// GET /api/shifts
// Query params: domainId, handle, open (bool), from+to (ISO range)
export function listShifts(req: Request, res: Response): void {
    const { domainId, handle, open, from, to } = req.query as Record<string, string | undefined>;

    if (handle) {
        const person = ppl().getByHandle(handle);
        if (!person) { res.json([]); return; }
        res.json(svc().getByPerson(person.id).map(toDto));
        return;
    }
    if (from && to) {
        res.json(svc().getRange(from, to, domainId).map(toDto));
        return;
    }
    if (open === "true") {
        res.json(svc().getOpen(domainId).map(toDto));
        return;
    }
    if (domainId) {
        res.json(svc().getByDomain(domainId).map(toDto));
        return;
    }
    // No filter — return all shifts sorted by start time
    res.json(svc().getRange("0000", "9999").map(toDto));
}

// GET /api/shifts/:id
export function getShift(req: Request, res: Response): void {
    const shift = svc().get(req.params.id as string);
    if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
    res.json(toDto(shift));
}

// POST /api/shifts
// Body: { domainId, label, startAt, endAt, note? }
export function createShift(req: Request, res: Response): void {
    const { domainId, label, startAt, endAt, note } = req.body ?? {};

    if (typeof domainId !== "string" || !domainId.trim()) {
        res.status(400).json({ error: "domainId is required" }); return;
    }
    if (typeof label !== "string" || !label.trim()) {
        res.status(400).json({ error: "label is required" }); return;
    }
    if (typeof startAt !== "string" || !startAt) {
        res.status(400).json({ error: "startAt is required" }); return;
    }
    if (typeof endAt !== "string" || !endAt) {
        res.status(400).json({ error: "endAt is required" }); return;
    }

    const createdBy: string = (req as typeof req & { personId?: string }).personId ?? "unknown";

    try {
        const shift = svc().create({ domainId, label, startAt, endAt, createdBy, note: note ?? null });
        res.status(201).json(toDto(shift));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/shifts/:id/claim
// Body: { handle? } — defaults to authenticated user
export function claimShift(req: Request, res: Response): void {
    const authPersonId: string = (req as typeof req & { personId?: string }).personId ?? "";
    const { handle } = (req.body ?? {}) as { handle?: string };

    let personId = authPersonId;
    if (handle) {
        const target = ppl().getByHandle(handle);
        if (!target) { res.status(404).json({ error: "Person not found" }); return; }
        personId = target.id;
    }
    if (!personId) { res.status(400).json({ error: "Authentication required" }); return; }

    try {
        const shift = svc().claim(req.params.id as string, personId);
        res.json(toDto(shift));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// POST /api/shifts/:id/unclaim
export function unclaimShift(req: Request, res: Response): void {
    try {
        const shift = svc().unclaim(req.params.id as string);
        res.json(toDto(shift));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// PATCH /api/shifts/:id/assign
// Body: { handle }
export function reassignShift(req: Request, res: Response): void {
    const { handle } = req.body ?? {};
    if (typeof handle !== "string" || !handle) {
        res.status(400).json({ error: "handle is required" }); return;
    }
    const target = ppl().getByHandle(handle);
    if (!target) { res.status(404).json({ error: "Person not found" }); return; }
    try {
        const shift = svc().reassign(req.params.id as string, target.id);
        res.json(toDto(shift));
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}

// DELETE /api/shifts/:id
export function deleteShift(req: Request, res: Response): void {
    try {
        svc().delete(req.params.id as string);
        res.status(204).end();
    } catch (err) {
        res.status(400).json({ error: (err as Error).message });
    }
}
