<script lang="ts">
    import { getConstitution, listBylaws, deleteBylaw, getCharter, getAuthorities } from "../lib/api.js";
    import type { GoverningDocumentDto, AuthorityDto } from "../lib/api.js";
    import { currentPage, session, selectedBylawId } from "../lib/session.js";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";

    const isSteward = $derived($session?.isSteward ?? false);

    let constitution: GoverningDocumentDto | null = $state(null);
    let charter: GoverningDocumentDto | null = $state(null);
    let bylaws: GoverningDocumentDto[] = $state([]);
    let authorities: AuthorityDto[] = $state([]);
    let loading = $state(true);
    let error   = $state("");

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

    async function handleDelete(bylaw: GoverningDocumentDto, e: MouseEvent) {
        e.stopPropagation();
        if (!confirm(`Delete "${bylaw.title}"? This cannot be undone.`)) return;
        try {
            await deleteBylaw(bylaw.id);
            bylaws = bylaws.filter(b => b.id !== bylaw.id);
        } catch { /* ignore */ }
    }

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

    function expiryStatus(bylaw: GoverningDocumentDto): "expired" | "soon" | "none" {
        if (!bylaw.expiresAt) return "none";
        const now      = Date.now();
        const expiry   = new Date(bylaw.expiresAt).getTime();
        if (expiry <= now)                              return "expired";
        if (expiry - now <= 90 * 24 * 3600 * 1000)    return "soon";
        return "none";
    }

    function expiryLabel(bylaw: GoverningDocumentDto): string {
        if (!bylaw.expiresAt) return "";
        return `Expires ${formatDate(bylaw.expiresAt)}`;
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

        <!-- Charter card -->
        {#if charter}
            <div class="section-label">Charter</div>
            <button class="doc-card" onclick={openCharter}>
                <div class="doc-card-body">
                    <div class="doc-title">{charter.title}</div>
                    <div class="doc-meta">
                        Adopted {formatDate(charter.adoptedAt)}
                        · {charter.articles.length} article{charter.articles.length !== 1 ? "s" : ""}
                    </div>
                </div>
                <span class="doc-arrow">›</span>
            </button>
        {/if}

        <!-- Constitution card -->
        {#if constitution}
            <div class="section-label">Constitution</div>
            <button class="doc-card" onclick={openConstitution}>
                <div class="doc-card-body">
                    <div class="doc-title">{constitution.title}</div>
                    <div class="doc-meta">
                        Version {constitution.version} · Adopted {formatDate(constitution.adoptedAt)}
                        {#if (constitution.amendments?.length ?? 0) > 0}
                            · {constitution.amendments!.length} amendment{constitution.amendments!.length !== 1 ? "s" : ""}
                        {/if}
                    </div>
                    {#if constitution.articles.length > 0}
                        <div class="doc-toc">{constitution.articles.length} article{constitution.articles.length !== 1 ? "s" : ""}</div>
                    {/if}
                    <div class="doc-authority"><AuthorityBadge authorityId={constitution.authorityId} {authorities} /></div>
                </div>
                <span class="doc-arrow">›</span>
            </button>
        {/if}

        <!-- Bylaws -->
        <div class="section-label" style="margin-top: 1.5rem">
            Bylaws
            {#if bylaws.length > 0}
                <span class="section-count">{bylaws.length}</span>
            {/if}
        </div>

        {#if bylaws.length === 0}
            <div class="empty-state">No bylaws have been adopted yet.</div>
        {:else}
            <ul class="doc-list">
                {#each bylaws as bylaw (bylaw.id)}
                    <li class="doc-card" onclick={() => openBylaw(bylaw)}>
                        <div class="doc-card-body">
                            <div class="doc-title">{bylaw.title}</div>
                            <div class="doc-meta">
                                Version {bylaw.version} · Adopted {formatDate(bylaw.adoptedAt)}
                                {#if bylaw.domainId}
                                    · <span class="domain-tag">{bylaw.domainId}</span>
                                {/if}
                            </div>
                            {#if bylaw.expiresAt}
                                <div class="expiry-badge expiry-{expiryStatus(bylaw)}">
                                    {expiryStatus(bylaw) === "expired" ? "⚠ Expired" : "⏳"} {expiryLabel(bylaw)}
                                </div>
                            {/if}
                            {#if bylaw.articles.length > 0}
                                <div class="doc-toc">{bylaw.articles.length} article{bylaw.articles.length !== 1 ? "s" : ""}</div>
                            {:else}
                                <div class="doc-toc empty">No articles yet</div>
                            {/if}
                            <div class="doc-authority"><AuthorityBadge authorityId={bylaw.authorityId} {authorities} /></div>
                        </div>
                        <div class="doc-card-actions">
                            {#if isSteward}
                                <button class="delete-btn" title="Delete bylaw" onclick={(e) => handleDelete(bylaw, e)}>✕</button>
                            {/if}
                            <span class="doc-arrow">›</span>
                        </div>
                    </li>
                {/each}
            </ul>
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
        margin-bottom: 1.25rem;
    }

    .page-title { margin: 0; font-size: 1.2rem; font-weight: 700; color: #0f172a; }

    .section-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .section-count {
        background: #e2e8f0;
        color: #475569;
        border-radius: 999px;
        padding: 0 0.45rem;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }

    .doc-card {
        display: flex;
        align-items: center;
        width: 100%;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 1rem 1.1rem;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, box-shadow 0.15s;
        margin-bottom: 0.5rem;
        gap: 0.75rem;
    }

    .doc-card:hover { border-color: #86efac; box-shadow: 0 0 0 3px #dcfce7; }

    .doc-card-body { flex: 1; min-width: 0; }

    .doc-title { font-size: 1rem; font-weight: 600; color: #0f172a; margin-bottom: 0.2rem; }
    .doc-meta  { font-size: 0.8rem; color: #64748b; margin-bottom: 0.2rem; }
    .doc-toc   { font-size: 0.78rem; color: #94a3b8; }
    .doc-toc.empty { font-style: italic; }
    .doc-toc.authority-tag { color: #2b6cb0; }
    .doc-authority { font-size: 0.78rem; color: #94a3b8; margin-top: 0.2rem; }
    .domain-tag { font-style: italic; }

    .expiry-badge {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 600;
        border-radius: 4px;
        padding: 0.1rem 0.45rem;
        margin: 0.2rem 0 0.15rem;
    }
    .expiry-badge.expiry-expired {
        background: #fee2e2;
        color: #b91c1c;
    }
    .expiry-badge.expiry-soon {
        background: #fef3c7;
        color: #b45309;
    }

    .doc-card-actions { display: flex; align-items: center; gap: 0.4rem; }

    .doc-arrow { font-size: 1.3rem; color: #94a3b8; flex-shrink: 0; }

    .delete-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #f87171;
        font-size: 0.85rem;
        padding: 0.25rem 0.4rem;
        border-radius: 6px;
        opacity: 0;
        transition: opacity 0.1s, background 0.1s;
    }
    .doc-card:hover .delete-btn { opacity: 1; }
    .delete-btn:hover { background: #fef2f2; }

    .empty-state { padding: 3rem 0; text-align: center; color: #94a3b8; font-size: 0.9rem; }
    .state-msg   { padding: 3rem 0; text-align: center; color: #94a3b8; }
    .error-banner { background: #fee; border: 1px solid #fcc; border-radius: 10px; padding: 0.75rem 1rem; color: #c00; }
</style>
