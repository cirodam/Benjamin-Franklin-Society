import { Request, Response } from "express";
import { PersonService } from "../person/PersonService.js";
import { DomainService } from "../DomainService.js";
import { Person } from "../person/Person.js";
import { HandleRegistry } from "../HandleRegistry.js";

const svc = () => PersonService.getInstance();

// GET /api/persons
export function listPersons(req: Request, res: Response): void {
    res.json(svc().getAll().map(toListDto));
}

// GET /api/persons/:handle
export function getPerson(req: Request, res: Response): void {
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    res.json(toDto(person));
}

// POST /api/persons
// Body: { firstName, lastName, birthDate, phone?, languages? }
export async function addPerson(req: Request, res: Response): Promise<void> {
    const { firstName, lastName, birthDate, phone, languages } = req.body ?? {};
    if (typeof firstName !== "string" || !firstName.trim()) {
        res.status(400).json({ error: "firstName is required" }); return;
    }
    if (typeof lastName !== "string" || !lastName.trim()) {
        res.status(400).json({ error: "lastName is required" }); return;
    }
    if (!birthDate) {
        res.status(400).json({ error: "birthDate is required" }); return;
    }
    const parsedBirthDate = new Date(birthDate);
    if (isNaN(parsedBirthDate.getTime())) {
        res.status(400).json({ error: "birthDate must be a valid date" }); return;
    }

    // Derive a unique handle from firstName_lastName
    const base = `${firstName.trim()}_${lastName.trim()}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
    let handle = base;
    let suffix = 2;
    while (HandleRegistry.getInstance().isTaken(handle)) {
        if (suffix > 999) {
            res.status(409).json({ error: "Could not generate a unique handle" });
            return;
        }
        handle = `${base}_${suffix++}`;
    }

    const person = new Person(
        firstName.trim(),
        lastName.trim(),
        parsedBirthDate,
        handle,
        false,
        null,
        null,
        [],
    );
    if (phone)     person.phone     = phone;
    if (languages) person.languages = languages;
    await svc().add(person);
    res.status(201).json(toDto(person));
}

// PATCH /api/persons/:handle
export function updatePerson(req: Request, res: Response): void {
    try {
        const person = svc().getByHandle(req.params.handle as string);
        if (!person) { res.status(404).json({ error: "Person not found" }); return; }
        const updated = svc().update(person.id, req.body ?? {});
        res.json(toDto(updated));
    } catch (err) {
        const msg = (err as Error).message ?? "";
        const status = msg.toLowerCase().includes("not found") ? 404 : 400;
        res.status(status).json({ error: msg });
    }
}

// DELETE /api/persons/:handle
export async function dischargePerson(req: Request, res: Response): Promise<void> {
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    await svc().discharge(person);
    res.status(204).send();
}

// POST /api/persons/:handle/credential
export function issueCredential(req: Request, res: Response): void {
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    const credential = svc().issueCredential(person);
    res.json(credential);
}

// POST /api/persons/:handle/admin
export function grantAdmin(req: Request, res: Response): void {
    try {
        const person = svc().getByHandle(req.params.handle as string);
        if (!person) { res.status(404).json({ error: "Person not found" }); return; }
        const updated = svc().grantAdmin(person.id);
        res.json(toDto(updated));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// DELETE /api/persons/:handle/admin
export function revokeAdmin(req: Request, res: Response): void {
    try {
        const person = svc().getByHandle(req.params.handle as string);
        if (!person) { res.status(404).json({ error: "Person not found" }); return; }
        const updated = svc().revokeAdmin(person.id);
        res.json(toDto(updated));
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// POST /api/persons/:handle/apps/:app
export async function grantApp(req: Request, res: Response): Promise<void> {
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    const { app } = req.params;
    const KNOWN = ["bank", "market", "mail"];
    if (!KNOWN.includes(app as string)) {
        res.status(400).json({ error: `Unknown app "${app}"` }); return;
    }
    const updated = await svc().grantApp(person.id, app as string);
    res.json(toDto(updated));
}

// DELETE /api/persons/:handle/apps/:app
export function revokeApp(req: Request, res: Response): void {
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    const { app } = req.params;
    const updated = svc().revokeApp(person.id, app as string);
    res.json(toDto(updated));
}

/** Full DTO — includes phone and appPermissions; only used for the individual GET. */
function toDto(p: Person) {
    return {
        firstName:       p.firstName,
        lastName:        p.lastName,
        handle:          p.handle,
        phone:           p.phone,
        disabled:        p.disabled,
        retired:         p.retired,
        admin:           p.admin,
        isAdmin:         svc().isAdmin(p),
        languages:       p.languages,
        joinDate:        p.joinDate,
        apps:            p.apps,
        credential:      p.credential,
        appPermissions:  svc().resolveAppPermissions(p, DomainService.getInstance()),
    };
}

/** Stripped DTO for list responses — omits phone. */
function toListDto(p: Person) {
    return {
        firstName:       p.firstName,
        lastName:        p.lastName,
        handle:          p.handle,
        disabled:        p.disabled,
        retired:         p.retired,
        admin:           p.admin,
        isAdmin:         svc().isAdmin(p),
        languages:       p.languages,
        joinDate:        p.joinDate,
        apps:            p.apps,
    };
}
