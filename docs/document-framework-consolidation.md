# Document Framework Consolidation Plan

## Problem

There are two parallel document systems:

1. **`DocumentLoader`** — generic, stores bylaws and the charter in the `bylaws` table as `GoverningDocument` JSON blobs. Prose-only; no parameter system.

2. **`ConstitutionLoader`** — bespoke singleton for the constitution. Stores articles in `bylaws["constitution"]` and metadata (parameters, amendments, authority map, community identity) in `singleton_records["constitution_meta"]`. Has its own `amend()`, typed getters, constraint checking, term window math, etc.

The split means the constitution is a special case that every subsystem must import `ConstitutionLoader` to reach, and extending the parameter pattern to any other document (e.g. a bylaw with a configurable threshold) is impossible without another bespoke loader.

## Goal

One document system. Every governing document — constitution, bylaws, charter, future domain statutes — is a `GoverningDocument` stored in `bylaws`. Documents that need to drive software behavior carry **parameters**: named, typed, constrained values that effects can amend and that the application can read via a single API. The `ConstitutionLoader` class is deleted entirely.

---

## Data Model Changes

### 1. Extend `GoverningDocument` (in `packages/core`)

```typescript
interface GoverningDocument {
    // existing fields unchanged
    id:          string;
    type:        string;
    title:       string;
    preamble?:   string;
    articles:    DocumentArticle[];
    adoptedAt:   string;
    version:     number;
    authorityId: string;
    voteRuleId:  string;
    domainId?:   string | null;
    expiresAt?:  string | null;

    // NEW
    parameters?:      Record<string, DocumentParameter>;
    amendments?:      DocumentAmendment[];
    authorityMap?:    ActionAuthority[];   // moved from ConstitutionMetadata
}

interface DocumentParameter {
    value:        number | boolean;
    immutable:    boolean;
    description:  string;
    constraints?: { min?: number; max?: number };
}

interface DocumentAmendment {
    version:    number;
    parameter:  string;
    oldValue:   number | boolean;
    newValue:   number | boolean;
    motionId:   string;
    amendedAt:  string;
}

interface ActionAuthority {
    action:      string;
    body:        string;
    description: string;
    voteRuleId:  string;
}
```

`ActionAuthority` was already in `packages/community/src/governance/Constitution.ts` — it moves to core alongside `DocumentParameter` and `DocumentAmendment`.

### 2. Community identity moves out of the constitution

`communityName` and `communityHandle` are system config, not governance prose. They move to a new `singleton_records["community_identity"]` row:

```typescript
interface CommunityIdentity {
    name:   string;
    handle: string;
}
```

A new thin `CommunityIdentityStore` class (≈20 lines) handles read/write. All callers currently reading `ConstitutionLoader.getInstance().communityName/Handle` are updated to use it.

---

## `DocumentLoader` Changes

Add to `DocumentLoader`:

```typescript
// Read a parameter from a document. Throws if not found.
getParam<T extends number | boolean>(docId: string, key: string): T

// Read all parameters from a document.
getParams(docId: string): Record<string, DocumentParameter>

// Amend a parameter. Records the amendment in doc.amendments and bumps version.
amend(docId: string, key: string, newValue: number | boolean, motionId: string): GoverningDocument

// Read the authority map from a document.
getAuthorityMap(docId: string): ActionAuthority[]

// Look up the required vote rule for an action kind (scans authorityMap).
getRequiredVoteRule(docId: string, action: string): string | null
```

Constraint checking and immutability enforcement moves here from `ConstitutionLoader.amend()`.

---

## Migration (no backwards compatibility)

Since `reset-community.sh` re-seeds from scratch, the migration path is:

1. Extend the core types.
2. Rewrite the default constitution seed to include `parameters`, `amendments: []`, and `authorityMap` directly on the `GoverningDocument`.
3. Add the new `DocumentLoader` methods.
4. Add `CommunityIdentityStore`.
5. Update all callers:
   - `ConstitutionLoader.getInstance().get("bankDemurrageRate")` → `DocumentLoader.getParam("constitution", "bankDemurrageRate")`
   - `ConstitutionLoader.getInstance().communityHandle` → `CommunityIdentityStore.getInstance().handle`
   - `ConstitutionLoader.getInstance().getRequiredVoteRule(kind)` → `DocumentLoader.getRequiredVoteRule("constitution", kind)`
   - `ConstitutionLoader.getInstance().amend(...)` → `DocumentLoader.amend("constitution", ...)`
   - `ConstitutionLoader.getInstance().currentTermWindow()` → standalone pure function `termWindow(params)` that takes the relevant parameters directly
6. Delete `ConstitutionLoader`, `ConstitutionMetadata`, `ConstitutionAmendment`, `ConstitutionalParameter`, `ActionAuthority`, `DEFAULT_CONSTITUTION_META`, `DEFAULT_ARTICLES`, `Constitution.ts`.
7. Drop the `singleton_records["constitution_meta"]` path from the DB schema (table stays for other uses).

---

## Effect Changes

`"amend-constitution"` is renamed `"amend-document-parameter"` with payload:

