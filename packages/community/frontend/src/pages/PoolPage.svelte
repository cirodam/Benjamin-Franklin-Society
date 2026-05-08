<script lang="ts">
    import { getPool, listPersons, listMotions, createMotion, submitMotionForDeliberation, listMotionEffects, updatePool } from "../lib/api.js";
    import type { PoolDto, PersonDto, MotionDto, MotionOutcome, MotionEffectKind } from "../lib/api.js";
    import { currentPage, selectedPoolId, session, selectedMotionId } from "../lib/session.js";
    import EffectPayloadForm from "../components/EffectPayloadForm.svelte";

    let pool: PoolDto | null     = $state(null);
    let persons: PersonDto[]     = $state([]);
    let motions: MotionDto[]     = $state([]);
    let loading = $state(true);
    let error   = $state("");
    let docketError = $state("");

    let nominating     = $state(false);
    let petitionPersonId  = $state("");
    let petitionApprovals = $state("3");
    let petitionDesc      = $state("");
    let petitionError     = $state("");
    let petitionSaving    = $state(false);

    // Add-to-docket form
    let showAddMotion  = $state(false);
    let addMotionTitle = $state("");
    let addMotionDesc  = $state("");
    let addingMotion   = $state(false);
    let addMotionError = $state("");
    let effectKinds    = $state<MotionEffectKind[]>([]);
    let selectedKind   = $state("");
    let effectPayload  = $state<Record<string, unknown>>({});

    $effect(() => {
        if (showAddMotion && !effectKinds.length) {
            listMotionEffects().then(k => { effectKinds = k; }).catch(() => {});
        }
    });

    async function doAddMotion() {
        if (!poolId || !addMotionTitle.trim() || !addMotionDesc.trim()) return;
        addingMotion = true; addMotionError = "";
        try {
            const m = await createMotion({
                authorityId: `pool:${poolId}`,
                title:       addMotionTitle.trim(),
                description: addMotionDesc.trim(),
                kind:        selectedKind || null,
                payload:     selectedKind ? effectPayload : undefined,
            });
            motions = [...motions, m];
            showAddMotion = false; addMotionTitle = ""; addMotionDesc = "";
            selectedKind = ""; effectPayload = {};
        } catch (e) {
            addMotionError = e instanceof Error ? e.message : "Failed to add motion";
        } finally { addingMotion = false; }
    }

    async function doPetition() {
        if (!petitionPersonId || !pool) return;
        const count = parseInt(petitionApprovals, 10);
        if (!count || count < 1) { petitionError = "Enter a valid approval count."; return; }
        petitionSaving = true; petitionError = "";
        try {
            const person = persons.find(p => p.id === petitionPersonId);
            const m = await createMotion({
                authorityId: "community",
                title:       `Add ${person?.firstName} ${person?.lastName} to ${pool.name}`,
                description: petitionDesc.trim() || `Petition to add @${person?.handle} to the ${pool.name} pool.`,
                kind:        "add-pool-member",
                payload:     { poolId: pool.id, personId: petitionPersonId },
            });
            await submitMotionForDeliberation(m.id, "petition", count);
            selectedMotionId.set(m.id);
            currentPage.go("motion");
        } catch (e) {
            petitionError = e instanceof Error ? e.message : "Failed";
        } finally { petitionSaving = false; }
    }

    const isAdmin = $derived(($session as any)?.isAdmin ?? false);
    const poolId = $derived($selectedPoolId);

    async function load() {
        if (!poolId) { currentPage.go("leadership"); return; }
        loading = true;
        error = "";
        try {
            [pool, persons, motions] = await Promise.all([
                getPool(poolId),
                listPersons(),
                listMotions({ authorityId: `pool:${poolId}` }),
            ]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load pool";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    const activeMotions   = $derived(motions.filter(m => m.stage !== "resolved"));
    const resolvedMotions = $derived(motions.filter(m => m.stage === "resolved"));

    function openMotion(m: MotionDto) {
        selectedMotionId.set(m.id);
        currentPage.go("motion");
    }

    // Mandate editing
    let editingMandate  = $state(false);
    let mandateDraft    = $state("");
    let mandateSaving   = $state(false);
    let mandateError    = $state("");

    async function saveMandate() {
        if (!pool) return;
        mandateSaving = true; mandateError = "";
        try {
            pool = await updatePool(pool.id, { mandate: mandateDraft });
            editingMandate = false;
        } catch (e) {
            mandateError = e instanceof Error ? e.message : "Failed to save mandate";
        } finally { mandateSaving = false; }
    }
</script>

<div class="page">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("leadership")}>‹ Leadership</button>
        {#if pool}
            <h1 class="page-title">{pool.name}</h1>
            {#if pool.description}
                <p class="page-sub">{pool.description}</p>
            {/if}
        {:else if !loading}
            <h1 class="page-title">Pool</h1>
        {/if}
    </div>

    {#if loading}
        {#each [1, 2, 3] as _}
            <div class="skeleton"></div>
        {/each}
    {:else if error}
        <p class="error-msg">{error}</p>
    {:else if pool}
        <!-- Mandate -->
        <div class="mandate-section">
            {#if editingMandate}
                <textarea
                    class="mandate-textarea"
                    rows={4}
                    placeholder="Describe this pool's mandate…"
                    bind:value={mandateDraft}
                    disabled={mandateSaving}
                ></textarea>
                {#if mandateError}<p class="mandate-error">{mandateError}</p>{/if}
                <div class="mandate-actions">
                    <button class="btn-sm btn-primary-sm" onclick={saveMandate} disabled={mandateSaving}>
                        {mandateSaving ? "Saving…" : "Save"}
                    </button>
                    <button class="btn-sm" onclick={() => { editingMandate = false; mandateError = ""; }}>Cancel</button>
                </div>
            {:else}
                <div class="mandate-display">
                    {#if pool.mandate}
                        <p class="mandate-text">{pool.mandate}</p>
                    {:else}
                        <p class="mandate-empty">No mandate set.</p>
                    {/if}
                    {#if isAdmin}
                        <button class="mandate-edit-btn" onclick={() => { mandateDraft = pool!.mandate; editingMandate = true; }}>
                            {pool.mandate ? "Edit mandate" : "Set mandate"}
                        </button>
                    {/if}
                </div>
            {/if}
        </div>

        {#if pool.personHandles.length === 0}
            <p class="empty-msg">No members in this pool yet.</p>
        {:else}
            <div class="member-list">
                {#each pool.personHandles as handle (handle)}
                    <div class="member-card">
                        <span class="member-handle">@{handle}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}

    {#if !loading && !error && isAdmin && pool}
        {#if nominating}
            <div class="nominate-form">
                <select class="nominate-select" bind:value={petitionPersonId}>
                    <option value="">— select person —</option>
                    {#each persons.filter(p => !pool!.personHandles.includes(p.handle)) as p (p.id)}
                        <option value={p.id}>{p.firstName} {p.lastName} (@{p.handle})</option>
                    {/each}
                </select>
                <input class="nominate-input" type="number" min="1" placeholder="Approvals needed (e.g. 3)" bind:value={petitionApprovals} />
                <input class="nominate-input" placeholder="Rationale (optional)" bind:value={petitionDesc} />
                {#if petitionError}<p class="nominate-error">{petitionError}</p>{/if}
                <div class="nominate-actions">
                    <button class="btn-sm btn-primary-sm" onclick={doPetition} disabled={!petitionPersonId || petitionSaving}>
                        {petitionSaving ? "Submitting…" : "Submit petition"}
                    </button>
                    <button class="btn-sm" onclick={() => { nominating = false; petitionError = ""; }}>Cancel</button>
                </div>
            </div>
        {:else}
            <button class="nominate-btn" onclick={() => nominating = true}>＋ Petition to add member</button>
        {/if}
    {/if}

    <!-- Docket -->
    <hr class="divider" />
    <div class="docket-header">
        <h2 class="section-heading">Docket</h2>
        {#if $session}
            <button class="btn-add" onclick={() => { showAddMotion = !showAddMotion; addMotionError = ""; }}>
                {showAddMotion ? "Cancel" : "＋ Add"}
            </button>
        {/if}
    </div>

    {#if showAddMotion}
        <div class="add-form">
            <input class="input-sm add-input" type="text" placeholder="Title" bind:value={addMotionTitle} disabled={addingMotion} />
            <textarea class="input-sm add-input" rows={3} placeholder="Describe the motion…" bind:value={addMotionDesc} disabled={addingMotion}></textarea>
            {#if effectKinds.length}
                <select class="input-sm add-input" bind:value={selectedKind} onchange={() => { effectPayload = {}; }}>
                    <option value="">No automated effect</option>
                    {#each effectKinds.filter(k => !k.authorityId || k.authorityId === "assembly") as k (k.kind)}
                        <option value={k.kind}>{k.label}</option>
                    {/each}
                </select>
                {#if selectedKind}
                    <div class="effect-fields">
                        <EffectPayloadForm kind={selectedKind} bind:payload={effectPayload} />
                    </div>
                {/if}
            {/if}
            {#if addMotionError}<p class="add-error">{addMotionError}</p>{/if}
            <div class="docket-actions">
                <button class="btn-sm btn-primary-sm" onclick={doAddMotion} disabled={addingMotion || !addMotionTitle.trim() || !addMotionDesc.trim()}>
                    {addingMotion ? "Adding…" : "Add to docket"}
                </button>
            </div>
        </div>
    {/if}

    {#if activeMotions.length === 0 && resolvedMotions.length === 0 && !showAddMotion}
        <p class="empty-msg">No motions on the docket.</p>
    {:else}
        {#each activeMotions as m (m.id)}
            <div class="docket-card">
                <button class="docket-title" onclick={() => openMotion(m)}>{m.title}</button>
                <span class="docket-stage">{m.stage}</span>
            </div>
        {/each}
        {#if resolvedMotions.length > 0}
            <details class="resolved-details">
                <summary>Resolved ({resolvedMotions.length})</summary>
                {#each resolvedMotions as m (m.id)}
                    <button class="docket-card docket-resolved" onclick={() => openMotion(m)}>
                        <span class="docket-title-text">{m.title}</span>
                        <span class="docket-outcome">{m.outcome}</span>
                    </button>
                {/each}
            </details>
        {/if}
    {/if}
    {#if docketError}<p class="error-msg">{docketError}</p>{/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    @media (min-width: 768px) {
        .page { padding-bottom: 2rem; }
    }

    .page-header { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.25rem; }

    .back-btn {
        background: none;
        border: none;
        color: #16a34a;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        text-align: left;
        margin-bottom: 0.25rem;
    }

    .page-title {
        font-size: 1.3rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
    }

    .page-sub {
        font-size: 0.82rem;
        color: #64748b;
        margin: 0;
    }

    .member-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    /* ── Mandate ───────────────────────────────────────────────────────────── */
    .mandate-section {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.9rem 1.1rem;
    }
    .mandate-display { display: flex; flex-direction: column; gap: 0.4rem; }
    .mandate-text  { font-size: 0.875rem; color: #1e293b; margin: 0; white-space: pre-wrap; }
    .mandate-empty { font-size: 0.875rem; color: #94a3b8; margin: 0; font-style: italic; }
    .mandate-edit-btn {
        align-self: flex-start;
        background: none; border: none; padding: 0;
        font-size: 0.78rem; color: #16a34a; cursor: pointer; font-weight: 500;
    }
    .mandate-edit-btn:hover { text-decoration: underline; }
    .mandate-textarea {
        width: 100%; box-sizing: border-box;
        padding: 0.5rem 0.65rem;
        border: 1px solid #cbd5e1; border-radius: 0.5rem;
        font-size: 0.875rem; font-family: inherit; resize: vertical;
        background: #fff; color: #0f172a;
    }
    .mandate-textarea:focus { outline: none; border-color: #16a34a; box-shadow: 0 0 0 2px #bbf7d0; }
    .mandate-actions { display: flex; gap: 0.5rem; }
    .mandate-error { font-size: 0.78rem; color: #dc2626; margin: 0; }

    .member-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.1rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        gap: 1rem;
    }

    .member-name {
        font-size: 0.95rem;
        font-weight: 600;
        color: #0f172a;
    }

    .member-handle {
        font-size: 0.78rem;
        color: #64748b;
    }

    .skeleton {
        height: 3.5rem;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.3s infinite;
        border-radius: 0.75rem;
    }

    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .error-msg { font-size: 0.875rem; color: #dc2626; padding: 0.75rem 1rem; background: #fef2f2; border-radius: 0.5rem; margin: 0; }
    .empty-msg { font-size: 0.875rem; color: #64748b; margin: 0; }

    /* ── Docket ──────────────────────────────────────────────────────────────── */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0.25rem 0; }
    .section-heading { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0; }

    .docket-card {
        display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
        padding: 0.75rem 1rem; background: #fff; border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
    }
    .docket-card.docket-resolved { cursor: pointer; background: #f8fafc; width: 100%; box-sizing: border-box; }
    .docket-title { background: none; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #0f172a; padding: 0; text-align: left; flex: 1; }
    .docket-title-text { font-size: 0.875rem; font-weight: 500; color: #334155; flex: 1; }
    .docket-stage  { font-size: 0.72rem; color: #64748b; background: #f1f5f9; padding: 0.15rem 0.5rem; border-radius: 9999px; }
    .docket-outcome { font-size: 0.72rem; color: #64748b; }
    .docket-actions { display: flex; gap: 0.4rem; flex-basis: 100%; }

    .btn-sm { padding: 0.3rem 0.65rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 0.4rem; color: #15803d; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
    .btn-primary-sm { background: #16a34a; color: #fff; border-color: #16a34a; }
    .input-sm { padding: 0.3rem 0.55rem; border: 1px solid #e2e8f0; border-radius: 0.4rem; font-size: 0.8rem; background: #fff; outline: none; font-family: inherit; }

    .resolved-details { font-size: 0.8rem; color: #64748b; }
    .resolved-details summary { cursor: pointer; padding: 0.3rem 0; font-weight: 600; }

    .docket-header { display: flex; align-items: center; justify-content: space-between; }

    .btn-add {
        background: transparent;
        border: 1px dashed #86efac;
        border-radius: 6px;
        color: #15803d;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.25rem 0.65rem;
        cursor: pointer;
    }
    .btn-add:hover { background: #f0fdf4; }

    .add-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem;
        padding: 0.9rem 1rem;
    }
    .add-input {
        width: 100%; box-sizing: border-box; border-radius: 0.5rem;
        border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.875rem;
        padding: 0.45rem 0.7rem; outline: none; resize: vertical;
    }
    .add-input:focus { border-color: #16a34a; }
    .add-error { font-size: 0.78rem; color: #dc2626; margin: 0; }
    .effect-fields { display: flex; flex-direction: column; gap: 0.4rem; }

    .nominate-btn {
        background: transparent;
        border: 1px dashed #86efac;
        border-radius: 6px;
        color: #15803d;
        font-size: 0.8rem;
        padding: 0.35rem 0.8rem;
        cursor: pointer;
        align-self: flex-start;
    }
    .nominate-btn:hover { background: #f0fdf4; }

    .nominate-form {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.9rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .nominate-select, .nominate-input {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.4rem 0.6rem;
        font-size: 0.875rem;
        font-family: inherit;
        background: #fff;
        color: #111827;
        width: 100%;
        box-sizing: border-box;
    }
    .nominate-error { font-size: 0.8rem; color: #dc2626; margin: 0; }
    .nominate-actions { display: flex; gap: 0.5rem; }
</style>
