# ECF Community Domains

A **domain** is a functional area of community operations. Each domain is a persistent institution within the community node — it has a stable ID, appears in governance, can have functional units, roles, leader pools, and a budget. Some domains also own a bank account.

Domains fall into two categories:

- **Required domains** — created on first boot by `seedDomains`. The community cannot function without them. Their IDs are hardcoded constants so they can be referenced from monetary logic, governance, and satellite apps.
- **Optional domains** — also seeded by default for most communities, but their absence would not break core operations.

---

## Required Domains

### 1. Central Bank
**ID:** `ecf-domain-central-bank-0000000001`
**Handle:** `central-bank`
**Bank account:** Yes — handle `"issuance"`, `primary: true`, overdraft limit `-Infinity` (issuance accounts must be able to go negative)
**Purpose:** The sole entity authorized to create and destroy kin. Issues kin on member join (endowment) and anniversaries; retires kin via demurrage and on member discharge. Sets no interest rates and holds no external reserves — it is a population-anchored issuance institution.
**Key invariant:** Total kin in circulation ≈ population × `kinPerPersonYear`.

### 2. Retirement
**ID:** `ecf-domain-retirement-000003`
**Handle:** `retirement`
**Bank account:** Yes — handle `"retirement"`, `primary: true`, no overdraft
**Purpose:** Holds the community's mutual aid reserve. A fraction of every member's join endowment and annual issuance is routed here. The pool pays out to members who fall below a threshold balance (e.g. after illness, disability, or hardship). Governed by the constitution's insurance parameters.

### 3. Community Treasury
**ID:** `ecf-domain-community-treasury-000002`
**Handle:** `treasury`
**Bank account:** Yes — handle `"treasury"`, `primary: true`, no overdraft
**Purpose:** The shared budget for community operations. Funded by a portion of member join endowments (the circulating fraction after insurance allocation). Spending flows through domain budget allocations and governance-approved referenda. Holds the Treasurer role.

### 4. Community Bank
**ID:** `ecf-domain-community-bank-000000004`
**Handle:** `community-bank`
**Bank account:** No (the bank satellite app manages accounts directly)
**Purpose:** The governance and staffing wrapper for the bank satellite app. Holds the Teller role and the bank leadership pool. Provides the domain entry point for bank-related governance motions.

---

## Optional Domains (seeded by default)

These are created on first boot alongside the required domains. They have no mandatory bank accounts.

| Domain | ID |
|---|---|
| Food | `ecf-domain-food-000000006` |
| Agriculture | `ecf-domain-agriculture-000000007` |
| Healthcare | `ecf-domain-healthcare-000000008` |
| Housing | `ecf-domain-housing-000000009` |
| Energy | `ecf-domain-energy-000000010` |
| Communications | `ecf-domain-communications-000000011` |
| Deathcare | `ecf-domain-deathcare-000000012` |
| Sanitation | `ecf-domain-sanitation-000000013` |
| Water | `ecf-domain-water-000000014` |
| Fire | `ecf-domain-fire-000000015` |
| Childcare | `ecf-domain-childcare-000000016` |
| Dependency Care | `ecf-domain-dependency-care-000000017` |
| Education | `ecf-domain-education-000000018` |
| Enrichment | `ecf-domain-enrichment-000000019` |
| Transit | `ecf-domain-transit-000000020` |
| Courier | `ecf-domain-courier-000000021` |
| Market | `ecf-domain-market-000000022` |
| Manufacturing | `ecf-domain-manufacturing-000000023` |

---

## Agriculture Domain

**ID:** `ecf-domain-agriculture-000000007`
**Handle:** `agriculture`
**Purpose:** Governs farm contracts, practice standards, equipment commons, and the community's long-term soil and seed health. Works alongside the Food domain — Agriculture manages production capacity and inputs; Food manages storage, processing, and distribution.

### Functional Units

#### Seed Library

The community's living seed commons. Maintains a diverse, locally-adapted stock of open-pollinated, non-hybrid seed for all crops grown under community farm contracts and member gardens. Seed saving is treated as skilled labor and compensated accordingly.

**Why this is a required functional unit:**

Commercial seed supply is a single point of failure. Hybrid and F1 seeds don't reliably reproduce true — a community dependent on annual commercial seed purchases loses its entire growing capacity if that supply is disrupted. The seed library exists to make the community seed-sovereign: able to plant, harvest, and replant indefinitely from its own stock.

**What the library maintains:**

- Open-pollinated varieties of all staple crops under contract (wheat, corn, dry beans, lentils, etc.)
- Varieties selected for local climate, soil, and pest pressure over successive seasons
- Backup stock of vegetable varieties for member gardens
- Isolation records — which plots were used for seed production, to prevent cross-pollination

**Seed steward responsibilities:**

- Designate seed production plots each season (separate from food production plots, or isolated by distance/timing)
- Harvest and process seed at correct moisture before storage
- Store seed in sealed containers in cool, dark, dry conditions (a root cellar is ideal)
- Test germination rates annually — discard and replace any stock below 80% germination
- Document each variety: origin, years in library, isolation method, germination history, any observed adaptation
- Run seed-saving classes through Atheneum so the knowledge is distributed, not held by one person

**Storage:**

