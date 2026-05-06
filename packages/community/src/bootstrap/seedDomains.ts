import logger from "../logger.js";
import { DomainService } from "../DomainService.js";
import { FunctionalUnit } from "../common/domain/FunctionalUnit.js";
import { RoleType } from "../common/RoleType.js";
import { DEFAULT_ROLE_TYPES } from "../common/defaultRoleTypes.js";
import { CentralBank } from "../domains/central_bank/CentralBank.js";
import { SocialInsuranceBank } from "../domains/social_insurance/SocialInsuranceBank.js";
import { CommunityTreasury } from "../domains/community_treasury/CommunityTreasury.js";
import { CommunityBankDomain } from "../domains/community_bank/CommunityBankDomain.js";
import { FoodDomain } from "../domains/food/FoodDomain.js";
import { FoodUnitTemplates } from "../domains/food/FoodUnitTemplates.js";
import { AgricultureDomain } from "../domains/agriculture/AgricultureDomain.js";
import { AgricultureUnitTemplates } from "../domains/agriculture/AgricultureUnitTemplates.js";
import { HealthcareDomain } from "../domains/healthcare/HealthcareDomain.js";
import { HealthcareUnitTemplates } from "../domains/healthcare/HealthcareUnitTemplates.js";
import { HousingDomain } from "../domains/housing/HousingDomain.js";
import { HousingUnitTemplates } from "../domains/housing/HousingUnitTemplates.js";
import { EnergyDomain } from "../domains/energy/EnergyDomain.js";
import { EnergyUnitTemplates } from "../domains/energy/EnergyUnitTemplates.js";
import { CommunicationsDomain } from "../domains/communications/CommunicationsDomain.js";
import { CommunicationsUnitTemplates } from "../domains/communications/CommunicationsUnitTemplates.js";
import { DeathcareDomain } from "../domains/deathcare/DeathcareDomain.js";
import { DeathcareUnitTemplates } from "../domains/deathcare/DeathcareUnitTemplates.js";
import { SanitationDomain } from "../domains/sanitation/SanitationDomain.js";
import { SanitationUnitTemplates } from "../domains/sanitation/SanitationUnitTemplates.js";
import { WaterDomain } from "../domains/water/WaterDomain.js";
import { WaterUnitTemplates } from "../domains/water/WaterUnitTemplates.js";
import { FireDomain } from "../domains/fire/FireDomain.js";
import { FireUnitTemplates } from "../domains/fire/FireUnitTemplates.js";
import { ChildcareDomain } from "../domains/childcare/ChildcareDomain.js";
import { ChildcareUnitTemplates } from "../domains/childcare/ChildcareUnitTemplates.js";
import { DependencyCareDomain } from "../domains/dependency_care/DependencyCareDomain.js";
import { DependencyCareUnitTemplates } from "../domains/dependency_care/DependencyCareUnitTemplates.js";
import { EducationDomain } from "../domains/education/EducationDomain.js";
import { EducationUnitTemplates } from "../domains/education/EducationUnitTemplates.js";
import { EnrichmentDomain } from "../domains/enrichment/EnrichmentDomain.js";
import { EnrichmentUnitTemplates } from "../domains/enrichment/EnrichmentUnitTemplates.js";
import { TransitDomain } from "../domains/transit/TransitDomain.js";
import { TransitUnitTemplates } from "../domains/transit/TransitUnitTemplates.js";
import { CourierDomain } from "../domains/courier/CourierDomain.js";
import { CourierUnitTemplates } from "../domains/courier/CourierUnitTemplates.js";
import { MarketDomain } from "../domains/market/MarketDomain.js";
import { MarketUnitTemplates } from "../domains/market/MarketUnitTemplates.js";
import { GovernanceDomain } from "../domains/governance/GovernanceDomain.js";
import { GovernanceUnitTemplates } from "../domains/governance/GovernanceUnitTemplates.js";
import { MediationDomain } from "../domains/mediation/MediationDomain.js";
import { MediationUnitTemplates } from "../domains/mediation/MediationUnitTemplates.js";
import { CommunityRole } from "../common/CommunityRole.js";
import { LeaderPool } from "@ecf/core";

/**
 * Seed role types and register all functional domains + unit templates on first boot.
 * Called once during startup, after DomainService.init() and initRoleTypes().
 */
