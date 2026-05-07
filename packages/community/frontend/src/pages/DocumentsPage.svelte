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
        {@const allDocs = [
            ...(charter      ? [{ doc: charter,      kind: "Charter",      action: openCharter }]      : []),
            ...(constitution ? [{ doc: constitution,  kind: "Constitution", action: openConstitution }] : []),
            ...bylaws.map(b  => ({ doc: b,            kind: b.type.charAt(0).toUpperCase() + b.type.slice(1), action: () => openBylaw(b) })),
        ]}
        <ul class="doc-list">
            {#each allDocs as { doc, kind, action } (doc.id)}
                <li>
                    <button class="doc-card" onclick={action}>
                        <div class="doc-card-body">
                            <div class="doc-title-row">
                                <span class="doc-kind">{kind}</span>
                                <span class="doc-title">{doc.title}</span>
                            </div>
                            <div class="doc-meta">
                                v{doc.version} · {formatDate(doc.adoptedAt)}{doc.expiresAt ? ` · ${expiryStatus(doc) === "expired" ? "⚠ expired" : "⏳ " + expiryLabel(doc)}` : ""}
                            </div>
                        </div>
                        <span class="doc-arrow">›</span>
                    </button>
                </li>
            {/each}
        </ul>
        {#if allDocs.length === 0}
            <div class="empty-state">No governing documents yet.</div>
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
