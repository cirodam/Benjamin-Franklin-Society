<script lang="ts">
    import { onMount } from "svelte";
    import { listContracts } from "../lib/api.js";
    import type { FarmContract, ContractStatus } from "../lib/api.js";
    import { currentPage, selectedContractId } from "../lib/nav.js";

    let contracts     = $state<FarmContract[]>([]);
    let filterStatus  = $state<ContractStatus | "all">("all");
    let loading       = $state(true);

    onMount(async () => {
        contracts = await listContracts();
        loading = false;
    });

    const filtered = $derived(
        filterStatus === "all" ? contracts : contracts.filter(c => c.status === filterStatus)
    );

    function open(id: string) {
        selectedContractId.set(id);
        currentPage.set("contract-detail");
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }

    const statuses: Array<ContractStatus | "all"> = [
        "all", "proposed", "approved", "active", "fulfilled", "disputed", "cancelled"
    ];
</script>

<div class="page">
    <h1>Contracts</h1>

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
        <p class="muted">No contracts{filterStatus !== "all" ? ` with status "${filterStatus}"` : ""}.</p>
    {:else}
        <table>
            <thead>
                <tr>
                    <th>Farm</th>
                    <th>Window</th>
                    <th>Crops</th>
                    <th>Base payment</th>
                    <th>Advance paid</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {#each filtered as c (c.id)}
                    <tr onclick={() => open(c.id)} class="clickable">
                        <td class="mono">{c.farmId.slice(0, 8)}…</td>
                        <td class="bold">{windowLabel(c.plantingWindow)}</td>
                        <td>{c.cropPlan.length}</td>
                        <td class="kin">{c.paymentTerms.basePaymentKin.toLocaleString()} kin</td>
                        <td>{c.advancePaidAt ? new Date(c.advancePaidAt).toLocaleDateString() : "—"}</td>
                        <td><span class="badge badge-{c.status}">{c.status}</span></td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>

<style>
    .page { max-width: 900px; }
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
    .mono { font-family: monospace; color: #64748b; }
    .kin  { color: #86efac; }
    .clickable { cursor: pointer; }
    .clickable:hover td { background: #1e293b; }

    .badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; font-weight: 600; text-transform: capitalize; }
    .badge-active    { background: #14532d; color: #86efac; }
    .badge-proposed  { background: #1e3a5f; color: #93c5fd; }
    .badge-approved  { background: #1e3a5f; color: #93c5fd; }
    .badge-fulfilled { background: #374151; color: #9ca3af; }
    .badge-disputed  { background: #7f1d1d; color: #fca5a5; }
    .badge-cancelled { background: #374151; color: #6b7280; }

    .muted { color: #64748b; }
</style>
