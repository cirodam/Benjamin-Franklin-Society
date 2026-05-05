import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join, dirname } from "path";

export class GrangeDb {
    private static instance: GrangeDb;
    readonly db: Database.Database;

    private constructor(dataDir: string) {
        const dbPath = join(dataDir, "grange.db");
        mkdirSync(dirname(dbPath), { recursive: true });

        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.pragma("synchronous = NORMAL");
        this.applySchema();
    }

    static init(dataDir: string): GrangeDb {
        if (GrangeDb.instance) throw new Error("GrangeDb already initialized");
        GrangeDb.instance = new GrangeDb(dataDir);
        return GrangeDb.instance;
    }

    static getInstance(): GrangeDb {
        if (!GrangeDb.instance) throw new Error("GrangeDb.init() must be called before getInstance()");
        return GrangeDb.instance;
    }

    private applySchema(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS farm_associations (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS needs_projections (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contracts (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deliveries (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS inspections (
                id   TEXT PRIMARY KEY,
                data TEXT NOT NULL
            );
        `);
    }
}
