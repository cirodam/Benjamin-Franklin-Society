import { Authority } from "./Authority.js";

/**
 * A small deliberative body drawn by sortition from a LeaderPool, typically
 * ad hoc, with up to a dozen members. Unlike an Assembly there is no
 * community-wide term — a committee is convened for a specific purpose and
 * its members are drawn from the pool governing that domain.
 *
 * Examples: oversight committee, appeals committee, credentials committee.
 */
export class Committee extends Authority {
    readonly kind = "committee" as const;

    memberIds: string[]       = [];
    mandate:   string         = "";
    /** The leader pool that chartered this committee, if any. */
    poolId:    string | undefined = undefined;
    /** True if this is a permanent standing committee; false if ad hoc. */
    permanent: boolean        = false;

    constructor(
        id:                string,
        name:              string,
        defaultVoteRuleId: string,
        description?:      string,
    ) {
        super(id, name, defaultVoteRuleId, description);
    }
}
