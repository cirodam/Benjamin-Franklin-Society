<script lang="ts">
    import { onMount } from "svelte";
    import { listProjections } from "../lib/api.js";
    import type { NeedsProjection } from "../lib/api.js";
    import { currentPage, selectedProjectionId } from "../lib/nav.js";

    let projections = $state<NeedsProjection[]>([]);
    let loading     = $state(true);

    onMount(async () => {
        projections = await listProjections();
        loading = false;
    });

    function open(id: string) {
        selectedProjectionId.set(id);
        currentPage.set("projection-detail");
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }
</script>

<div class="page">
    <div class="page-header">
        <h1>Needs Projections</h1>
        <button class="new-btn" onclick={() => currentPage.set("new-projection")}>+ New projection</button>
    </div>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if projections.length === 0}
        <p class="muted">No projections published yet.</p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Window</th>
                    <th>Headcount</th>
                    <th>Reserve target</th>
                    <th>Crops</th>
                    <th>Published</th>
                    <th>Approved</th>
                </tr>
            </thead>
            <tbody>
                {#each projections as p (p.id)}
                    <tr onclick={() => open(p.id)} class="clickable">
                        <td class="bold">{windowLabel(p.plantingWindow)}</td>
                        <td>{p.memberHeadcount}</td>
                        <td>{p.reserveTargetWeeks} wks</td>
                        <td>{p.cropNeeds.length}</td>
                        <td>{new Date(p.publishedAt).toLocaleDateString()}</td>
                        <td>
                            {#if p.approvedByMotionId}
                                <span class="badge-yes">Yes</span>
                            {:else}
                                <span class="badge-no">Pending</span>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .page { max-width: 860px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    h1 { margin: 0; font-size: 1.8rem; }
    .new-btn {
        background: #16a34a; border: none; border-radius: 8px; color: #fff;
        padding: 0.5rem 1.1rem; cursor: pointer; font-size: 0.88rem; font-weight: 600;
        transition: background 0.15s;
    }
    .new-btn:hover { background: #15803d; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
    td { padding: 0.75rem; color: #e2e8f0; font-size: 0.9rem; border-bottom: 1px solid #1e293b; }
    .bold { font-weight: 600; color: #f1f5f9; }
    .clickable { cursor: pointer; }
    .clickable:hover td { background: #1e293b; }

    .badge-yes { background: #14532d; color: #86efac; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 99px; }
    .badge-no  { background: #374151; color: #9ca3af; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 99px; }

    .muted { color: #64748b; }
</style>
