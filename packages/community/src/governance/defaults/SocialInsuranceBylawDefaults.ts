import { type GoverningDocument } from "@ecf/core";

/**
 * The default Social Insurance bylaw.
 *
 * Establishes the community's social insurance programmes: retirement income,
 * disability support, and pool sustainability rules.
 *
 * Parameters defined here that are NOT already in the constitution:
 *   disabilityPayoutRate   — monthly kin paid to each member marked disabled
 *   poolReserveFloor       — minimum pool balance (as a fraction of monthly
 *                            liability) before payments are pro-rated
 *
 * Parameters already defined in the constitution (referenced by prose only):
 *   retirementAge          — age at which retirement income begins
 *   retirementPayoutRate   — flat monthly kin per retiree
 *   workingAgeMin          — lower bound for working-age population
 *   endowmentPoolFraction  — share of join endowment directed to the pool
 */
export const SocialInsuranceBylawDefaults = {
    build(): GoverningDocument {
        return {
            id:          "social-insurance",
            type:        "bylaw",
            title:       "Social Insurance",
            preamble:    "This bylaw establishes the community's social insurance programmes. Every member contributes to the pool throughout their membership and is entitled to draw from it during retirement or periods of incapacity. The pool is a collective commitment: its sustainability is a shared responsibility.",
            adoptedAt:   new Date().toISOString(),
            version:     1,
            authorityId: "assembly",
            voteRuleId:  "simple-majority",
            domainId:    null,
            articles: [
                {
                    number: "I",
                    title:  "Retirement Income",
                    sections: [
                        {
                            id:        "I.1",
                            title:     "Eligibility",
                            body:      "A member becomes eligible for retirement income upon reaching the age specified in the constitution ({retirementAge} years) and declaring retirement. Declaration is voluntary: a member who has reached retirement age but continues working is not required to retire. Eligibility is continuous once declared — it is not subject to review or revocation except by the member's own request.",
                            rationale: "Retirement should be a right, not a benefit that must be re-earned or can be withdrawn. The voluntary declaration respects that some members may prefer to continue contributing beyond the threshold.",
                            directives: [],
                        },
                        {
                            id:        "I.2",
                            title:     "Monthly Payment",
                            body:      "On the first day of each month, each eligible retiree receives a flat payment of {retirementPayoutRate} kin transferred from the social insurance pool to their primary account. If the pool balance is insufficient to pay all retirees in full, payments are pro-rated equally. No retiree receives more than their full entitlement; no retiree receives nothing while others receive full payment.",
                            rationale: "A flat equal payment reflects the community's commitment to equal dignity in retirement, regardless of lifetime earnings or contributions. Pro-rata sharing in a shortfall is fairer than first-come-first-served.",
                            directives: [],
                        },
                        {
                            id:        "I.3",
                            title:     "Contributions",
                            body:      "The pool is funded by two streams: a fraction of each new member's join endowment ({endowmentPoolFraction} of the issued amount), and one person-year of kin credited to the pool on each member's birthday. These contributions are automatic and do not require member action. No additional dues or levies are imposed for retirement support.",
                            rationale: "Automatic contributions prevent the pool from depending on voluntary compliance. Birthday contributions tie funding to continued active membership, ensuring the pool grows with the community.",
                            directives: [],
                        },
                    ],
                },
                {
                    number: "II",
                    title:  "Disability Support",
                    sections: [
                        {
                            id:        "II.1",
                            title:     "Eligibility",
                            body:      "A member who is marked as disabled by community decision is eligible for monthly disability support payments. Disability status is determined by the assembly on the basis of documented incapacity. A member may hold both retirement and disability status; in that case, only the higher of the two payment rates applies.",
                            rationale: "Disability support is distinct from retirement: it applies to any member regardless of age. The assembly determination requirement prevents self-certification while keeping the process accessible.",
                            directives: [],
                        },
                        {
                            id:        "II.2",
                            title:     "Monthly Payment",
                            body:      "Each month, every member with disability status receives a flat payment of {disabilityPayoutRate} kin from the social insurance pool. The same pro-rata shortfall rule that applies to retirement payments applies here: if the pool cannot cover all payments in full, all payments are reduced equally.",
                            rationale: "Using the same pool and the same shortfall rule for both programmes keeps the system simple and ensures retirement and disability recipients share the same risk.",
                            directives: [
                                { verb: "parameter.define", args: ["disabilityPayoutRate", "400", "false", "0", "100000", "Flat kin amount paid to each member with disability status per month from the social insurance pool"] },
                            ],
                        },
                    ],
                },
                {
                    number: "III",
                    title:  "Pool Sustainability",
                    sections: [
                        {
                            id:        "III.1",
                            title:     "Reserve Floor",
                            body:      "The assembly shall monitor the pool balance each month. If the pool balance falls below {poolReserveFloor} times the total monthly payment liability (the sum of all retirement and disability payments due), the assembly must convene an emergency session within thirty days to consider remedial measures. Remedial measures may include increasing contribution rates, reducing payment rates, issuing additional kin to the pool, or a combination thereof.",
                            rationale: "The reserve floor is an early-warning mechanism, not a hard cap. It triggers deliberation before a shortfall becomes a crisis.",
                            directives: [
                                { verb: "parameter.define", args: ["poolReserveFloor", "3", "false", "1", "24", "Minimum number of months of payment liability the pool must hold before triggering an emergency review"] },
                            ],
                        },
                        {
                            id:        "III.2",
                            title:     "Demurrage Exemption",
                            body:      "The social insurance pool account is exempt from the Central Bank's demurrage fee. The pool holds deferred liabilities, not circulating currency. Applying demurrage to it would erode the community's ability to meet its obligations to retirees and disabled members.",
                            rationale: "Demurrage discourages idle hoarding. The pool is the opposite of hoarding — it is deferred obligation. Exempting it preserves the intent of demurrage without penalising collective security.",
                            directives: [],
                        },
                    ],
                },
            ],
            parameters: {
                disabilityPayoutRate: {
                    value:       400,
                    immutable:   false,
                    description: "Flat kin amount paid to each member with disability status per month from the social insurance pool.",
                    constraints: { min: 0, max: 100_000 },
                },
                poolReserveFloor: {
                    value:       3,
                    immutable:   false,
                    description: "Minimum months of payment liability the pool must hold before triggering an emergency assembly review.",
                    constraints: { min: 1, max: 24 },
                },
            },
        };
    },
};
