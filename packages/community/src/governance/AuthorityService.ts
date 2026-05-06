import { CommunityDb } from "../CommunityDb.js";
import { PersonService } from "../person/PersonService.js";
import { DomainService } from "../DomainService.js";
import { AuthorityLoader } from "./AuthorityLoader.js";
import { type Authority, isPoolAuthorityId, poolIdFromAuthorityId } from "./Authority.js";

const ASSEMBLY_KEY = "assembly_term";

interface AssemblyTermRecord {
    termStartDate: string;
    memberIds:     string[];
}

export class AuthorityService {
    private static instance: AuthorityService;

    static getInstance(): AuthorityService {
        if (!AuthorityService.instance) AuthorityService.instance = new AuthorityService();
        return AuthorityService.instance;
    }

    getAll(): Authority[] {
        return AuthorityLoader.getInstance().loadAll();
    }

    get(id: string): Authority | undefined {
        return AuthorityLoader.getInstance().load(id);
    }

    /**
     * Resolve the set of person IDs eligible to vote under the given authority.
     * Returns an empty array if the authority is unknown.
     */
    getMemberIds(authorityId: string): string[] {
        switch (authorityId) {
            case "assembly":
                return this.assemblyMemberIds();
            case "membership":
                return PersonService.getInstance().getAll()
                    .filter(p => !p.disabled)
                    .map(p => p.id);
            default:
                if (isPoolAuthorityId(authorityId)) {
                    const poolId = poolIdFromAuthorityId(authorityId);
                    const pool   = DomainService.getInstance().getPool(poolId);
                    return pool?.personIds ?? [];
                }
                return [];
        }
    }

    isMember(authorityId: string, personId: string): boolean {
        return this.getMemberIds(authorityId).includes(personId);
    }

    private assemblyMemberIds(): string[] {
        const db  = CommunityDb.getInstance().db;
        const row = db.prepare("SELECT data FROM singleton_records WHERE key = ?")
            .get(ASSEMBLY_KEY) as { data: string } | undefined;
        if (!row) return [];
        const term = JSON.parse(row.data) as AssemblyTermRecord;
        return term.memberIds ?? [];
    }
}
