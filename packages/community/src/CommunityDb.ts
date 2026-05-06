import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";

/**
 * SQLite singleton for the community package.
 *
 * Call `CommunityDb.init(dataDir)` once at startup before constructing any
 * loaders. All loaders obtain the database via `CommunityDb.getInstance().db`.
 */
export class CommunityDb {
    private static instance: CommunityDb | null = null;

    readonly db: Database.Database;

    private constructor(dataDir: string) {
        mkdirSync(dataDir, { recursive: true });
        this.db = new Database(join(dataDir, "community.db"));

        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.pragma("synchronous = NORMAL");

        this.createSchema();
    }

    static init(dataDir: string): CommunityDb {
        if (!CommunityDb.instance) {
            CommunityDb.instance = new CommunityDb(dataDir);
        }
        return CommunityDb.instance;
    }

    static getInstance(): CommunityDb {
        if (!CommunityDb.instance) {
            throw new Error("[CommunityDb] Not initialised — call CommunityDb.init(dataDir) at startup");
        }
        return CommunityDb.instance;
    }

    private createSchema(): void {
        this.db.exec(`
            -- ── Persons ──────────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS persons (
                id                TEXT PRIMARY KEY,
                first_name        TEXT NOT NULL,
                last_name         TEXT NOT NULL,
                birth_date        TEXT NOT NULL,
                join_date         TEXT NOT NULL,
                handle            TEXT NOT NULL UNIQUE,
                disabled          INTEGER NOT NULL DEFAULT 0,
                retired           INTEGER NOT NULL DEFAULT 0,
                steward           INTEGER NOT NULL DEFAULT 0,
                guardian_id       TEXT,
                phone             TEXT,
                pin_hash          TEXT,
                password_hash     TEXT,
                private_key_der   TEXT,
                public_key_hex    TEXT,
                languages            TEXT NOT NULL DEFAULT '[]',
                apps                 TEXT NOT NULL DEFAULT '[]',
                must_change_password INTEGER NOT NULL DEFAULT 0,
                credential           TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_persons_handle ON persons(handle);
            CREATE INDEX IF NOT EXISTS idx_persons_phone  ON persons(phone) WHERE phone IS NOT NULL;


            -- ── Locations ─────────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS locations (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                address     TEXT NOT NULL,
                lat         REAL,
                lng         REAL,
                description TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL
            );

            -- ── Shifts ───────────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS shifts (
                id                 TEXT PRIMARY KEY,
                created_at         TEXT NOT NULL,
                created_by         TEXT NOT NULL,
                domain_id          TEXT NOT NULL,
                label              TEXT NOT NULL,
                start_at           TEXT NOT NULL,
                end_at             TEXT NOT NULL,
                assigned_person_id TEXT,
                note               TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_shifts_domain ON shifts(domain_id);

            -- ── Nominations ───────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS nominations (
                id          TEXT PRIMARY KEY,
                created_at  TEXT NOT NULL,
                created_by  TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'role',
                role_id     TEXT NOT NULL DEFAULT '',
                unit_id     TEXT NOT NULL DEFAULT '',
                domain_id   TEXT NOT NULL DEFAULT '',
                pool_id     TEXT,
                nominee_id  TEXT NOT NULL,
                statement   TEXT NOT NULL DEFAULT '',
                status      TEXT NOT NULL DEFAULT 'pending',
                resolved_at TEXT,
                resolved_by TEXT
            );

            -- ── Social insurance members ──────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS social_insurance_members (
                member_id        TEXT PRIMARY KEY,
                pool_contributed REAL NOT NULL DEFAULT 0,
                pool_received    REAL NOT NULL DEFAULT 0
            );

            -- ── Collection tables (id + JSON data) ───────────────────────────────────
            CREATE TABLE IF NOT EXISTS proposals (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS motions (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS leader_pools (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS associations (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS calendar_events (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS organizations (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS role_types (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS community_roles (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS functional_units (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS unit_types (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS functional_domain_states (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            -- ── Bylaws ────────────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS bylaws (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            -- ── Authorities ───────────────────────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS authorities (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            -- ── Singleton records (key/value) ─────────────────────────────────────────
            CREATE TABLE IF NOT EXISTS singleton_records (
                key  TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            -- ── Community log (append-only timeline) ─────────────────────────────────
            CREATE TABLE IF NOT EXISTS community_log (
                id          TEXT PRIMARY KEY,
                type        TEXT NOT NULL,
                summary     TEXT NOT NULL,
                actor_id    TEXT,
                ref_id      TEXT,
                occurred_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_community_log_occurred ON community_log(occurred_at DESC);
        `);
    }
}