Seed is far more demanding than grain storage — it requires lower moisture (below 8% for most seeds) and lower temperature (40–50°F ideal). Options:
- Root cellar: passive, no electricity, maintains 45–55°F and low humidity year-round in most climates
- Sealed glass jars with silica gel desiccant packs in any cool room
- Freezer storage for long-term backup stock (seeds must be thoroughly dry first or ice crystals destroy viability)

A properly maintained seed library can hold viable stock for 3–10 years depending on species, providing a substantial buffer against a single bad seed crop.

**Relationship to farm contracts:**

Farm contracts should specify whether the farm is responsible for seed saving on designated plots, or whether the seed library supplies seed and the farm returns a seed tithe at harvest (typically 10–20% of the seed crop). The tithe model keeps seed production distributed across farm associations rather than centralizing it.

---

## Manufacturing Domain

**ID:** `ecf-domain-manufacturing-000000023`
**Handle:** `manufacturing`
**Bank account:** Yes — funded by treasury allocation for capital equipment and materials procurement
**Purpose:** Governs the community's productive fabrication capacity. Oversees functional units that build, maintain, and operate equipment the community needs — mills, tools, infrastructure hardware, and other fabricated goods. Manufacturing domain outputs are not market goods in the first instance; they are community infrastructure built to a governance-approved specification.

### Functional Units

Functional units within Manufacturing are workshops organized around a specific capability. Each has a designated steward, an equipment inventory, and a materials budget allocated by the domain.

#### Machine Shop

The primary fabrication unit. Capable of producing precision mechanical components and assembling working machinery from raw or salvaged materials.

**Minimum equipment for a functional machine shop:**
- Metal lathe (manual or CNC) — for turning shafts, bearing seats, rollers, and cylindrical components
- Welder (MIG or stick) — for frames, rotors, and structural assembly
- Angle grinder and cutting tools
- Drill press
- Bench vise and hand tools

**Priority build list (food infrastructure):**

1. **Hammer mill** — fastest to build, highest immediate impact. Rotating shaft with hardened steel hammers striking grain against a mesh screen. Frame welded from mild steel flat bar; rotor turned on the lathe; screen from hardware cloth or perforated sheet. Powers from any motor or tractor PTO. Produces coarse meal immediately, fine meal with finer screen. Build time: 1–2 days for a competent fabricator.

2. **Disc mill** — produces finer, more consistent flour than a hammer mill. Two hardened steel discs (mild steel plate, case-hardened or AR400 abrasion-resistant) with radial grooves dressed with an angle grinder. Gap is adjustable for coarse cracking or fine flour. Drive shaft on pillow block bearings, belt-driven. Build time: 3–5 days including machining.

3. **Roller mill** — most efficient for high-throughput flour production. Two corrugated steel cylinders on parallel shafts, gap-adjustable. Corrugations cut on the lathe. Requires more precision than a disc mill but produces superior flour with less energy. Build time: 1–2 weeks.

**Throughput targets:**
- Hammer mill at 1HP: 200–500 lbs/hour coarse meal
- Disc mill at 1HP: 100–300 lbs/hour flour
- Roller mill at 1–2HP: 300–600 lbs/hour flour

A subdivision of 1,500 people needs roughly 1,500 lbs of flour/day. One electric roller mill running 4–6 hours covers this; a bicycle-powered disc mill backup covers outages.

**Drive options (in priority order for resilience):**
1. Electric motor (normal operations)
2. Bicycle drivetrain via V-belt (manual backup — one person pedaling)
3. Tractor PTO (if farm equipment is accessible)
4. Animal capstan (donkey or horse walking a circular track turning a central shaft — no electricity required, continuous operation)

**Materials the machine shop routinely needs:**
- Mild steel plate and flat bar (structural)
- AR400 or similar abrasion-resistant plate (wear surfaces)
- Pillow block bearings (standard hardware, widely available)
- V-belts and pulleys (salvageable from farm equipment, HVAC units, industrial machinery)
- Welding wire/rod and gas

**Steward responsibilities:**
- Maintain equipment inventory and condition records
- Accept build requests from other domains (Food, Agriculture, Housing, etc.)
- Train additional members in basic machining and welding
- Document all builds with materials lists and assembly notes so machines can be replicated

---

## Treasury Account

The Community Treasury's bank account is the single most important account in the community's monetary system after the central bank issuance account. It is created on first boot with these parameters:

```
owner:    institution ("Community Treasury")
label:    "Community Treasury"
currency: "kin"
handle:   "treasury"
primary:  true
```

It cannot go into overdraft. All flows through it are traceable as bank transactions with memos. No kin is destroyed when it passes through the treasury — unlike demurrage, which retires kin.

---

## Adding a Domain

To add a new required domain:

1. Create a `FunctionalDomain` subclass in `packages/community/src/domains/<name>/`.
2. Assign a hardcoded `DOMAIN_ID` constant (continue the numbering sequence).
3. Register it in `seedDomains()` in `packages/community/src/bootstrap/seedDomains.ts`.
4. If it needs a bank account, initialize it in `server.ts` alongside the other monetary domains.

Optional domains that are not universally needed should not be given hardcoded IDs unless another part of the system needs to reference them directly.
