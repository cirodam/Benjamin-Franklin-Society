import { type DocumentArticle } from "@ecf/core";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GovernanceBody = "council" | "assembly" | "referendum";

export enum VoteThreshold {
    SIMPLE_MAJORITY = "SIMPLE_MAJORITY",
    SUPERMAJORITY   = "SUPERMAJORITY",
    NEAR_CONSENSUS  = "NEAR_CONSENSUS",
}

export interface ActionAuthority {
    readonly action:      string;
    readonly body:        GovernanceBody;
    readonly description: string;
    /** The vote rule that must be applied to motions of this action type.
     *  Must be a key from the VOTE_RULES registry in @ecf/core. */
    readonly voteRuleId:  string;
}

export interface ConstitutionalParameter<T extends number | boolean> {
    readonly value:        T;
    /** true = unit definition or fundamental guarantee; cannot be amended by any vote. */
    readonly immutable:    boolean;
    readonly description:  string;
    readonly constraints?: { min?: number; max?: number };
}

export interface ConstitutionAmendment {
    readonly version:    number;
    readonly parameter:  string;
    readonly oldValue:   number | boolean;
    readonly newValue:   number | boolean;
    readonly proposalId: string;
    readonly amendedAt:  string; // ISO 8601
}

/** Constitution-specific metadata: parameters, voting authority map, community identity. */
export interface ConstitutionMetadata {
    documentId:      string;
    version:         number;
    communityName:   string;
    /** URL-safe handle used to identify this community within a federation. */
    communityHandle: string;
    parameters:      Record<string, ConstitutionalParameter<number | boolean>>;
    amendments:      ConstitutionAmendment[];
    authorityMap:    ActionAuthority[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_CONSTITUTION_META: Omit<ConstitutionMetadata, "documentId"> = {
    version:       1,
    communityName:   "My Community",
    communityHandle: "",
    parameters: {

        // ── Axioms — unit definitions, never changeable ──────────────────────
        kinPerPersonYear: {
            value: 10_000,
            immutable: true,
            description:
                "Kin issued per person-year of presence. This is a unit definition — 1 kin = 1/10,000 person-year — not a policy choice. All human years are valued equally.",
        },

        // ── Fundamental guarantees ───────────────────────────────────────────
        universalFloorGuaranteed: {
            value: true,
            immutable: true,
            description: "Every member receives basic needs support unconditionally.",
        },
        membershipUnconditional: {
            value: true,
            immutable: true,
            description: "Belonging is not contingent on productive capacity.",
        },
        dataPortabilityGuaranteed: {
            value: true,
            immutable: true,
            description: "Members can always take their data and leave.",
        },
        ledgerTransparent: {
            value: true,
            immutable: true,
            description: "All kin flows are visible to all members.",
        },
        democraticMinimumProtected: {
            value: true,
            immutable: true,
            description: "Governance cannot be captured by any individual or group.",
        },
        dueProcessGuaranteed: {
            value: true,
            immutable: true,
            description:
                "No member may have their membership suspended, revoked, or materially restricted without notice, a stated reason, and an opportunity to respond before the decision takes effect.",
        },
        noExPostFacto: {
            value: true,
            immutable: true,
            description:
                "No rule change may be applied retroactively to penalise conduct that was permitted at the time it occurred.",
        },
        rightOfAppeal: {
            value: true,
            immutable: true,
            description:
                "Any member subject to an adverse governance decision has the right to appeal it to an independent body before it takes permanent effect.",
        },

        // ── Vote thresholds ──────────────────────────────────────────────────
        thresholdSimpleMajority: {
            value: 0.51,
            immutable: false,
            description: "Fraction of total members required to pass a simple majority proposal.",
            constraints: { min: 0.51, max: 0.66 },
        },
        thresholdSupermajority: {
            value: 0.67,
            immutable: false,
            description: "Fraction of total members required to pass a supermajority proposal.",
            constraints: { min: 0.60, max: 0.80 },
        },
        thresholdNearConsensus: {
            value: 0.90,
            immutable: false,
            description: "Fraction of total members required to pass a near-consensus proposal.",
            constraints: { min: 0.80, max: 1.00 },
        },

        // ── Governance process ───────────────────────────────────────────────
        assemblySeatCount: {
            value: 99,
            immutable: false,
            description: "Number of members drawn by sortition to form the assembly for a given term.",
            constraints: { min: 9, max: 999 },
        },
        assemblyFraction: {
            value: 0.03,
            immutable: false,
            description: "Fraction of the population that forms the assembly. The seat count is max(9, ceil(population × assemblyFraction)).",
            constraints: { min: 0.01, max: 0.20 },
        },
        assemblyTermMonths: {
            value: 12,
            immutable: false,
            description: "Duration of an assembly term in months.",
            constraints: { min: 1, max: 24 },
        },
        assemblyTermStartMonth: {
            value: 6,
            immutable: false,
            description: "Calendar month (1–12) on which a new assembly term begins each cycle. Combined with assemblyTermStartDay to define the canonical term anchor date.",
            constraints: { min: 1, max: 12 },
        },
        assemblyTermStartDay: {
            value: 2,
            immutable: false,
            description: "Day of the month on which a new assembly term begins each cycle. Combined with assemblyTermStartMonth to define the canonical term anchor date.",
            constraints: { min: 1, max: 31 },
        },
        deliberationPeriodDays: {
            value: 3,
            immutable: false,
            description: "Minimum days before a proposal vote can close.",
            constraints: { min: 1, max: 30 },
        },

        // ── Monetary policy ──────────────────────────────────────────────────
        bankDemurrageRate: {
            value: 0.02,
            immutable: false,
            description:
                "Monthly rate at which the Central Bank applies demurrage to recover unanchored kin.",
            constraints: { min: 0, max: 0.10 },
        },
        demurrageFloor: {
            value: 1_000,
            immutable: false,
            description:
                "Balance floor below which no demurrage is charged. Only the portion of an account balance above this threshold is subject to dues or bank demurrage. Protects small balances from being eroded.",
            constraints: { min: 0, max: 5_000 },
        },

        // ── Community dues ───────────────────────────────────────────────────
        communityDuesRate: {
            value: 0.01,
            immutable: false,
            description:
                "Monthly rate collected from every member's primary account into the community treasury as community dues — kin is not retired, it moves from members to the shared budget. Applied after Central Bank demurrage.",
            constraints: { min: 0, max: 0.10 },
        },

        // ── Social insurance ─────────────────────────────────────────────────
        workingAgeMin: {
            value: 16,
            immutable: false,
            description:
                "Minimum age at which a community member is considered part of the working-age population. Used for demographic reporting and role eligibility.",
            constraints: { min: 14, max: 21 },
        },
        retirementAge: {
            value: 65,
            immutable: false,
            description:
                "Age at which a member becomes eligible for monthly retirement payments from the social insurance pool.",
            constraints: { min: 55, max: 75 },
        },
        retirementPayoutRate: {
            value: 500,
            immutable: false,
            description:
                "Flat kin amount paid to each eligible retiree per month from the social insurance pool. Capped by available pool balance.",
            constraints: { min: 0, max: 100_000 },
        },
        birthdayCirculationFraction: {
            value: 0.20,
            immutable: false,
            description:
                "Fraction of each annual person-year issuance (kinPerPersonYear) paid directly to the member's primary account as circulating kin. The remainder goes to the social insurance retirement pool.",
            constraints: { min: 0, max: 0.5 },
        },
        endowmentPoolFraction: {
            value: 0.80,
            immutable: false,
            description:
                "Fraction of a new member's join endowment (age × kinPerPersonYear) directed into the social insurance retirement pool. The remaining fraction goes to the community treasury.",
            constraints: { min: 0.50, max: 0.95 },
        },

        // ── Membership admission ─────────────────────────────────────────────
        memberAdmissionVouchesRequired: {
            value: 3,
            immutable: false,
            description:
                "Number of existing member vouches required to automatically admit a membership applicant. Once this many distinct members vouch for an application it is admitted without further action.",
            constraints: { min: 1, max: 10 },
        },

        // ── Stewardship ──────────────────────────────────────────────────────
        stewardshipThresholdYears: {
            value: 3,
            immutable: false,
            description:
                "Years of continuous membership after which a person automatically becomes a steward, gaining access to administrative actions (password resets, disabling members, etc.). Stewardship can also be granted explicitly by an existing steward at any time.",
            constraints: { min: 1, max: 20 },
        },
    },
    amendments: [],
    authorityMap: [
        // Membership
        { action: "admit-member",             body: "assembly",   voteRuleId: "petition",                description: "Admitting a new member — requires a petition reaching the signature threshold" },
        { action: "suspend-member",           body: "assembly",   voteRuleId: "simple-majority",         description: "Suspending a member pending review — simple majority of the assembly" },
        { action: "exclude-member",           body: "referendum", voteRuleId: "absolute-supermajority",  description: "Permanently excluding a member — requires 2/3 of all members" },
        // Monetary policy
        { action: "change-dues-rate",         body: "referendum", voteRuleId: "absolute-majority",       description: "Changing the community dues rate — majority of all members" },
        { action: "change-demurrage-rate",    body: "referendum", voteRuleId: "absolute-majority",       description: "Changing the bank demurrage rate — majority of all members" },
        { action: "change-demurrage-floor",   body: "referendum", voteRuleId: "absolute-majority",       description: "Changing the demurrage-free balance floor — majority of all members" },
        // Constitution
        { action: "amend-constitution",       body: "referendum", voteRuleId: "absolute-supermajority",  description: "Amending the constitution — requires 2/3 of all members" },
        // Federation
        { action: "join-federation",          body: "referendum", voteRuleId: "absolute-supermajority",  description: "Joining a federation — requires 2/3 of all members" },
        { action: "leave-federation",         body: "referendum", voteRuleId: "absolute-supermajority",  description: "Leaving a federation — requires 2/3 of all members" },
        // Assembly / council operations
        { action: "split-council",            body: "assembly",   voteRuleId: "supermajority",           description: "Splitting a multi-domain council into two — 2/3 of the assembly" },
        { action: "allocate-domain-budget",   body: "assembly",   voteRuleId: "simple-majority",         description: "Setting budget envelopes for domains — simple majority of the assembly" },
        { action: "declare-domain-emergency", body: "council",    voteRuleId: "simple-majority",         description: "Declaring a domain emergency — council vote; assembly ratifies within 72h" },
        { action: "change-market-schedule",   body: "council",    voteRuleId: "simple-majority",         description: "Changing market day schedule — council vote" },
        { action: "enact-domain-statute",     body: "council",    voteRuleId: "simple-majority",         description: "Enacting an operating rule within a domain — council vote" },
    ],
};

// ── Default Articles ─────────────────────────────────────────────────────────

export const DEFAULT_ARTICLES: DocumentArticle[] = [
    {
        number: "I",
        title: "Founding Principles",
        sections: [
            {
                id: "I.1",
                title: "Why We Are Here",
                body: "Most of us grew up believing that if we worked hard and played by the rules, our basic needs would be met. For a great many people, that has not proven true. Work no longer guarantees security. Housing costs more than families can afford. Healthcare goes without because the price is too high. Neighbors who need help find that the systems meant to provide it are distant, difficult, and insufficient. These are not personal failures — they are shared experiences, felt across communities of every background. We are not the first to notice, and we are not naive about the difficulty of change. But we believe that people who choose to meet their needs together, in full view of one another, can do better than institutions that have forgotten who they were built to serve. This community is that attempt.",
                paramKeys: [],
                rationale: "This section names the problem the community exists to address. It is here so that future members know the founding motivation, and so that any proposal that would move the community away from that purpose is recognizable as a departure from its reason for being.",
            },
            {
                id: "I.2",
                title: "Human Dignity",
                body: "Every person has worth that is not contingent on their productivity, their health, their age, or any other measure of economic usefulness. A person who cannot work has the same claim on a dignified life as anyone else. A community that withholds basic necessities from people who fail to contribute economically has not balanced its books — it has betrayed its purpose. This community holds human dignity as prior to economic participation. No member's standing within it is earned. It is given.",
                paramKeys: [],
                rationale: "Most institutional failures come down to treating people as inputs rather than ends. This section makes explicit that the community rejects that framing — belonging is not conditional on productivity. It is the philosophical foundation for the universal floor guarantee and unconditional membership provisions elsewhere in the constitution.",
            },
            {
                id: "I.3",
                title: "Economy in Service of People",
                body: "An economy is a tool for coordinating how people meet their needs. An economy that denies cancer treatment to keep a claims ratio low, that leaves veterans on the street, that will not feed children despite producing enough food to waste half of it — that economy has not merely developed flaws. It has failed at its only legitimate purpose. The economy of this community exists to meet the needs of its members. That is the measure by which every economic decision here will be judged.",
                paramKeys: [],
                rationale: "This section provides the evaluative criterion for economic decisions: does it meet members' needs? It is here to prevent the community's economic structures from becoming ends in themselves — the ledger must serve people, not the other way around. It is also a check on proposals that optimize for efficiency or growth at the expense of care.",
            },
            {
                id: "I.4",
                title: "Scope",
                body: "This constitution governs the internal affairs of this community. It does not claim authority over any person who has not chosen membership, and it does not override any rights a member holds as a person beyond this community. It is not a complete theory of society — it is an agreement among people who have chosen to meet their needs together.",
                paramKeys: [],
                rationale: "A community constitution can only bind those who have consented to it. This section sets that boundary clearly, to prevent mission creep and to make plain that membership is voluntary. It also protects members: nothing in this document diminishes any right a person holds outside of it.",
            },
        ],
    },
    {
        number: "II",
        title: "Governance",
        sections: [
            {
                id: "II.1",
                title: "The Source of Authority",
                body: "Legitimate authority in this community comes from the whole community, not from the ability to win an election. No person or group holds permanent authority here. Every decision is made by the community, in whole or in part.",
                paramKeys: [],
                rationale: "Elections concentrate authority in those who seek it. This section establishes the alternative: authority flows from the community as a whole and is delegated temporarily, never assigned permanently. It is the constitutional basis for sortition and the rejection of electoral politics within the community.",
            },
            {
                id: "II.2",
                title: "The Assembly",
                body: "The assembly is the highest governing body of this community. It is composed of {assemblySeatCount} members drawn by sortition from the full membership for a fixed term. Any member may be drawn. The assembly sets policy, ratifies significant decisions, and holds all other bodies accountable. When its term ends, a new assembly is drawn.",
                paramKeys: ["assemblySeatCount"],
                rationale: "A randomly drawn assembly represents the community as it actually is, not as those motivated to seek power would have it appear. The size is set large enough to be statistically representative while small enough to deliberate effectively. The fixed term prevents entrenchment.",
            },
            {
                id: "II.3",
                title: "Sortition",
                body: "Leadership roles are filled by random draw from the relevant pool. The person selected serves for a fixed term, then returns to ordinary membership. A cooling-off period follows before they may serve in the same role again. This ensures that authority circulates through the community rather than accumulating in the hands of those who seek it most.",
                paramKeys: [],
                rationale: "Sortition has a long history — Athenian democracy used it for most offices, on the theory that any competent citizen can serve and that elections are an aristocratic method. The cooling-off period prevents quasi-permanent leadership even within a random draw system. The result is that everyone governs and no one governs for long.",
            },
            {
                id: "II.4",
                title: "Leader Pools",
                body: "Any member may join the pool of candidates for a leadership role by declaring their willingness to serve. No campaign, no election, no endorsement is required or permitted. The pool is simply the set of people who have said: I am willing.",
                paramKeys: [],
                rationale: "The pool mechanism preserves one meaningful element of consent: a person must choose to be available for leadership. No one is conscripted. But beyond that declaration, no further qualification, advocacy, or endorsement is permitted — to prevent pool membership from becoming a de facto election.",
            },
        ],
    },
    {
        number: "III",
        title: "Economics",
        sections: [
            {
                id: "III.1",
                title: "The Kin",
                body: "The unit of account for this community is the kin. It is grounded in the most basic thing all members share: the years of their lives. One kin represents one ten-thousandth of a person-year — 10,000 kin to a year.\n\nMost currencies are backed by government decree, by gold, or by debt. The kin is backed by something more direct: the community itself and the lives of the people in it.",
                paramKeys: [],
                rationale: "Anchoring the currency to person-years rather than labor output or commodity prices means the money supply grows with the community itself and values all members equally regardless of what they produce. A retired member, a child, and a surgeon all contribute one person-year per year. The kin makes that equality legible in the ledger.",
            },
            {
                id: "III.2",
                title: "The Banks",
                body: "This community operates two financial institutions. The Community Bank holds member accounts — it is where kin is stored, sent, and received. The Central Bank manages monetary policy — it issues new kin and applies the holding fee. All flows through both institutions are visible to every member. There are no hidden charges and no hidden balances.",
                paramKeys: [],
                rationale: "Separating the retail bank (member accounts) from the central bank (monetary policy) mirrors standard institutional design and keeps the two functions from conflating. Full transparency — every transaction visible to every member — is the accountability mechanism that replaces the audit and regulatory apparatus external currencies rely on.",
            },
            {
                id: "III.3",
                title: "The Holding Fee",
                body: "To discourage hoarding and keep kin moving through the community, the Central Bank applies a monthly holding fee of {bankDemurrageRate} to all account balances above {demurrageFloor} kin. Only the portion above this floor is subject to the fee. Balances at or below {demurrageFloor} kin are never charged.",
                paramKeys: ["bankDemurrageRate", "demurrageFloor"],
                rationale: "Demurrage — a cost for holding currency idle — has a long history in complementary currency design, most notably Silvio Gesell's work and the Wörgl experiment of 1932. It discourages accumulation and encourages circulation, which is what a community currency is for. The floor protects small balances so the fee falls only on surplus, not on people meeting basic needs.",
            },
            {
                id: "III.4",
                title: "Community Dues",
                body: "Each month, {communityDuesRate} of every member's primary balance above {demurrageFloor} kin is transferred to the community treasury as dues. This kin is not destroyed — it funds the shared budget we all depend on.",
                paramKeys: ["communityDuesRate", "demurrageFloor"],
                rationale: "Dues are how the shared budget is funded. Unlike taxes in an external currency, kin dues do not leave the community — they move from member accounts to the treasury, which then spends them back into the community. The floor again protects small balances. The rate is a referendum parameter because the size of the common pool is a fundamental community choice.",
            },
        ],
    },
];

