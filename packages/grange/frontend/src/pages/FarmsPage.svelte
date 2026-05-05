<script lang="ts">
    import { onMount } from "svelte";
    import { listFarms } from "../lib/api.js";
    import type { FarmAssociation, FarmStatus } from "../lib/api.js";
    import { currentPage, selectedFarmId } from "../lib/nav.js";

    let farms       = $state<FarmAssociation[]>([]);
    let filterStatus = $state<FarmStatus | "all">("all");
    let loading     = $state(true);

    onMount(async () => {
        farms = await listFarms();
        loading = false;
    });

    const filtered = $derived(
        filterStatus === "all" ? farms : farms.filter(f => f.status === filterStatus)
    );

    function open(id: string) {
        selectedFarmId.set(id);
        currentPage.set("farm-detail");
    }

    const statuses: Array<FarmStatus | "all"> = ["all", "eligible", "pending", "suspended", "retired"];
</script>

<div class="page">
    <h1>Farm Associations</h1>

    <div class="filters">
        {#each statuses as s}
            <button
                class="filter-btn"
                class:active={filterStatus === s}
                onclick={() => filterStatus = s}
            >{s === "all" ? "All" : s}</button>
        {/each}
    </div>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if filtered.length === 0}
        <p class="muted">No farms with status "{filterStatus}".</p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Acreage</th>
                    <th>Status</th>
                    <th>Contracts</th>
                    <th>Operators</th>
                </tr>
            </thead>
            <tbody>
                {#each filtered as farm (farm.id)}
                    <tr onclick={() => open(farm.id)} class="clickable">
                        <td class="bold">{farm.name}</td>
                        <td class="muted-cell">{farm.location}</td>
                        <td>{farm.acreage} ac</td>
                        <td><span class="badge badge-{farm.status}">{farm.status}</span></td>
                        <td>{farm.contracts.length}</td>
                        <td>{farm.operatorIds.length}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .page { max-width: 860px; }
    h1 { margin: 0 0 1.25rem; font-size: 1.8rem; }

    .filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .filter-btn {
        padding: 0.35rem 0.9rem; border: 1px solid #334155; background: none;
        border-radius: 99px; cursor: pointer; font-size: 0.85rem; color: #94a3b8;
        text-transform: capitalize; transition: background 0.1s;
    }
    .filter-btn:hover  { background: #1e293b; color: #e2e8f0; }
    .filter-btn.active { background: #334155; color: #f1f5f9; border-color: #475569; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 0.5rem 0.75rem; border-bottom: 1px solid #334155; }
    td { padding: 0.75rem; color: #e2e8f0; font-size: 0.9rem; border-bottom: 1px solid #1e293b; }
    .bold { font-weight: 600; color: #f1f5f9; }
    .muted-cell { color: #64748b; }
    .clickable { cursor: pointer; }
    .clickable:hover td { background: #1e293b; }

    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; text-transform: capitalize; }
    .badge-eligible  { background: #14532d; color: #86efac; }
    .badge-pending   { background: #1e3a5f; color: #93c5fd; }
    .badge-suspended { background: #7f1d1d; color: #fca5a5; }
    .badge-retired   { background: #374151; color: #9ca3af; }

    .muted { color: #64748b; }
</style>