```typescript
{ docId: string; parameter: string; newValue: number | boolean }
```

This makes the same effect work for any parameterized document. The `authorityId` hint on the effect registration is dropped — the authority is determined by the motion's `authorityId` field at proposal time, guided by the document's `authorityMap`.

---

## `ConstitutionLoader` callers and their replacements

| Caller | Current | Replacement |
|---|---|---|
| `registerMonetaryHandlers.ts` | `constitution.bankDemurrageRate` etc. | `DocumentLoader.getParam("constitution", key)` |
| `ApplicationController.ts` | `constitution.memberAdmissionVouchesRequired` | same |
| `EconomicsController.ts` | `ConstitutionLoader.getInstance().*` | same |
| `PersonService.ts` | `constitution.stewardshipThresholdYears` | same |
| `governanceRoutes.ts` `computeSeats()` | `constitution.get("assemblySeatCount")` | same |
| `governanceRoutes.ts` term window | `constitution.currentTermWindow()` | pure `termWindow({ startMonth, startDay, termMonths })` util in core |
| `MotionController.ts` | `constitution.getRequiredVoteRule(kind)` | `DocumentLoader.getRequiredVoteRule("constitution", kind)` |
| `SetupController.ts` | `constitution.setCommunityName/Handle` | `CommunityIdentityStore.set(name, handle)` |
| `server.ts` identity | `constitution.communityHandle` | `CommunityIdentityStore.getInstance().handle` |
| `effects/index.ts` amend handler | `constitution.amend(param, value, id)` | `DocumentLoader.amend("constitution", param, value, id)` |
| `effects/index.ts` term window | `constitution.currentTermWindow()` | same pure util |

---

## API route changes

| Old route | New route |
|---|---|
| `GET /api/constitution` | `GET /api/documents/constitution` |
| `PATCH /api/constitution/parameters/:key` | `PATCH /api/documents/:id/parameters/:key` |
| `PATCH /api/constitution/sections/:sectionId` | `PATCH /api/documents/:id/sections/:sectionId` |
| `GET /api/charter` | `GET /api/documents/charter` |
| `GET /api/bylaws` | `GET /api/documents` |
| `GET /api/bylaws/:id` | `GET /api/documents/:id` |
| `POST /api/bylaws` | `POST /api/documents` |
| etc. | all bylaw sub-routes move under `/documents` |

The `rejectCharter` middleware is replaced by a `readonly: boolean` flag on `GoverningDocument`. `DocumentLoader` enforces it on all write operations. The charter and (optionally) any other federation-controlled document can be seeded with `readonly: true`.

---

## `DocumentLoader` changes to `loadAll()`

Currently excludes `constitution` and `charter` by hardcoded id. After consolidation, all documents live in the same table. `loadAll()` gains an optional filter:

```typescript
loadAll(opts?: { type?: string; excludeIds?: string[] }): GoverningDocument[]
```

The documents list page can call `loadAll({ excludeIds: ["constitution"] })` if the constitution is surfaced elsewhere in the nav. Or it can just show everything and let the UI handle display.

---

## Files to delete after migration

- `packages/community/src/governance/Constitution.ts`
- `packages/community/src/governance/ConstitutionLoader.ts`
- `packages/community/frontend/src/pages/ConstitutionPage.svelte`

## Files to create

- `packages/community/src/CommunityIdentityStore.ts`

## Frontend type changes (`api.ts`)

`ConstitutionDto`, `ConstitutionMetaDto`, `ConstitutionParam`, `ConstitutionAmendmentDto` are replaced by types that mirror the extended `GoverningDocument`:

```typescript
interface DocumentParameterDto {
    value:        number | boolean;
    immutable:    boolean;
    description:  string;
    constraints?: { min?: number; max?: number };
}
interface DocumentAmendmentDto {
    version:    number;
    parameter:  string;
    oldValue:   number | boolean;
    newValue:   number | boolean;
    motionId:   string;
    amendedAt:  string;
}
// GoverningDocument already has the shape — api.ts just re-exports it
// with parameters and amendments optionally present.
```

`getConstitution()` → `getDocument("constitution")`. `ConstitutionPage.svelte` → generic `DocumentPage.svelte` (already exists for bylaws; unify into one).

## Files substantially changed

- `packages/core/src/governance/DocumentFramework.ts` — new types added
- `packages/core/src/index.ts` — new exports
- `packages/community/src/governance/DocumentLoader.ts` — new methods
- `packages/community/src/governance/effects/index.ts` — `amend-constitution` → `amend-document-parameter`
- `packages/community/src/routes/governanceRoutes.ts` — remove constitution routes, use DocumentLoader
- all callers in the table above

---

## Decisions

- `currentTermWindow()` / `nextTermStartDate()` move to core as pure functions.
- `ConstitutionPage` is replaced by a generic `DocumentPage` that renders any document — parameters table, amendment log, and authority map appendix are rendered whenever those fields are present. The constitution is just another document with `type: "constitution"`. No special casing in code — the type string is only used by the UI to decide which nav item to highlight.
