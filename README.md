# Benjamin Franklin Society

Software for communities that have decided to build their own institutions.

![Screenshot](docs/images/screenshot1.png)

## The idea

Something has gone wrong with the institutions Americans were supposed to be able to rely on. The details are different depending on who you ask, but the feeling is the same: the systems that were supposed to work for ordinary people mostly don't. Communities can wait for those institutions to fix themselves, or they can start building something they actually control.

A Benjamin Franklin Society is a community that has decided to do the latter: its own governance, its own way for members to look after each other, its own social fabric.

This software is the organizational tool. It gives a community everything it needs to get started: a ledger members use to track exchanges, a market, a mail system, and a shared budget — run by the members, not a corporation or a government. Members extend credit to each other, backed by their commitment to meet each other's needs. The credit supply is anchored to one thing: the number of people in the community. More members, more credit. No interest. No outside lender.

Societies can federate with each other — joining together so that trade can flow across a wider circle. Each society governs itself. A federation only has the authority its member societies choose to give it.

The society is named for Benjamin Franklin, who in 1727 organized the Junto — a club for Philadelphia tradespeople that gave rise to the first public library, the first volunteer fire department, and a hospital. Franklin understood that civic infrastructure doesn't come from governments; it comes from neighbors who decide to build it.

## This is for the United States

The default bylaws, governance structures, and legal assumptions are designed for American communities. That's a deliberate choice — trying to build for every culture at once usually produces something that works well for none of them. The software is open source; communities in other countries are welcome to fork it and adapt it to their own traditions and legal contexts.

## Principles

**Members look after each other — the young, the old, the sick, the person between jobs. That's what a community is.**
An economy that only values people for what they produce has already failed most of them.

**An organization exists to meet people's needs. If it doesn't do that, what's the point.**
Not to grow. Not to attract investment. Not to balance a budget. The only measure that matters is whether people are fed, housed, cared for, and able to live with dignity. Everything else is bookkeeping.

## Inspirations

**Benjamin Franklin's Junto (1727)** — A club for Philadelphia tradespeople that ran for 38 years and seeded nearly every major civic institution Franklin is credited with founding. Members pooled books, shared knowledge, and worked on civic problems together. Small, committed, local — with a clear enough character that it attracted the right people.

**The grange movement** — Farmers' organizations founded in the 1860s that ran co-ops, mutual insurance, and political advocacy for rural communities. At their peak, the granges were the main civic institution in much of rural America. They worked because membership was real: you showed up, you had responsibilities, and the organization was accountable to you.

**Credit unions** — Member-owned financial cooperatives, founded on the principle that people should be able to borrow from each other rather than from a bank. Still operating in nearly every county in America.

**Great Depression-era fraternal lodges** — Community organizations that ran their own insurance, healthcare, and unemployment support through member dues and solidarity. They collapsed not from failure but because the New Deal nationalized their function.

**Argentinian creditos** — When the peso collapsed in 2001 and the government froze bank accounts, millions of Argentinians turned to community exchange clubs that issued their own scrip, backed by the labor and goods members brought to market. At the peak, an estimated six million people were participating. It worked because it was simple, local, and trusted.

**M-Pesa** — Mobile money in Kenya, built on the insight that most people don't need a bank — they need a way to store and send value using the device they already have. It worked because it met people where they were, required no existing financial infrastructure, and spread through social trust networks.

## Contributing

Every change to this project — code, documentation, governance design — should be able to answer yes to at least one of these questions, and no to none of them:

**Does it make the system more pragmatic?** Does it solve a real problem that real communities face, in the simplest way that actually works? If it's clever but fragile, or theoretically correct but hard to use, it's probably not the right direction.

**Does it make the system more resilient?** Can communities keep functioning if a piece fails — a server goes down, a federation disappears, the internet is slow? Complexity that creates single points of failure works against this.

**Does it make the system more cooperative?** Does it make it easier for members to work together, for communities to trust each other, for the whole to be worth more than the sum of its parts? Features that concentrate power or create dependency work against this.

A change that makes the system more efficient but less resilient is probably the wrong trade. A change that adds capability but makes cooperation harder is probably the wrong trade. When in doubt, do less and do it well.

## What's in the repo

### Community node

- `packages/community` — the core community node: member registry, governance (pools, motions, assembly), census, and the shell that ties everything together
- `packages/bank` — the internal currency ledger: accounts, transactions, demurrage scheduling, and the credit issuance rules
- `packages/market` — goods and labour exchange: listings, offers, and fulfillment
- `packages/mail` — internal messaging between members and between nodes
- `packages/atheneum` — class coordination: scheduling, enrollment, and facilitation for community-run classes and skill-sharing
- `packages/grange` — the farming system: farm associations, needs projections, annual food contracts, practice inspections, and settlement

### Network layers

- `packages/federation` — federates communities; runs a clearing house for inter-community trade
- `packages/commonwealth` — federates federations
- `packages/globe` — the top-level network layer

### Shared

- `packages/core` — shared identity, cryptography, and networking primitives

## Documentation

- [Architecture](architecture.md)
- [Banking layer](banking-layer.md)
- [Messaging layer](messaging-layer.md)
- [Governance layer](governance-layer.md)
- [Network layer](network-layer.md)
- [Clearing layers](clearing-layers.md)
- [Farming system](docs/farming-system.md)
- [Addressing](docs/addressing.md)
- [Legal structure](docs/legal-structure.md)
- [Charter](docs/charter.md)
