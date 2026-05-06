<script lang="ts">
    import {
        getConstitution, getAuthorities, listVoteRules,
    } from "../lib/api.js";
    import type { GoverningDocumentDto, DocumentParameter, DocumentSection, AuthorityDto, VoteRule } from "../lib/api.js";
    import { currentPage, session, selectedSection } from "../lib/session.js";
    import { formatDate } from "../lib/utils.js";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";
    import VoteRuleBadge from "../components/VoteRuleBadge.svelte";
    import VoteRuleDetails from "../components/VoteRuleDetails.svelte";

    let doc: GoverningDocumentDto | null = $state(null);
    let authorities: AuthorityDto[] = $state([]);
    let voteRules: VoteRule[] = $state([]);
    let loading = $state(true);
    let error = $state("");

    const isSteward = $derived($session?.isSteward ?? false);

    $effect(() => {
        Promise.all([getConstitution(), getAuthorities(), listVoteRules()])
            .then(([d, a, r]) => { doc = d; authorities = a; voteRules = r; })
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load constitution"; })
            .finally(() => { loading = false; });
    });

    // ── Helpers ───────────────────────────────────────────────────────────────

    function isRateParam(p: DocumentParameter): boolean {
        if (typeof p.value !== "number") return false;
        return p.value > 0 && p.value < 1 && (p.constraints?.max ?? 2) <= 1;
    }

    function fmtParam(key: string, params: Record<string, DocumentParameter>): string {
        const p = params[key];
        if (!p) return `{${key}}`;
        const v = p.value;
        if (typeof v === "boolean") return v ? "guaranteed" : "disabled";
        if (isRateParam(p)) {
            const pct = v * 100;
            return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
        }
        return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }

    type Segment = { type: "text"; content: string } | { type: "param"; key: string };

    function parseBody(body: string): Segment[] {
        const segments: Segment[] = [];
        const parts = body.split(/\{([^}]+)\}/g);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                if (parts[i]) segments.push({ type: "text", content: parts[i] });
            } else {
                segments.push({ type: "param", key: parts[i] });
            }
        }
        return segments;
    }

    function openSection(section: DocumentSection) {
        if (!doc) return;
        selectedSection.set({
            docId:     "constitution",
            docTitle:  `Constitution`,
            backPage:  "constitution",
            sectionId: section.id,
        });
        currentPage.go("section");
    }
</script>

