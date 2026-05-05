<script lang="ts">
    import { onMount } from "svelte";
    import {
        listFarms, listProjections, getProjection,
        submitContract,
    } from "../lib/api.js";
    import type {
        FarmAssociation, NeedsProjection, CropNeedEntry,
        CropCategory, ContractType, DeliveryScheduleEntry,
    } from "../lib/api.js";
    import {
        currentPage, selectedContractId, offerProjectionId,
    } from "../lib/nav.js";
    import { session } from "../lib/session.js";

    // ── Load data ─────────────────────────────────────────────────────────────
    let myFarms      = $state<FarmAssociation[]>([]);
    let projections  = $state<NeedsProjection[]>([]);
    let selectedProj = $state<NeedsProjection | null>(null);
    let loading      = $state(true);

    onMount(async () => {
        const personId = $session?.personId ?? "";
        const [allFarms, allProjs] = await Promise.all([
            listFarms({ status: "eligible" }),
            listProjections(),
        ]);
        // Only farms where the logged-in person is an operator
        myFarms     = allFarms.filter(f => f.operatorIds.includes(personId));
        projections = allProjs;

        // Pre-select projection if we arrived from projection-detail
        const preselect = $offerProjectionId;
        if (preselect) {
            const found = allProjs.find(p => p.id === preselect);
            if (found) { selectedProj = found; syncCropRows(); }
        }

        loading = false;
    });

    async function onProjectionChange(id: string) {
        selectedProj = projections.find(p => p.id === id) ?? null;
        cropRows = [];
        if (selectedProj) syncCropRows();
    }

    // ── Farm selection ────────────────────────────────────────────────────────
    let farmId = $state<string>("");

    // ── Crop plan rows ────────────────────────────────────────────────────────
    interface CropRow {
        needEntry:          CropNeedEntry;
        included:           boolean;
        acreage:            number;
        estimatedYieldLbs:  number;
        floorYieldLbs:      number;
        ceilingYieldLbs:    number;
        reserveAllocationPct: number;
        deliveryDates:      string; // comma-separated ISO dates
        deliveryLbs:        string; // comma-separated lbs matching dates
    }

    let cropRows = $state<CropRow[]>([]);

    function syncCropRows() {
        if (!selectedProj) return;
        cropRows = selectedProj.cropNeeds.map(n => ({
            needEntry:           n,
            included:            false,
            acreage:             0,
            estimatedYieldLbs:   0,
            floorYieldLbs:       0,
            ceilingYieldLbs:     n.maxContractLbs,
            reserveAllocationPct: 10,
            deliveryDates:       "",
            deliveryLbs:         "",
        }));
    }

    const includedRows = $derived(cropRows.filter(r => r.included));

    // ── Payment terms ─────────────────────────────────────────────────────────
    let basePaymentKin        = $state<number>(0);
    let advancePaymentKin     = $state<number>(0);
    let surplusFarmerPct      = $state<number>(60);
    let externalPaymentUsd    = $state<string>(""); // blank = null
    let contractType          = $state<ContractType>("annual");
    let notes                 = $state<string>("");

    const surplusCommunityPct = $derived(100 - surplusFarmerPct);

    // ── Submission ────────────────────────────────────────────────────────────
    let submitting = $state(false);
    let error      = $state<string | null>(null);

    function parseDeliverySchedule(row: CropRow): DeliveryScheduleEntry[] {
        const dates = row.deliveryDates.split(",").map(s => s.trim()).filter(Boolean);
        const lbsArr = row.deliveryLbs.split(",").map(s => Number(s.trim())).filter(v => !isNaN(v));
        return dates.map((date, i) => ({ date, estimatedLbs: lbsArr[i] ?? 0 }));
    }

    async function submit(e: SubmitEvent) {
        e.preventDefault();
        error = null;

        if (!farmId)        { error = "Select a farm."; return; }
        if (!selectedProj)  { error = "Select a planting projection."; return; }
        if (includedRows.length === 0) { error = "Include at least one crop in your offer."; return; }

        for (const r of includedRows) {
            if (r.acreage <= 0)           { error = `Enter acreage for ${r.needEntry.crop}.`; return; }
            if (r.estimatedYieldLbs <= 0) { error = `Enter estimated yield for ${r.needEntry.crop}.`; return; }
            if (r.estimatedYieldLbs > r.needEntry.maxContractLbs) {
                error = `Estimated yield for ${r.needEntry.crop} exceeds the community's ceiling (${r.needEntry.maxContractLbs.toLocaleString()} lbs).`; return;
            }
            if (r.floorYieldLbs > r.ceilingYieldLbs) {
                error = `Floor yield cannot exceed ceiling for ${r.needEntry.crop}.`; return;
            }
            if (r.reserveAllocationPct < 0 || r.reserveAllocationPct > 100) {
                error = `Reserve % must be 0–100 for ${r.needEntry.crop}.`; return;
            }
        }
        if (basePaymentKin < 0)     { error = "Base payment cannot be negative."; return; }
        if (advancePaymentKin < 0)  { error = "Advance payment cannot be negative."; return; }
        if (advancePaymentKin > basePaymentKin) { error = "Advance cannot exceed base payment."; return; }
        if (surplusFarmerPct < 0 || surplusFarmerPct > 100) { error = "Surplus split must be 0–100."; return; }

        submitting = true;
        try {
            const contract = await submitContract({
                farmId,
                needsProjectionId:   selectedProj!.id,
                contractType,
                plantingWindow:      selectedProj!.plantingWindow,
                notes:               notes.trim(),
                resourceCommitments: [],
                cropPlan: includedRows.map(r => ({
                    cropNeedEntryId:      r.needEntry.id,
                    crop:                 r.needEntry.crop,
                    category:             r.needEntry.category as CropCategory,
                    acreage:              r.acreage,
                    estimatedYieldLbs:    r.estimatedYieldLbs,
                    floorYieldLbs:        r.floorYieldLbs,
                    ceilingYieldLbs:      r.ceilingYieldLbs,
                    deliverySchedule:     parseDeliverySchedule(r),
                    reserveAllocationPct: r.reserveAllocationPct,
                })),
                paymentTerms: {
                    basePaymentKin,
                    advancePaymentKin,
                    advanceMilestones:        [],
                    surplusSplitFarmerPct:    surplusFarmerPct,
                    surplusSplitCommunityPct: surplusCommunityPct,
                    externalPaymentUsd:       externalPaymentUsd.trim() ? Number(externalPaymentUsd) : null,
                },
            });
            selectedContractId.set(contract.id);
            offerProjectionId.set(null);
            currentPage.set("contract-detail");
        } catch (err: unknown) {
            error = (err as Error).message;
            submitting = false;
        }
    }

    function windowLabel(w: string): string {
        const [season, year] = w.split("-");
        return `${season.charAt(0).toUpperCase() + season.slice(1)} ${year}`;
    }

    function cancel() {
        const returnTo = $offerProjectionId ? "projection-detail" : "contracts";
        offerProjectionId.set(null);
        currentPage.set(returnTo);
    }
