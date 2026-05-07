<script lang="ts">
    import { publishProjection } from "../lib/api.js";
    import type { CropCategory, PlantingWindowSeason } from "../lib/api.js";
    import { currentPage, selectedProjectionId } from "../lib/nav.js";

    // ── Planting window ───────────────────────────────────────────────────────
    let season = $state<PlantingWindowSeason>("fall");
    let year   = $state<number>(new Date().getFullYear() + 1);

    // ── Projection metadata ───────────────────────────────────────────────────
    let memberHeadcount    = $state<number>(0);
    let reserveTargetWeeks = $state<number>(4);

    // ── Crop need entries ─────────────────────────────────────────────────────
    interface CropEntry {
        crop:                     string;
        category:                 CropCategory;
        maxContractLbs:           number;
        minDesiredLbs:            number;
        estimatedPaymentPerLbKin: number;
        notes:                    string;
    }

    function blankCrop(): CropEntry {
        return { crop: "", category: "grain", maxContractLbs: 0, minDesiredLbs: 0, estimatedPaymentPerLbKin: 0, notes: "" };
    }

    let crops = $state<CropEntry[]>([blankCrop()]);

    function addCrop() { crops = [...crops, blankCrop()]; }
    function removeCrop(i: number) { crops = crops.filter((_, idx) => idx !== i); }

    // ── Submission ────────────────────────────────────────────────────────────
    let submitting = $state(false);
    let error      = $state<string | null>(null);

    const plantingWindow = $derived(`${season}-${year}` as `${PlantingWindowSeason}-${number}`);

    async function submit(e: SubmitEvent) {
        e.preventDefault();
        error = null;

        // Basic validation
        if (memberHeadcount < 1) { error = "Member headcount must be at least 1."; return; }
        if (crops.length === 0)  { error = "Add at least one crop need."; return; }
        for (const c of crops) {
            if (!c.crop.trim()) { error = "All crops must have a name."; return; }
            if (c.minDesiredLbs > c.maxContractLbs) {
                error = `Floor cannot exceed ceiling for "${c.crop}".`; return;
            }
        }

        submitting = true;
        try {
            const projection = await publishProjection({
                plantingWindow,
                memberHeadcount,
                reserveTargetWeeks,
                cropNeeds: crops.map(c => ({
                    crop:                     c.crop.trim(),
                    category:                 c.category,
                    maxContractLbs:           c.maxContractLbs,
                    minDesiredLbs:            c.minDesiredLbs,
                    estimatedPaymentPerLbKin: c.estimatedPaymentPerLbKin,
                    notes:                    c.notes.trim(),
                })),
            });
            selectedProjectionId.set(projection.id);
            currentPage.set("projection-detail");
        } catch (err: unknown) {
            error = (err as Error).message;
            submitting = false;
        }
    }

    const seasons: PlantingWindowSeason[] = ["fall", "spring", "main", "perennial"];
    const categories: CropCategory[]       = ["grain", "legume", "vegetable", "fruit", "forage", "other"];
</script>