export function seedDomains(domainSvc: DomainService): void {
    // Upsert default role types on every boot so that new fields (responsibilities,
    // qualifications, category, etc.) are backfilled into existing records.
    const existingByTitle = new Map(domainSvc.getRoleTypes().map(rt => [rt.title, rt]));
    let seeded = 0;
    for (const def of DEFAULT_ROLE_TYPES) {
        const existing = existingByTitle.get(def.title);
        if (!existing) {
            domainSvc.createRoleType(new RoleType(
                def.title, def.description, def.defaultKinPerMonth, undefined,
                def.preferredUnitTypes ?? [], def.category ?? "",
                def.responsibilities ?? [], def.qualifications ?? [],
            ));
            seeded++;
        } else {
            // Backfill any fields that are missing or empty on the persisted record
            let dirty = false;
            if (!existing.category && def.category)                         { existing.category        = def.category;        dirty = true; }
            if (!existing.responsibilities?.length && def.responsibilities) { existing.responsibilities = def.responsibilities; dirty = true; }
            if (!existing.qualifications?.length  && def.qualifications)    { existing.qualifications   = def.qualifications;  dirty = true; }
            if (!existing.preferredUnitTypes?.length && def.preferredUnitTypes?.length) { existing.preferredUnitTypes = def.preferredUnitTypes; dirty = true; }
            if (dirty) { domainSvc.saveRoleType(existing); seeded++; }
        }
    }
    if (seeded > 0) logger.info(`[community] upserted ${seeded} default role type(s)`);

    // Register the four monetary/financial domains so they participate in
    // governance — they get leader pools, roles, and appear in the domain API.
    // Monetary init (async bank connection) happens separately below.
    domainSvc.registerDomain(CentralBank.getInstance());
    if (CentralBank.getInstance().unitIds.length === 0) {
        domainSvc.createUnit(
            new FunctionalUnit("Central Bank Office", "The central administrative office of the central bank.", "office"),
            CentralBank.getInstance().id,
        );
    }

    domainSvc.registerDomain(SocialInsuranceBank.getInstance());
    if (SocialInsuranceBank.getInstance().unitIds.length === 0) {
        domainSvc.createUnit(
            new FunctionalUnit("Retirement Office", "The central administrative office of the community retirement fund.", "office"),
            SocialInsuranceBank.getInstance().id,
        );
    }

    domainSvc.registerDomain(CommunityTreasury.getInstance());
    if (CommunityTreasury.getInstance().unitIds.length === 0) {
        const treasuryOffice = new FunctionalUnit("Treasury Office", "Administrative office responsible for tracking community income and expenditure, reconciling accounts, and preparing financial reports for stewards.", "treasury-office");
        domainSvc.createUnit(treasuryOffice, CommunityTreasury.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Treasurer", "Manages the community treasury: tracks income and expenditure, reconciles accounts, prepares financial reports for stewards, and ensures funds are allocated in line with governance decisions.", 4_583),
            treasuryOffice.id,
        );
    }

    domainSvc.registerDomain(CommunityBankDomain.getInstance());
    if (CommunityBankDomain.getInstance().unitIds.length === 0) {
        const mainBranch = new FunctionalUnit("Main Branch", "The primary branch of the community bank.", "branch");
        domainSvc.createUnit(mainBranch, CommunityBankDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Teller", "Assists community members with deposits, withdrawals, account inquiries, and day-to-day banking transactions at the branch.", 2_500),
            mainBranch.id,
        );
    }
    domainSvc.registerDomain(FoodDomain.getInstance());
    if (FoodDomain.getInstance().unitIds.length === 0) {
        const foodSupplyUnit = new FunctionalUnit("Food Supply Office", "Central office coordinating food procurement, storage, and distribution for the community.", "food-supply-office");
        domainSvc.createUnit(foodSupplyUnit, FoodDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Food Supply Officer", "Coordinates food procurement, storage, and distribution across the community; manages inventory and supply chain logistics.", 3_750),
            foodSupplyUnit.id,
        );
        const kitchenUnit = new FunctionalUnit("Community Kitchen", "Shared kitchen space for food preparation and cooking. Handles raw ingredient processing, meal preparation, and food preservation for the community.", "community-kitchen");
        domainSvc.createUnit(kitchenUnit, FoodDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Community Kitchen Director", "Oversees day-to-day operations of the community kitchen: meal planning, food safety, staff coordination, and inventory of perishables.", 3_333),
            kitchenUnit.id,
        );
        for (let i = 0; i < 4; i++) {
            domainSvc.createRole(
                new CommunityRole("Cook", "Prepares and serves community meals.", 2_917),
                kitchenUnit.id,
            );
        }
    }
    domainSvc.registerDomain(AgricultureDomain.getInstance());
    if (AgricultureDomain.getInstance().unitIds.length === 0) {
        const farmCoordUnit = new FunctionalUnit("Farm Coordination Office", "Coordinates land allocation, planting schedules, shared equipment, and harvest logistics across community farms and individual growers.", "farm-coordination-office");
        domainSvc.createUnit(farmCoordUnit, AgricultureDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Farm Coordinator", "Coordinates land allocation, planting schedules, shared equipment, and harvest logistics across community farms and individual growers.", 3_750),
            farmCoordUnit.id,
        );
    }
    domainSvc.registerDomain(HealthcareDomain.getInstance());
    if (HealthcareDomain.getInstance().unitIds.length === 0) {
        const medSupplyUnit = new FunctionalUnit("Medical Supply Office", "Manages procurement, storage, and distribution of medicines and medical supplies for the community.", "medical-supply-office");
        domainSvc.createUnit(medSupplyUnit, HealthcareDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Medical Supply Officer", "Oversees procurement, inventory, and distribution of medical supplies.", 3_750),
            medSupplyUnit.id,
        );
        const clinicUnit = new FunctionalUnit("Primary Care Clinic", "General medical care, preventive health, chronic disease management, and triage for the community.", "primary-care-clinic");
        domainSvc.createUnit(clinicUnit, HealthcareDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Doctor", "Diagnoses and treats illness and injury.", 8_333),
            clinicUnit.id,
        );
        for (let i = 0; i < 2; i++) {
            domainSvc.createRole(
                new CommunityRole("Community Health Worker", "Trained lay health worker who provides health education, triage support, chronic disease monitoring, and connection to care — the front line of community health.", 3_333),
                clinicUnit.id,
            );
        }
    }
    domainSvc.registerDomain(HousingDomain.getInstance());
    domainSvc.registerDomain(EnergyDomain.getInstance());
    if (EnergyDomain.getInstance().unitIds.length === 0) {
        const liquidFuelUnit = new FunctionalUnit("Liquid Fuels Office", "Manages production or procurement, storage, and rationing of liquid fuels including biodiesel and petrol.", "liquid-fuel-office");
        domainSvc.createUnit(liquidFuelUnit, EnergyDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Liquid Fuel Officer", "Manages procurement, storage, safety compliance, and rationed distribution of liquid fuels including biodiesel and petrol.", 3_750),
            liquidFuelUnit.id,
        );
    }
    domainSvc.registerDomain(CommunicationsDomain.getInstance());
    domainSvc.registerDomain(DeathcareDomain.getInstance());
    domainSvc.registerDomain(SanitationDomain.getInstance());
    domainSvc.registerDomain(WaterDomain.getInstance());
    domainSvc.registerDomain(FireDomain.getInstance());
    domainSvc.registerDomain(ChildcareDomain.getInstance());
    domainSvc.registerDomain(DependencyCareDomain.getInstance());
    if (DependencyCareDomain.getInstance().unitIds.length === 0) {
        domainSvc.createUnit(
            new FunctionalUnit("Community Outreach Team", "Identifies at-risk, isolated, or vulnerable community members — including elderly, disabled, and food-insecure individuals — and coordinates delivery of food, medicine, and care services to them.", "community-outreach-team"),
            DependencyCareDomain.getInstance().id,
        );
    }
    domainSvc.registerDomain(EducationDomain.getInstance());
    domainSvc.registerDomain(EnrichmentDomain.getInstance());
    domainSvc.registerDomain(TransitDomain.getInstance());
    domainSvc.registerDomain(CourierDomain.getInstance());
    domainSvc.registerDomain(MarketDomain.getInstance());
    if (MarketDomain.getInstance().unitIds.length === 0) {
        const coordOffice = new FunctionalUnit(
            "Market Coordination Office",
            "Administers physical marketplaces: coordinates scheduling, vendor relations, and fair-exchange policies across all community market sites.",
            "market-coordination-office",
        );
        domainSvc.createUnit(coordOffice, MarketDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Marketplace Coordinator", "Manages day-to-day operations of a physical marketplace: opens and closes the site, mediates disputes, tracks vendor slots, and ensures fair exchange practices.", 3_000),
            coordOffice.id,
        );
    }

    domainSvc.registerDomain(MediationDomain.getInstance());
    if (MediationDomain.getInstance().unitIds.length === 0) {
        const mediationPanel = new FunctionalUnit(
            "Mediation Panel",
            "A small panel of trained community mediators who facilitate structured conversations between parties in conflict. Mediators hold space for mutual understanding — they do not rule or impose outcomes.",
            "mediation-panel",
        );
        domainSvc.createUnit(mediationPanel, MediationDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole("Mediator", "Facilitates structured, confidential dialogue between parties in conflict. Does not impose outcomes. Trained in active listening, de-escalation, and restorative practice.", 3_000),
            mediationPanel.id,
        );
    }

    domainSvc.registerDomain(GovernanceDomain.getInstance());
    if (GovernanceDomain.getInstance().unitIds.length === 0) {
        const assemblyUnit = new FunctionalUnit(
            "Assembly",
            "The seated community assembly drawn by sortition each term. Deliberates on motions, records outcomes, and upholds procedural rules.",
            "assembly",
        );
        domainSvc.createUnit(assemblyUnit, GovernanceDomain.getInstance().id);
        domainSvc.createRole(
            new CommunityRole(
                "Clerk",
                "Records the proceedings and outcomes of every assembly session. Maintains the official minutes, files motions into the record, and certifies the results of votes. The institutional memory of the assembly.",
                2_500,
            ),
            assemblyUnit.id,
        );
        domainSvc.createRole(
            new CommunityRole(
                "Parliamentarian",
                "Advises the assembly on points of order, interprets the constitution and bylaws when disputes arise, and ensures proceedings follow agreed procedure. Does not vote — rules on process only.",
                2_500,
            ),
            assemblyUnit.id,
        );
    }

    // Register all unit templates so POST /api/units can instantiate them by type.
    FoodUnitTemplates.register();
    AgricultureUnitTemplates.register();
    HealthcareUnitTemplates.register();
    HousingUnitTemplates.register();
    EnergyUnitTemplates.register();
    CommunicationsUnitTemplates.register();
    DeathcareUnitTemplates.register();
    SanitationUnitTemplates.register();
    WaterUnitTemplates.register();
    FireUnitTemplates.register();
    ChildcareUnitTemplates.register();
    DependencyCareUnitTemplates.register();
    EducationUnitTemplates.register();
    EnrichmentUnitTemplates.register();
    TransitUnitTemplates.register();
    CourierUnitTemplates.register();
    MarketUnitTemplates.register();
    MediationUnitTemplates.register();
    GovernanceUnitTemplates.register();

    // Seed default leader pools on first boot.
    if (domainSvc.getPools().length === 0) {
        const defaultPools: [string, string, string][] = [
            ["Farmers",     "Members who work in food production and agriculture.",
             "Govern decisions related to farming, food sovereignty, crop planning, land stewardship, and the agriculture and food domains."],
            ["Medics",      "Healthcare workers including doctors, nurses, paramedics, and support staff.",
             "Govern decisions related to community health, medical services, preventive care, and the healthcare domain."],
            ["Teachers",    "Educators and enrichment workers at all levels.",
             "Govern decisions related to schooling, skills training, cultural programming, and the education and enrichment domains."],
            ["Builders",    "Construction, housing, and maintenance workers.",
             "Govern decisions related to housing, infrastructure construction and repair, and the housing domain."],
            ["Firefighters","Fire safety and emergency response workers.",
             "Govern decisions related to emergency preparedness, fire prevention, disaster response, and the fire domain."],
            ["Line Workers","Energy, utilities, and infrastructure operators.",
             "Govern decisions related to power generation, water systems, sanitation, communications, and those respective domains."],
            ["Caregivers",  "Childcare and dependency care workers.",
             "Govern decisions related to childcare, eldercare, disability support, and the childcare and dependency care domains."],
            ["Couriers",    "Transit and delivery workers.",
             "Govern decisions related to transportation, goods delivery, route planning, and the transit and courier domains."],
            ["Mediators",   "Community mediators and restorative practice facilitators.",
             "Govern decisions related to conflict resolution processes, restorative practice standards, and the mediation domain."],
        ];
        for (const [name, description, mandate] of defaultPools) {
            const pool = new LeaderPool(undefined, name, "simple-majority", description);
            pool.mandate = mandate;
            domainSvc.createPool(pool);
        }
        logger.info(`[community] seeded ${defaultPools.length} default leader pools`);
    }
}
