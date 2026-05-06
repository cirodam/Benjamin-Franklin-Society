import type { GoverningDocument } from "../common/DocumentFramework.js";

/**
 * Returns the default charter document for a Benjamin Franklin Society.
 * `adoptedAt` is set to now at call-time so each community's charter records
 * its own founding date.
 */
export function makeDefaultCharter(): GoverningDocument {
    return {
        id:          "charter",
        type:        "charter",
        title:       "Benjamin Franklin Society Charter",
        preamble:    "This charter defines what a Benjamin Franklin Society is. It is maintained by the founding societies and amended by agreement among established societies. Its provisions are not subject to local amendment.",
        articles: [
            {
                number: "I",
                title:  "What a Benjamin Franklin Society Is",
                sections: [
                    {
                        id:        "I.1",
                        body:      "A Benjamin Franklin Society is a member-governed community organization. It exists to meet the needs of its members — not to grow, not to generate returns for outside investors, not to serve any interest other than the people who belong to it.\n\nEvery society is independent. It writes its own bylaws, admits its own members, makes its own decisions. No outside authority — not an association, not the Society at large, not the founders of this software — governs the internal life of a society. That authority belongs to the members.\n\nA Benjamin Franklin Society is not a political organization. It does not take positions on elections or candidates. It is open to people of any background or political view who are willing to work alongside their neighbors and abide by the society's own rules.",
                        paramKeys: [],
                        rationale: "The independence clause protects member communities from capture by any central authority, including the network itself. The non-partisan clause protects the community's ability to include everyone.",
                    },
                ],
            },
            {
                number:   "II",
                title:    "What Every Society Commits To",
                preamble: "By adopting this charter, a society makes the following commitments to its members. These are not subject to local amendment. They are the floor below which a society cannot go and still be a Benjamin Franklin Society.",
                sections: [
                    {
                        id:        "II.1",
                        title:     "We will look after our members",
                        body:      "Every member receives basic needs support unconditionally. Support is not withheld as punishment. Membership is not contingent on health, productivity, or economic contribution.",
                        paramKeys: [],
                        rationale: "A mutual aid society that conditions support on productivity is an employer, not a community. The unconditional floor is what makes the commitment genuine.",
                    },
                    {
                        id:        "II.2",
                        title:     "We will govern ourselves fairly",
                        body:      "Every member has an equal standing in the society's governance. Assembly members are drawn by sortition — random selection from the eligible membership — so no individual or faction can acquire a controlling position by campaigning, wealth, or influence. Decisions are made by the members, not made for them.",
                        paramKeys: [],
                        rationale: "Sortition prevents the capture of governance by well-organized minorities. A randomly drawn body represents the community as it actually is.",
                    },
                    {
                        id:        "II.3",
                        title:     "We will treat members with due process",
                        body:      "No member's standing may be suspended, revoked, or materially restricted without notice, a stated reason, and a genuine opportunity to respond before the decision takes effect.",
                        paramKeys: [],
                        rationale: "Unilateral removal without process is the primary tool of authoritarian governance. The due process requirement makes it structurally unavailable.",
                    },
                    {
                        id:        "II.4",
                        title:     "We will provide a right of appeal",
                        body:      "Any member subject to an adverse governance decision may appeal it to an independent body before it takes permanent effect.",
                        paramKeys: [],
                    },
                    {
                        id:        "II.5",
                        title:     "We will not punish people retroactively",
                        body:      "No rule change may be applied to penalize conduct that was permitted when it occurred.",
                        paramKeys: [],
                    },
                    {
                        id:        "II.6",
                        title:     "We will keep an honest ledger",
                        body:      "All exchange flows within the society are visible to all members. No parallel books.",
                        paramKeys: [],
                        rationale: "Opacity in the ledger is how economic exploitation hides. Full member visibility makes it structurally impossible to run parallel books or conceal transfers.",
                    },
                    {
                        id:        "II.7",
                        title:     "We will not surveil, manipulate, or coerce our members",
                        body:      "Member data belongs to members. The society does not sell or share member information with outside parties. It does not use advertising, algorithmic pressure, or social incentives to push members toward particular views or behaviors. Members are entitled to their own opinions. The society does not require conformity — only that members treat each other with basic respect and abide by the rules they agreed to.",
                        paramKeys: [],
                    },
                    {
                        id:        "II.8",
                        title:     "We will let members leave freely",
                        body:      "Members may take their own records and go at any time. A society may not hold a member's data or balance hostage to continued membership.",
                        paramKeys: [],
                    },
                ],
            },
            {
                number:   "III",
                title:    "Required Institutions",
                preamble: "The commitments in Article II are not aspirations. They are operational requirements. A society that sincerely intends to keep them must build the institutions that make keeping them possible. The following institutions are non-negotiable — every Benjamin Franklin Society must maintain them.",
                sections: [
                    {
                        id:        "III.1",
                        title:     "A Community Bank",
                        body:      "Every society operates a community bank that issues and manages the society's internal currency. The bank is not owned by any individual member or faction. Its ledger is open to all members. It does not lend money it does not have, does not charge interest on mutual-aid accounts, and does not operate parallel books. The bank exists to keep exchange flowing — not to accumulate.\n\nThe community currency is designed to circulate, not to be hoarded. It carries a demurrage charge — a small periodic fee on idle balances — so that kin held without use gradually returns to the community pool. This is not a penalty. It is the mechanism that keeps the currency working as a medium of exchange rather than a store of private wealth.",
                        paramKeys: [],
                        rationale: "Without a community-owned bank, exchange within the society depends on outside money that can be withheld. The demurrage mechanism enforces circulation and prevents hoarding by any individual or faction.",
                    },
                    {
                        id:        "III.2",
                        title:     "A Social Insurance Fund",
                        body:      "Every society maintains a social insurance fund. All members contribute to it according to their means. All members may draw from it according to their need. The fund covers basic necessities — food, shelter, medical care, and the other things without which a person cannot live with dignity.\n\nAccess to the fund is not contingent on a member's economic productivity, health status, or history of contribution. A member who falls ill, loses work, ages out of employment, or faces an emergency is entitled to support. This is what the commitment to look after members actually means in practice.\n\nThe fund is governed by the membership, not administered unilaterally by any officer. Its balance and disbursements are visible to all members.",
                        paramKeys: [],
                    },
                    {
                        id:        "III.3",
                        title:     "A Governing Assembly",
                        body:      "Every society operates a governing assembly drawn by sortition — members selected at random from the eligible membership, not by election. Sortition prevents the community assembly from being captured by a faction that campaigns well. A randomly-drawn body represents the community as it actually is, not as its most organised members would prefer it to be.\n\nThe community assembly sets policy, amends bylaws, draws or removes officers, and makes decisions that cannot be delegated. No executive, no committee, and no officer may act in ways the community assembly has not authorised or would not authorise if asked. The community assembly does not need to meet continuously, but it must meet regularly and must be the final authority on the society's direction.",
                        paramKeys: [],
                    },
                ],
            },
            {
                number: "IV",
                title:  "Relationship to Other Societies",
                sections: [
                    {
                        id:        "IV.1",
                        body:      "Societies may join together into associations — groups of societies that trade and look after each other across a wider area. Joining an association is voluntary. A society that joins an association does not hand over its governance to it. The association serves the societies; the societies do not serve the association.\n\nSocieties dealing with each other deal honestly. Exchange records are accurate and not manipulated. A society that manipulates its records or defrauds other societies has broken the terms on which cooperation rests — other societies are under no obligation to continue associating with it.\n\nA society may stop participating in the wider Benjamin Franklin Society at any time by member vote. Its own records, its exchange ledger, and its members' data remain its own. Any open balances with other societies are settled and the connection is closed.",
                        paramKeys: [],
                    },
                ],
            },
            {
                number: "V",
                title:  "What Makes a Benjamin Franklin Society",
                sections: [
                    {
                        id:        "V.1",
                        body:      "This charter does not govern communities. Communities govern themselves. What this charter does is define what the name means.\n\nA Benjamin Franklin Society is a community that upholds the commitments in Article II and operates the Benjamin Franklin Society software with those commitments active and enforced — including the institutions required by Article III. That's it. No application, no approval, no paperwork required.\n\nA community that does not uphold the commitments in Article II is not a Benjamin Franklin Society. It may be a fine community. It may do good work. But the name belongs to the definition, and the definition requires those commitments. A community that abandons them has not been expelled — it has simply become something else.",
                        paramKeys: [],
                    },
                ],
            },
        ],
        adoptedAt:   new Date().toISOString(),
        version:     1,
        authorityId: "network",
        voteRuleId:  "absolute-supermajority",
        domainId:    null,
        expiresAt:   null,
    };
}