<div class="page">
    <button class="back" onclick={() => currentPage.set("projections")}>← Projections</button>
    <h1>New Needs Projection</h1>
    <p class="subtitle">
        Signal what the community wants to contract for a planting window. Farms will submit offers
        against individual crop need entries.
    </p>

    <form onsubmit={submit}>

        <!-- Window -->
        <section>
            <h2>Planting window</h2>
            <div class="row">
                <div class="field">
                    <label for="season">Season</label>
                    <select id="season" bind:value={season}>
                        {#each seasons as s}
                            <option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label for="year">Year</label>
                    <input id="year" type="number" min="2020" max="2100" bind:value={year} />
                </div>
                <div class="field preview">
                    <label>Window ID</label>
                    <div class="preview-val">{plantingWindow}</div>
                </div>
            </div>
        </section>

        <!-- Metadata -->
        <section>
            <h2>Community parameters</h2>
            <div class="row">
                <div class="field">
                    <label for="headcount">Member headcount</label>
                    <input id="headcount" type="number" min="1" bind:value={memberHeadcount} />
                </div>
                <div class="field">
                    <label for="reserve">Reserve target (weeks)</label>
                    <input id="reserve" type="number" min="1" max="52" bind:value={reserveTargetWeeks} />
                </div>
            </div>
        </section>

        <!-- Crop needs -->
        <section>
            <h2>Crop needs</h2>
            <p class="help">
                Set the ceiling (maximum contracts accepted) and floor (minimum desired). Farms see
                the signal price but may offer any price — coordinators choose which offers to approve.
            </p>

            {#each crops as crop, i}
                <div class="crop-card">
                    <div class="crop-card-header">
                        <span class="crop-num">Crop {i + 1}</span>
                        {#if crops.length > 1}
                            <button type="button" class="remove-btn" onclick={() => removeCrop(i)}>Remove</button>
                        {/if}
                    </div>

                    <div class="row">
                        <div class="field grow">
                            <label>Crop name</label>
                            <input type="text" placeholder="e.g. Hard red wheat" bind:value={crop.crop} />
                        </div>
                        <div class="field">
                            <label>Category</label>
                            <select bind:value={crop.category}>
                                {#each categories as cat}
                                    <option value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <div class="row three">
                        <div class="field">
                            <label>Floor (min desired lbs)</label>
                            <input type="number" min="0" bind:value={crop.minDesiredLbs} />
                        </div>
                        <div class="field">
                            <label>Ceiling (max contract lbs)</label>
                            <input type="number" min="0" bind:value={crop.maxContractLbs} />
                        </div>
                        <div class="field">
                            <label>Signal price (kin/lb)</label>
                            <input type="number" min="0" step="0.01" bind:value={crop.estimatedPaymentPerLbKin} />
                        </div>
                    </div>

                    <div class="field">
                        <label>Notes <span class="opt">(optional)</span></label>
                        <input type="text" placeholder="Variety preferences, quality specs, etc." bind:value={crop.notes} />
                    </div>
                </div>
            {/each}

            <button type="button" class="add-crop-btn" onclick={addCrop}>+ Add crop</button>
        </section>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <div class="actions">
            <button type="button" class="cancel-btn" onclick={() => currentPage.set("projections")}>Cancel</button>
            <button type="submit" class="submit-btn" disabled={submitting}>
                {submitting ? "Publishing…" : "Publish projection"}
            </button>
        </div>
    </form>
</div>

<style>
    .page { max-width: 760px; }
    .back { background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem; padding: 0; }
    .back:hover { color: #e2e8f0; }
    h1 { margin: 0 0 0.4rem; font-size: 1.8rem; }
    .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }

    h2 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 0.75rem; }
    section { margin-bottom: 2rem; }

    .help { font-size: 0.85rem; color: #64748b; margin: -0.25rem 0 1rem; }

    .row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .row.three { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }

    .field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 160px; }
    .field.grow { flex: 1; }

    label { font-size: 0.8rem; color: #94a3b8; }
    .opt  { color: #475569; }

    input, select {
        background: #0f172a; border: 1px solid #334155; border-radius: 6px;
        color: #e2e8f0; padding: 0.5rem 0.7rem; font-size: 0.9rem; font-family: inherit;
        transition: border-color 0.15s;
    }
    input:focus, select:focus { outline: none; border-color: #64748b; }

    .preview-val {
        background: #0f172a; border: 1px solid #334155; border-radius: 6px;
        padding: 0.5rem 0.7rem; font-size: 0.9rem; color: #94a3b8; font-family: monospace;
    }

    /* Crop cards */
    .crop-card {
        background: #1e293b; border: 1px solid #334155; border-radius: 10px;
        padding: 1.1rem 1.25rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.85rem;
    }
    .crop-card-header { display: flex; justify-content: space-between; align-items: center; }
    .crop-num { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .remove-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.82rem; padding: 0; }
    .remove-btn:hover { color: #fca5a5; }

    .add-crop-btn {
        background: none; border: 1px dashed #475569; border-radius: 8px; color: #64748b;
        padding: 0.6rem 1rem; cursor: pointer; font-size: 0.88rem; width: 100%;
        transition: border-color 0.15s, color 0.15s;
    }
    .add-crop-btn:hover { border-color: #64748b; color: #94a3b8; }

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
</style>
