import { CommunityDb } from "../CommunityDb.js";
import { SocialInsuranceMember } from "./SocialInsuranceMember.js";

export class SocialInsuranceMemberLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(r: SocialInsuranceMember): void {
        this.db.prepare(`
            INSERT INTO social_insurance_members (member_id, pool_contributed, pool_received)
            VALUES (@member_id, @pool_contributed, @pool_received)
            ON CONFLICT(member_id) DO UPDATE SET
                pool_contributed = excluded.pool_contributed,
                pool_received    = excluded.pool_received
        `).run({
            member_id:       r.memberId,
            pool_contributed: r.poolContributed,
            pool_received:    r.poolReceived,
        });
    }

    loadAll(): SocialInsuranceMember[] {
        return (this.db.prepare("SELECT * FROM social_insurance_members").all() as Array<{
            member_id: string; pool_contributed: number; pool_received: number;
        }>).map(r => {
            const m = new SocialInsuranceMember(r.member_id);
            m.poolContributed = r.pool_contributed;
            m.poolReceived    = r.pool_received;
            return m;
        });
    }

    delete(memberId: string): void {
        this.db.prepare("DELETE FROM social_insurance_members WHERE member_id = ?").run(memberId);
    }
}

