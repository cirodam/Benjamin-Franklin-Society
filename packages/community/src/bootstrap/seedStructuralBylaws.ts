/**
 * seedStructuralBylaws.ts
 *
 * Creates the two founding structural bylaws on first boot:
 *   - Domains Bylaw  (id: "ecf-bylaw-domains")
 *   - Leader Pools Bylaw  (id: "ecf-bylaw-pools")
 *
 * Each bylaw is a machine-readable governing document. Its sections carry
 * directives that declare desired state. The StructuralReconciler reads them
 * on every boot and brings the DB into alignment.
 *
 * The documents are read-only here so they cannot be deleted via the normal
 * document API — they are foundational. Amendments happen through motions that
 * add sections or modify existing ones.
 */

import { type GoverningDocument, type DocumentArticle } from "@ecf/core";
import { DocumentLoader } from "../governance/DocumentLoader.js";

const DOMAINS_BYLAW_ID = "ecf-bylaw-domains";
const POOLS_BYLAW_ID   = "ecf-bylaw-pools";

export function seedStructuralBylaws(): void {
    const loader = new DocumentLoader();

    if (!loader.load(DOMAINS_BYLAW_ID)) seedDomainsBylaw(loader);
    if (!loader.load(POOLS_BYLAW_ID))   seedPoolsBylaw(loader);
}

// ── Domains Bylaw ─────────────────────────────────────────────────────────────

