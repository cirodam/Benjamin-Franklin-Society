# Authority System — Implementation Plan

## Goal

Give every governance action in the system a first-class `Authority` — the body
that has jurisdiction over it. The voting engine enforces eligibility based on
authority membership. The UI shows authority everywhere a governance decision
appears.

---

## Data Model

### `Authority`

```typescript
interface Authority {
    id:                string;   // e.g. "assembly", "membership", "pool:<uuid>"
    name:              string;   // human label
    description?:      string;
    type:              "builtin" | "pool";
    poolId?:           string;   // set only when type === "pool"
    defaultVoteRuleId: string;   // default rule when none is specified on the motion
}
```

Stored in a new `authorities` table (`id TEXT PK, data TEXT`).

### Built-in authorities (seeded at startup, undeletable)

| id           | name             | defaultVoteRuleId         |
|--------------|------------------|---------------------------|
| `assembly`   | Assembly         | `assembly-general`        |
| `membership` | Full Membership  | `referendum-general`      |

### Pool authorities

When a `LeaderPool` is created, an `Authority` with `type: "pool"` and
`poolId` pointing to the pool is automatically created alongside it.
Its `id` is `pool:<pool.id>` and its `name` matches the pool name.
When a pool is deleted, its authority is deleted with it.

---

## Unified Motion Lifecycle

The current system has two separate stage tracks:
- **Referendum** (`draft → deliberating → voting → resolved`) — async online vote by full membership
- **Clerk-driven** (`proposed → discussed → voted → resolved`) — in-person body, clerk records outcome

This distinction only exists because the system had no way to know who was eligible
to vote on non-referendum motions. With `AuthorityService` resolving the voter set
for any authority, clerk-driven motions can use the same async voting flow.

**All motions use a single stage track:**

```
draft → deliberating → voting → resolved
```

### `@ecf/core` changes (`packages/core/src/governance/AssemblyMotion.ts`)

- Remove `ClerkStage` type (`"proposed" | "discussed" | "voted"`)
- Remove `isReferendum` getter and the `body === "referendum"` initial-stage check
- Rename `ReferendumStage` → `MotionStage` (now the only stage type)
- `body` field: keep as a plain string for potential grouping/display, but stop
  driving behaviour from it

### `Motion.ts` changes

Replace `body: MotionBody` with `authorityId: string`:

```typescript
// Before
body: "referendum" | "assembly" | string  // string = pool id

// After
authorityId: string  // "assembly" | "membership" | "pool:<id>"
```

Drop `MotionBody` type entirely. Update `toData`/`fromData` accordingly.

---

## Eligibility Enforcement

Add `AuthorityService` that resolves the current member set for any authority:

```typescript
class AuthorityService {
    getMemberIds(authorityId: string): string[]
    isMember(authorityId: string, personId: string): boolean
}
```

Resolution logic:
- `"assembly"` → current assembly term `memberIds` from `singleton_records`
- `"membership"` → all active (non-disabled) persons
- `"pool:<id>"` → `LeaderPool.personIds` for that pool

`MotionService.castVote` calls `AuthorityService.isMember(motion.authorityId, voterId)`
and throws `403`-equivalent if false.

---

## Leader Pool Changes

`LeaderPoolLoader` gains a reference to an `AuthorityLoader`. On `save()` of a
new pool, it writes the companion authority row. On `delete()`, it removes the
authority row.

Pool name changes propagate to the authority name.

---

## New DB Table

```sql
CREATE TABLE IF NOT EXISTS authorities (
    id   TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
```

Added to `CommunityDb.ts` alongside the existing tables.

---

## New Files

| File | Purpose |
|------|---------|
| `src/governance/Authority.ts` | `Authority` interface + type guards |
| `src/governance/AuthorityLoader.ts` | CRUD against `authorities` table; `seedBuiltins()` |
| `src/governance/AuthorityService.ts` | Singleton; `getMemberIds()`, `isMember()` |

---

## Existing File Changes

| File | Change |
|------|--------|
| `CommunityDb.ts` | Add `authorities` table |
| `server.ts` | Init `AuthorityLoader` + call `seedBuiltins()` at startup |
| `LeaderPool.ts` | No change to model |
| `LeaderPoolLoader.ts` | On create/save: upsert companion authority. On delete: remove authority |
| `packages/core/AssemblyMotion.ts` | Remove `ClerkStage`, `isReferendum`, dual-stage init; rename `ReferendumStage` → `MotionStage` |
| `Motion.ts` | Replace `body: MotionBody` with `authorityId: string`; drop `MotionBody`; update `toData`/`fromData` |
| `MotionService.ts` | Remove `isReferendum` guards; unified lifecycle for all motions; `castVote` checks `AuthorityService.isMember` |
| `MotionController.ts` | Pass `authorityId` from request body; expose `GET /api/authorities` |
| `governanceRoutes.ts` | Add `GET /api/authorities` route |

---

## API

```
GET  /api/authorities               → Authority[]
GET  /api/authorities/:id/members   → { personIds: string[] }
```

Both public (no auth required — list of who governs is community-visible).

---

## Frontend

### New component: `AuthorityBadge.svelte`

```svelte
<!-- Props: authorityId: string, authorities: Authority[] -->
<!-- Renders: pill with authority name -->
```

Placed in `src/components/`.

### `api.ts` additions

```typescript
interface AuthorityDto { id: string; name: string; type: string; defaultVoteRuleId: string; }
getAuthorities(): Promise<AuthorityDto[]>
```

### Wired in:

- `DocumentsPage` — replace hardcoded "Community" / dynamic `authorityId` strings
  with `<AuthorityBadge>`
- `CharterPage` / `ConstitutionPage` / `BylawPage` — document headers
- `SectionPage` — section chips
- `MotionPage` / motion cards — show which body is deciding
- Motion creation form — `authorityId` picker (dropdown from `getAuthorities()`)
- Leader pool creation — show resulting authority name after create

---

## Build Order

1. `packages/core`: collapse to single `MotionStage`; remove `ClerkStage`, `isReferendum`, dual-stage init
2. `Authority.ts` + `AuthorityLoader.ts` (model + DB)
3. `CommunityDb.ts` — add `authorities` table
4. `server.ts` — seed built-ins at startup
5. `LeaderPoolLoader.ts` — auto-create/delete pool authorities
6. `AuthorityService.ts` — member resolution
7. `Motion.ts` — `authorityId` replaces `body`; drop `MotionBody`
8. `MotionService.ts` — unified lifecycle; enforce eligibility in `castVote`
9. `MotionController.ts` + routes — wire `authorityId`; add `GET /api/authorities`
10. Frontend: `api.ts` additions + `AuthorityBadge.svelte`
11. Frontend: wire badge into all document/motion/section surfaces
12. Frontend: motion creation picks authority; pool creation shows resulting authority

---

_No open questions. `@ecf/core` is in the same monorepo and will be updated in step 1._
