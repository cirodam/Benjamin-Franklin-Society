<script lang="ts">
    import {
        listMotions, createMotion, submitMotionForDeliberation,
        openMotionVoting, castMotionVote, withdrawMotion, listMotionEffects, listVoteRules,
    } from "../lib/api.js";
    import type { MotionDto, MotionEffectKind, VoteRule } from "../lib/api.js";
    import { session, currentPage, selectedMotionId } from "../lib/session.js";
    import EffectPayloadForm from "../components/EffectPayloadForm.svelte";

    type StageFilter = "active" | "resolved" | "all";

    let motions:  MotionDto[] = $state([]);
    let loading   = $state(true);
    let error     = $state("");
    let filter    = $state<StageFilter>("active");

    // Create form
    let showCreate   = $state(false);
    let creating     = $state(false);
    let createError  = $state("");
    let newTitle     = $state("");
    let newDesc      = $state("");
    let newPremises  = $state("");
    let newExpected  = $state("");
    let voteRules    = $state<VoteRule[]>([]);
    let newRuleId    = $state("referendum-general");
    let newMinApprovals = $state("");
    let effectKinds  = $state<MotionEffectKind[]>([]);
    let selectedKind = $state("");
    let effectPayload = $state<Record<string, unknown>>({})

    $effect(() => {
        if (showCreate && !effectKinds.length) {
            listMotionEffects().then(k => { effectKinds = k; }).catch(() => {});
        }
        if (showCreate && !voteRules.length) {
            listVoteRules().then(r => { voteRules = r; }).catch(() => {});
        }
    });

    async function load() {
        loading = true; error = "";
        try {
            motions = await listMotions({ authorityId: "community" });
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load referenda";
        } finally { loading = false; }
    }

    $effect(() => { load(); });

    const filtered = $derived(() => {
        if (filter === "active")   return motions.filter(m => m.stage !== "resolved");
        if (filter === "resolved") return motions.filter(m => m.stage === "resolved");
        return motions;
    });

    async function handleCreate() {
        if (!newTitle.trim() || !newDesc.trim()) return;
        creating = true; createError = "";
        try {
            const m = await createMotion({
                authorityId:     "community",
                title:           newTitle.trim(),
                description:     newDesc.trim(),
                kind:            selectedKind || null,
                payload:         selectedKind ? effectPayload : undefined,
                premises:        newPremises.trim() || undefined,
                expectedOutcome: newExpected.trim() || undefined,
            });
            const rule = voteRules.find(r => r.id === newRuleId);
            const isPetition = rule?.legitimacy === "petition";
            const minApprovals = isPetition ? parseInt(newMinApprovals, 10) : undefined;
            if (isPetition && (!minApprovals || minApprovals < 1)) {
                createError = "Enter a required approval count."; creating = false; return;
            }
            await submitMotionForDeliberation(m.id, newRuleId, minApprovals);
            showCreate = false; newTitle = ""; newDesc = ""; newPremises = ""; newExpected = ""; newMinApprovals = "";
            selectedKind = ""; effectPayload = {};
            await load();
        } catch (e) {
            createError = e instanceof Error ? e.message : "Failed to create motion";
        } finally { creating = false; }
    }

    function openMotion(m: MotionDto) {
        selectedMotionId.set(m.id);
        currentPage.go("motion");
    }

    function stageBadge(m: MotionDto): string {
        if (m.stage === "deliberating") return "Deliberating";
        if (m.stage === "voting")       return "Voting open";
        if (m.stage === "draft")        return "Draft";
        if (m.stage === "resolved") {
            if (m.outcome === "passed")    return "Passed";
            if (m.outcome === "failed")    return "Failed";
            if (m.outcome === "withdrawn") return "Withdrawn";
            if (m.outcome === "referred")  return "Referred";
        }
        return m.stage;
    }

    function stageClass(m: MotionDto): string {
        if (m.stage === "voting")   return "badge-voting";
        if (m.stage === "resolved" && m.outcome === "passed")  return "badge-passed";
        if (m.stage === "resolved" && m.outcome === "failed")  return "badge-failed";
        if (m.stage === "resolved") return "badge-resolved";
        return "badge-default";
    }
