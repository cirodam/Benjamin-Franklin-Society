import { Request, Response } from "express";
import { PersonService } from "../person/PersonService.js";
import { DomainService } from "../DomainService.js";
import { Person } from "../person/Person.js";
import type { AuthedRequest } from "@ecf/core";

const svc = () => PersonService.getInstance();

// ── Login rate limiting ───────────────────────────────────────────────────────
// Keyed by client IP. 10 attempts per 15-minute window.
const LOGIN_ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = LOGIN_ATTEMPTS.get(ip);
    if (!entry || now >= entry.resetAt) {
        LOGIN_ATTEMPTS.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_LOGIN_ATTEMPTS) return false;
    entry.count++;
    return true;
}
// ─────────────────────────────────────────────────────────────────────────────

function toPersonDto(p: Person) {
    return {
        id:                p.id,
        firstName:         p.firstName,
        lastName:          p.lastName,
        handle:            p.handle,
        phone:             p.phone,
        disabled:          p.disabled,
        retired:           p.retired,
        admin:              p.admin,
        isAdmin:            svc().isAdmin(p),
        joinDate:          p.joinDate,
        hasPassword:       p.hasPassword(),
        mustChangePassword: p.mustChangePassword,
    };
}

// POST /api/auth/login
// Body: { handle, password }
// Returns person DTO + a base64url-encoded PersonCredential token.
export async function login(req: Request, res: Response): Promise<void> {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (!checkLoginRateLimit(ip)) {
        res.status(429).json({ error: "Too many login attempts. Please try again later." }); return;
    }
    const { handle, password } = req.body ?? {};
    if (typeof handle !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "handle and password are required" }); return;
    }
    const person = await svc().verifyPassword(handle, password);
    if (!person) { res.status(401).json({ error: "Invalid handle or password" }); return; }

    const credential = svc().issueCredential(person, undefined, DomainService.getInstance());
    const token = Buffer.from(JSON.stringify(credential)).toString("base64url");

    res.json({ ...toPersonDto(person), token });
}

// POST /api/persons/:handle/password
// Body: { password }
export async function setPassword(req: Request, res: Response): Promise<void> {
    const { password } = req.body ?? {};
    if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({ error: "password must be at least 8 characters" }); return;
    }
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    try {
        await svc().setPassword(person.id, password);
        res.status(204).send();
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// POST /api/persons/:handle/pin
// Body: { pin }  — 4–8 digits
export async function setPin(req: Request, res: Response): Promise<void> {
    const { pin } = req.body ?? {};
    if (typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
        res.status(400).json({ error: "pin must be 4–8 digits" }); return;
    }
    const person = svc().getByHandle(req.params.handle as string);
    if (!person) { res.status(404).json({ error: "Person not found" }); return; }
    try {
        await svc().setPin(person.id, pin);
        res.status(204).send();
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}

// POST /api/auth/verify
// Body: PersonCredential JSON
export function verifyCredential(req: Request, res: Response): void {
    const credential = req.body;
    if (!credential || typeof credential !== "object") {
        res.status(400).json({ error: "credential body required" }); return;
    }
    const valid = svc().verifyCredential(credential);
    res.json({ valid });
}

// POST /api/auth/change-password
// Body: { password }
// Requires: requireAuth — changes the caller's own password and clears mustChangePassword.
export async function changeOwnPassword(req: Request, res: Response): Promise<void> {
    const { password } = (req as AuthedRequest).body ?? {};
    if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({ error: "password must be at least 8 characters" }); return;
    }
    const personId = (req as AuthedRequest).personId;
    try {
        await svc().setPassword(personId, password);
        res.status(204).send();
    } catch (err) {
        res.status(404).json({ error: (err as Error).message });
    }
}
