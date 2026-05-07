# ECF Addressing

ECF uses a hierarchical address format to identify any entity in the network. The `@` symbol is a level separator meaning "within" — it never prefixes a handle.

---

## Format

```
handle@handle@handle...
```

Segments are written from most-specific to least-specific, left to right. Each segment is a handle unique within its parent scope.

### Examples

| Address | Meaning |
|---|---|
| `alice` | A person, within the current community (local context) |
| `alice@riverside` | Alice at the Riverside community |
| `alice@riverside@northeast` | Alice at Riverside, which is a member of the Northeast federation |
| `savings@alice@riverside` | Alice's "savings" account at Riverside |
| `treasury@riverside` | The Riverside community treasury account |
| `woodworkers@riverside` | The Woodworkers association at Riverside |
| `riverside@northeast` | The Riverside community within the Northeast federation |

---

## Handle rules

- Lowercase alphanumeric and underscores only: `[a-z0-9_]+`
- Unique within their scope (see below)
- Immutable once assigned (changing a handle breaks existing addresses)

---

## Scopes and uniqueness

Each level has its own handle namespace. Within a community, all person, association, and organization handles share a single namespace — no two entities of any type can have the same handle.

| Entity | Handle scope | Examples |
|---|---|---|
| Person | Community-wide (shared) | `alice`, `bob` |
| Association | Community-wide (shared) | `woodworkers`, `first_baptist` |
| Organization | Community-wide (shared) | `kitchen`, `clinic` |
| Community | Federation-wide | `riverside`, `oakville` |
| Federation | Global (self-assigned) | `northeast`, `pacific` |
| Bank account | Per owner | `savings`, `household` |

Institutional accounts (treasury, social insurance fund, etc.) are owned by their respective domains and follow the same per-owner uniqueness rule.

---

## Bank account resolution

A bank account address has an optional account segment prepended to a person (or institution) address.

**Primary account shorthand:** Every owner designates one account as primary (`primary = true`). When no account handle is given, the address resolves to that account.

```
alice@riverside          →  alice's primary account at Riverside
savings@alice@riverside  →  alice's account with handle "savings" at Riverside
treasury@riverside       →  the community treasury's primary account
```

Multiple accounts per owner are supported. Account handles must be unique per owner but not community-wide — both alice and bob can have a `savings` account.

---

## Cross-community transfers

When a sender addresses a recipient at another community, the local community server:

1. Parses the address to extract the community handle
2. Resolves the community handle to a URL via the federation member list
3. Forwards the transfer as a signed inter-node message to the destination community
4. The destination community resolves the person handle and credits the account atomically

The raw bank account UUID is never exposed to the sender. Handle resolution happens server-side.

---

## Local context

Within a single community's UI, the community segment can be omitted. `alice` and `savings@alice` are valid local addresses. Fully-qualified addresses are required for cross-community operations.

---

## What `@` is not

`@` is not a prefix. There is no `@alice` — the handle is `alice` and the `@` only appears when separating levels. This avoids conflating the separator with a social mention convention.
