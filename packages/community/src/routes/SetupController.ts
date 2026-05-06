import { Request, Response } from "express";
import { PersonService } from "../person/PersonService.js";
import { Person } from "../person/Person.js";
import { ConstitutionLoader } from "../governance/ConstitutionLoader.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { makeDefaultCharter } from "../governance/CharterDefaults.js";

// ── Sample population seeder ──────────────────────────────────────────────────

const FIRST_NAMES = [
    "Alice","Benjamin","Clara","Daniel","Elena","Finn","Grace","Henry","Isla","Jacob",
    "Kira","Liam","Maya","Noah","Olivia","Patrick","Quinn","Rachel","Samuel","Tara",
    "Uma","Victor","Wren","Xavier","Yara","Zoe","Aaron","Beth","Cameron","Diana",
    "Ethan","Fiona","George","Hannah","Ivan","Julia","Kevin","Laura","Marcus","Nina",
    "Oscar","Priya","Quentin","Rosa","Simon","Theo","Uma","Violet","Walter","Xena",
    "Yusuf","Zahra","Adrian","Bella","Connor","Delia","Emil","Freya","Graham","Holly",
];

const LAST_NAMES = [
    "Anderson","Baker","Carter","Davis","Evans","Foster","Garcia","Harris","Ingram","Jones",
    "Kim","Lewis","Martin","Nelson","Okafor","Patel","Quinn","Rivera","Smith","Taylor",
    "Upton","Vargas","Walker","Xavier","Young","Zhang","Abbott","Brooks","Collins","Dean",
    "Erikson","Fletcher","Grant","Hughes","Ivanova","Jenkins","Kumar","Lynch","Moore","Nguyen",
    "Owen","Park","Reed","Santos","Torres","Underwood","Vance","Webb","Yamamoto","Ziegler",
];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomBirthDate(minAge: number, maxAge: number): Date {
    const today = new Date();
    const maxYearsAgo = maxAge * 365;
    const minYearsAgo = minAge * 365;
    const daysAgo = randomInt(minYearsAgo, maxYearsAgo);
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

async function seedPopulation(svc: PersonService): Promise<number> {
    const count = randomInt(220, 280);
    const usedHandles = new Set<string>();

    for (let i = 0; i < count; i++) {
        const firstName = randomFrom(FIRST_NAMES);
        const lastName  = randomFrom(LAST_NAMES);

        // Age distribution: ~20% children (0–17), ~65% working age (18–65), ~15% retired (66–85)
        const roll = Math.random();
        let birthDate: Date;
        if (roll < 0.20)      birthDate = randomBirthDate(0,  17);
        else if (roll < 0.85) birthDate = randomBirthDate(18, 65);
        else                  birthDate = randomBirthDate(66, 85);

        // Build a unique handle
        const base = `${firstName[0].toLowerCase()}${lastName.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        let handle = base;
        let suffix = 2;
        while (usedHandles.has(handle)) {
            handle = `${base}${suffix++}`;
        }
        usedHandles.add(handle);

        const isChild = birthDate > new Date(Date.now() - 18 * 365.25 * 86400_000);
        const person = new Person(firstName, lastName, birthDate, handle, false, null, null, []);
        await svc.add(person);
        // Seed adults with all apps; children get community-only by default
        if (!isChild) {
            await svc.grantApp(person.id, "bank");
            await svc.grantApp(person.id, "market");
            await svc.grantApp(person.id, "mail");
        }
    }

    return count;
}

const svc = () => PersonService.getInstance();

// GET /api/setup/status
// Returns { needsSetup: true } if no persons exist yet (fresh install).
export function getSetupStatus(req: Request, res: Response): void {
    res.json({ needsSetup: svc().count() === 0 });
}

// POST /api/setup
// Body: { communityName, communityHandle, firstName, lastName, birthDate, handle, password }
// Atomic first-boot setup: creates the founder person and sets their password.
// Returns 409 if setup has already been completed.
export async function setup(req: Request, res: Response): Promise<void> {
    if (svc().count() > 0) {
        res.status(409).json({ error: "Setup already completed" });
        return;
    }

    const { communityName, communityHandle, firstName, lastName, birthDate, handle, password, phone, seedPopulation: doSeed } = req.body ?? {};

    if (typeof communityName !== "string" || !communityName.trim()) {
        res.status(400).json({ error: "communityName is required" }); return;
    }
    if (typeof communityHandle !== "string" || !communityHandle.trim()) {
        res.status(400).json({ error: "communityHandle is required" }); return;
    }
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
    if (typeof handle !== "string" || !handle.trim()) {
        res.status(400).json({ error: "handle is required" }); return;
    }
    if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({ error: "password must be at least 8 characters" }); return;
    }

    // Create the founder
    const person = new Person(
        firstName.trim(),
        lastName.trim(),
        parsedBirthDate,
        handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""),
    );
    if (typeof phone === "string" && phone.trim()) person.phone = phone.trim();
    await svc().add(person);
    await svc().setPassword(person.id, password);

    // Grant the founder explicit stewardship
    svc().grantSteward(person.id);

    // Grant the founder access to all satellite apps
    await svc().grantApp(person.id, "bank");
    await svc().grantApp(person.id, "market");
    await svc().grantApp(person.id, "mail");

    // Set the community name and handle in the constitution and persist
    ConstitutionLoader.getInstance().setCommunityName(communityName.trim());
    ConstitutionLoader.getInstance().setCommunityHandle(communityHandle.trim());
    ConstitutionLoader.getInstance().save();

    // Seed the charter document if it doesn't already exist
    const docs = new DocumentLoader();
    if (!docs.load("charter")) {
        docs.save(makeDefaultCharter());
    }

    // Optionally seed a sample population for testing
    let seededCount = 0;
    if (doSeed === true) {
        seededCount = await seedPopulation(svc());
    }

    res.status(201).json({
        communityName: ConstitutionLoader.getInstance().communityName,
        seededCount,
        founder: {
            id:        person.id,
            firstName: person.firstName,
            lastName:  person.lastName,
            handle:    person.handle,
        },
    });
}
