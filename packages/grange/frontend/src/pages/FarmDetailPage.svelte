<script lang="ts">
    import { onMount } from "svelte";
    import { getFarm, listContracts } from "../lib/api.js";
    import type { FarmAssociation, FarmContract } from "../lib/api.js";
    import { currentPage, selectedFarmId, selectedContractId } from "../lib/nav.js";

    let farm      = $state<FarmAssociation | null>(null);
    let contracts = $state<FarmContract[]>([]);
    let loading   = $state(true);

    onMount(async () => {
        const id = $selectedFarmId;
        if (!id) { currentPage.set("farms"); return; }
        [farm, contracts] = await Promise.all([
            getFarm(id),
            listContracts({ farmId: id }),
        ]);
        loading = false;
    });

    function openContract(id: string) {
        selectedContractId.set(id);
        currentPage.set("contract-detail");
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }
</script>

<div class="page">
    <button class="back" onclick={() => currentPage.set("farms")}>← Farms</button>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if farm}
        <div class="header">
            <div>
                <h1>{farm.name}</h1>
                <div class="meta">{farm.location} · {farm.acreage} acres</div>
            </div>
            <span class="badge badge-{farm.status}">{farm.status}</span>
        </div>

        <!-- Practice declaration -->
        <section>
            <h2>Practice Declaration</h2>
            <div class="practice-grid">
                {#if farm.practices.soilMethods.length > 0}
                    <div class="practice-item">
                        <div class="practice-label">Soil methods</div>
                        <div class="practice-value">{farm.practices.soilMethods.join(", ")}</div>
                    </div>
                {/if}
                {#if farm.practices.prohibitedInputs.length > 0}
                    <div class="practice-item">
                        <div class="practice-label">Prohibited inputs</div>
                        <div class="practice-value">{farm.practices.prohibitedInputs.join(", ")}</div>
                    </div>
                {/if}
                <div class="practice-item">
                    <div class="practice-label">Water source</div>
                    <div class="practice-value">{farm.practices.waterSource}</div>
                </div>
                <div class="practice-item">
                    <div class="practice-label">Seed source</div>
                    <div class="practice-value">{farm.practices.seedSource}</div>
                </div>
                {#if farm.practices.cropDiversity}
                    <div class="practice-item wide">
                        <div class="practice-label">Crop diversity &amp; rotation</div>
                        <div class="practice-value">{farm.practices.cropDiversity}</div>
                    </div>
                {/if}
                {#if farm.practices.notes}
                    <div class="practice-item wide">
                        <div class="practice-label">Notes</div>
                        <div class="practice-value">{farm.practices.notes}</div>
                    </div>
                {/if}
            </div>
        </section>

        <!-- Contracts -->
        <section>
            <h2>Contracts ({contracts.length})</h2>
            {#if contracts.length === 0}
                <p class="muted">No contracts yet.</p>
            {:else}
                <div class="contract-list">
                    {#each contracts as c (c.id)}
                        <button class="contract-row" onclick={() => openContract(c.id)}>
                            <span class="c-window">{windowLabel(c.plantingWindow)}</span>
                            <span class="c-crops">{c.cropPlan.length} crop{c.cropPlan.length === 1 ? "" : "s"}</span>
                            <span class="c-payment">{c.paymentTerms.basePaymentKin.toLocaleString()} kin</span>
                            <span class="c-status status-{c.status}">{c.status}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </section>
    {/if}
</div>

<style>
    .page { max-width: 760px; }
    .back { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; padding: 0; }
    .back:hover { color: #e2e8f0; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.8rem; }
    .meta { color: #64748b; font-size: 0.9rem; }

    h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.75rem; }
    section { margin-bottom: 2rem; }

    .badge { font-size: 0.85rem; padding: 0.3rem 0.8rem; border-radius: 99px; font-weight: 600; text-transform: capitalize; }
    .badge-eligible  { background: #14532d; color: #86efac; }
    .badge-pending   { background: #1e3a5f; color: #93c5fd; }
    .badge-suspended { background: #7f1d1d; color: #fca5a5; }
    .badge-retired   { background: #374151; color: #9ca3af; }

    .practice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .practice-item { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 0.75rem 1rem; }
    .practice-item.wide { grid-column: 1 / -1; }
    .practice-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.25rem; }
    .practice-value { font-size: 0.9rem; color: #e2e8f0; }

    .contract-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .contract-row {
        display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1rem; align-items: center;
        padding: 0.75rem 1rem; background: #1e293b; border: 1px solid #334155; border-radius: 8px;
        cursor: pointer; text-align: left; color: #e2e8f0; font-size: 0.9rem;
        transition: background 0.1s;
    }
    .contract-row:hover { background: #263244; }
    .c-window { font-weight: 600; color: #f1f5f9; }
    .c-payment { color: #86efac; }
    .c-status  { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; text-align: center; }
    .status-active    { background: #14532d; color: #86efac; }
    .status-proposed  { background: #1e3a5f; color: #93c5fd; }
    .status-approved  { background: #1e3a5f; color: #93c5fd; }
    .status-fulfilled { background: #374151; color: #9ca3af; }
    .status-disputed  { background: #7f1d1d; color: #fca5a5; }
    .status-cancelled { background: #374151; color: #6b7280; }

    .muted { color: #64748b; }
</style>
