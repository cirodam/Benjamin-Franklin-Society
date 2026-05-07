<script lang="ts">
    import { listAssociations, createMotion, submitMotionForDeliberation } from "../lib/api.js";
    import type { AssociationDto } from "../lib/api.js";
    import { currentPage, selectedAssociationId, selectedMotionId } from "../lib/session.js";
    import EffectPayloadForm from "../components/EffectPayloadForm.svelte";

    let associations: AssociationDto[] = $state([]);
    let loading = $state(true);
    let error   = $state("");

    const PAGE_SIZE = 20;
    let search = $state("");
    let page   = $state(1);

    // Propose-creation motion form
    let showPropose    = $state(false);
    let proposeTitle   = $state("");
    let proposeDesc    = $state("");
    let minApprovals   = $state("4");
    let proposing      = $state(false);
    let proposeError   = $state("");
    let proposePayload = $state<Record<string, unknown>>({});

    async function load() {
        loading = true;
        error = "";
        try {
            associations = (await listAssociations()).sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    const filtered = $derived(
        search.trim()
            ? associations.filter(a =>
                a.name.toLowerCase().includes(search.toLowerCase()) ||
                a.handle.toLowerCase().includes(search.toLowerCase()) ||
                (a.description ?? "").toLowerCase().includes(search.toLowerCase())
              )
            : associations
    );
    const pages   = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const visible = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

    function goPage(p: number) {
        page = Math.max(1, Math.min(p, pages));
    }

    async function submitProposal() {
        proposeError = "";
        if (!proposeTitle.trim() || !proposeDesc.trim()) {
            proposeError = "Title and rationale are required."; return;
        }
        if (!proposePayload.name || !proposePayload.handle) {
            proposeError = "Association name and handle are required."; return;
        }
        const count = parseInt(minApprovals, 10);
        if (!count || count < 1) {
            proposeError = "Enter a required approval count."; return;
        }
        proposing = true;
        try {
            const m = await createMotion({
                authorityId: "referendum",
                title:       proposeTitle.trim(),
                description: proposeDesc.trim(),
                kind:        "create-association",
                payload:     proposePayload,
            });
            await submitMotionForDeliberation(m.id, "petition", count);
            showPropose = false;
            proposeTitle = ""; proposeDesc = ""; proposePayload = {}; minApprovals = "4";
            selectedMotionId.set(m.id);
            currentPage.go("motion");
        } catch (e) {
            proposeError = e instanceof Error ? e.message : "Failed to propose";
        } finally {
            proposing = false;
        }
    }

    function open(id: string) {
        selectedAssociationId.set(id);
        currentPage.go("association");
    }
</script>

<div class="page">
    <div class="page-header">
        <div>
            <h2 class="page-title">Associations</h2>
            <p class="page-subtitle">Businesses, churches, cooperatives, and clubs within this community.</p>
        </div>
        <button class="new-btn" onclick={() => { showPropose = !showPropose; proposeError = ""; }}>
            {showPropose ? "✕" : "＋ Propose"}
        </button>
    </div>

    <div class="search-row">
        <input
            class="search-input"
            type="search"
            placeholder="Search by name, handle, or description…"
            bind:value={search}
            oninput={() => { page = 1; }}
        />
    </div>

    {#if showPropose}
        <form class="create-form" onsubmit={(e) => { e.preventDefault(); submitProposal(); }}>
            <h3 class="form-title">Propose a new association</h3>
            <p class="form-hint">This will create a motion for the Community Assembly to approve.</p>

            <div class="field">
                <label for="p-title">Motion title</label>
                <input id="p-title" type="text" bind:value={proposeTitle} placeholder="e.g. Create First Baptist Church association" />
            </div>

            <div class="field">
                <label for="p-desc">Rationale</label>
                <textarea id="p-desc" bind:value={proposeDesc} rows="2" placeholder="Why should this association be created?"></textarea>
            </div>

            <div class="field">
                <label for="p-approvals">Approvals required to pass</label>
                <input id="p-approvals" type="number" min="1" bind:value={minApprovals} placeholder="e.g. 4" />
                <span class="field-sub">Motion passes as a petition once this many members approve it.</span>
            </div>

            <div class="field">
                <p class="section-label">Association details</p>
                <EffectPayloadForm kind="create-association" bind:payload={proposePayload} />
            </div>

            {#if proposeError}
                <p class="form-error">{proposeError}</p>
            {/if}

            <button class="submit-btn" type="submit" disabled={proposing}>
                {proposing ? "Submitting…" : "Submit motion"}
            </button>
        </form>
    {/if}

    {#if loading && associations.length === 0}
        <div class="skeleton"></div>
        <div class="skeleton short"></div>
        <div class="skeleton"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if associations.length === 0}
        <div class="empty-msg">No associations yet. Propose one above to start the process.</div>
    {:else if filtered.length === 0}
        <div class="empty-msg">No associations match your search.</div>
    {:else}
        <div class="list">
            {#each visible as a (a.id)}
                <button class="card" onclick={() => open(a.id)}>
                    <div class="card-left">
                        <div class="avatar">{a.name[0]}</div>
                        <div class="card-text">
                            <span class="card-name">{a.name}</span>
                            <span class="card-handle">{a.handle}</span>
                            {#if a.description}
                                <span class="card-desc">{a.description}</span>
                            {/if}
                        </div>
                    </div>
                    <div class="card-right">
                        <span class="member-count">{a.memberCount} member{a.memberCount !== 1 ? "s" : ""}</span>
                        <span class="chevron">›</span>
                    </div>
                </button>
            {/each}
        </div>
        {#if pages > 1}
            <div class="pagination">
                <button class="page-btn" onclick={() => goPage(page - 1)} disabled={page <= 1}>‹ Prev</button>
                <span class="page-info">{page} / {pages}</span>
                <button class="page-btn" onclick={() => goPage(page + 1)} disabled={page >= pages}>Next ›</button>
            </div>
        {/if}
        <p class="count">{filtered.length} association{filtered.length !== 1 ? "s" : ""}{search.trim() ? ` matching "${search}"` : ""}</p>
    {/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 560px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
    }

    .page-title { margin-bottom: 0.2rem; }
    .page-subtitle { font-size: 0.82rem; color: #64748b; margin: 0; }

    .new-btn {
        background: #0f172a;
        color: #fff;
        border: none;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
    }

    /* Create form */
    .create-form {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 1.25rem;
        margin-bottom: 1.25rem;
    }
    .form-title { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0 0 0.35rem; }
    .form-hint  { font-size: 0.78rem; color: #64748b; margin: 0 0 1rem; }
    .section-label { display: block; font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; }
    .field-sub  { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }

    .field { margin-bottom: 0.85rem; }
    .field label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        color: #475569;
        margin-bottom: 0.3rem;
    }

    .field input,
    .field textarea {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.6rem 0.85rem;
        font-size: 0.9rem;
        color: #0f172a;
        background: #f8fafc;
        box-sizing: border-box;
        resize: vertical;
    }
    .field input:focus,
    .field textarea:focus {
        outline: none;
        border-color: #94a3b8;
        background: #fff;
    }

    .form-error { font-size: 0.82rem; color: #dc2626; margin: 0 0 0.75rem; }

    .submit-btn {
        width: 100%;
        background: #15803d;
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 0.7rem;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
    }
    .submit-btn:disabled { opacity: 0.5; }

    /* Skeleton */
    .skeleton {
        background: #e2e8f0;
        border-radius: 14px;
        height: 5rem;
        margin-bottom: 0.65rem;
        animation: pulse 1.4s ease-in-out infinite;
    }
    .skeleton.short { height: 3.5rem; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .error-msg, .empty-msg {
        text-align: center;
        color: #94a3b8;
        padding: 3rem 0;
        font-size: 0.9rem;
    }

    /* List */
    .list { display: flex; flex-direction: column; gap: 0.5rem; }

    .card {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 0.9rem 1.1rem;
        cursor: pointer;
        text-align: left;
        transition: box-shadow 0.15s, border-color 0.15s;
    }
    .card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.06); border-color: #cbd5e1; }

    .card-left { display: flex; align-items: center; gap: 0.85rem; min-width: 0; }

    .avatar {
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 10px;
        background: #dbeafe;
        color: #1d4ed8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        font-weight: 700;
        flex-shrink: 0;
        text-transform: uppercase;
    }

    .card-text { display: flex; flex-direction: column; min-width: 0; gap: 0.1rem; }
    .card-name   { font-size: 0.92rem; font-weight: 700; color: #0f172a; }
    .card-handle { font-size: 0.76rem; color: #94a3b8; }
    .card-desc   { font-size: 0.78rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .card-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
    .member-count { font-size: 0.78rem; color: #94a3b8; }
    .chevron { font-size: 1.3rem; color: #cbd5e1; line-height: 1; }

    .search-row {
        margin-bottom: 1rem;
    }
    .search-input {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 0.6rem 0.9rem;
        font-size: 0.88rem;
        color: #0f172a;
        background: #f8fafc;
        box-sizing: border-box;
    }
    .search-input:focus {
        outline: none;
        border-color: #94a3b8;
        background: #fff;
    }

    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        margin-top: 1rem;
    }
    .page-btn {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.35rem 0.75rem;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        color: #0f172a;
    }
    .page-btn:disabled { opacity: 0.35; cursor: default; }
    .page-btn:not(:disabled):hover { background: #e2e8f0; }
    .page-info { font-size: 0.82rem; color: #64748b; }

    .count { text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem; }

    @media (min-width: 768px) {
        .page { padding-bottom: 2rem; }
    }
</style>
