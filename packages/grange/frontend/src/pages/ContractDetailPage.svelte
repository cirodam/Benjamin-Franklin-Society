<script lang="ts">
    import { onMount } from "svelte";
    import { getContract, getFarm } from "../lib/api.js";
    import type { FarmContract, FarmAssociation } from "../lib/api.js";
    import { currentPage, selectedContractId } from "../lib/nav.js";

    let contract = $state<FarmContract | null>(null);
    let farm     = $state<FarmAssociation | null>(null);
    let loading  = $state(true);

    onMount(async () => {
        const id = $selectedContractId;
        if (!id) { currentPage.set("contracts"); return; }
        contract = await getContract(id);
        if (contract) farm = await getFarm(contract.farmId).catch(() => null);
        loading = false;
    });

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }

    function totalDelivered(c: FarmContract): number {
        return c.deliveries.reduce((s, d) => s + d.actualYieldLbs, 0);
    }

    function totalEstimated(c: FarmContract): number {
        return c.cropPlan.reduce((s, e) => s + e.estimatedYieldLbs, 0);
    }

    function backPage(): void {
        // If we came from a farm, go back there; otherwise contracts list
        currentPage.set("contracts");
    }
</script>

<div class="page">
    <button class="back" onclick={backPage}>← Contracts</button>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if contract}
        <div class="header">
            <div>
                <h1>{farm ? farm.name : contract.farmId.slice(0, 8) + "…"} — {windowLabel(contract.plantingWindow)}</h1>
                <div class="meta">
                    {contract.contractType} contract ·
                    Created {new Date(contract.createdAt).toLocaleDateString()}
                    {#if contract.advancePaidAt}
                        · Advance paid {new Date(contract.advancePaidAt).toLocaleDateString()}
                    {/if}
                </div>
            </div>
            <span class="badge badge-{contract.status}">{contract.status}</span>
        </div>

        <!-- Crop plan -->
        <section>
            <h2>Crop Plan</h2>
            <div class="crop-cards">
                {#each contract.cropPlan as entry}
                    <div class="crop-card">
                        <div class="crop-name">{entry.crop}</div>
                        <div class="crop-cat">{entry.category}</div>
                        <div class="crop-stats">
                            <div><span class="label">Acreage</span><span class="val">{entry.acreage} ac</span></div>
                            <div><span class="label">Estimated</span><span class="val">{entry.estimatedYieldLbs.toLocaleString()} lbs</span></div>
                            <div><span class="label">Floor</span><span class="val">{entry.floorYieldLbs.toLocaleString()} lbs</span></div>
                            <div><span class="label">Ceiling</span><span class="val">{entry.ceilingYieldLbs.toLocaleString()} lbs</span></div>
                            <div><span class="label">Reserve %</span><span class="val">{entry.reserveAllocationPct}%</span></div>
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Payment terms -->
        <section>
            <h2>Payment Terms</h2>
            <div class="terms-grid">
                <div class="term"><span class="label">Base payment</span><span class="val kin">{contract.paymentTerms.basePaymentKin.toLocaleString()} kin</span></div>
                <div class="term"><span class="label">Advance</span><span class="val kin">{contract.paymentTerms.advancePaymentKin.toLocaleString()} kin</span></div>
                <div class="term"><span class="label">Surplus — farmer</span><span class="val">{contract.paymentTerms.surplusSplitFarmerPct}%</span></div>
                <div class="term"><span class="label">Surplus — community</span><span class="val">{contract.paymentTerms.surplusSplitCommunityPct}%</span></div>
                {#if contract.paymentTerms.externalPaymentUsd !== null}
                    <div class="term"><span class="label">Dollar component</span><span class="val">${contract.paymentTerms.externalPaymentUsd.toLocaleString()}</span></div>
                {/if}
            </div>
        </section>

        <!-- Deliveries -->
        <section>
            <h2>Deliveries ({contract.deliveries.length})</h2>
            {#if contract.deliveries.length === 0}
                <p class="muted">No deliveries recorded yet.</p>
            {:else}
                {@const delivered = totalDelivered(contract)}
                {@const estimated = totalEstimated(contract)}
                <div class="delivery-progress">
                    <div class="bar-wrap">
                        <div class="bar" style="width: {Math.min(100, Math.round(delivered / estimated * 100))}%"></div>
                    </div>
                    <span class="bar-label">{delivered.toLocaleString()} / {estimated.toLocaleString()} lbs ({Math.round(delivered / estimated * 100)}%)</span>
                </div>
                <table>
                    <thead>
                        <tr><th>Date</th><th>Crop</th><th>Yield</th><th>Moisture</th><th>Reserve</th><th>Market</th><th>Received by</th></tr>
                    </thead>
                    <tbody>
                        {#each contract.deliveries as d (d.id)}
                            {@const entry = contract.cropPlan.find(e => e.cropNeedEntryId === d.cropPlanEntryId) ?? contract.cropPlan.find(() => true)}
                            <tr>
                                <td>{new Date(d.recordedAt).toLocaleDateString()}</td>
                                <td>{entry?.crop ?? "—"}</td>
                                <td>{d.actualYieldLbs.toLocaleString()} lbs</td>
                                <td>{d.moisturePct !== null ? `${d.moisturePct}%` : "—"}</td>
                                <td>{d.reserveAllocatedLbs.toLocaleString()} lbs</td>
                                <td>{d.marketAllocatedLbs.toLocaleString()} lbs</td>
                                <td class="mono">{d.receivedBy}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </section>

        <!-- Inspections -->
        <section>
            <h2>Inspections ({contract.inspections.length})</h2>
            {#if contract.inspections.length === 0}
                <p class="muted">No inspections recorded yet.</p>
            {:else}
                <div class="inspection-list">
                    {#each contract.inspections as ins (ins.id)}
                        <div class="inspection-card outcome-{ins.outcome}">
                            <div class="inspection-header">
                                <span class="ins-date">{new Date(ins.conductedAt).toLocaleDateString()}</span>
                                <span class="ins-outcome outcome-badge outcome-{ins.outcome}">{ins.outcome}</span>
                            </div>
                            <p class="ins-findings">{ins.findings}</p>
                            {#if ins.practiceViolations.length > 0}
                                <div class="violations">
                                    Violations: {ins.practiceViolations.join(", ")}
                                </div>
                            {/if}
                            {#if ins.followUpRequired && ins.followUpDate}
                                <div class="followup">Follow-up required by {new Date(ins.followUpDate).toLocaleDateString()}</div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Settlement -->
        {#if contract.settlement}
            <section>
                <h2>Settlement</h2>
                <div class="settlement-card" class:dispute={contract.settlement.disputeRaised}>
                    <div class="terms-grid">
                        <div class="term"><span class="label">Settled</span><span class="val">{new Date(contract.settlement.settledAt).toLocaleDateString()}</span></div>
                        <div class="term"><span class="label">Total delivered</span><span class="val">{contract.settlement.totalDeliveredLbs.toLocaleString()} lbs</span></div>
                        <div class="term"><span class="label">Base payment</span><span class="val kin">{contract.settlement.basePaymentPaid.toLocaleString()} kin</span></div>
                        <div class="term"><span class="label">Surplus payment</span><span class="val kin">{contract.settlement.surplusPaymentPaid.toLocaleString()} kin</span></div>
                        <div class="term"><span class="label">Shortfall absorbed</span><span class="val">{contract.settlement.shortfallAbsorbed.toLocaleString()} kin</span></div>
                        <div class="term"><span class="label">Advance reconciled</span><span class="val">{contract.settlement.advanceReconciled.toLocaleString()} kin</span></div>
                        {#if contract.settlement.externalPaymentUsd !== null}
                            <div class="term"><span class="label">Dollar payment</span><span class="val">${contract.settlement.externalPaymentUsd.toLocaleString()}</span></div>
                        {/if}
                    </div>
                    {#if contract.settlement.disputeRaised}
                        <div class="dispute-flag">⚠ Dispute raised</div>
                    {/if}
                    {#if contract.settlement.notes}
                        <p class="notes">{contract.settlement.notes}</p>
                    {/if}
                </div>
            </section>
        {/if}

        {#if contract.notes}
            <section>
                <h2>Notes</h2>
                <p class="notes">{contract.notes}</p>
            </section>
        {/if}
    {/if}
</div>

<style>
    .page { max-width: 820px; }
    .back { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; padding: 0; }
    .back:hover { color: #e2e8f0; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; }
    .meta { color: #64748b; font-size: 0.9rem; }

    h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.75rem; }
    section { margin-bottom: 2rem; }

    .badge { font-size: 0.85rem; padding: 0.3rem 0.8rem; border-radius: 99px; font-weight: 600; text-transform: capitalize; white-space: nowrap; }
    .badge-active    { background: #14532d; color: #86efac; }
    .badge-proposed  { background: #1e3a5f; color: #93c5fd; }
    .badge-approved  { background: #1e3a5f; color: #93c5fd; }
    .badge-fulfilled { background: #374151; color: #9ca3af; }
    .badge-disputed  { background: #7f1d1d; color: #fca5a5; }
    .badge-cancelled { background: #374151; color: #6b7280; }

    /* Crop plan */
    .crop-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
    .crop-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; }
    .crop-name { font-weight: 700; font-size: 1rem; color: #f1f5f9; margin-bottom: 0.15rem; }
    .crop-cat  { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
    .crop-stats { display: flex; flex-direction: column; gap: 0.3rem; }
    .crop-stats div { display: flex; justify-content: space-between; }

    .label { font-size: 0.82rem; color: #64748b; }
    .val   { font-size: 0.82rem; color: #e2e8f0; font-weight: 500; }
    .val.kin { color: #86efac; }

    /* Payment terms */
    .terms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
    .term { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }

    /* Deliveries */
    .delivery-progress { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .bar-wrap { flex: 1; height: 10px; background: #334155; border-radius: 5px; overflow: hidden; }
    .bar { height: 100%; background: #22c55e; border-radius: 5px; transition: width 0.3s; }
    .bar-label { font-size: 0.82rem; color: #94a3b8; white-space: nowrap; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; padding: 0.4rem 0.6rem; border-bottom: 1px solid #334155; }
    td { padding: 0.6rem; color: #e2e8f0; font-size: 0.85rem; border-bottom: 1px solid #1e293b; }
    .mono { font-family: monospace; color: #94a3b8; }

    /* Inspections */
    .inspection-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .inspection-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1rem; }
    .inspection-card.outcome-violation, .inspection-card.outcome-critical-violation { border-color: #7f1d1d; }
    .inspection-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .ins-date { font-size: 0.85rem; color: #64748b; }
    .outcome-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 99px; font-weight: 600; }
    .outcome-badge.outcome-compliant         { background: #14532d; color: #86efac; }
    .outcome-badge.outcome-minor-concern     { background: #713f12; color: #fde68a; }
    .outcome-badge.outcome-violation         { background: #7f1d1d; color: #fca5a5; }
    .outcome-badge.outcome-critical-violation { background: #450a0a; color: #fca5a5; border: 1px solid #7f1d1d; }
    .ins-findings { font-size: 0.9rem; color: #cbd5e1; margin: 0 0 0.5rem; }
    .violations { font-size: 0.82rem; color: #fca5a5; }
    .followup   { font-size: 0.82rem; color: #fde68a; margin-top: 0.25rem; }

    /* Settlement */
    .settlement-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .settlement-card.dispute { border-color: #7f1d1d; }
    .dispute-flag { color: #fca5a5; font-weight: 600; font-size: 0.9rem; }

    .notes { color: #94a3b8; font-size: 0.9rem; margin: 0; }
    .muted { color: #64748b; }
</style>