</script>

<div class="page">
    <button class="back" onclick={cancel}>← Back</button>
    <h1>Submit Contract Offer</h1>
    <p class="subtitle">
        Offer to supply specific crops against an open needs projection.
        Stewards will review and approve or decline your offer.
    </p>

    {#if loading}
        <p class="muted">Loading…</p>
    {:else if myFarms.length === 0}
        <div class="notice">
            <strong>No eligible farms found.</strong>
            Your account isn't listed as an operator on any eligible farm association.
            Contact a steward to register your farm or update its status.
        </div>
    {:else}
    <form onsubmit={submit}>

        <!-- Farm + projection selectors -->
        <section>
            <h2>Farm &amp; planting window</h2>
            <div class="row">
                <div class="field grow">
                    <label for="farm">Your farm</label>
                    <select id="farm" bind:value={farmId} required>
                        <option value="">— Select farm —</option>
                        {#each myFarms as f (f.id)}
                            <option value={f.id}>{f.name} ({f.location})</option>
                        {/each}
                    </select>
                </div>
                <div class="field grow">
                    <label for="proj">Planting projection</label>
                    <select
                        id="proj"
                        value={selectedProj?.id ?? ""}
                        onchange={e => onProjectionChange((e.currentTarget as HTMLSelectElement).value)}
                        required
                    >
                        <option value="">— Select projection —</option>
                        {#each projections as p (p.id)}
                            <option value={p.id}>{windowLabel(p.plantingWindow)}{p.approvedByMotionId ? "" : " (pending approval)"}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label for="ctype">Contract type</label>
                    <select id="ctype" bind:value={contractType}>
                        <option value="annual">Annual</option>
                        <option value="perennial">Perennial</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- Crop plan -->
        {#if selectedProj}
        <section>
            <h2>Crop offer</h2>
            <p class="help">
                Check each crop you can supply. Estimated yield must not exceed the community's ceiling.
                Floor and ceiling yield define your acceptable delivery range.
            </p>

            {#each cropRows as row, i (row.needEntry.id)}
                <div class="crop-block" class:included={row.included}>
                    <div class="crop-block-top">
                        <label class="crop-check">
                            <input type="checkbox" bind:checked={row.included} />
                            <span class="crop-name">{row.needEntry.crop}</span>
                            <span class="crop-cat">{row.needEntry.category}</span>
                        </label>
                        <div class="need-signal">
                            <span class="signal-item">Ceiling: <strong>{row.needEntry.maxContractLbs.toLocaleString()} lbs</strong></span>
                            <span class="signal-item">Floor: <strong>{row.needEntry.minDesiredLbs.toLocaleString()} lbs</strong></span>
                            <span class="signal-item">Signal price: <strong>{row.needEntry.estimatedPaymentPerLbKin} kin/lb</strong></span>
                        </div>
                    </div>

                    {#if row.included}
                        <div class="crop-fields">
                            <div class="row four">
                                <div class="field">
                                    <label>Acreage</label>
                                    <input type="number" min="0" step="0.1" bind:value={row.acreage} placeholder="ac" />
                                </div>
                                <div class="field">
                                    <label>Estimated yield (lbs)</label>
                                    <input type="number" min="0" bind:value={row.estimatedYieldLbs} />
                                    {#if row.estimatedYieldLbs > row.needEntry.maxContractLbs}
                                        <span class="warn">Exceeds ceiling</span>
                                    {/if}
                                </div>
                                <div class="field">
                                    <label>Floor yield (lbs)</label>
                                    <input type="number" min="0" bind:value={row.floorYieldLbs} />
                                </div>
                                <div class="field">
                                    <label>Ceiling yield (lbs)</label>
                                    <input type="number" min="0" bind:value={row.ceilingYieldLbs} />
                                </div>
                            </div>
                            <div class="row">
                                <div class="field short">
                                    <label>Reserve allocation %</label>
                                    <input type="number" min="0" max="100" bind:value={row.reserveAllocationPct} />
                                </div>
                                <div class="field grow">
                                    <label>Delivery dates <span class="opt">(comma-separated, optional)</span></label>
                                    <input type="text" placeholder="2026-10-15, 2026-11-01" bind:value={row.deliveryDates} />
                                </div>
                                <div class="field grow">
                                    <label>Estimated lbs per date <span class="opt">(matching order)</span></label>
                                    <input type="text" placeholder="5000, 3000" bind:value={row.deliveryLbs} />
                                </div>
                            </div>
                            {#if row.needEntry.notes}
                                <div class="need-notes">Community note: {row.needEntry.notes}</div>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/each}
        </section>
        {/if}

        <!-- Payment terms -->
        <section>
            <h2>Payment terms</h2>
            <p class="help">
                Propose the kin payment you're seeking. The steward may negotiate before approval.
                The signal price × your estimated yield is a reasonable starting point.
            </p>
            {#if selectedProj && includedRows.length > 0}
                {@const signalTotal = includedRows.reduce((s, r) =>
                    s + r.estimatedYieldLbs * r.needEntry.estimatedPaymentPerLbKin, 0)}
                <div class="signal-hint">
                    Signal price × estimated yield = <strong>{signalTotal.toLocaleString()} kin</strong>
                </div>
            {/if}
            <div class="row">
                <div class="field">
                    <label for="base">Base payment (kin)</label>
                    <input id="base" type="number" min="0" bind:value={basePaymentKin} />
                </div>
                <div class="field">
                    <label for="advance">Advance payment (kin)</label>
                    <input id="advance" type="number" min="0" bind:value={advancePaymentKin} />
                </div>
                <div class="field">
                    <label for="surplus">Surplus to farmer (%)</label>
                    <input id="surplus" type="number" min="0" max="100" bind:value={surplusFarmerPct} />
                    <span class="opt">{surplusCommunityPct}% stays with community</span>
                </div>
                <div class="field">
                    <label for="usd">Dollar component <span class="opt">(optional)</span></label>
                    <input id="usd" type="number" min="0" step="0.01" placeholder="0.00" bind:value={externalPaymentUsd} />
                </div>
            </div>
        </section>

        <!-- Notes -->
        <section>
            <h2>Notes <span class="opt">(optional)</span></h2>
            <textarea rows="3" placeholder="Any additional context for stewards — soil conditions, planned practices, constraints…" bind:value={notes}></textarea>
        </section>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <div class="actions">
            <button type="button" class="cancel-btn" onclick={cancel}>Cancel</button>
            <button type="submit" class="submit-btn" disabled={submitting || includedRows.length === 0}>
                {submitting ? "Submitting…" : "Submit offer"}
            </button>
        </div>

    </form>
    {/if}
</div>

<style>
    .page { max-width: 820px; }
    .back { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; padding: 0; }
    .back:hover { color: #e2e8f0; }
    h1 { margin: 0 0 0.4rem; font-size: 1.8rem; }
    .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }

    h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.6rem; }
    section { margin-bottom: 2rem; }
    .help { font-size: 0.85rem; color: #64748b; margin: -0.2rem 0 0.9rem; }

    .row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .row.four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.9rem; }

    .field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 140px; }
    .field.grow  { flex: 1; }
    .field.short { max-width: 160px; }

    label { font-size: 0.8rem; color: #94a3b8; }
    .opt  { color: #475569; font-weight: 400; }

    input[type="text"],
    input[type="number"],
    select,
    textarea {
        background: #0f172a; border: 1px solid #334155; border-radius: 6px;
        color: #e2e8f0; padding: 0.5rem 0.7rem; font-size: 0.9rem; font-family: inherit;
        transition: border-color 0.15s; width: 100%;
    }
    input:focus, select:focus, textarea:focus { outline: none; border-color: #64748b; }
    textarea { resize: vertical; }

    .warn { font-size: 0.78rem; color: #fca5a5; }

    /* Crop blocks */
    .crop-block {
        border: 1px solid #334155; border-radius: 10px; margin-bottom: 0.75rem;
        overflow: hidden; transition: border-color 0.15s;
    }
    .crop-block.included { border-color: #475569; }
    .crop-block-top {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.85rem 1rem; gap: 1rem; flex-wrap: wrap;
    }
    .crop-check { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
    .crop-check input[type="checkbox"] { width: 1rem; height: 1rem; accent-color: #22c55e; }
    .crop-name { font-weight: 600; color: #f1f5f9; font-size: 0.95rem; }
    .crop-cat  { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 0.25rem; }

    .need-signal { display: flex; gap: 1rem; flex-wrap: wrap; }
    .signal-item { font-size: 0.82rem; color: #64748b; }
    .signal-item strong { color: #94a3b8; }

    .crop-fields {
        padding: 0.85rem 1rem 1rem; border-top: 1px solid #334155;
        background: #0f172a; display: flex; flex-direction: column; gap: 0.85rem;
    }
    .need-notes { font-size: 0.82rem; color: #64748b; font-style: italic; }

    /* Signal hint */
    .signal-hint {
        font-size: 0.88rem; color: #64748b; margin-bottom: 0.75rem;
    }
    .signal-hint strong { color: #86efac; }

    /* Notice */
    .notice {
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 1.25rem 1.5rem; font-size: 0.9rem; color: #94a3b8; line-height: 1.6;
    }
    .notice strong { color: #f1f5f9; }

    /* Error */
    .error {
        background: #7f1d1d; border: 1px solid #991b1b; border-radius: 8px;
        color: #fca5a5; padding: 0.75rem 1rem; font-size: 0.88rem; margin-bottom: 1.25rem;
    }

    /* Actions */
    .actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .cancel-btn {
        background: none; border: 1px solid #334155; border-radius: 8px;
        color: #94a3b8; padding: 0.6rem 1.25rem; cursor: pointer; font-size: 0.9rem;
    }
    .cancel-btn:hover { background: #1e293b; color: #e2e8f0; }
    .submit-btn {
        background: #16a34a; border: none; border-radius: 8px;
        color: #fff; padding: 0.6rem 1.5rem; cursor: pointer; font-size: 0.9rem; font-weight: 600;
        transition: background 0.15s;
    }
    .submit-btn:hover:not(:disabled) { background: #15803d; }
    .submit-btn:disabled { background: #166534; color: #86efac; cursor: not-allowed; opacity: 0.7; }

    .muted { color: #64748b; }
</style>
