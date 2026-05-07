<script lang="ts">
    import { onMount } from "svelte";
    import { listProjections, getProjectionCoverage } from "../lib/api.js";
    import type { NeedsProjection, CoverageEntry } from "../lib/api.js";
    import { currentPage, selectedProjectionId } from "../lib/nav.js";

    interface ProjectionWithCoverage {
        projection: NeedsProjection;
        coverage:   CoverageEntry[];
    }

    let items   = $state<ProjectionWithCoverage[]>([]);
    let loading = $state(true);

    onMount(async () => {
        const projections = await listProjections();
        // Show the 4 most recent (open planting windows)
        const recent = projections.slice(0, 4);
        const results = await Promise.all(
            recent.map(async p => ({
                projection: p,
                coverage:   await getProjectionCoverage(p.id),
            }))
        );
        items = results;
        loading = false;
    });

    function openProjection(id: string) {
        selectedProjectionId.set(id);
        currentPage.set("projection-detail");
    }

    function overallStatus(coverage: CoverageEntry[]): "uncovered" | "minimum-met" | "full" {
        if (coverage.length === 0) return "uncovered";
        if (coverage.every(c => c.status === "full")) return "full";
        if (coverage.some(c => c.status === "uncovered")) return "uncovered";
        return "minimum-met";
    }

    function statusLabel(s: "uncovered" | "minimum-met" | "full"): string {
        return s === "full" ? "Fully covered" : s === "minimum-met" ? "Minimum met" : "Needs offers";
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }
</script>

<div class="page">
    <h1>Dashboard</h1>

    <div class="about">
        <p>
            The Grange coordinates food production between the community and its member farms.
            The community publishes <strong>needs projections</strong> — seasonal windows that signal
            how much of each crop the community wants, and at what price. Farms respond with
            <strong>contract offers</strong> against specific crop needs. Coordinators review coverage,
            approve contracts, and track deliveries and inspections through to settlement.
        </p>
        <p>
            The coverage bars below show how well each open planting window is served.
            The vertical floor marker is the minimum desired quantity; the bar fills to the contracted ceiling.
        </p>
    </div>

    <h2>Open planting windows</h2>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if items.length === 0}
        <p class="muted">No needs projections have been published yet.</p>
    {:else}
        <div class="window-grid">
            {#each items as { projection, coverage } (projection.id)}
                {@const status = overallStatus(coverage)}
                <button class="window-card status-{status}" onclick={() => openProjection(projection.id)}>
                    <div class="window-header">
                        <span class="window-label">{windowLabel(projection.plantingWindow)}</span>
                        <span class="status-badge status-{status}">{statusLabel(status)}</span>
                    </div>
                    <div class="crop-list">
                        {#each coverage as c (c.cropNeedEntryId)}
                            <div class="crop-row">
                                <span class="crop-name">{c.crop}</span>
                                <div class="bar-wrap">
                                    <div class="bar" style="width: {c.coveragePct}%"
                                         class:bar-min={c.status === "minimum-met"}
                                         class:bar-full={c.status === "full"}
                                         class:bar-uncov={c.status === "uncovered"}
                                    ></div>
                                    <div class="bar-floor" style="left: {Math.round(c.minDesiredLbs / c.maxContractLbs * 100)}%"></div>
                                </div>
                                <span class="pct">{c.coveragePct}%</span>
                            </div>
                        {/each}
                    </div>
                    <div class="window-meta">
                        {projection.memberHeadcount} members · {projection.reserveTargetWeeks}wk reserve target
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .page { max-width: 960px; }
    h1 { margin: 0 0 1rem; font-size: 1.8rem; }
    h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 1.75rem 0 1rem; }

    .about {
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 1.1rem 1.4rem; display: flex; flex-direction: column; gap: 0.6rem;
        margin-bottom: 0.25rem;
    }
    .about p { font-size: 0.9rem; color: #94a3b8; line-height: 1.6; margin: 0; }
    .about strong { color: #e2e8f0; font-weight: 600; }

    .window-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
        gap: 1.25rem;
    }

    .window-card {
        background: #1e293b; border: 1px solid #334155; border-radius: 12px;
        padding: 1.25rem; text-align: left; cursor: pointer;
        transition: box-shadow 0.15s, border-color 0.15s;
        display: flex; flex-direction: column; gap: 1rem;
    }
    .window-card:hover { box-shadow: 0 2px 16px rgba(0,0,0,0.3); border-color: #475569; }

    .window-header { display: flex; align-items: center; justify-content: space-between; }
    .window-label  { font-weight: 700; font-size: 1.1rem; color: #f1f5f9; }

    .status-badge {
        font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600;
    }
    .status-badge.status-full      { background: #14532d; color: #86efac; }
    .status-badge.status-minimum-met { background: #713f12; color: #fde68a; }
    .status-badge.status-uncovered { background: #7f1d1d; color: #fca5a5; }

    .crop-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .crop-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 0.75rem; }
    .crop-name { font-size: 0.85rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .bar-wrap { position: relative; height: 8px; background: #334155; border-radius: 4px; overflow: visible; }
    .bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .bar-full   { background: #22c55e; }
    .bar-min    { background: #f59e0b; }
    .bar-uncov  { background: #ef4444; }

    .bar-floor {
        position: absolute; top: -3px; bottom: -3px; width: 2px;
        background: #94a3b8; border-radius: 1px;
    }

    .pct { font-size: 0.8rem; color: #64748b; width: 2.5rem; text-align: right; }

    .window-meta { font-size: 0.8rem; color: #64748b; }

    .muted { color: #64748b; }
</style>
