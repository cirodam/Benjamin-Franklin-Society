import {
    randomUUID,
    generateKeyPairSync,
    sign as signEd25519,
    createPrivateKey,
    createHash,
    type KeyObject,
} from "crypto";
import { IEconomicActor, type PersonCredential } from "@ecf/core";

export type { PersonCredential };

export interface LanguageProficiency {
    language: string;   // BCP 47, e.g. "en", "es", "zh-Hans"
    reading: boolean;
    writing: boolean;
    speaking: boolean;
}

/**
 * A human being who is a member of this community.
 *
 * The community generates and holds an Ed25519 keypair on behalf of each person.
 * The person can take custody of their private key at any time (data portability).
 * The community signs a PersonCredential over the public key — this is how other
 * nodes know the key is bound to an active community person.
 */
export class Person implements IEconomicActor {

    readonly id: string;
    readonly joinDate: Date;

    firstName: string;
    lastName: string;
    birthDate: Date;
    handle: string;             // lowercase alphanumeric + underscores, unique in community
    disabled: boolean;          // community-determined; exempt from work expectations
    retired: boolean;           // true once the person has reached retirement age and opted in
    admin: boolean;             // explicitly granted admin access (also earned automatically by seniority)
    guardianId: string | null;
    phone: string | null;       // E.164, e.g. "+15551234567". null if no phone.
    languages: LanguageProficiency[];
    /** Satellite apps this person has been enrolled in (e.g. ["bank", "market", "mail"]). */
    apps: string[];

    /**
     * The community-signed credential binding this person's public key to their identity.
     * Null until explicitly issued (see PersonService.issueCredential).
     */
    credential: PersonCredential | null = null;

    mustChangePassword: boolean = false;

    private _pinHash: string | null = null;
    private _passwordHash: string | null = null;

    private _privateKey: KeyObject;
    private _privateKeyDer: string;
    private _publicKeyHex: string;
    private _nullifier: string;

    constructor(
        firstName: string,
        lastName: string,
        birthDate: Date,
        handle: string = "",
        disabled: boolean = false,
        guardianId: string | null = null,
        phone: string | null = null,
        languages: LanguageProficiency[] = [],
    ) {
        this.id = randomUUID();
        this.firstName = firstName;
        this.lastName = lastName;
        this.birthDate = birthDate;
        this.joinDate = new Date();
        this.handle = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
        this.disabled = disabled;
        this.retired = false;
        this.admin = false;
        this.guardianId = guardianId;
        this.phone = phone;
        this.languages = languages;
        this.apps = [];

        const { privateKey, publicKey } = generateKeyPairSync("ed25519");
        this._privateKey = privateKey;
        this._privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" }).toString("hex");
        this._publicKeyHex = publicKey.export({ type: "spki", format: "der" }).toString("hex");
        this._nullifier = createHash("sha256").update(this._privateKeyDer).digest("hex");
    }

    /** Returns the person's age in whole years as of today. */
    getAgeYears(now: Date = new Date()): number {
        const years = now.getFullYear() - this.birthDate.getFullYear();
        const hadBirthday =
            now.getMonth() > this.birthDate.getMonth() ||
            (now.getMonth() === this.birthDate.getMonth() && now.getDate() >= this.birthDate.getDate());
        return hadBirthday ? years : years - 1;
    }

