# Authority & Document Ownership Refactor Plan

## Goal

1. Introduce a first-class `Authority` concept with built-in values `"community"` and `"assembly"`.
2. Every `GoverningDocument` (constitution, bylaws, charters) is owned by an authority — which means that authority controls amendment rights over the document.
3. Dissolve the Constitution singleton — make the constitution a regular `GoverningDocument` stored and loaded exactly like bylaws, just with `type: "constitution"` and `authorityId: "community"`.

---

## 1. Authority type (DocumentFramework.ts)

Add a lightweight `Authority` interface and a canonical built-in registry:

```ts
export interface Authority {
    id:          string;   // e.g. "community", "assembly", "council:market"
    label:       string;   // display name
    description: string;
}

export const BUILT_IN_AUTHORITIES: Record<string, Authority> = {
    community: {
        id:          "community",
        label:       "Whole Community",
        description: "The full membership via referendum. Documents owned here require a referendum to amend.",
    },
    assembly: {
        id:          "assembly",
        label:       "Assembly",
        description: "The randomly drawn assembly. Documents owned here can be amended by assembly vote.",
    },
};
```

Domain councils (e.g. `"council:market"`) can be registered at runtime when a domain is created. The registry is a `Map<string, Authority>` the app boots with the two built-ins and adds council entries dynamically.

---

## 2. GoverningDocument gets authorityId

Replace the current `scope` field (which does a double duty of "who owns this" and "which pool does this apply to") with two explicit fields:

```ts
export interface GoverningDocument {
    id:           string;
    type:         string;           // "constitution" | "bylaw" | "charter"
    title:        string;
    preamble?:    string;
    articles:     DocumentArticle[];
    adoptedAt:    string;
    version:      number;
    authorityId:  string;           // who may amend this document
    domainId?:    string | null;    // which pool/domain this bylaw applies within (null = community-wide)
    expiresAt?:   string | null;
}
```

- `authorityId: "community"` → amendment requires a full referendum
- `authorityId: "assembly"` → amendment requires an assembly vote
- `authorityId: "council:market"` → amendment requires a market council vote
- `domainId` replaces `scope`: purely about applicability, not amend-authority

---

## 3. Constitution becomes a regular GoverningDocument

The constitution gains `type: "constitution"` and `authorityId: "community"`. The constitutional parameters, `authorityMap`, and `amendments` — which are specific to the constitution — move into a companion record stored alongside the document:

```ts
export interface ConstitutionMetadata {
    documentId:  string;   // FK → GoverningDocument.id
    parameters:  Record<string, ConstitutionalParameter<number | boolean>>;
    amendments:  ConstitutionAmendment[];
    authorityMap: ActionAuthority[];
    communityName:   string;
    communityHandle: string;
}
```

Persistence: `BylawDb` (or a renamed `DocumentDb`) stores `GoverningDocument` rows as before. `ConstitutionMetadata` is stored in a separate `constitution_meta` row in the same SQLite database, keyed by `documentId`. There is exactly one constitution; its document id is a well-known constant (`"constitution"`) so it can be found without a query.

---

## 4. What disappears

| Before | After |
|---|---|
| `Constitution` singleton class | Deleted |
| `ConstitutionSaver` interface | Deleted |
| `ConstitutionDocument` interface | Split → `GoverningDocument` + `ConstitutionMetadata` |
| `Constitution.getInstance()` call sites | Import `ConstitutionLoader` and call methods directly |
| `scope` on `GoverningDocument` | Renamed `domainId` |

---

## 5. Loader changes

**Rename `BylawLoader` → `DocumentLoader`** (it already generically handles `GoverningDocument`).

Add a `ConstitutionLoader` (or extend `DocumentLoader`) with:
- `loadConstitution(): { doc: GoverningDocument; meta: ConstitutionMetadata }`
- `saveConstitution(doc, meta): void`
- `amendParameter(key, value, proposalId): void`
- `updateSection(sectionId, body): void`

`DocumentLoader.create()` gains an `authorityId` parameter (replaces the old `scope` parameter which was ambiguous).

---

## 6. MotionController / GovernanceService changes

All call sites of `Constitution.getInstance()` become imports of `ConstitutionLoader`. The `getRequiredVoteRule(action)` helper moves to a standalone function that takes a `ConstitutionMetadata` argument, not a singleton.

---

## 7. Migration strategy

Because the constitution is currently not stored as a `GoverningDocument` row (it lives in its own `constitution.json` file), the first boot after this refactor needs to:
1. Read the existing `constitution.json`.
2. Create a `GoverningDocument` row with `id: "constitution"`, `type: "constitution"`, `authorityId: "community"`, articles from the JSON.
3. Create a `constitution_meta` row with parameters, amendments, authorityMap, communityName, communityHandle from the JSON.
4. Delete (or rename) `constitution.json`.

This can be a one-shot migration function called in `index.ts` before the app starts listening.

---

## 8. Rough implementation order

1. **DocumentFramework.ts** — add `Authority`, `BUILT_IN_AUTHORITIES`, rename `scope→domainId`, add `authorityId`
2. **DocumentLoader.ts** — rename from `BylawLoader`, update `create()` signature
3. **ConstitutionLoader.ts** — new file; handles `ConstitutionMetadata` persistence and all parameter/amendment logic
4. **Constitution.ts** — delete the singleton class; keep `ConstitutionalParameter`, `ConstitutionAmendment`, `ActionAuthority`, `ConstitutionMetadata`, `DEFAULT_CONSTITUTION_META`, `DEFAULT_ARTICLES` as pure data
5. **index.ts** — run one-shot migration; call `ConstitutionLoader` instead of `Constitution.getInstance().init()`
6. **MotionController / GovernanceService** — update all `Constitution.getInstance()` references
7. **governanceRoutes.ts** — no structural change needed; just swap loader references
8. **Frontend** — `GoverningDocument` now has `authorityId`; display it in bylaw list and constitution header

---

## Open questions

- Should domain councils be stored in the DB as `Authority` rows, or derived dynamically from the domain/pool records that already exist?  
  *Lean toward deriving — avoid a third table for something already implicit in domain records.*

- Does the assembly itself have governing documents (e.g. standing orders)? If so, those would be `authorityId: "assembly"` bylaws — no code change needed, just a convention.

## Decided: simplify parameter authority

`ParameterAuthority` (`"immutable"` | `"referendum"` | `"assembly"` | ...) is removed. The non-immutable values are redundant — amendment authority is now expressed at the document level via `authorityId`.

What remains is a single flag on each parameter:

```ts
export interface ConstitutionalParameter<T extends number | boolean> {
    readonly value:        T;
    readonly immutable:    boolean;   // replaces authority string
    readonly description:  string;
    readonly constraints?: { min?: number; max?: number };
}
```

`immutable: true` means the parameter is a unit definition or fundamental guarantee that no vote can change. `immutable: false` means it is amendable by whatever process the document's `authorityId` specifies.

The `ParameterAuthority` type and all its string values (`"referendum"`, `"assembly"`, `"council"`, `"commonwealth"`) are deleted. Add this to step 4 of the implementation order: update all parameter declarations in `DEFAULT_CONSTITUTION_META` and the `amend()` method check (`if (param.immutable) throw ...`).
