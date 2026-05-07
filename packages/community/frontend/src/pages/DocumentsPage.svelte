<script lang="ts">
    import { getConstitution, listBylaws, getCharter, getAuthorities } from "../lib/api.js";
    import type { GoverningDocumentDto, AuthorityDto } from "../lib/api.js";
    import { currentPage, session, selectedBylawId } from "../lib/session.js";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";

    let constitution: GoverningDocumentDto | null = $state(null);
    let charter: GoverningDocumentDto | null = $state(null);
    let bylaws: GoverningDocumentDto[] = $state([]);
    let authorities: AuthorityDto[] = $state([]);
    let loading = $state(true);
    let error   = $state("");

    let searchQuery  = $state("");
    let filterType   = $state("");
    let filterOwner  = $state("");

    async function load() {
        loading = true; error = "";
        try {
            [constitution, charter, bylaws, authorities] = await Promise.all([
                getConstitution(), getCharter(), listBylaws(), getAuthorities(),
            ]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load documents";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    function openCharter() {
        currentPage.go("charter");
    }

    function openConstitution() {
        currentPage.go("constitution");
    }

    function openBylaw(bylaw: GoverningDocumentDto) {
        selectedBylawId.set(bylaw.id);
        currentPage.go("bylaw");
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }

    function expiryStatus(doc: GoverningDocumentDto): "expired" | "soon" | "none" {
        if (!doc.expiresAt) return "none";
        const now    = Date.now();
        const expiry = new Date(doc.expiresAt).getTime();
        if (expiry <= now)                           return "expired";
        if (expiry - now <= 90 * 24 * 3600 * 1000)  return "soon";
        return "none";
    }

    function expiryLabel(doc: GoverningDocumentDto): string {
        if (!doc.expiresAt) return "";
        return `Expires ${formatDate(doc.expiresAt)}`;
    }

    function authorityName(id: string): string {
        return authorities.find(a => a.id === id)?.name ?? id;
    }

    function kindLabel(doc: GoverningDocumentDto): string {
        return doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
    }

    const allDocs = $derived.by(() => {
        const docs = [
            ...(charter      ? [{ doc: charter,      action: openCharter }]      : []),
            ...(constitution ? [{ doc: constitution,  action: openConstitution }] : []),
            ...bylaws.map(b  => ({ doc: b,            action: () => openBylaw(b) })),
        ];

        const q = searchQuery.trim().toLowerCase();
        return docs.filter(({ doc }) => {
            if (filterType  && doc.type        !== filterType)  return false;
            if (filterOwner && doc.authorityId !== filterOwner) return false;
            if (q && !doc.title.toLowerCase().includes(q))      return false;
            return true;
        });
    });

    const typeOptions = $derived.by(() => {
        const types = new Set([
            ...(charter      ? [charter.type]      : []),
            ...(constitution ? [constitution.type]  : []),
            ...bylaws.map(b => b.type),
        ]);
        return [...types].sort();
    });

    const ownerOptions = $derived.by(() => {
        const ids = new Set([
            ...(charter      ? [charter.authorityId]      : []),
            ...(constitution ? [constitution.authorityId]  : []),
            ...bylaws.map(b => b.authorityId),
        ]);
        return [...ids].sort((a, b) => authorityName(a).localeCompare(authorityName(b)));
    });

    const hasActiveFilters = $derived(searchQuery.trim() !== "" || filterType !== "" || filterOwner !== "");

    function clearFilters() {
        searchQuery = "";
        filterType  = "";
        filterOwner = "";
    }
</script>

<div class="docs-page">
    <div class="page-header">
        <h2 class="page-title">Governing Documents</h2>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="error-banner">{error}</div>
    {:else}
        <div class="toolbar">
            <div class="search-wrap">
                <span class="search-icon">⌕</span>
                <input
                    class="search-input"
                    type="search"
                    placeholder="Search documents…"
                    bind:value={searchQuery}
                />
            </div>
            <div class="filter-row">
                <select class="filter-select" bind:value={filterType}>
                    <option value="">All types</option>
                    {#each typeOptions as t}
                        <option value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    {/each}
                </select>
                <select class="filter-select" bind:value={filterOwner}>
                    <option value="">All owners</option>
                    {#each ownerOptions as id}
                        <option value={id}>{authorityName(id)}</option>
                    {/each}
                </select>
                {#if hasActiveFilters}
                    <button class="clear-btn" onclick={clearFilters}>Clear</button>
                {/if}
            </div>
        </div>

        <ul class="doc-list">
            {#each allDocs as { doc, action } (doc.id)}
                <li>
                    <button class="doc-card" onclick={action}>
                        <div class="doc-card-body">
                            <div class="doc-title-row">
                                <span class="doc-kind">{kindLabel(doc)}</span>
                                <span class="doc-title">{doc.title}</span>
                            </div>
                            <div class="doc-meta">
                                {authorityName(doc.authorityId)} · v{doc.version} · {formatDate(doc.adoptedAt)}{doc.expiresAt ? ` · ${expiryStatus(doc) === "expired" ? "⚠ expired" : "⏳ " + expiryLabel(doc)}` : ""}
                            </div>
                        </div>
                        <span class="doc-arrow">›</span>
                    </button>
                </li>
            {/each}
        </ul>
        {#if allDocs.length === 0}
            <div class="empty-state">
                {hasActiveFilters ? "No documents match your filters." : "No governing documents yet."}
            </div>
        {/if}
    {/if}
</div>

<style>
    .docs-page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
    }

    @media (min-width: 768px) {
        .docs-page { padding-bottom: 2rem; }
    }

    .page-header {
        margin-bottom: 0.75rem;
    }

    .page-title { margin: 0; font-size: 1.2rem; font-weight: 700; color: #0f172a; }

    .toolbar { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }

    .search-wrap {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: 0.65rem;
        font-size: 1.05rem;
        color: #94a3b8;
        pointer-events: none;
        line-height: 1;
    }

    .search-input {
        width: 100%;
        padding: 0.5rem 0.75rem 0.5rem 2rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.88rem;
        color: #0f172a;
        background: #fff;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .search-input:focus { border-color: #86efac; box-shadow: 0 0 0 3px #dcfce7; }

    .filter-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

    .filter-select {
        flex: 1;
        min-width: 120px;
        padding: 0.4rem 0.6rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.82rem;
        color: #334155;
        background: #fff;
        outline: none;
        cursor: pointer;
        transition: border-color 0.15s, box-shadow 0.15s;
    }

    .filter-select:focus { border-color: #86efac; box-shadow: 0 0 0 3px #dcfce7; }

    .clear-btn {
        padding: 0.4rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 0.82rem;
        color: #64748b;
        background: #f8fafc;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
    }

    .clear-btn:hover { background: #f1f5f9; }

    .doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }

    .doc-card {
        display: flex;
        align-items: center;
        width: 100%;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.6rem 0.9rem;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, box-shadow 0.15s;
        margin-bottom: 0.35rem;
        gap: 0.75rem;
    }

    .doc-card:hover { border-color: #86efac; box-shadow: 0 0 0 3px #dcfce7; }

    .doc-card-body { flex: 1; min-width: 0; }

    .doc-title-row { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.1rem; }

    .doc-kind {
        flex-shrink: 0;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
    }

    .doc-title { font-size: 0.92rem; font-weight: 600; color: #0f172a; line-height: 1.2; }
    .doc-meta  { font-size: 0.76rem; color: #94a3b8; }

    .doc-arrow { font-size: 1.2rem; color: #cbd5e1; flex-shrink: 0; }

    .empty-state { padding: 3rem 0; text-align: center; color: #94a3b8; font-size: 0.9rem; }
    .state-msg   { padding: 3rem 0; text-align: center; color: #94a3b8; }
    .error-banner { background: #fee; border: 1px solid #fcc; border-radius: 10px; padding: 0.75rem 1rem; color: #c00; }
</style>
