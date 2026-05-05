<script lang="ts">
    import { onMount } from "svelte";
    import { getProjection, getProjectionCoverage, listContracts } from "../lib/api.js";
    import type { NeedsProjection, CoverageEntry, FarmContract } from "../lib/api.js";
    import { currentPage, selectedProjectionId, selectedContractId, offerProjectionId } from "../lib/nav.js";

    let projection = $state<NeedsProjection | null>(null);
    let coverage   = $state<CoverageEntry[]>([]);
    let contracts  = $state<FarmContract[]>([]);
    let loading    = $state(true);

    onMount(async () => {
        const id = $selectedProjectionId;
        if (!id) { currentPage.set("projections"); return; }
        [projection, coverage, contracts] = await Promise.all([
            getProjection(id),
            getProjectionCoverage(id),
            listContracts({ projectionId: id }),
        ]);
        loading = false;
    });

    function openContract(id: string) {
        selectedContractId.set(id);
        currentPage.set("contract-detail");
    }

    function contractsFor(cropNeedEntryId: string): FarmContract[] {
        return contracts.filter(c =>
            c.cropPlan.some(e => e.cropNeedEntryId === cropNeedEntryId) &&
            c.status !== "cancelled"
        );
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }
</script>

<div class="page">
    <button class="back" onclick={() => currentPage.set("projections")}>← Projections</button>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if projection}
        <div class="header">
            <div>
                <h1>{windowLabel(projection.plantingWindow)}</h1>
                <div class="meta">
                    {projection.memberHeadcount} members ·
                    {projection.reserveTargetWeeks}-week reserve target ·
                    Published {new Date(projection.publishedAt).toLocaleDateString()}
                    {#if projection.approvedByMotionId}
                        · <span class="approved">Approved</span>
                    {:else}
                        · <span class="pending">Pending approval</span>
                    {/if}
                </div>
            </div>
            <button class="offer-btn" onclick={() => {
                offerProjectionId.set(projection!.id);
                selectedProjectionId.set(projection!.id);
                currentPage.set("new-contract-offer");
            }}>+ Submit offer</button>
        </div>

        <h2>Crop Needs &amp; Coverage</h2>

        {#each projection.cropNeeds as need (need.id)}
            {@const cov = coverage.find(c => c.cropNeedEntryId === need.id)}
            {@const farmContracts = contractsFor(need.id)}
            <div class="need-card">
                <div class="need-header">
                    <div>
                        <span class="need-crop">{need.crop}</span>
                        <span class="need-cat">{need.category}</span>
                    </div>
                    {#if cov}
                        <span class="cov-badge cov-{cov.status}">
                            {cov.status === "full" ? "Full" : cov.status === "minimum-met" ? "Min met" : "Uncovered"}
                        </span>
                    {/if}
                </div>

                {#if cov}
                    <div class="bar-row">
                        <div class="bar-wrap">
                            <div class="bar cov-{cov.status}" style="width: {cov.coveragePct}%"></div>
                            <div class="bar-floor" style="left: {Math.round(need.minDesiredLbs / need.maxContractLbs * 100)}%"></div>
                        </div>
                        <span class="bar-label">
                            {cov.committedLbs.toLocaleString()} / {need.maxContractLbs.toLocaleString()} lbs
                            ({cov.coveragePct}%)
                        </span>
                    </div>
                {/if}

                <div class="need-details">
                    <span>Floor: {need.minDesiredLbs.toLocaleString()} lbs</span>
                    <span>Ceiling: {need.maxContractLbs.toLocaleString()} lbs</span>
                    <span>Signal price: {need.estimatedPaymentPerLbKin} kin/lb</span>
                </div>

                {#if need.notes}
                    <p class="need-notes">{need.notes}</p>
                {/if}

                {#if farmContracts.length > 0}
                    <div class="contracts-section">
                        <div class="contracts-label">Contracts offering against this need</div>
                        {#each farmContracts as c (c.id)}
                            {@const entry = c.cropPlan.find(e => e.cropNeedEntryId === need.id)}
                            <button class="contract-row" onclick={() => openContract(c.id)}>
                                <span class="c-farm">{c.farmId.slice(0, 8)}…</span>
                                <span class="c-yield">{entry?.estimatedYieldLbs.toLocaleString() ?? "?"} lbs est.</span>
                                <span class="c-acres">{entry?.acreage} ac</span>
                                <span class="c-status status-{c.status}">{c.status}</span>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</div>

<style>
    .page { max-width: 860px; }
    .back { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; padding: 0; }
    .back:hover { color: #e2e8f0; }
    h1 { margin: 0 0 0.25rem; font-size: 1.8rem; }
    h2 { margin: 2rem 0 1rem; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .offer-btn {
        background: #16a34a; border: none; border-radius: 8px; color: #fff;
        padding: 0.55rem 1.1rem; cursor: pointer; font-size: 0.88rem; font-weight: 600;
        white-space: nowrap; transition: background 0.15s;
    }
    .offer-btn:hover { background: #15803d; }

    .meta { color: #64748b; font-size: 0.9rem; }
    .approved { color: #86efac; }
    .pending  { color: #fde68a; }

    .need-card {
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 1.25rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem;
    }

    .need-header { display: flex; justify-content: space-between; align-items: center; }
    .need-crop { font-weight: 700; font-size: 1rem; color: #f1f5f9; }
    .need-cat  { font-size: 0.75rem; color: #64748b; margin-left: 0.75rem; text-transform: uppercase; }

    .cov-badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; }
    .cov-badge.cov-full         { background: #14532d; color: #86efac; }
    .cov-badge.cov-minimum-met  { background: #713f12; color: #fde68a; }
    .cov-badge.cov-uncovered    { background: #7f1d1d; color: #fca5a5; }

    .bar-row { display: flex; align-items: center; gap: 1rem; }
    .bar-wrap { flex: 1; position: relative; height: 10px; background: #334155; border-radius: 5px; overflow: visible; }
    .bar { height: 100%; border-radius: 5px; transition: width 0.3s; }
    .bar.cov-full         { background: #22c55e; }
    .bar.cov-minimum-met  { background: #f59e0b; }
    .bar.cov-uncovered    { background: #ef4444; }
    .bar-floor { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #94a3b8; border-radius: 1px; }
    .bar-label { font-size: 0.82rem; color: #94a3b8; white-space: nowrap; }

    .need-details { display: flex; gap: 1.5rem; font-size: 0.82rem; color: #64748b; }
    .need-notes   { font-size: 0.85rem; color: #94a3b8; font-style: italic; margin: 0; }

    .contracts-section { border-top: 1px solid #334155; padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .contracts-label   { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.25rem; }

    .contract-row {
        display: grid; grid-template-columns: 1fr 1fr 1fr auto;
        gap: 0.75rem; align-items: center; padding: 0.5rem 0.75rem;
        background: #0f172a; border: 1px solid #334155; border-radius: 6px;
        cursor: pointer; text-align: left; color: #e2e8f0; font-size: 0.85rem;
        transition: background 0.1s;
    }
    .contract-row:hover { background: #1e293b; }
    .c-farm  { color: #94a3b8; font-family: monospace; }
    .c-yield { font-weight: 600; }
    .c-acres { color: #64748b; }
    .c-status { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 99px; background: #334155; }
    .status-active   { background: #14532d; color: #86efac; }
    .status-proposed { background: #1e3a5f; color: #93c5fd; }
    .status-approved { background: #1e3a5f; color: #93c5fd; }
    .status-fulfilled { background: #374151; color: #9ca3af; }

    .muted { color: #64748b; }
</style>
