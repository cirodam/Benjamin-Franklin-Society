# Governance as Code

ECF uses a declarative governance language embedded in governing documents. Documents are JSON files that a human can read as policy text and that the software can read as instructions. The two readings are the same document — there is no separate "config file" that shadows the text.

The core principle: **the document is the record of truth.** The software's job is to reflect the document, not to impose its own structure on top of it.

---

## Document Structure

A governing document is a `GoverningDocument` object:

```json
{
  "id": "authorities",
  "type": "bylaw",
  "title": "Governing Authorities and Enumerated Powers",
  "preamble": "...",
  "version": 1,
  "authorityId": "referendum",
  "voteRuleId": "absolute-supermajority",
  "adoptedAt": "2025-01-01T00:00:00.000Z",
  "domainId": null,
  "articles": [ ... ]
}
```

**Top-level fields:**

| Field | Description |
|---|---|
| `id` | Stable machine identifier for this document |
| `type` | `"constitution"`, `"bylaw"`, `"charter"`, `"ordinance"` — describes role, confers no privilege |
| `title` | Human-readable title |
| `preamble` | Optional prose displayed before the first article |
| `version` | Incremented on each amendment |
| `adoptedAt` | ISO 8601 datetime; determines precedence (oldest document wins on conflicts) |
| `authorityId` | Which authority controls amendment of this document |
| `voteRuleId` | Default vote threshold for amending sections of this document |
| `domainId` | `null` = community-wide; a domain ID = scoped to that domain |
| `expiresAt` | Ordinances only — reconciler ignores expired documents entirely |
| `readonly` | If `true`, cannot be amended via the normal document API (e.g. federation charters) |

**Articles** contain **sections**. A section is where the human text and machine directives live together:

```json
{
  "id": "I.2",
  "title": "Reserved Powers",
  "body": "The community has reserved the following powers...",
  "rationale": "Separating reserved powers from delegated ones makes...",
  "voteRuleId": "absolute-supermajority",
  "directives": [ ... ]
}
```

| Field | Description |
|---|---|
| `id` | Hierarchical identifier — `"I.1"`, `"IV.2"`, `"I.3.1"` |
| `title` | Section heading (also used as the `name` of any created entity) |
| `body` | Prose text. May embed `{paramKey}` slots that render as live parameter values |
| `rationale` | Authors' stated intent — displayed alongside the body so purpose is always visible |
| `voteRuleId` | Overrides the document-level threshold for amending this specific section |
| `directives` | Zero or more machine-readable instructions (see below) |

---

## Directives

A directive is a machine-readable instruction attached to a section. Directives are **declarative**: they describe desired state, not procedure. The reconciler reads all active documents and produces a consistent desired state, then syncs the database to match.

```json
{
  "verb": "authority.grant",
  "args": ["referendum", "exclude-member", "absolute-supermajority"]
}
```

All directives share the same shape: a `verb` string and a positional `args` array. Arguments are always strings; the reconciler parses them by position according to the verb spec.

### Implicit fields from section prose

Several directives do not repeat name and description in `args` — they pull them from the enclosing section:

| Directive | Name source | Description source | Mandate source |
|---|---|---|---|
| `domain.define` | `section.title` | `section.body` | — |
| `domain.unit` | `section.title` | `section.body` | — |
| `pool.define` | `section.title` | `section.body` | `section.rationale` |

This means the governance text and the software record stay in sync automatically: editing the section body changes what the software displays as the domain description.

---

## Directive Vocabulary

### `authority.define`

Declares that a governing body with the given stable ID should exist.

```
authority.define  <id>  <kind>  <defaultVoteRuleId>  <description...>
```

| Arg | Description |
|---|---|
| `id` | Stable ID, e.g. `"referendum"`, `"assembly"` |
| `kind` | `"membership"` \| `"assembly"` \| `"committee"` \| `"leader-pool"` \| `"referendum"` |
| `defaultVoteRuleId` | Vote rule used when this authority votes and no override is specified |
| `description...` | All remaining args joined as a prose description |

**Example:**
```json
{
  "verb": "authority.define",
  "args": [
    "assembly",
    "assembly",
    "simple-majority",
    "The community's standing delegated governing body, drawn by sortition."
  ]
}
```

---

### `authority.grant`

Grants a specific enumerated power to a governing body.

```
authority.grant  <authorityId>  <action>  <voteRuleId>
```

| Arg | Description |
|---|---|
| `authorityId` | Must match an `authority.define` ID in any active document |
| `action` | Named action string, e.g. `"exclude-member"`, `"allocate-domain-budget"` |
| `voteRuleId` | Vote rule required to exercise this specific power |

**Example:**
```json
{
  "verb": "authority.grant",
  "args": ["referendum", "exclude-member", "absolute-supermajority"]
}
```