function seedDomainsBylaw(loader: DocumentLoader): void {
    const now = new Date().toISOString();

    const domainArticle: DocumentArticle = {
        number:   "I",
        title:    "Standard Functional Domains",
        preamble: "The community shall maintain the following functional domains. Each domain coordinates a distinct area of collective life. Domains may be added, renamed, or dissolved by the assembly through the normal amendment process.",
        sections: [
            {
                id: "I.1", title: "Community Bank",
                body: "The community shall maintain a Community Bank domain to provide deposit accounts, transfers, and issuance infrastructure for the community, governed by an elected treasurer pool.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-community-bank-000000004"] }],
            },
            {
                id: "I.2", title: "Food",
                body: "The community shall maintain a Food domain to coordinate food procurement, storage, preparation, and distribution for the community.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-food-000000006"] }],
            },
            {
                id: "I.3", title: "Agriculture",
                body: "The community shall maintain an Agriculture domain to coordinate land use, cultivation, and seed stewardship for the community.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-agriculture-000000007"] }],
            },
            {
                id: "I.4", title: "Healthcare",
                body: "The community shall maintain a Healthcare domain to coordinate community health services including primary care and dental care.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-healthcare-000000008"] }],
            },
            {
                id: "I.5", title: "Housing",
                body: "The community shall maintain a Housing domain to coordinate community housing allocation, construction, and maintenance.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-housing-000000009"] }],
            },
            {
                id: "I.6", title: "Energy",
                body: "The community shall maintain an Energy domain to coordinate community energy production, storage, and distribution including electricity and liquid fuels.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-energy-000000010"] }],
            },
            {
                id: "I.7", title: "Communications",
                body: "The community shall maintain a Communications domain to coordinate community information infrastructure including radio broadcast, mesh networking, and postal delivery.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-communications-000000011"] }],
            },
            {
                id: "I.8", title: "Deathcare",
                body: "The community shall maintain a Deathcare domain to coordinate community end-of-life services including mortuary care, burial, and grief support.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-deathcare-000000012"] }],
            },
            {
                id: "I.9", title: "Sanitation",
                body: "The community shall maintain a Sanitation domain to coordinate community waste management, sewage treatment, and environmental hygiene.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-sanitation-000000013"] }],
            },
            {
                id: "I.10", title: "Water",
                body: "The community shall maintain a Water domain to coordinate community water supply, treatment, and distribution.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-water-000000014"] }],
            },
            {
                id: "I.11", title: "Fire",
                body: "The community shall maintain a Fire domain to coordinate fire prevention, suppression, and emergency response services.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-fire-000000015"] }],
            },
            {
                id: "I.12", title: "Childcare",
                body: "The community shall maintain a Childcare domain to coordinate community child development, early education, and supervised care for children of all ages.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-childcare-000000016"] }],
            },
            {
                id: "I.13", title: "Dependency Care",
                body: "The community shall maintain a Dependency Care domain to coordinate community care services for elderly, disabled, and chronically ill members requiring ongoing support.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-dependency-care-000000017"] }],
            },
            {
                id: "I.14", title: "Education",
                body: "The community shall maintain an Education domain to coordinate community learning from primary schooling through vocational training and lifelong knowledge access.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-education-000000018"] }],
            },
            {
                id: "I.15", title: "Enrichment",
                body: "The community shall maintain an Enrichment domain to coordinate community cultural life, recreational activities, and social events that sustain wellbeing and cohesion.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-enrichment-000000019"] }],
            },
            {
                id: "I.16", title: "Transit",
                body: "The community shall maintain a Transit domain to coordinate community passenger transport and shared vehicle services.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-transit-000000020"] }],
            },
            {
                id: "I.17", title: "Courier",
                body: "The community shall maintain a Courier domain to coordinate the movement of packages, goods, and mail items within the community and to neighbouring settlements.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-courier-000000021"] }],
            },
            {
                id: "I.18", title: "Market",
                body: "The community shall maintain a Market domain to coordinate community marketplaces for the exchange of goods and services.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-market-000000022"] }],
            },
            {
                id: "I.19", title: "Governance",
                body: "The community shall maintain a Governance domain to administer the community assembly, maintain procedural records, and provide the human infrastructure for democratic self-governance.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-governance-000000023"] }],
            },
            {
                id: "I.20", title: "Mediation",
                body: "The community shall maintain a Mediation domain to coordinate community conflict resolution, restorative practice, and peer mediation services.",
                directives: [{ verb: "domain.define", args: ["ecf-domain-mediation-000000024"] }],
            },
        ],
    };

    const unitsArticle: DocumentArticle = {
        number:   "II",
        title:    "Initial Functional Units",
        preamble: "The following functional units shall be established within their respective domains at the time of the community's founding. Additional units may be deployed by governance motion at any time.",
        sections: [
            // Community Bank
            {
                id: "II.1", title: "Main Branch",
                body: "The primary branch of the community bank, providing day-to-day banking services to members.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-community-bank-000000004", "branch"] }],
            },
            // Food
            {
                id: "II.2", title: "Food Supply Office",
                body: "Central office coordinating food procurement, storage, and distribution for the community.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-food-000000006", "food-supply-office"] }],
            },
            {
                id: "II.3", title: "Community Kitchen",
                body: "Shared kitchen space for food preparation and cooking. Handles raw ingredient processing, meal preparation, and food preservation for the community.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-food-000000006", "community-kitchen"] }],
            },
            // Agriculture
            {
                id: "II.4", title: "Farm Coordination Office",
                body: "Coordinates land allocation, planting schedules, shared equipment, and harvest logistics across community farms and individual growers.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-agriculture-000000007", "farm-coordination-office"] }],
            },
            // Healthcare
            {
                id: "II.5", title: "Medical Supply Office",
                body: "Manages procurement, storage, and distribution of medicines and medical supplies for the community.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-healthcare-000000008", "medical-supply-office"] }],
            },
            {
                id: "II.6", title: "Primary Care Clinic",
                body: "General medical care, preventive health, chronic disease management, and triage for the community.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-healthcare-000000008", "primary-care-clinic"] }],
            },
            // Energy
            {
                id: "II.7", title: "Liquid Fuels Office",
                body: "Manages production or procurement, storage, and rationing of liquid fuels including biodiesel and petrol.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-energy-000000010", "liquid-fuel-office"] }],
            },
            // Dependency Care
            {
                id: "II.8", title: "Community Outreach Team",
                body: "Identifies at-risk, isolated, or vulnerable community members — including elderly, disabled, and food-insecure individuals — and coordinates delivery of food, medicine, and care services to them.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-dependency-care-000000017", "community-outreach-team"] }],
            },
            // Market
            {
                id: "II.9", title: "Market Coordination Office",
                body: "Administers physical marketplaces: coordinates scheduling, vendor relations, and fair-exchange policies across all community market sites.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-market-000000022", "market-coordination-office"] }],
            },
            // Governance
            {
                id: "II.10", title: "Assembly",
                body: "The seated community assembly drawn by sortition each term. Deliberates on motions, records outcomes, and upholds procedural rules.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-governance-000000023", "assembly"] }],
            },
            // Mediation
            {
                id: "II.11", title: "Mediation Panel",
                body: "A small panel of trained community mediators who facilitate structured conversations between parties in conflict. Mediators hold space for mutual understanding — they do not rule or impose outcomes.",
                directives: [{ verb: "domain.unit", args: ["ecf-domain-mediation-000000024", "mediation-panel"] }],
            },
        ],
    };

    const doc: GoverningDocument = {
        id:          DOMAINS_BYLAW_ID,
        type:        "bylaw",
        title:       "Bylaw on Functional Domains",
        preamble:    "This bylaw establishes the functional domains of the community and their initial operational units. It is the authoritative machine-readable declaration of which domains shall exist and what units they shall contain. The software reads this document to determine desired state and reconciles the operational database accordingly.",
        articles:    [domainArticle, unitsArticle],
        adoptedAt:   now,
        version:     1,
        authorityId: "assembly",
        voteRuleId:  "simple-majority",
        domainId:    null,
        readonly:    false,
    };

    loader.save(doc);
}

