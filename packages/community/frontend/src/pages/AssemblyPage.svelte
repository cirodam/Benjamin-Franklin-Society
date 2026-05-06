<script lang="ts">
    import { getAssembly, drawAssembly, clearAssembly, listMotions, createMotion, listMotionEffects } from "../lib/api.js";
    import type { AssemblyDto, AssemblySlimPerson, MotionDto, MotionOutcome, MotionEffectKind } from "../lib/api.js";
    import { currentPage, session, selectedMotionId } from "../lib/session.js";
    import EffectPayloadForm from "../components/EffectPayloadForm.svelte";

    let assembly  = $state<AssemblyDto | null>(null);
    let motions   = $state<MotionDto[]>([]);
    let loading   = $state(true);
    let error     = $state("");
    let docketError = $state("");

    // Draw form
    let showDraw   = $state(false);
    let drawDate   = $state("");
    let drawing    = $state(false);
    let drawError  = $state("");

    // Add-to-docket form
    let showAddMotion  = $state(false);
    let addMotionTitle = $state("");
    let addMotionDesc  = $state("");
    let addingMotion   = $state(false);
    let addMotionError = $state("");
    let effectKinds    = $state([] as MotionEffectKind[]);
    let selectedKind   = $state("");
    let effectPayload  = $state<Record<string, unknown>>({});

    $effect(() => {
        if (showAddMotion && !effectKinds.length) {
            listMotionEffects().then(k => { effectKinds = k; }).catch(() => {});
        }
    });

    async function doAddMotion() {
        if (!addMotionTitle.trim() || !addMotionDesc.trim()) return;
        addingMotion = true; addMotionError = "";
        try {
            const m = await createMotion({
                authorityId: "assembly",
                title:       addMotionTitle.trim(),
                description: addMotionDesc.trim(),
                kind:        selectedKind || null,
                payload:     selectedKind ? effectPayload : undefined,
            });
            motions = [...motions, m];
            showAddMotion = false; addMotionTitle = ""; addMotionDesc = "";
            selectedKind = ""; effectPayload = {};
        } catch (e) {
            addMotionError = e instanceof Error ? e.message : "Failed to add motion";
        } finally { addingMotion = false; }
    }

    const isSteward = $derived(($session as any)?.isSteward ?? false);

    async function load() {
        loading = true; error = "";
        try {
            [assembly, motions] = await Promise.all([
                getAssembly(),
                listMotions({ authorityId: "assembly" }),
            ]);
            // pre-fill draw date with canonical term start
            if (assembly && !drawDate) drawDate = assembly.canonicalTermStartDate;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load assembly";
        } finally { loading = false; }
    }

    $effect(() => { load(); });

    async function doDraw() {
        drawing = true; drawError = "";
        try {
            assembly = await drawAssembly(drawDate || undefined);
            showDraw = false;
        } catch (e) {
            drawError = e instanceof Error ? e.message : "Failed to draw assembly";
        } finally { drawing = false; }
    }

    async function doClear() {
        if (!confirm("Clear the current assembly term?")) return;
        try {
            await clearAssembly();
            assembly = assembly ? { ...assembly, termStartDate: null, seated: [] } : null;
        } catch (e) { /* ignore */ }
    }

    const activeMotions   = $derived(motions.filter(m => m.stage !== "resolved"));
    const resolvedMotions = $derived(motions.filter(m => m.stage === "resolved"));

    function openMotion(m: MotionDto) {
        selectedMotionId.set(m.id);
        currentPage.go("motion");
    }


    /** Build the full seat array — seated members first, then nulls for vacancies. */
    function buildSeats(a: AssemblyDto): (AssemblySlimPerson | null)[] {
        const seats: (AssemblySlimPerson | null)[] = [];
        for (let i = 0; i < a.seats; i++) {
            seats.push(a.seated[i] ?? null);
        }
        return seats;
    }

    function initials(p: AssemblySlimPerson): string {
        return (p.firstName[0] ?? "") + (p.lastName[0] ?? "");
    }

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
</script>

