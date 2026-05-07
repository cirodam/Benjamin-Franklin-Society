import { Request, Response } from "express";
import { LocationService, Location } from "@ecf/core";

const svc = () => LocationService.getInstance();

// GET /api/locations
export function listLocations(_req: Request, res: Response): void {
    res.json(svc().getAll().map(toDto));
}

// GET /api/locations/:id
export function getLocation(req: Request, res: Response): void {
    const loc = svc().get(req.params.id as string);
    if (!loc) { res.status(404).json({ error: "Location not found" }); return; }
    res.json(toDto(loc));
}

// POST /api/locations
// Body: { name, address, lat?, lng?, description? }
export function createLocation(req: Request, res: Response): void {
    const { name, address, lat, lng, description } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "name is required" }); return;
    }
    if (typeof address !== "string" || !address.trim()) {
        res.status(400).json({ error: "address is required" }); return;
    }
    if (lat !== undefined && lat !== null && typeof lat !== "number") {
        res.status(400).json({ error: "lat must be a number" }); return;
    }
    if (lng !== undefined && lng !== null && typeof lng !== "number") {
        res.status(400).json({ error: "lng must be a number" }); return;
    }
    const loc = new Location(name.trim(), address.trim(), lat ?? null, lng ?? null, description ?? "");
    svc().create(loc);
    res.status(201).json(toDto(loc));
}

// PATCH /api/locations/:id
// Body: { name?, address?, lat?, lng?, description? }
export function updateLocation(req: Request, res: Response): void {
    const { name, address, lat, lng, description } = req.body ?? {};
    const updated = svc().update(req.params.id as string, { name, address, lat, lng, description });
    if (!updated) { res.status(404).json({ error: "Location not found" }); return; }
    res.json(toDto(updated));
}

// DELETE /api/locations/:id
export function deleteLocation(req: Request, res: Response): void {
    const deleted = svc().delete(req.params.id as string);
    if (!deleted) { res.status(404).json({ error: "Location not found" }); return; }
    res.status(204).send();
}

function toDto(loc: Location) {
    return {
        id:          loc.id,
        name:        loc.name,
        address:     loc.address,
        lat:         loc.lat,
        lng:         loc.lng,
        description: loc.description,
        createdAt:   loc.createdAt.toISOString(),
    };
}