// ── Leader Pools Bylaw ────────────────────────────────────────────────────────

function seedPoolsBylaw(loader: DocumentLoader): void {
    const now = new Date().toISOString();

    const poolsArticle: DocumentArticle = {
        number:   "I",
        title:    "Leader Pools",
        preamble: "The following leader pools are established to govern the functional domains of the community. Each pool is a named body of members with shared expertise or responsibilities. Pools govern their domains by majority vote unless otherwise specified.",
        sections: [
            {
                id: "I.1", title: "Farmers",
                body: "Members who work in food production and agriculture.",
                rationale: "Govern decisions related to farming, food sovereignty, crop planning, land stewardship, and the agriculture and food domains.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-farmers", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-farmers", "ecf-domain-food-000000006"] },
                    { verb: "pool.governs",  args: ["ecf-pool-farmers", "ecf-domain-agriculture-000000007"] },
                ],
            },
            {
                id: "I.2", title: "Medics",
                body: "Healthcare workers including doctors, nurses, paramedics, and support staff.",
                rationale: "Govern decisions related to community health, medical services, preventive care, and the healthcare domain.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-medics", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-medics", "ecf-domain-healthcare-000000008"] },
                ],
            },
            {
                id: "I.3", title: "Teachers",
                body: "Educators and enrichment workers at all levels.",
                rationale: "Govern decisions related to schooling, skills training, cultural programming, and the education and enrichment domains.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-teachers", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-teachers", "ecf-domain-education-000000018"] },
                    { verb: "pool.governs",  args: ["ecf-pool-teachers", "ecf-domain-enrichment-000000019"] },
                ],
            },
            {
                id: "I.4", title: "Builders",
                body: "Construction, housing, and maintenance workers.",
                rationale: "Govern decisions related to housing, infrastructure construction and repair, and the housing domain.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-builders", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-builders", "ecf-domain-housing-000000009"] },
                ],
            },
            {
                id: "I.5", title: "Firefighters",
                body: "Fire safety and emergency response workers.",
                rationale: "Govern decisions related to emergency preparedness, fire prevention, disaster response, and the fire domain.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-firefighters", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-firefighters", "ecf-domain-fire-000000015"] },
                ],
            },
            {
                id: "I.6", title: "Line Workers",
                body: "Energy, utilities, and infrastructure operators.",
                rationale: "Govern decisions related to power generation, water systems, sanitation, communications, and those respective domains.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-line-workers", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-line-workers", "ecf-domain-energy-000000010"] },
                    { verb: "pool.governs",  args: ["ecf-pool-line-workers", "ecf-domain-water-000000014"] },
                    { verb: "pool.governs",  args: ["ecf-pool-line-workers", "ecf-domain-sanitation-000000013"] },
                    { verb: "pool.governs",  args: ["ecf-pool-line-workers", "ecf-domain-communications-000000011"] },
                ],
            },
            {
                id: "I.7", title: "Caregivers",
                body: "Childcare and dependency care workers.",
                rationale: "Govern decisions related to childcare, eldercare, disability support, and the childcare and dependency care domains.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-caregivers", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-caregivers", "ecf-domain-childcare-000000016"] },
                    { verb: "pool.governs",  args: ["ecf-pool-caregivers", "ecf-domain-dependency-care-000000017"] },
                ],
            },
            {
                id: "I.8", title: "Couriers",
                body: "Transit and delivery workers.",
                rationale: "Govern decisions related to transportation, goods delivery, route planning, and the transit and courier domains.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-couriers", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-couriers", "ecf-domain-transit-000000020"] },
                    { verb: "pool.governs",  args: ["ecf-pool-couriers", "ecf-domain-courier-000000021"] },
                ],
            },
            {
                id: "I.9", title: "Mediators",
                body: "Community mediators and restorative practice facilitators.",
                rationale: "Govern decisions related to conflict resolution processes, restorative practice standards, and the mediation domain.",
                directives: [
                    { verb: "pool.define",   args: ["ecf-pool-mediators", "simple-majority"] },
                    { verb: "pool.governs",  args: ["ecf-pool-mediators", "ecf-domain-mediation-000000024"] },
                ],
            },
        ],
    };

    const doc: GoverningDocument = {
        id:          POOLS_BYLAW_ID,
        type:        "bylaw",
        title:       "Bylaw on Leader Pools",
        preamble:    "This bylaw establishes the leader pools of the community and their governing relationships to functional domains. Leader pools are bodies of members who, by virtue of their work and expertise, govern the domains most relevant to their labour. This document is the authoritative machine-readable declaration of which pools shall exist and which domains they govern.",
        articles:    [poolsArticle],
        adoptedAt:   now,
        version:     1,
        authorityId: "assembly",
        voteRuleId:  "simple-majority",
        domainId:    null,
        readonly:    false,
    };

    loader.save(doc);
}