    /**
     * Reconstruct a Person from a persisted record.
     * Only for use by PersonLoader.
     */
    static restore(record: {
        id: string;
        firstName: string;
        lastName: string;
        birthDate: Date;
        joinDate: Date;
        handle: string;
        disabled: boolean;
        retired: boolean;
        admin: boolean;
        mustChangePassword: boolean;
        guardianId: string | null;
        phone: string | null;
        pinHash: string | null;
        passwordHash: string | null;
        privateKeyDer: string | null;
        publicKeyHex: string | null;
        languages: LanguageProficiency[];
        apps: string[];
        credential: PersonCredential | null;
    }): Person {
        const p = new Person(
            record.firstName,
            record.lastName,
            record.birthDate,
            record.handle,
            record.disabled,
            record.guardianId,
            record.phone,
            record.languages,
        );
        (p as unknown as Record<string, unknown>)["id"] = record.id;
        (p as unknown as Record<string, unknown>)["joinDate"] = record.joinDate;
        p.retired = record.retired;
        p.admin = record.admin;
        p.mustChangePassword = record.mustChangePassword ?? false;
        p.apps = record.apps ?? [];
        p.credential = record.credential;
        p._pinHash = record.pinHash;
        p._passwordHash = record.passwordHash;
        if (record.privateKeyDer && record.publicKeyHex) {
            p._privateKey = createPrivateKey({
                key: Buffer.from(record.privateKeyDer, "hex"),
                format: "der",
                type: "pkcs8",
            });
            p._privateKeyDer = record.privateKeyDer;
            p._publicKeyHex = record.publicKeyHex;
            p._nullifier = createHash("sha256").update(record.privateKeyDer).digest("hex");
        }
        return p;
    }

    getId(): string { return this.id; }
    getDisplayName(): string { return `${this.firstName} ${this.lastName}`; }
    getHandle(): string { return this.handle; }

    // ── Identity (Ed25519 keypair) ─────────────────────────────────────────────
    // The community holds this keypair in custody on behalf of the person.
    // The person can request their private key at any time (custody handoff).

    /** Hex-encoded SPKI DER public key. Safe to share. */
    get publicKeyHex(): string { return this._publicKeyHex; }

    /**
     * Nullifier: SHA-256(privateKeyDer).
     * Submitted to a federation registry to detect double-membership
     * without revealing the person's identity.
     */
    get nullifier(): string { return this._nullifier; }

    /**
     * Export the private key on explicit person request (custody handoff).
     * Returns hex-encoded PKCS8 DER.
     */
    exportPrivateKey(): string { return this._privateKeyDer; }

    /**
     * Sign an arbitrary message on behalf of the person.
     * Returns a hex-encoded Ed25519 signature.
     */
    sign(message: string): string {
        return signEd25519(null, Buffer.from(message, "utf-8"), this._privateKey).toString("hex");
    }

    /** @internal Only for use by PersonLoader. */
    getKeypairForPersistence(): { privateKeyDer: string; publicKeyHex: string } {
        return { privateKeyDer: this._privateKeyDer, publicKeyHex: this._publicKeyHex };
    }

    // ── Auth credentials ──────────────────────────────────────────────────────

    /** @internal Only call from PersonService. */
    setPinHash(hash: string | null): void { this._pinHash = hash; }

    /** @internal Only call from PersonService. */
    setPasswordHash(hash: string | null): void { this._passwordHash = hash; }

    matchesPinHash(hash: string): boolean {
        return this._pinHash !== null && this._pinHash === hash;
    }

    matchesPasswordHash(hash: string): boolean {
        return this._passwordHash !== null && this._passwordHash === hash;
    }

    hasPin(): boolean { return this._pinHash !== null; }
    hasPassword(): boolean { return this._passwordHash !== null; }

    /** @internal Only for use by PersonLoader. */
    getCredentialsForPersistence(): { pinHash: string | null; passwordHash: string | null } {
        return { pinHash: this._pinHash, passwordHash: this._passwordHash };
    }

    /**
     * Exclude sensitive fields from JSON serialization.
     * Prevents accidental credential leakage via res.json(person).
     */
    toJSON() {
        return {
            id:           this.id,
            firstName:    this.firstName,
            lastName:     this.lastName,
            birthDate:    this.birthDate,
            joinDate:     this.joinDate,
            handle:       this.handle,
            disabled:     this.disabled,
            retired:      this.retired,
            guardianId:   this.guardianId,
            phone:        this.phone,
            languages:    this.languages,
            publicKeyHex: this._publicKeyHex,
            nullifier:    this._nullifier,
            credential:   this.credential,
        };
    }
}
