import { CommunityDb } from "../CommunityDb.js";
import { Person, PersonCredential, LanguageProficiency } from "./Person.js";

interface PersonRow {
    id:                string;
    first_name:        string;
    last_name:         string;
    birth_date:        string;
    join_date:         string;
    handle:            string;
    disabled:          number;
    retired:           number;
    admin:             number;
    guardian_id:       string | null;
    phone:             string | null;
    pin_hash:          string | null;
    password_hash:     string | null;
    private_key_der:   string | null;
    public_key_hex:    string | null;
    languages:         string; // JSON
    apps:                 string; // JSON
    must_change_password: number;
    credential:           string | null; // JSON
}

export class PersonLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(person: Person): void {
        const { pinHash, passwordHash } = person.getCredentialsForPersistence();
        const { privateKeyDer, publicKeyHex } = person.getKeypairForPersistence();
        this.db.prepare(`
            INSERT INTO persons
                (id, first_name, last_name, birth_date, join_date, handle,
                 disabled, retired, admin,
                 guardian_id, phone, pin_hash, password_hash,
                 private_key_der, public_key_hex, languages, apps, must_change_password, credential)
            VALUES
                (@id, @first_name, @last_name, @birth_date, @join_date, @handle,
                 @disabled, @retired, @admin,
                 @guardian_id, @phone, @pin_hash, @password_hash,
                 @private_key_der, @public_key_hex, @languages, @apps, @must_change_password, @credential)
            ON CONFLICT(id) DO UPDATE SET
                first_name           = excluded.first_name,
                last_name            = excluded.last_name,
                birth_date           = excluded.birth_date,
                join_date            = excluded.join_date,
                handle               = excluded.handle,
                disabled             = excluded.disabled,
                retired              = excluded.retired,
                admin                = excluded.admin,
                guardian_id          = excluded.guardian_id,
                phone                = excluded.phone,
                pin_hash             = excluded.pin_hash,
                password_hash        = excluded.password_hash,
                private_key_der      = excluded.private_key_der,
                public_key_hex       = excluded.public_key_hex,
                languages            = excluded.languages,
                apps                 = excluded.apps,
                must_change_password = excluded.must_change_password,
                credential           = excluded.credential
        `).run({
            id:                person.id,
            first_name:        person.firstName,
            last_name:         person.lastName,
            birth_date:        person.birthDate.toISOString(),
            join_date:         person.joinDate.toISOString(),
            handle:            person.handle,
            disabled:          person.disabled ? 1 : 0,
            retired:           person.retired ? 1 : 0,
            admin:             person.admin ? 1 : 0,
            guardian_id:       person.guardianId ?? null,
            phone:             person.phone ?? null,
            pin_hash:          pinHash ?? null,
            password_hash:     passwordHash ?? null,
            private_key_der:   privateKeyDer ?? null,
            public_key_hex:    publicKeyHex ?? null,
            languages:            JSON.stringify(person.languages),
            apps:                 JSON.stringify(person.apps),
            must_change_password: person.mustChangePassword ? 1 : 0,
            credential:           person.credential ? JSON.stringify(person.credential) : null,
        });
    }

    loadAll(): Person[] {
        return (this.db.prepare("SELECT * FROM persons").all() as PersonRow[])
            .map(r => this.fromRow(r));
    }

    delete(id: string): boolean {
        const result = this.db.prepare("DELETE FROM persons WHERE id = ?").run(id);
        return result.changes > 0;
    }

    private fromRow(r: PersonRow): Person {
        return Person.restore({
            id:              r.id,
            firstName:       r.first_name,
            lastName:        r.last_name,
            birthDate:       new Date(r.birth_date),
            joinDate:        new Date(r.join_date),
            handle:          r.handle,
            disabled:        r.disabled === 1,
            retired:         r.retired === 1,
            admin:           r.admin === 1,
            guardianId:      r.guardian_id ?? null,
            phone:           r.phone ?? null,
            pinHash:            r.pin_hash ?? null,
            passwordHash:       r.password_hash ?? null,
            mustChangePassword: r.must_change_password === 1,
            privateKeyDer:      r.private_key_der ?? null,
            publicKeyHex:       r.public_key_hex ?? null,
            languages:          JSON.parse(r.languages) as LanguageProficiency[],
            apps:               JSON.parse(r.apps ?? "[]") as string[],
            credential:         r.credential ? JSON.parse(r.credential) as PersonCredential : null,
        });
    }
}

