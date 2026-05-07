# Farming System

## Overview

The farming system connects communities to local, sustainable food production through annual contracts. The community takes on the capital and risk burden that currently destroys small farms; farmers contribute land, skill, and stewardship. The exchange is governed by the Farmers pool and ratified by the assembly.

Communities come in two types with different relationships to food production:

- **Rural/mixed communities** — farms are local associations under direct contract with the community
- **Urban communities** — food contracts are managed at the federation level, with farms supplying multiple communities through a regional network

---

## Farm Associations

A farm is registered as a **farm association** — a special type of community association with a formal contractual relationship. It is not a governing body and has no pool authority, but it has a richer profile than a social association.

### Farm association record

- Name, location, acreage
- Farmer members (the people who work the farm)
- Declared practices (polyculture, no synthetic inputs, soil health methods, water use, etc.)
- Acreage cap compliance (farms above the maximum contracted acreage are ineligible)
- Proximity compliance (farms must be within the community's defined supply radius)
- Active and historical contracts

### Eligibility requirements

- No single entity may hold more than one farm contract (prevents corporate aggregation)
- Farm must be below the community-defined acreage ceiling
- Farm must be within the defined proximity radius
- Farm must commit to declared practice standards before contract approval

---

## The Annual Contract Cycle

Food needs are predictable and farming is seasonal. Contracts follow a fixed annual rhythm:

```
Nov – Jan    Needs projection
             Community projects food requirements from member headcount
             and a standard per-capita food basket
             Farmers pool reviews incoming farm proposals and crop plans

Feb – Mar    Contract negotiation
             Farmers propose crop plans, acreage, and yield estimates
             Farmers pool recommends contract terms
             Assembly ratifies contracts via motion

Apr          Advance payment
             Community makes advance payment to each contracted farm
             Covers seed, inputs, and early-season operating costs
             Crop plans locked — no major changes after this point

May – Sep    Growing season
             Periodic practice inspections by Farmers pool members
             Community labor available on request for intensive periods
             Equipment commons scheduling active

Aug – Oct    Harvest
             Delivery against contract terms
             Community labor pool mobilized for harvest assistance
             Yield recorded against contracted volumes

Oct – Nov    Settlement and renewal
             Surplus distribution per contract terms
             Payment reconciliation
             Renewal discussions begin for following season
```

---

## Contract Structure

### Payment tiers

Contracts use a three-tier yield model that transfers weather and crop risk from the farmer to the community:

| Yield outcome | Farmer receives | Community receives |
|---|---|---|
| Below floor (crop failure) | Full base payment | Reduced/no delivery — community absorbs loss |
| Normal yield | Base payment | Contracted volume |
| Above ceiling (surplus) | Base + surplus share (e.g. 60%) | Contracted volume + surplus share (e.g. 40%) |

The **advance payment** at planting is the most important feature — it gives small farms capital independence from banks and covers input costs before any revenue is earned.

### Resource commitments

Contracts specify not just payment terms but community resource commitments to the farm:

- **Equipment access** — scheduled allocations from the equipment commons
- **Harvest labor** — community labor pool hours committed for harvest period
- **Bulk inputs** — seed, fuel, and other inputs delivered via community procurement
- **Infrastructure support** — Builders pool availability for barn, fencing, and irrigation maintenance

### Contract statuses

```
proposed → approved → active → fulfilled
                             → disputed
```

Contract approval is a motion ratified by the assembly. A disputed contract (delivery shortfall, practice violation) goes back to the Farmers pool for resolution before final settlement.

---

## Community Resource Commitments

### Equipment commons

The community owns a shared pool of major agricultural equipment:

- Tractors, tillers, planters, harvesters
- Irrigation systems and pumps
- Post-harvest processing equipment

Farmers schedule access through the system. Maintenance is a community responsibility — breakdowns are repaired by community mechanics, not at the individual farmer's expense. Equipment is funded through the community's common pool and governed by the Farmers pool.

### Harvest labor

Harvest is time-critical. A week's delay can mean significant crop loss. The community supplies harvest labor from the general membership:

- Farmers pool posts a harvest labor request with dates and headcount
- Members sign up and earn internal currency credit for hours worked
- Labor hours are tracked against the contract's committed labor allocation

This is a direct use of the internal currency system — members who are not farmers contribute during peak demand and are credited accordingly.

### Bulk procurement

The community buys seed, fuel, and other inputs collectively at scale through the external trade common pool. Individual farmers do not negotiate with suppliers. Cost savings from bulk purchasing are passed to contracted farms as reduced input costs.

---

## Practice Standards

The Farmers pool defines and enforces practice standards for all contracted farms. Standards are set by the pool and ratified by the assembly. Example standards:

- Minimum crop diversity (no single crop may exceed X% of contracted acreage)
- Prohibited inputs (synthetic pesticides, GMO seed if community so decides, etc.)
- Soil health requirements (cover cropping, rotation minimums)
- Water use limits
- Buffer zones for wildlife and watershed protection

### Inspection

The Farmers pool conducts periodic practice inspections during the growing season. Inspections are documented in the contract record and visible to all community members. A practice violation triggers a Farmers pool review before the following contract renewal.

---

## Urban Communities and Federation Food Networks

Urban communities have no local farms. Their food supply is managed at the **federation level**:

- The federation contracts with regional farms on behalf of multiple urban communities
- Farms supply the federation network, not individual communities
- Supply is allocated across communities by the federation based on population and need
- Urban communities contribute to the federation food fund from their common pool
- A food committee within the urban community manages allocation, storage, and distribution locally

This gives regional farms a large, stable guaranteed buyer — the federation — while urban communities get local, sustainable food without needing to individually manage farm relationships.

The Farmers pool at the federation level represents contracted farms across the network and governs practice standards and contract terms for the regional supply system.

---

## Perennial Crops

Orchards, vineyards, and perennial berry crops operate on 3–5 year timelines. These require:

- Longer-term contracts (3–5 years with annual review)
- Higher advance investment by the community (establishment costs are front-loaded)
- Different yield expectations in early years (orchards don't produce at full capacity for several years)
- Specific infrastructure commitments (trellising, irrigation, cold storage)

Perennial crop contracts are approved by the assembly as a capital commitment, not just an annual food contract.

---

## Data Model

```
FarmAssociation
  id, name, location, acreage
  memberIds[]          ← people who work the farm
  practices            ← declared practice standards
  contracts[]          ← annual FarmContract records
  inspectionHistory[]

FarmContract
  id, farmId, seasonYear
  contractType         ← annual | perennial
  cropPlan[]           ← { crop, estimatedYield, acreage }
  basePayment          ← guaranteed regardless of yield
  advancePayment       ← paid at planting
  floorYield           ← below this, community absorbs loss
  ceilingYield         ← above this, surplus split applies
  surplusSplit         ← { farmerPct, communityPct }
  resourceCommitments  ← { equipmentSlots[], laborHours, inputDeliveries[] }
  deliverySchedule[]   ← { date, crop, volume }
  actualDeliveries[]   ← recorded at harvest
  payments[]           ← { date, amount, type: advance|base|surplus }
  status               ← proposed | approved | active | fulfilled | disputed
  motionId             ← assembly motion that ratified this contract
```

---

## Community Grain Storage

After harvest, the community holds a staple grain reserve separate from the market. This reserve provides a buffer against supply disruption and is managed by the Food Security pool.

### Target reserve

The reserve is sized to feed the full community for at least 8 weeks from stored staples alone — grains and legumes primarily. The Food Security pool is responsible for maintaining this level and may spend from its treasury allocation without a motion for any purchase below a defined threshold.

### The storage structure

Community-scale grain storage (5,000–10,000 bushels, enough for 100–200 people for a year) can be built from dimensional lumber available at any hardware store. The design uses a **flat storage** approach — a shed-like building with reinforced walls that resist the significant lateral pressure grain exerts.

**The core engineering constraint:** grain pushes outward on walls with roughly 200–300 lbs per square foot at the base of a 6-foot pile. Standard stud walls fail. The solution is plank-on-edge walls with heavy exterior posts.

#### Wall construction

- Exterior posts: 6×6 lumber (or doubled 2×6), set in concrete, 4 ft on center
- Wall sheathing: 2×10 or 2×12 planks stood on edge horizontally, spiked to posts — the posts take the lateral grain load, not the planks
- Diagonal bracing on the exterior face of each post bay

#### Floor

The floor is the most critical detail. Grain sitting on an impermeable surface sweats moisture from below and rots at the bottom first.

**Option A — Raised wood floor on piers (simpler to build):**
- 2×6 or 2×8 joists on concrete piers or treated posts, 18"–24" off grade
- 2×6 T&G decking, gaps sealed with hardware cloth to prevent grain loss
- Open underside allows air circulation and visual inspection for pests and moisture

**Option B — Concrete slab with aeration channels:**
- 4" perforated PVC pipe in gravel below slab, manifolded to passive vents or a fan
- Requires more planning but is more durable long-term

#### Roof

- Standard shed roof, 4/12 pitch minimum for drainage
- Metal roofing strongly preferred — shingles can leak at seams over time and moisture is catastrophic
- Perforated soffit at eaves + ridge vent at peak creates passive stack-effect airflow through stored grain

#### Ventilation

Passive airflow is sufficient for most climates if the grain is dry on entry:
- Vented soffit around the perimeter, covered with hardware cloth
- Ridge vent along the full peak
- No electricity required

A small electric fan on a timer (running for 2–4 hours after sunrise each day) dramatically improves moisture management if power is available, but is not essential.

#### Pest management

This is the genuine weakness of timber vs. steel bins. Mitigations:
- 1/4" hardware cloth behind every vent opening, no gaps
- Metal flashing at the base perimeter where siding meets foundation (rats cannot chew through it)
- All exterior joints caulked and painted
- Diatomaceous earth dusted along all interior wall-floor joints each season — kills insects without toxins or residue
- Raised floor design allows underside inspection, which sealed steel bins do not

#### Approximate materials for a 20×30 ft structure (~5,000 bushels)

| Component | Material | Rough quantity |
|---|---|---|
| Posts | 6×6×12 ft | 16 |
| Wall planks | 2×10×16 ft | ~200 |
| Roof framing | 2×8 rafters, 24" OC | standard shed calc |
| Floor decking | 2×6 T&G | 600 sq ft |
| Roofing | Metal panel | 700 sq ft |
| Hardware | Lag screws, post bases, hardware cloth | — |

**Rough material cost:** $8,000–14,000 at current lumber prices. A crew of 4 with basic carpentry skills can frame and dry-in the structure in 2–3 weekends.

### Drying grain before storage

Getting grain into storage dry is the knowledge bottleneck. Storing grain above ~14% moisture causes mold within weeks. Commercial elevators use propane dryers. Community alternatives:

- **Field drying** — harvest late, after grain has dried on the stalk. Weather-dependent and not always possible.
- **Solar dryer** — a shallow tray under glass or clear plastic sheeting, with a dark base to absorb heat. Grain spread 2–3" deep, stirred daily, dried over several days of sun. Scalable with multiple trays.
- **Forced air at ambient temperature** — a fan pushing unheated air through a perforated floor bin. Slow but effective if the air is dry. Works best in low-humidity climates.

A handheld moisture meter ($40–80) is essential equipment. Test grain before it enters storage. If it reads above 14%, it is not ready.

### Reserve management

The Food Security pool tracks inventory with a simple ledger: crop, variety, quantity in bushels, date stored, estimated shelf life, and location in the structure. Grain is rotated — oldest stock used first, new harvest added at the back. The pool reports reserve levels to the community monthly, and sounds the alarm if the reserve falls below the 4-week threshold.

---

## Comparison to the Current System

| Problem for small farms today | Community model |
|---|---|
| Equipment debt ($150k+ tractor) | Community-owned equipment commons |
| Input costs at consolidated retail | Bulk purchasing through common pool |
| Harvest labor scarcity | Community labor pool with internal currency incentive |
| Market price set by global commodity speculation | Guaranteed contract price before planting |
| 100% weather and crop risk borne alone | Community absorbs yield shortfall |
| Off-farm job required to survive | Base income floor covers living costs |
| No negotiating leverage with distributors | Federation purchasing at scale |

The farmer contributes land, skill, and stewardship. The community contributes everything that currently requires capital or market power. This is a structurally different deal than anything currently available to small farms.