<div class="page">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("leadership")}>‹ Leadership</button>
        <h1 class="page-title">The Community Assembly</h1>
        <p class="page-sub">Members drawn by sortition to govern this term.</p>
    </div>

    {#if loading}
        <div class="skeleton" style="height:8rem"></div>
        {#each [1, 2] as _}<div class="skeleton"></div>{/each}
    {:else if error}
        <p class="error-msg">{error}</p>
    {:else if assembly}

        <!-- Term info bar -->
        <div class="term-bar">
            <div class="term-stat">
                <span class="term-label">Seats</span>
                <span class="term-value">{assembly.seats}</span>
            </div>
            <div class="term-stat">
                <span class="term-label">Fraction</span>
                <span class="term-value">{(assembly.fraction * 100).toFixed(1)}%</span>
            </div>
            <div class="term-stat">
                <span class="term-label">Population</span>
                <span class="term-value">{assembly.population}</span>
            </div>
            <div class="term-stat">
                <span class="term-label">Term</span>
                <span class="term-value">{assembly.termMonths} mo</span>
            </div>
        </div>

        <div class="term-window">
            <span class="term-window-label">Current term</span>
            <span class="term-window-dates">
                {formatDate(assembly.canonicalTermStartDate)} → {formatDate(assembly.canonicalTermEndDate)}
            </span>
        </div>

        {#if assembly.termStartDate}
            <p class="term-since">Drew {formatDate(assembly.termStartDate)} · {assembly.seated.length} of {assembly.seats} filled</p>
        {:else}
            <p class="term-since no-term">No term drawn yet.</p>
        {/if}

        <!-- Seat grid -->
        <div class="seat-grid" aria-label="Assembly seats">
            {#each buildSeats(assembly) as seat, i (i)}
                {#if seat}
                    <div
                        class="seat filled"
                        title="{seat.firstName} {seat.lastName} (@{seat.handle})"
                        aria-label="{seat.firstName} {seat.lastName}"
                    >
                        <span class="seat-initials">{initials(seat)}</span>
                    </div>
                {:else}
                    <div class="seat vacant" aria-label="Vacant seat {i + 1}">
                        <span class="seat-vacant-dot"></span>
                    </div>
                {/if}
            {/each}
        </div>

        <!-- Steward draw controls -->
        {#if isSteward}
            <div class="steward-bar">
                {#if !showDraw}
                    <button class="btn-sm btn-primary-sm" onclick={() => { showDraw = true; drawError = ""; }}>Draw new term</button>
                    {#if assembly.termStartDate}
                        <button class="btn-sm btn-danger-sm" onclick={doClear}>Clear term</button>
                    {/if}
                {:else}
                    <div class="draw-form">
                        <label class="draw-label">
                            Term start date
                            <input class="input-sm" type="date" bind:value={drawDate} />
                        </label>
                        {#if drawError}<p class="add-error">{drawError}</p>{/if}
                        <div class="draw-actions">
                            <button class="btn-sm btn-primary-sm" onclick={doDraw} disabled={drawing}>
                                {drawing ? "Drawing…" : "Confirm draw"}
                            </button>
                            <button class="btn-sm" onclick={() => showDraw = false}>Cancel</button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}

    <!-- Docket -->
    <hr class="divider" />
    <div class="docket-header">
        <h2 class="section-heading">Docket</h2>
        {#if $session}
            <button class="btn-add" onclick={() => { showAddMotion = !showAddMotion; addMotionError = ""; }}>
                {showAddMotion ? "Cancel" : "＋ Add"}
            </button>
        {/if}
    </div>

    {#if showAddMotion}
        <div class="add-form">
            <input class="input-sm add-input" type="text" placeholder="Title" bind:value={addMotionTitle} disabled={addingMotion} />
            <textarea class="input-sm add-input" rows={3} placeholder="Describe the motion…" bind:value={addMotionDesc} disabled={addingMotion}></textarea>
            {#if effectKinds.length}
                <select class="input-sm add-input" bind:value={selectedKind} onchange={() => { effectPayload = {}; }}>
                    <option value="">No automated effect</option>
                    {#each effectKinds.filter(k => !k.bodyHint || k.bodyHint === "assembly") as k (k.kind)}
                        <option value={k.kind}>{k.label}</option>
                    {/each}
                </select>
                {#if selectedKind}
                    <div class="effect-fields">
                        <EffectPayloadForm kind={selectedKind} bind:payload={effectPayload} />
                    </div>
                {/if}
            {/if}
            {#if addMotionError}<p class="add-error">{addMotionError}</p>{/if}
            <div class="docket-actions">
                <button class="btn-sm btn-primary-sm" onclick={doAddMotion} disabled={addingMotion || !addMotionTitle.trim() || !addMotionDesc.trim()}>
                    {addingMotion ? "Adding…" : "Add to docket"}
                </button>
            </div>
        </div>
    {/if}

    {#if activeMotions.length === 0 && resolvedMotions.length === 0 && !showAddMotion}
        <p class="empty-msg">No motions on the docket.</p>
    {:else}
        {#each activeMotions as m (m.id)}
            <div class="docket-card">
                <button class="docket-title" onclick={() => openMotion(m)}>{m.title}</button>
                <span class="docket-stage">{m.stage}</span>
            </div>
        {/each}
        {#if resolvedMotions.length > 0}
            <details class="resolved-details">
                <summary>Resolved ({resolvedMotions.length})</summary>
                {#each resolvedMotions as m (m.id)}
                    <button class="docket-card docket-resolved" onclick={() => openMotion(m)}>
                        <span class="docket-title-text">{m.title}</span>
                        <span class="docket-outcome">{m.outcome}</span>
                    </button>
                {/each}
            </details>
        {/if}
    {/if}
    {#if docketError}<p class="error-msg">{docketError}</p>{/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    @media (min-width: 768px) {
        .page { padding-bottom: 2rem; }
    }

    .page-header { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.25rem; }

    .back-btn {
        background: none; border: none; color: #16a34a; font-size: 0.875rem;
        font-weight: 600; cursor: pointer; padding: 0; text-align: left; margin-bottom: 0.25rem;
    }

    .page-title { font-size: 1.3rem; font-weight: 700; color: #0f172a; margin: 0; }
    .page-sub   { font-size: 0.82rem; color: #64748b; margin: 0; }

    /* ── Term info ─────────────────────────────────────────────────────────────── */
    .term-bar {
        display: flex; gap: 0.5rem; flex-wrap: wrap;
        background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.75rem;
        padding: 0.75rem 1rem;
    }
    .term-stat { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 3.5rem; }
    .term-label { font-size: 0.65rem; color: #4ade80; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .term-value { font-size: 1.1rem; font-weight: 800; color: #15803d; }

    .term-since { font-size: 0.78rem; color: #64748b; margin: -0.25rem 0 0; }
    .term-since.no-term { color: #94a3b8; font-style: italic; }
    .term-window {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 0.5rem 0.85rem;
        margin: 0.5rem 0 0.25rem;
    }
    .term-window-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.04em; }
    .term-window-dates { font-size: 0.85rem; color: #166534; }

    /* ── Seat grid ─────────────────────────────────────────────────────────────── */
    .seat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
        gap: 0.4rem;
    }

    .seat {
        aspect-ratio: 1;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: default;
        transition: transform 0.12s;
    }

    .seat.filled {
        background: #16a34a;
        color: #fff;
        box-shadow: 0 1px 3px rgba(22,163,74,0.25);
    }
    .seat.filled:hover { transform: scale(1.12); box-shadow: 0 3px 8px rgba(22,163,74,0.35); }

    .seat.vacant {
        background: #f1f5f9;
        border: 1px dashed #cbd5e1;
    }

    .seat-initials { font-size: 0.7rem; font-weight: 800; letter-spacing: -0.03em; user-select: none; }

    .seat-vacant-dot {
        width: 0.4rem; height: 0.4rem;
        border-radius: 50%;
        background: #cbd5e1;
    }

    /* ── Steward draw bar ────────────────────────────────────────────────────── */
    .steward-bar { display: flex; gap: 0.5rem; align-items: flex-start; flex-wrap: wrap; }

    .draw-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem;
        padding: 0.9rem 1rem; width: 100%;
    }
    .draw-label { font-size: 0.78rem; font-weight: 600; color: #334155; display: flex; flex-direction: column; gap: 0.25rem; }
    .draw-actions { display: flex; gap: 0.4rem; }

    .skeleton {
        height: 3.5rem;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.3s infinite;
        border-radius: 0.75rem;
    }

    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .error-msg { font-size: 0.875rem; color: #dc2626; padding: 0.75rem 1rem; background: #fef2f2; border-radius: 0.5rem; margin: 0; }
    .empty-msg { font-size: 0.875rem; color: #64748b; margin: 0; }

    /* ── Docket ──────────────────────────────────────────────────────────────── */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0.25rem 0; }
    .section-heading { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0; }

    .docket-card {
        display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
        padding: 0.75rem 1rem; background: #fff; border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
    }
    .docket-card.docket-resolved { cursor: pointer; background: #f8fafc; width: 100%; box-sizing: border-box; }
    .docket-title {
        background: none; border: none; cursor: pointer; font-size: 0.9rem;
        font-weight: 600; color: #0f172a; padding: 0; text-align: left; flex: 1;
    }
    .docket-title-text { font-size: 0.875rem; font-weight: 500; color: #334155; flex: 1; }
    .docket-stage  { font-size: 0.72rem; color: #64748b; background: #f1f5f9; padding: 0.15rem 0.5rem; border-radius: 9999px; }
    .docket-outcome { font-size: 0.72rem; color: #64748b; }
    .docket-actions { display: flex; gap: 0.4rem; flex-basis: 100%; }

    .btn-sm {
        padding: 0.3rem 0.65rem; background: #f0fdf4; border: 1px solid #86efac;
        border-radius: 0.4rem; color: #15803d; font-size: 0.75rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary-sm { background: #16a34a; color: #fff; border-color: #16a34a; }
    .btn-danger-sm  { background: #fef2f2; border-color: #fca5a5; color: #dc2626; }
    .input-sm {
        padding: 0.3rem 0.55rem; border: 1px solid #e2e8f0; border-radius: 0.4rem;
        font-size: 0.8rem; background: #fff; outline: none; font-family: inherit;
    }

    .resolved-details { font-size: 0.8rem; color: #64748b; }
    .resolved-details summary { cursor: pointer; padding: 0.3rem 0; font-weight: 600; }

    .docket-header { display: flex; align-items: center; justify-content: space-between; }

    .btn-add {
        background: transparent; border: 1px dashed #86efac; border-radius: 6px;
        color: #15803d; font-size: 0.78rem; font-weight: 600; padding: 0.25rem 0.65rem; cursor: pointer;
    }
    .btn-add:hover { background: #f0fdf4; }

    .add-form {
        display: flex; flex-direction: column; gap: 0.5rem;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem;
        padding: 0.9rem 1rem;
    }
    .add-input {
        width: 100%; box-sizing: border-box; border-radius: 0.5rem;
        border: 1px solid #cbd5e1; font-family: inherit; font-size: 0.875rem;
        padding: 0.45rem 0.7rem; outline: none; resize: vertical;
    }
    .add-input:focus { border-color: #16a34a; }
    .add-error { font-size: 0.78rem; color: #dc2626; margin: 0; }
    .effect-fields { display: flex; flex-direction: column; gap: 0.4rem; }
</style>