<div class="constitution-page doc-viewer">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("documents")}>‹ Documents</button>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="state-msg error">{error}</div>
    {:else if doc}

        <!-- Document header -->
        <div class="doc-header">
            <div class="doc-meta-row">
                <span class="doc-meta-label">Version {doc.version}</span>
                <span class="doc-meta-sep">·</span>
                <span class="doc-meta-label">Adopted {formatDate(doc.adoptedAt)}</span>
                {#if (doc.amendments?.length ?? 0) > 0}
                    <span class="doc-meta-sep">·</span>
                    <span class="doc-meta-label">{doc.amendments!.length} amendment{doc.amendments!.length !== 1 ? "s" : ""}</span>
                {/if}
            </div>
            <h1 class="doc-title">{doc.title}</h1>
            <div class="doc-governance">
                <div class="doc-governance-top">
                    <span class="meta-label">Governed &amp; amended by</span>
                    <AuthorityBadge authorityId={doc.authorityId} {authorities} />
                </div>
                <VoteRuleDetails ruleId={doc.voteRuleId} rules={voteRules} />
            </div>
        </div>

        <!-- Articles -->
        {#each (doc.articles ?? []) as article}
            <section class="article">
                <h2 class="article-heading">
                    <span class="article-number">Article {article.number}</span>
                    {article.title}
                </h2>
                {#if article.preamble}
                    <p class="article-preamble">{article.preamble}</p>
                {/if}

                <div class="section-list">
                    {#each article.sections as section}
                        <button class="section-btn" onclick={() => openSection(section)}>
                            <div class="section-btn-top">
                                <span class="section-btn-id">§ {section.id}</span>
                                {#if section.title}
                                    <span class="section-btn-title">{section.title}</span>
                                {/if}
                            </div>
                            <p class="section-btn-snippet">
                                {#each parseBody(section.body) as seg}
                                    {#if seg.type === "text"}{seg.content}{:else}<span class="snippet-param">{fmtParam(seg.key, doc.parameters ?? {})}</span>{/if}
                                {/each}
                            </p>
                        </button>
                    {/each}
                </div>
            </section>
        {/each}

        <!-- Amendment history -->
        {#if (doc.amendments?.length ?? 0) > 0}
            <section class="article">
                <h2 class="article-heading">
                    <span class="article-number">History</span>
                    Amendments
                </h2>
                <div class="amendment-list">
                    {#each doc.amendments! as a}
                        <div class="amendment-row">
                            <span class="amend-version">v{a.version}</span>
                            <span class="amend-key">{a.parameter}</span>
                            <span class="amend-change">{a.oldValue} → {a.newValue}</span>
                            <span class="amend-date">{formatDate(a.amendedAt)}</span>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

    {/if}
</div>

<style>
    .constitution-page {
        padding: 1.5rem 1.25rem 6rem;
        max-width: 680px;
        margin: 0 auto;
    }

    .page-header { margin-bottom: 1.5rem; }

    .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #15803d;
        padding: 0;
    }

    .state-msg {
        color: #64748b;
        font-size: 0.9rem;
        margin-top: 2rem;
        text-align: center;
    }
    .state-msg.error { color: #dc2626; }

    /* ── Document header ──────────────────────────────────────────────── */

    .doc-header {
        margin-bottom: 2.5rem;
        border-bottom: 2px solid #15803d;
        padding-bottom: 1.25rem;
    }

    /* .doc-meta-row / .doc-meta-sep — shared in app.css under .doc-viewer */

    .doc-meta-label {
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .doc-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.3;
        margin: 0;
    }

    .doc-governance {
        margin-top:    0.85rem;
        padding:       0.65rem 0.85rem;
        border-radius: 8px;
        border:        1px solid #e2e8f0;
        background:    #f8fafc;
        display:       flex;
        flex-direction: column;
        gap:           0.45rem;
    }

    .doc-governance-top {
        display:     flex;
        align-items: center;
        gap:         0.4rem;
    }

    .meta-label {
        font-size:      0.68rem;
        font-weight:    700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color:          #94a3b8;
    }

    /* ── Articles ─────────────────────────────────────────────────────── */

    .article {
        margin-bottom: 2.5rem;
    }

    .article-heading {
        font-size: 1rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .article-number {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #15803d;
    }

    .article-preamble {
        font-size: 0.875rem;
        color: #475569;
        line-height: 1.65;
        margin: 0 0 1rem;
        font-style: italic;
        border-left: 3px solid #bbf7d0;
        padding-left: 0.75rem;
    }

    /* ── Sections as buttons ──────────────────────────────────────────── */

    .section-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .section-btn {
        display: block;
        width: 100%;
        text-align: left;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: border-color 0.12s, box-shadow 0.12s;
    }
    .section-btn:hover {
        border-color: #86efac;
        box-shadow: 0 1px 4px rgba(21, 128, 61, 0.07);
    }

    .section-btn-top {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.3rem;
    }

    .section-btn-id {
        font-size: 0.7rem;
        font-weight: 700;
        color: #15803d;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        flex-shrink: 0;
    }

    .section-btn-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #0f172a;
    }

    .section-badge {
        font-size: 0.65rem;
        font-weight: 600;
        padding: 0.1rem 0.45rem;
        border-radius: 999px;
        margin-left: auto;
    }
    .badge-expired { background: #fee2e2; color: #b91c1c; }
    .badge-sunset  { background: #fef3c7; color: #b45309; }

    .section-btn-snippet {
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.5;
        margin: 0;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .snippet-param {
        color: #15803d;
        font-weight: 600;
    }

    /* ── Authority section ────────────────────────────────────────────── */

    .authority-section { border-top: 1px solid #e2e8f0; padding-top: 1.5rem; }

    .action-grid {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    @media (min-width: 520px) {
        .action-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.6rem;
        }
    }

    .action-row {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
    }

    .action-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
    }

    .action-name {
        font-size: 0.78rem;
        font-weight: 600;
        color: #0f172a;
        font-family: monospace;
    }

    .action-desc {
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.4;
        margin: 0;
    }

    /* ── Amendments ───────────────────────────────────────────────────── */

    .amendment-list {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .amendment-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        font-size: 0.8rem;
        padding: 0.4rem 0;
        border-bottom: 1px solid #f1f5f9;
        flex-wrap: wrap;
    }

    .amend-version {
        font-weight: 700;
        color: #15803d;
        min-width: 2rem;
    }

    .amend-key {
        font-family: monospace;
        color: #0f172a;
        font-size: 0.78rem;
    }

    .amend-change { color: #475569; }
    .amend-date   { color: #94a3b8; margin-left: auto; }
</style>
