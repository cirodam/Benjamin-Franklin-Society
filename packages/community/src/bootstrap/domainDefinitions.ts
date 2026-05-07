/**
 * Static definitions for all standard functional domains.
 *
 * These are pure data — name, description, and a stable ID. The IDs are
 * hard-coded so that existing SQLite records (unitIds, poolId, budgetItems)
 * survive restarts unchanged.
 *
 * Domains with real behaviour (CentralBank, SocialInsuranceBank,
 * CommunityTreasury) are NOT listed here — they remain as their own classes.
 */
export interface DomainDef {
    id:          string;
    name:        string;
    description: string;
}

export const DOMAIN_DEFS: DomainDef[] = [
    {
        id:          "ecf-domain-community-bank-000000004",
        name:        "Community Bank",
        description: "Deposit accounts, transfers, and issuance infrastructure for the community. Governed by an elected treasurer pool.",
    },
    {
        id:          "ecf-domain-food-000000006",
        name:        "Food",
        description: "Coordinates food procurement, storage, preparation, and distribution for the community.",
    },
    {
        id:          "ecf-domain-agriculture-000000007",
        name:        "Agriculture",
        description: "Coordinates land use, cultivation, and seed stewardship for the community.",
    },
    {
        id:          "ecf-domain-healthcare-000000008",
        name:        "Healthcare",
        description: "Coordinates community health services including primary care and dental care.",
    },
    {
        id:          "ecf-domain-housing-000000009",
        name:        "Housing",
        description: "Coordinates community housing allocation, construction, and maintenance.",
    },
    {
        id:          "ecf-domain-energy-000000010",
        name:        "Energy",
        description: "Coordinates community energy production, storage, and distribution including electricity and liquid fuels.",
    },
    {
        id:          "ecf-domain-communications-000000011",
        name:        "Communications",
        description: "Coordinates community information infrastructure including radio broadcast, mesh networking, and postal delivery.",
    },
    {
        id:          "ecf-domain-deathcare-000000012",
        name:        "Deathcare",
        description: "Coordinates community end-of-life services including mortuary care, burial, and grief support.",
    },
    {
        id:          "ecf-domain-sanitation-000000013",
        name:        "Sanitation",
        description: "Coordinates community waste management, sewage treatment, and environmental hygiene.",
    },
    {
        id:          "ecf-domain-water-000000014",
        name:        "Water",
        description: "Coordinates community water supply, treatment, and distribution.",
    },
    {
        id:          "ecf-domain-fire-000000015",
        name:        "Fire",
        description: "Coordinates fire prevention, suppression, and emergency response services.",
    },
    {
        id:          "ecf-domain-childcare-000000016",
        name:        "Childcare",
        description: "Coordinates community child development, early education, and supervised care for children of all ages.",
    },
    {
        id:          "ecf-domain-dependency-care-000000017",
        name:        "Dependency Care",
        description: "Coordinates community care services for elderly, disabled, and chronically ill members requiring ongoing support.",
    },
    {
        id:          "ecf-domain-education-000000018",
        name:        "Education",
        description: "Coordinates community learning from primary schooling through vocational training and lifelong knowledge access.",
    },
    {
        id:          "ecf-domain-enrichment-000000019",
        name:        "Enrichment",
        description: "Coordinates community cultural life, recreational activities, and social events that sustain wellbeing and cohesion.",
    },
    {
        id:          "ecf-domain-transit-000000020",
        name:        "Transit",
        description: "Coordinates community passenger transport and shared vehicle services.",
    },
    {
        id:          "ecf-domain-courier-000000021",
        name:        "Courier",
        description: "Coordinates the movement of packages, goods, and mail items within the community and to neighbouring settlements.",
    },
    {
        id:          "ecf-domain-market-000000022",
        name:        "Market",
        description: "Coordinates community marketplaces for the exchange of goods and services.",
    },
    {
        id:          "ecf-domain-governance-000000023",
        name:        "Governance",
        description: "Administers the community assembly, maintains procedural records, and provides the human infrastructure for democratic self-governance.",
    },
    {
        id:          "ecf-domain-mediation-000000024",
        name:        "Mediation",
        description: "Coordinates community conflict resolution, restorative practice, and peer mediation services.",
    },
];

// Convenience: look up an ID by name without importing the full array.
export const DOMAIN_ID: Record<string, string> = Object.fromEntries(
    DOMAIN_DEFS.map(d => [d.name.toUpperCase().replace(/\s+/g, "_"), d.id]),
);