Multiple `authority.grant` directives on the same section are all processed. A section can grant any number of powers.

---

### `parameter.define`

Declares a named, typed, optionally-constrained value that the software reads at runtime and that governance can amend.

```
parameter.define  <key>  <value>  <immutable>  [min]  [max]  <description...>
```

| Arg | Description |
|---|---|
| `key` | Camel-case identifier, e.g. `"demurrageRatePct"` |
| `value` | Initial value — a number, `"true"`, or `"false"` |
| `immutable` | `"true"` = cannot be amended by any vote (foundational guarantees) |
| `min` | Optional numeric lower bound |
| `max` | Optional numeric upper bound |
| `description...` | All remaining args joined as a prose description |

**Examples:**
```json
{ "verb": "parameter.define", "args": ["universalFloorGuaranteed", "true", "true", "Every member receives basic needs support unconditionally"] }
{ "verb": "parameter.define", "args": ["demurrageRatePct", "2.0", "false", "0.1", "10.0", "Annual demurrage rate applied to kin balances"] }
```

Parameters can be embedded in section prose with `{paramKey}` — the UI renders the live value in place of the slot.

---

### `domain.define`

Declares that a functional domain with the given stable ID should exist. Name and description come from the enclosing section.

```
domain.define  <id>
```

| Arg | Description |
|---|---|
| `id` | Stable domain ID — must be globally unique and never reused |

**Example:**
```json
{
  "id": "I.1",
  "title": "Central Bank",
  "body": "The Central Bank is the sole issuer of the community currency (kin)...",
  "directives": [
    { "verb": "domain.define", "args": ["ecf-domain-central-bank-0000000001"] }
  ]
}
```

---

### `domain.unit`

Declares that a functional unit of the given type should exist within a domain. Name and description come from the enclosing section.

```
domain.unit  <domainId>  <unitType>
```

| Arg | Description |
|---|---|
| `domainId` | Stable ID of the parent domain (must be declared by a `domain.define`) |
| `unitType` | Free-form type string, e.g. `"branch"`, `"office"`, `"ward"` |

**Example:**
```json
{
  "id": "I.3.1",
  "title": "Main Branch",
  "body": "The primary branch of the Community Bank, providing day-to-day deposit and payment services to all members.",
  "directives": [
    { "verb": "domain.unit", "args": ["ecf-domain-community-bank-000000004", "branch"] }
  ]
}
```

---

### `pool.define`

Declares that a leader pool with the given stable ID should exist. Name, description, and mandate come from the enclosing section.

```
pool.define  <id>  <voteRuleId>
```

| Arg | Description |
|---|---|
| `id` | Stable pool ID |
| `voteRuleId` | Vote rule used for internal pool decisions |

---

### `pool.governs`

Declares that a named pool governs a named domain.

```
pool.governs  <poolId>  <domainId>
```

---

### `document.require`

Declares that a document of the given type must exist for the community to be considered fully constituted. **Not yet consumed by the reconciler** — reserved for future completeness-checking.

```
document.require  <type>  [description...]
```

---

## Reconciler Semantics

The **DocumentReconciler** runs at boot and after any document change. It:

1. Loads all non-expired governing documents from the database.
2. Sorts them by `adoptedAt` ascending — **oldest document wins** on any conflict.
3. Processes all `authority.define` and `authority.grant` directives to build desired authority state.
4. Syncs the authority database to match desired state.

The **StructuralReconciler** processes `domain.define`, `domain.unit`, `pool.define`, and `pool.governs` directives to create domains, units, and pools in the database.

**No document type has special privilege.** A bylaw can carry `authority.define` directives. A constitution is not treated differently from any other document by the reconciler. The constitution's authority comes from the fact that it is adopted first — its directives take precedence because they are oldest, not because of their document type.

---

## Vote Rules

Vote rule IDs referenced in directives must match records in the vote rules table. The standard set:

| ID | Meaning |
|---|---|
| `simple-majority` | More than half of votes cast |
| `supermajority` | Two-thirds or more of votes cast |
| `absolute-majority` | More than half of all eligible voters |
| `absolute-supermajority` | Two-thirds or more of all eligible voters |

---

## Conventions

- **Stable IDs** for domains and pools are hard-coded strings of the form `ecf-domain-<name>-<zero-padded-number>`. They never change after first use.
- **Section IDs** use Roman numerals for articles (`I`, `II`) and dotted decimals for sections (`I.1`, `I.3.1`). Sub-sections (`I.3.1`) are valid.
- **`authorityId` on the document** governs who can amend the document itself. The directives inside govern what powers that document creates.
- **`domainId: null`** means community-wide scope. A non-null `domainId` scopes the document's effect to a specific domain.
- **Immutable parameters** (`"immutable": "true"`) are foundational guarantees — the software refuses to amend them regardless of vote outcome.