</script>

<div class="page">
    <div class="page-header">
        <div>
            <h1 class="page-title">Referenda</h1>
            <p class="page-sub">Decisions open to the full membership.</p>
        </div>
        {#if $session}
            <button class="btn-new" onclick={() => { showCreate = !showCreate; createError = ""; }}>
                {showCreate ? "Cancel" : "+ New"}
            </button>
        {/if}
    </div>

    {#if showCreate}
        <form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
            <input class="input" type="text" placeholder="Title" bind:value={newTitle} required />
            <textarea class="input textarea" placeholder="Describe the motion…" bind:value={newDesc} rows="4" required></textarea>
            <div class="reasoning-section">
                <p class="reasoning-hint">Structured reasoning (optional — but encouraged)</p>
                <textarea class="input textarea" placeholder="Premises — what do you believe to be true that makes this motion necessary?" bind:value={newPremises} rows="3"></textarea>
                <textarea class="input textarea" placeholder="Expected outcome — what result do you predict if this passes?" bind:value={newExpected} rows="2"></textarea>
            </div>
            <div class="threshold-row">
                <label class="threshold-label" for="threshold-select">Required to pass</label>
                <select id="threshold-select" class="input select" bind:value={newRuleId}>
                    {#each voteRules as rule (rule.id)}
                        <option value={rule.id}>{rule.label}</option>
                    {/each}
                </select>
            </div>
            {#if voteRules.find(r => r.id === newRuleId)?.legitimacy === "petition"}
                <div class="threshold-row">
                    <label class="threshold-label" for="min-approvals">Approvals required</label>
                    <input id="min-approvals" class="input" type="number" min="1" placeholder="e.g. 4" bind:value={newMinApprovals} />
                </div>
            {/if}
            {#if effectKinds.length}
                <div class="threshold-row">
                    <label class="threshold-label" for="effect-select">Automated effect (optional)</label>
                    <select id="effect-select" class="input select" bind:value={selectedKind} onchange={() => { effectPayload = {}; }}>
                        <option value="">None</option>
                        {#each effectKinds.filter(k => !k.bodyHint || k.bodyHint === "community") as k (k.kind)}
                            <option value={k.kind}>{k.label}</option>
                        {/each}
                    </select>
                </div>
                {#if selectedKind}
                    <div class="effect-fields">
                        <EffectPayloadForm kind={selectedKind} bind:payload={effectPayload} />
                    </div>
                {/if}
            {/if}
            {#if createError}<p class="form-error">{createError}</p>{/if}
            <button class="btn-primary" type="submit" disabled={creating || !newTitle.trim() || !newDesc.trim()}>
                {creating ? "Submitting…" : "Submit for deliberation"}
            </button>
        </form>
    {/if}

    <!-- Filter tabs -->
    <div class="filter-tabs">
        {#each (["active", "resolved", "all"] as StageFilter[]) as f}
            <button class="tab" class:active={filter === f} onclick={() => filter = f}>
                {f === "active" ? "Active" : f === "resolved" ? "Resolved" : "All"}
            </button>
        {/each}
    </div>

    {#if loading}
        {#each [1,2,3] as _}<div class="skeleton"></div>{/each}
    {:else if error}
        <p class="error-msg">{error}</p>
    {:else if filtered().length === 0}
        <p class="empty-msg">No {filter === "active" ? "active " : filter === "resolved" ? "resolved " : ""}referenda.</p>
    {:else}
        {#each filtered() as m (m.id)}
            <button class="motion-card" onclick={() => openMotion(m)}>
                <div class="motion-main">
                    <span class="motion-title">{m.title}</span>
                    <span class="motion-desc">{m.description}</span>
                </div>
                <div class="motion-meta">
                    <span class="badge {stageClass(m)}">{stageBadge(m)}</span>
                    {#if m.stage === "voting"}
                        <span class="vote-count">{m.approvalCount} ✓</span>
                    {/if}
                </div>
            </button>
        {/each}
    {/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    @media (min-width: 768px) { .page { padding-bottom: 2rem; } }

    .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.25rem;
    }

    .page-title { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin: 0; }
    .page-sub   { font-size: 0.82rem; color: #64748b; margin: 0.15rem 0 0; }

    .btn-new {
        padding: 0.4rem 0.9rem;
        background: none;
        border: 1px solid #16a34a;
        border-radius: 0.5rem;
        color: #16a34a;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
    }

    /* ── Create form ─────────────────────────────────────────────────────────── */
    .create-form {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1rem;
    }

    .input {
        padding: 0.6rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.9rem;
        background: #fff;
        outline: none;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
    }

    .input:focus { border-color: #16a34a; box-shadow: 0 0 0 2px #dcfce7; }
    .textarea { resize: vertical; min-height: 80px; }
    .select { cursor: pointer; }

    .threshold-row { display: flex; flex-direction: column; gap: 0.3rem; }
    .threshold-label { font-size: 0.78rem; color: #64748b; font-weight: 500; }
    .effect-fields { display: flex; flex-direction: column; gap: 0.4rem; }

    .reasoning-section { display: flex; flex-direction: column; gap: 0.4rem; border-left: 2px solid #e2e8f0; padding-left: 0.75rem; }
    .reasoning-hint { font-size: 0.75rem; color: #94a3b8; margin: 0 0 0.1rem; font-style: italic; }

    .form-error { font-size: 0.8rem; color: #dc2626; margin: 0; }

    .btn-primary {
        padding: 0.6rem 1.1rem;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        align-self: flex-start;
    }

    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ── Filter tabs ─────────────────────────────────────────────────────────── */
    .filter-tabs { display: flex; gap: 0.4rem; margin: 0.25rem 0; }

    .tab {
        padding: 0.3rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 9999px;
        background: none;
        font-size: 0.78rem;
        color: #64748b;
        cursor: pointer;
    }

    .tab.active { background: #dcfce7; border-color: #86efac; color: #15803d; font-weight: 600; }

    /* ── Motion cards ────────────────────────────────────────────────────────── */
    .motion-card {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.1rem;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        cursor: pointer;
        text-align: left;
        color: inherit;
        width: 100%;
        transition: border-color 0.15s;
    }

    .motion-card:hover { border-color: #86efac; }

    .motion-main { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
    .motion-title { font-size: 0.95rem; font-weight: 600; color: #0f172a; }
    .motion-desc  {
        font-size: 0.78rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 40ch;
    }

    .motion-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; flex-shrink: 0; }

    .vote-count { font-size: 0.72rem; color: #16a34a; font-weight: 600; }

    /* ── Badges ──────────────────────────────────────────────────────────────── */
    .badge {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 0.2rem 0.55rem;
        border-radius: 9999px;
        white-space: nowrap;
    }

    .badge-voting   { background: #dbeafe; color: #1d4ed8; }
    .badge-passed   { background: #dcfce7; color: #15803d; }
    .badge-failed   { background: #fee2e2; color: #b91c1c; }
    .badge-resolved { background: #f1f5f9; color: #64748b; }
    .badge-default  { background: #f1f5f9; color: #64748b; }

    /* ── Utility ─────────────────────────────────────────────────────────────── */
    .skeleton {
        height: 4rem;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.3s infinite;
        border-radius: 0.75rem;
    }

    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .error-msg { font-size: 0.875rem; color: #dc2626; padding: 0.75rem 1rem; background: #fef2f2; border-radius: 0.5rem; margin: 0; }
    .empty-msg { font-size: 0.875rem; color: #64748b; margin: 0; }
</style>
