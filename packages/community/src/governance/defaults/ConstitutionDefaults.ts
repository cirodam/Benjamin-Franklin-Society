/**
 * Default constitution document seeded on first boot.
 * Self-contained — no dependency on the deleted Constitution.ts.
 *
 * Authority definitions and grants are declared via section directives (Phase 2).
 * Document-level parameters are kept for now so DocumentLoader.getParam continues
 * to work until the reconciler (Phase 3) takes over reading from directives.
 */
import type { GoverningDocument, DocumentArticle } from "@ecf/core";

const DEFAULT_ARTICLES: DocumentArticle[] = [
    // ── Article I — Founding Principles ──────────────────────────────────────
    {
        number: "I",
        title: "Founding Principles",
        sections: [
            {
                id: "I.1", title: "Why We Are Here",
                body: "Most of us grew up believing that if we worked hard and played by the rules, our basic needs would be met. For a great many people, that has not proven true. Work no longer guarantees security. Housing costs more than families can afford. Healthcare goes without because the price is too high. Neighbors who need help find that the systems meant to provide it are distant, difficult, and insufficient. These are not personal failures — they are shared experiences, felt across communities of every background. We are not the first to notice, and we are not naive about the difficulty of change. But we believe that people who choose to meet their needs together, in full view of one another, can do better than institutions that have forgotten who they were built to serve. This community is that attempt.",
                rationale: "This section names the problem the community exists to address. It is here so that future members know the founding motivation, and so that any proposal that would move the community away from that purpose is recognizable as a departure from its reason for being.",
            },
            {
                id: "I.2", title: "Human Dignity",
                body: "Every person has worth that is not contingent on their productivity, their health, their age, or any other measure of economic usefulness. A person who cannot work has the same claim on a dignified life as anyone else. A community that withholds basic necessities from people who fail to contribute economically has not balanced its books — it has betrayed its purpose. This community holds human dignity as prior to economic participation. No member's standing within it is earned. It is given.",
                rationale: "Most institutional failures come down to treating people as inputs rather than ends. This section makes explicit that the community rejects that framing — belonging is not conditional on productivity.",
                directives: [
                    { verb: "parameter.define", args: ["universalFloorGuaranteed",   "true", "true", "Every member receives basic needs support unconditionally"] },
                    { verb: "parameter.define", args: ["membershipUnconditional",     "true", "true", "Belonging is not contingent on productive capacity"] },
                    { verb: "parameter.define", args: ["dueProcessGuaranteed",        "true", "true", "No member may have their membership suspended without notice, a stated reason, and an opportunity to respond"] },
                    { verb: "parameter.define", args: ["noExPostFacto",               "true", "true", "No rule change may be applied retroactively to penalise conduct that was permitted at the time it occurred"] },
                    { verb: "parameter.define", args: ["rightOfAppeal",               "true", "true", "Any member subject to an adverse governance decision has the right to appeal it before it takes permanent effect"] },
                ],
            },
            {
                id: "I.3", title: "Economy in Service of People",
                body: "An economy is a tool for coordinating how people meet their needs. An economy that denies cancer treatment to keep a claims ratio low, that leaves veterans on the street, that will not feed children despite producing enough food to waste half of it — that economy has not merely developed flaws. It has failed at its only legitimate purpose. The economy of this community exists to meet the needs of its members. That is the measure by which every economic decision here will be judged.",
                rationale: "This section provides the evaluative criterion for economic decisions: does it meet members' needs?",
                directives: [
                    { verb: "parameter.define", args: ["ledgerTransparent",            "true", "true", "All kin flows are visible to all members"] },
                    { verb: "parameter.define", args: ["democraticMinimumProtected",   "true", "true", "Governance cannot be captured by any individual or group"] },
                    { verb: "parameter.define", args: ["dataPortabilityGuaranteed",    "true", "true", "Members can always take their data and leave"] },
                ],
            },
            {
                id: "I.4", title: "Scope",
                body: "This constitution governs the internal affairs of this community. It does not claim authority over any person who has not chosen membership, and it does not override any rights a member holds as a person beyond this community. It is not a complete theory of society — it is an agreement among people who have chosen to meet their needs together.",
                rationale: "A community constitution can only bind those who have consented to it.",
            },
        ],
    },

    // ── Article II — Governance ───────────────────────────────────────────────
    {
        number: "II",
        title: "Governance",
        sections: [
            {
                id: "II.1", title: "The Source of Authority",
                body: "Legitimate authority in this community comes from the whole community, not from the ability to win an election. No person or group holds permanent authority here. Every decision is made by the community, in whole or in part.",
                rationale: "Elections concentrate authority in those who seek it. This section establishes the alternative: authority flows from the community as a whole and is delegated temporarily, never assigned permanently.",
            },
            {
                id: "II.2", title: "The Assembly",
                body: "The assembly is the highest governing body of this community. It is composed of {assemblySeatCount} members drawn by sortition from the full membership for a fixed term of {assemblyTermMonths} months. Any member may be drawn. The assembly sets policy, ratifies significant decisions, and holds all other bodies accountable. When its term ends, a new assembly is drawn.",
                rationale: "A randomly drawn assembly represents the community as it actually is, not as those motivated to seek power would have it appear.",
                directives: [
                    { verb: "authority.define",  args: ["assembly", "assembly", "simple-majority", "The seated assembly — members drawn by sortition for the current term."] },
                    { verb: "parameter.define",  args: ["assemblySeatCount",       "99", "false", "9",  "999", "Number of members drawn by sortition to form the assembly for a given term"] },
                    { verb: "parameter.define",  args: ["assemblyTermMonths",      "12", "false", "1",  "24",  "Duration of an assembly term in months"] },
                    { verb: "parameter.define",  args: ["assemblyTermStartMonth",  "6",  "false", "1",  "12",  "Calendar month (1-12) on which a new assembly term begins each cycle"] },
                    { verb: "parameter.define",  args: ["assemblyTermStartDay",    "2",  "false", "1",  "31",  "Day of the month on which a new assembly term begins each cycle"] },
                    { verb: "parameter.define",  args: ["deliberationPeriodDays",  "3",  "false", "1",  "30",  "Minimum days a proposal must be open for deliberation before voting may close"] },
                ],
            },
            {
                id: "II.3", title: "Sortition",
                body: "Leadership roles are filled by random draw from the relevant pool. The person selected serves for a fixed term, then returns to ordinary membership. A cooling-off period follows before they may serve in the same role again. This ensures that authority circulates through the community rather than accumulating in the hands of those who seek it most.",
                rationale: "Sortition has a long history — Athenian democracy used it for most offices, on the theory that any competent citizen can serve and that elections are an aristocratic method.",
            },
            {
                id: "II.4", title: "Leader Pools",
                body: "Any member may join the pool of candidates for a leadership role by declaring their willingness to serve. No campaign, no election, no endorsement is required or permitted. The pool is simply the set of people who have said: I am willing.",
                rationale: "The pool mechanism preserves one meaningful element of consent: a person must choose to be available for leadership.",
            },
            {
                id: "II.5", title: "Assembly Powers",
                body: "The assembly holds the following governing powers: admitting new members by petition reaching the required signature threshold; suspending a member pending investigation or review by simple majority; setting the budget envelope for each operational domain by simple majority; and reorganising or splitting a domain council when necessary by supermajority.",
                rationale: "Grouping assembly powers in one section ensures members can see at a glance what the assembly may and may not decide, and makes it straightforward to amend specific powers independently.",
                directives: [
                    { verb: "authority.grant", args: ["assembly", "admit-member",            "petition"] },
                    { verb: "authority.grant", args: ["assembly", "suspend-member",          "simple-majority"] },
                    { verb: "authority.grant", args: ["assembly", "allocate-domain-budget",  "simple-majority"] },
                    { verb: "authority.grant", args: ["assembly", "split-council",           "supermajority"] },
                ],
            },
            {
                id: "II.6", title: "The Referendum",
                body: "Certain fundamental decisions require the direct vote of the full membership — a referendum. A referendum is not a delegation of authority to a representative body; it is the community acting directly. Any active member may vote. The result binds the community.",
                rationale: "Some decisions are too consequential to delegate to a drawn subset. A referendum ensures the full community makes fundamental choices.",
                directives: [
                    { verb: "authority.define", args: ["referendum", "membership", "absolute-supermajority", "A direct vote of all active members, used for fundamental decisions."] },
                ],
            },
            {
                id: "II.7", title: "Referendum Powers",
                body: "The full membership decides the following: permanently excluding a member from the community; changing the community dues rate or the bank demurrage rate or floor; amending any constitutional parameter; and joining or leaving a federation.",
                rationale: "These decisions alter fundamental rights, economic structures, or the community's external relationships. They require the broadest possible mandate — not a representative sample, but the whole.",
                directives: [
                    { verb: "authority.grant", args: ["referendum", "exclude-member",            "absolute-supermajority"] },
                    { verb: "authority.grant", args: ["referendum", "change-dues-rate",          "absolute-majority"] },
                    { verb: "authority.grant", args: ["referendum", "change-demurrage-rate",     "absolute-majority"] },
                    { verb: "authority.grant", args: ["referendum", "change-demurrage-floor",    "absolute-majority"] },
                    { verb: "authority.grant", args: ["referendum", "amend-document-parameter",  "absolute-supermajority"] },
                    { verb: "authority.grant", args: ["referendum", "join-federation",           "absolute-supermajority"] },
                    { verb: "authority.grant", args: ["referendum", "leave-federation",          "absolute-supermajority"] },
                ],
            },
            {
                id: "II.8", title: "Voting Thresholds",
                body: "Votes are evaluated against defined thresholds. A simple majority requires more than half of votes cast. A supermajority requires two-thirds of votes cast. An absolute majority requires more than half of all eligible members. An absolute supermajority requires two-thirds of all eligible members. A petition requires a fixed count of signatures set at motion creation.",
                rationale: "Naming the thresholds in constitutional prose and in machine-readable parameters ensures the software enforces exactly what the document says.",
                directives: [
                    { verb: "parameter.define", args: ["thresholdSimpleMajority",  "0.51", "false", "0.51", "0.66", "Fraction of votes cast required to pass a simple-majority proposal"] },
                    { verb: "parameter.define", args: ["thresholdSupermajority",   "0.67", "false", "0.60", "0.80", "Fraction of votes cast required to pass a supermajority proposal"] },
                    { verb: "parameter.define", args: ["thresholdNearConsensus",   "0.90", "false", "0.80", "1.00", "Fraction of votes cast required to pass a near-consensus proposal"] },
                ],
            },
        ],
    },

    // ── Article III — Economics ───────────────────────────────────────────────
    {
        number: "III",
        title: "Economics",
        sections: [
            {
                id: "III.1", title: "The Kin",
                body: "The unit of account for this community is the kin. It is grounded in the most basic thing all members share: the years of their lives. One kin represents one ten-thousandth of a person-year — 10,000 kin to a year.\n\nMost currencies are backed by government decree, by gold, or by debt. The kin is backed by something more direct: the community itself and the lives of the people in it.",
                rationale: "Anchoring the currency to person-years means the money supply grows with the community itself and values all members equally regardless of what they produce.",
                directives: [
                    { verb: "parameter.define", args: ["kinPerPersonYear",           "10000", "true",  "Kin issued per person-year of presence — unit definition, 1 kin = 1/10,000 person-year"] },
                    { verb: "parameter.define", args: ["birthdayCirculationFraction", "0.20", "false", "0", "0.5", "Fraction of each annual person-year issuance paid directly to the member's primary account"] },
                ],
            },
            {
                id: "III.2", title: "The Banks",
                body: "This community operates two financial institutions. The Community Bank holds member accounts — it is where kin is stored, sent, and received. The Central Bank manages monetary policy — it issues new kin and applies the holding fee. All flows through both institutions are visible to every member. There are no hidden charges and no hidden balances.",
                rationale: "Separating the retail bank from the central bank mirrors standard institutional design.",
            },
            {
                id: "III.3", title: "The Holding Fee",
                body: "To discourage hoarding and keep kin moving through the community, the Central Bank applies a monthly holding fee of {bankDemurrageRate} to all account balances above {demurrageFloor} kin. Only the portion above this floor is subject to the fee. Balances at or below {demurrageFloor} kin are never charged.",
                rationale: "Demurrage — a cost for holding currency idle — discourages accumulation and encourages circulation. The floor protects small balances.",
                directives: [
                    { verb: "parameter.define", args: ["bankDemurrageRate", "0.02",  "false", "0", "0.10",  "Monthly rate at which the Central Bank applies demurrage to balances above the floor"] },
                    { verb: "parameter.define", args: ["demurrageFloor",    "1000",  "false", "0", "5000",  "Balance below which no demurrage is charged"] },
                ],
            },
            {
                id: "III.4", title: "Community Dues",
                body: "Each month, {communityDuesRate} of every member's primary balance above {demurrageFloor} kin is transferred to the community treasury as dues. This kin is not destroyed — it funds the shared budget we all depend on.",
                rationale: "Dues are how the shared budget is funded. Unlike taxes in an external currency, kin dues do not leave the community.",
                directives: [
                    { verb: "parameter.define", args: ["communityDuesRate", "0.01", "false", "0", "0.10", "Monthly rate collected from every member's primary balance above the floor as community dues"] },
                ],
            },
        ],
    },

    // ── Article IV — Membership ───────────────────────────────────────────────
    {
        number: "IV",
        title: "Membership",
        sections: [
            {
                id: "IV.1", title: "Admission",
                body: "Any person may apply for membership. An application is automatically approved when {memberAdmissionVouchesRequired} existing members vouch for the applicant. The assembly may also admit a member directly by petition vote.",
                rationale: "Vouching distributes the responsibility for membership decisions across the whole community rather than concentrating it in a committee.",
                directives: [
                    { verb: "parameter.define", args: ["memberAdmissionVouchesRequired", "3", "false", "1", "10", "Number of existing member vouches required to automatically admit a membership applicant"] },
                ],
            },
            {
                id: "IV.2", title: "Senior Members",
                body: "A member who has been continuously active for {adminThresholdYears} years automatically gains admin access. Senior members have additional responsibilities: they are eligible for sortition into the assembly and may serve as clerks and witnesses in governance proceedings.",
                rationale: "Admin access is earned through sustained participation, not appointment. The threshold is high enough to signal genuine commitment, low enough to be reachable.",
                directives: [
                    { verb: "parameter.define", args: ["adminThresholdYears", "3", "false", "1", "20", "Years of continuous active membership required to gain admin access"] },
                ],
            },
            {
                id: "IV.3", title: "Working Life and Retirement",
                body: "Members who have reached the age of {retirementAge} are eligible to receive a monthly retirement payment of {retirementPayoutRate} kin from the social insurance pool. Members under the age of {workingAgeMin} are not counted in the working-age population for the purposes of labour statistics and contribution expectations.",
                rationale: "Retirement support is a concrete expression of the community's commitment to human dignity at every stage of life.",
                directives: [
                    { verb: "parameter.define", args: ["workingAgeMin",        "16",  "false", "14", "21",     "Minimum age at which a member is counted in the working-age population"] },
                    { verb: "parameter.define", args: ["retirementAge",        "65",  "false", "55", "75",     "Age at which a member becomes eligible for monthly retirement payments"] },
                    { verb: "parameter.define", args: ["retirementPayoutRate", "500", "false", "0",  "100000", "Flat kin amount paid to each eligible retiree per month from the social insurance pool"] },
                ],
            },
            {
                id: "IV.4", title: "Member Endowment",
                body: "When a new member is admitted, the community issues a one-time endowment drawn from the kin issuance pool. Of this endowment, {endowmentPoolFraction} is directed into the social insurance pool and the remainder is credited to the member's primary account. This ensures every member begins with a meaningful stake in the community's financial life.",
                rationale: "A joining endowment prevents new members from starting at zero — a situation that would undermine the community's stated commitment to meeting members' needs from day one.",
                directives: [
                    { verb: "parameter.define", args: ["endowmentPoolFraction", "0.80", "false", "0.50", "0.95", "Fraction of a new member's join endowment directed into the social insurance pool"] },
                ],
            },
        ],
    },
];

