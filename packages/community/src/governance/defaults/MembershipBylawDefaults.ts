import { type GoverningDocument } from "@ecf/core";

/**
 * The default Membership Procedures bylaw.
 *
 * This bylaw governs the admission and discipline of community members.
 * It is seeded at startup with a fixed id ("membership") so that other
 * parts of the system can reliably read its parameters.
 *
 * Key parameters:
 *   petitionThreshold — how many approvals are required for an admit-member
 *                       motion to pass (petition vote rule).
 *
 * Authority grants declared here supplement the constitution:
 *   - assembly   → admit-member  (petition)   [also in constitution II.5]
 *   - referendum → admit-member  (petition)   [added here]
 *   - assembly   → suspend-member (simple-majority)
 *   - assembly   → reinstate-member (simple-majority)
 */
export const MembershipBylawDefaults = {
    build(): GoverningDocument {
        return {
            id:          "membership",
            type:        "bylaw",
            title:       "Membership Procedures",
            preamble:    "This bylaw establishes the procedures by which persons are admitted to the community and by which members may be suspended or reinstated.",
            adoptedAt:   new Date().toISOString(),
            version:     1,
            authorityId: "assembly",
            voteRuleId:  "simple-majority",
            domainId:    null,
            articles: [
                {
                    number:   "I",
                    title:    "Membership Admission",
                    sections: [
                        {
                            id:        "I.1",
                            title:     "Admission by Petition",
                            body:      "Any member in good standing may propose the admission of a new person by submitting a motion of kind admit-member. The motion passes when it accumulates {petitionThreshold} affirmative votes from eligible members. Both the assembly and the full membership may conduct admission petitions.",
                            rationale: "A petition-based admission distributes the responsibility for welcoming new members across the whole community. The threshold is deliberately low to keep the community open while still requiring genuine community endorsement.",
                            directives: [
                                { verb: "parameter.define", args: ["petitionThreshold", "5", "false", "1", "100", "Number of affirmative votes required for an admit-member petition to pass"] },
                                { verb: "authority.grant",  args: ["assembly",   "admit-member", "petition"] },
                                { verb: "authority.grant",  args: ["referendum", "admit-member", "petition"] },
                            ],
                        },
                    ],
                },
                {
                    number:   "II",
                    title:    "Member Discipline",
                    sections: [
                        {
                            id:        "II.1",
                            title:     "Suspension",
                            body:      "The assembly may suspend a member's participation by simple majority vote. A suspension motion must state the grounds. A suspended member retains the right to address the assembly once before the vote closes.",
                            rationale: "Suspension must be possible to protect community safety, but the requirement to state grounds and allow a response guards against arbitrary use.",
                            directives: [
                                { verb: "authority.grant", args: ["assembly", "suspend-member", "simple-majority"] },
                            ],
                        },
                        {
                            id:        "II.2",
                            title:     "Reinstatement",
                            body:      "A suspended member may be reinstated by simple majority vote of the assembly. Any member may bring a reinstatement motion. The suspended person may submit a written statement to be read before the vote.",
                            rationale: "Suspension should be a temporary measure. A clear, accessible reinstatement path prevents suspension from becoming permanent exclusion by inaction.",
                            directives: [
                                { verb: "authority.grant", args: ["assembly", "reinstate-member", "simple-majority"] },
                            ],
                        },
                    ],
                },
            ],
            parameters: {
                petitionThreshold: {
                    value:       5,
                    immutable:   false,
                    description: "Number of affirmative votes required for an admit-member petition to pass.",
                    constraints: { min: 1, max: 100 },
                },
            },
        };
    },
};