export const DEFAULT_CONSTITUTION: GoverningDocument = {
    id:          "constitution",
    type:        "constitution",
    title:       "Community Constitution",
    readonly:    true,
    articles:    DEFAULT_ARTICLES,
    adoptedAt:   new Date().toISOString(),
    version:     1,
    authorityId: "referendum",
    voteRuleId:  "absolute-supermajority",
    // ── Parameters (kept for DocumentLoader.getParam until reconciler lands in Phase 3)
    parameters: {
        kinPerPersonYear:               { value: 10_000, immutable: true,  description: "Kin issued per person-year of presence. Unit definition — 1 kin = 1/10,000 person-year." },
        universalFloorGuaranteed:       { value: true,   immutable: true,  description: "Every member receives basic needs support unconditionally." },
        membershipUnconditional:        { value: true,   immutable: true,  description: "Belonging is not contingent on productive capacity." },
        dataPortabilityGuaranteed:      { value: true,   immutable: true,  description: "Members can always take their data and leave." },
        ledgerTransparent:              { value: true,   immutable: true,  description: "All kin flows are visible to all members." },
        democraticMinimumProtected:     { value: true,   immutable: true,  description: "Governance cannot be captured by any individual or group." },
        dueProcessGuaranteed:           { value: true,   immutable: true,  description: "No member may have their membership suspended without notice, a stated reason, and an opportunity to respond." },
        noExPostFacto:                  { value: true,   immutable: true,  description: "No rule change may be applied retroactively to penalise conduct that was permitted at the time it occurred." },
        rightOfAppeal:                  { value: true,   immutable: true,  description: "Any member subject to an adverse governance decision has the right to appeal it before it takes permanent effect." },
        thresholdSimpleMajority:        { value: 0.51,   immutable: false, description: "Fraction of votes cast required to pass a simple-majority proposal.",    constraints: { min: 0.51, max: 0.66 } },
        thresholdSupermajority:         { value: 0.67,   immutable: false, description: "Fraction of votes cast required to pass a supermajority proposal.",       constraints: { min: 0.60, max: 0.80 } },
        thresholdNearConsensus:         { value: 0.90,   immutable: false, description: "Fraction of votes cast required to pass a near-consensus proposal.",      constraints: { min: 0.80, max: 1.00 } },
        assemblySeatCount:              { value: 99,     immutable: false, description: "Number of members drawn by sortition to form the assembly for a given term.", constraints: { min: 9, max: 999 } },
        assemblyTermMonths:             { value: 12,     immutable: false, description: "Duration of an assembly term in months.",                                  constraints: { min: 1, max: 24 } },
        assemblyTermStartMonth:         { value: 6,      immutable: false, description: "Calendar month (1–12) on which a new assembly term begins each cycle.",   constraints: { min: 1, max: 12 } },
        assemblyTermStartDay:           { value: 2,      immutable: false, description: "Day of the month on which a new assembly term begins each cycle.",        constraints: { min: 1, max: 31 } },
        deliberationPeriodDays:         { value: 3,      immutable: false, description: "Minimum days before a proposal vote can close.",                          constraints: { min: 1, max: 30 } },
        bankDemurrageRate:              { value: 0.02,   immutable: false, description: "Monthly rate at which the Central Bank applies demurrage.",               constraints: { min: 0, max: 0.10 } },
        demurrageFloor:                 { value: 1_000,  immutable: false, description: "Balance floor below which no demurrage is charged.",                      constraints: { min: 0, max: 5_000 } },
        communityDuesRate:              { value: 0.01,   immutable: false, description: "Monthly rate collected from every member's primary account as community dues.", constraints: { min: 0, max: 0.10 } },
        workingAgeMin:                  { value: 16,     immutable: false, description: "Minimum age counted in the working-age population.",                      constraints: { min: 14, max: 21 } },
        retirementAge:                  { value: 65,     immutable: false, description: "Age at which a member becomes eligible for monthly retirement payments.", constraints: { min: 55, max: 75 } },
        retirementPayoutRate:           { value: 500,    immutable: false, description: "Flat kin amount paid to each eligible retiree per month.",                constraints: { min: 0, max: 100_000 } },
        birthdayCirculationFraction:    { value: 0.20,   immutable: false, description: "Fraction of each annual person-year issuance paid to the member's primary account.", constraints: { min: 0, max: 0.5 } },
        endowmentPoolFraction:          { value: 0.80,   immutable: false, description: "Fraction of a new member's join endowment directed into the social insurance pool.", constraints: { min: 0.50, max: 0.95 } },
        memberAdmissionVouchesRequired: { value: 3,      immutable: false, description: "Vouches required to automatically admit a membership applicant.",         constraints: { min: 1, max: 10 } },
        adminThresholdYears:             { value: 3,      immutable: false, description: "Years of continuous membership required to gain admin access.",            constraints: { min: 1, max: 20 } },
    },
    amendments: [],
    // authorityMap removed — authority.define and authority.grant directives
    // on sections II.2–II.7 are now the canonical source of truth.
    // The DocumentReconciler reads those directives and maintains the authorities
    // table and power cache at startup.
};
