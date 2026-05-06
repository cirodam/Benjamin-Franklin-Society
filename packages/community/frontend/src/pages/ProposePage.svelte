<script lang="ts">
    import { listMotionEffects, getAuthorities, createMotion } from "../lib/api.js";
    import type { MotionEffectKind, AuthorityDto } from "../lib/api.js";
    import { currentPage, session, selectedMotionId, selectedAuthorityId } from "../lib/session.js";
    import EffectPayloadForm from "../components/EffectPayloadForm.svelte";
    import AuthorityBadge from "../components/AuthorityBadge.svelte";

    // Static metadata per effect kind (icon + description)
    const ACTION_META: Record<string, { icon: string; desc: string }> = {
        "amend-constitution":       { icon: "§",  desc: "Change a constitutional parameter such as term length or vote thresholds." },
        "set-dues-rate":            { icon: "⊕",  desc: "Set the monthly dues rate charged to all members." },
        "set-retirement-age":       { icon: "◷",  desc: "Change the age at which members become eligible for retirement benefits." },
        "set-retirement-payout":    { icon: "⊜",  desc: "Change the monthly kin paid to each retiree." },
        "admit-member":              { icon: "◉",  desc: "Admit a new person to the community via membership petition." },
        "suspend-member":           { icon: "⊘",  desc: "Suspend a member's participation pending review." },
        "reinstate-member":         { icon: "⊛",  desc: "Reinstate a previously suspended member." },
        "add-pool":                  { icon: "★",  desc: "Create a new named leadership pool or governing council." },
        "remove-pool":               { icon: "✕",  desc: "Dissolve an existing leadership pool." },
        "accept-nomination":        { icon: "✓",  desc: "Formally confirm a pending leadership nomination." },
        "schedule-community-event": { icon: "◷",  desc: "Put a recurring or one-time event on the community calendar." },
        "create-bylaw":             { icon: "§",  desc: "Adopt a new bylaw that governs community conduct or operations." },
        "amend-bylaw":              { icon: "✎",  desc: "Amend the title, preamble, or expiry of an existing bylaw." },
        "add-role-type":            { icon: "◈",  desc: "Add a new occupational role type to the community role bank." },
        "remove-role-type":         { icon: "◈",  desc: "Remove an occupational role type from the role bank." },
        "add-unit-type":            { icon: "⊡",  desc: "Define a new functional unit type (e.g. a new kind of institution)." },
        "remove-unit-type":         { icon: "⊡",  desc: "Remove a custom unit type from the unit bank." },
        "deploy-unit":              { icon: "⊞",  desc: "Stand up a new functional unit (clinic, school, kitchen, etc.) in a domain." },
        "found-marketplace":        { icon: "⊙",  desc: "Establish a new marketplace at a physical location." },
        "create-association":       { icon: "⊟",  desc: "Register a new association, cooperative, club, or business." },
        "add-pool-member":          { icon: "◉",  desc: "Add an existing member directly to a leadership pool via petition." },
    };

    const isSteward = $derived($session?.isSteward ?? false);

    let effects     = $state<MotionEffectKind[]>([]);
    let authorities = $state<AuthorityDto[]>([]);
    let loading     = $state(true);
    let error       = $state("");

    // Authority filter — "all" means show everything grouped as before
    let filterAuthorityId = $state("all");

    // Form state
    let selectedKind  = $state("");
    let formTitle     = $state("");
    let formDesc      = $state("");
    let formAuthority = $state("");
    let formPayload   = $state<Record<string, unknown>>({});
    let submitting    = $state(false);
    let submitError   = $state("");

    async function load() {
        error = "";
        try {
            [effects, authorities] = await Promise.all([listMotionEffects(), getAuthorities()]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    function selectKind(k: MotionEffectKind) {
        if (selectedKind === k.kind) {
            selectedKind = "";
            return;
        }
        selectedKind  = k.kind;
        formTitle     = "";
        formDesc      = "";
        formPayload   = {};
        submitError   = "";
        // Pre-fill authority from the effect's declared authorityId
        if (k.authorityId) {
            formAuthority = k.authorityId;
        } else {
            formAuthority = filterAuthorityId !== "all" ? filterAuthorityId : (authorities[0]?.id ?? "assembly");
        }
    }

    async function submit() {
        if (!formTitle.trim() || !formDesc.trim() || !formAuthority) return;
        submitting = true;
        submitError = "";
        try {
            const motion = await createMotion({
                authorityId: formAuthority,
                title:       formTitle.trim(),
                description: formDesc.trim(),
                kind:        selectedKind || null,
                payload:     selectedKind ? JSON.stringify(formPayload) : undefined,
            });
            selectedMotionId.set(motion.id);
            currentPage.go("motion");
        } catch (e) {
            submitError = e instanceof Error ? e.message : "Failed to create motion";
            submitting = false;
        }
    }

    // Build power lookup: action → { sectionId, docId } from the authority with that power
    const powerSource = $derived.by(() => {
        const map = new Map<string, { sectionId: string; docId: string; authorityId: string }>();
        for (const a of authorities) {
            for (const p of a.powers) {
                if (!map.has(p.action)) map.set(p.action, { sectionId: p.sectionId, docId: p.docId, authorityId: a.id });
            }
        }
        return map;
    });

    // Filter kinds by selected authority
    const visibleEffects = $derived.by(() => {
        if (filterAuthorityId === "all") return effects;
        const auth = authorities.find(a => a.id === filterAuthorityId);
        if (!auth) return effects;
        const grantedActions = new Set(auth.powers.map(p => p.action));
        // Show kinds this authority governs + kinds with no authority declared (free-form)
        return effects.filter(k => !k.authorityId || grantedActions.has(k.kind) || k.authorityId === filterAuthorityId);
    });

    // After filtering, group by governing authority
    const governedGroups = $derived.by(() => {
        const groups = new Map<string, MotionEffectKind[]>();
        const free: MotionEffectKind[] = [];
        for (const k of visibleEffects) {
            if (k.authorityId) {
                if (!groups.has(k.authorityId)) groups.set(k.authorityId, []);
                groups.get(k.authorityId)!.push(k);
            } else {
                free.push(k);
            }
        }
        return { groups, free };
    });

    function meta(kind: string) {
        return ACTION_META[kind] ?? { icon: "⊕", desc: "" };
    }

    function authorityName(id: string): string {
        return authorities.find(a => a.id === id)?.name ?? id;
    }

    function openAuthorityPage(id: string) {
        selectedAuthorityId.set(id);
        currentPage.go("authority");
    }
</script>

<div class="page">
    <div class="page-header">
        <button class="back-btn" onclick={() => currentPage.go("dashboard")}>‹ Back</button>
        <h2 class="page-title">Propose an Action</h2>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else}

        <!-- Authority filter pills -->
        {#if authorities.length > 0}
            <div class="authority-filter">
                <button
                    class="filter-pill"
                    class:active={filterAuthorityId === "all"}
                    onclick={() => { filterAuthorityId = "all"; selectedKind = ""; }}
                >All</button>
                {#each authorities as a (a.id)}
                    <button
                        class="filter-pill"
                        class:active={filterAuthorityId === a.id}
                        onclick={() => { filterAuthorityId = a.id; selectedKind = ""; }}
                    >{a.name}</button>
                {/each}
            </div>
        {/if}

        {#snippet kindList(kinds: MotionEffectKind[])}
            {#each kinds as k (k.kind)}
                {@const m = meta(k.kind)}
                {@const isSelected = selectedKind === k.kind}
                {@const src = powerSource.get(k.kind)}
                <div class="action-card" class:selected={isSelected}>
                    <button class="card-btn" onclick={() => selectKind(k)}>
                        <span class="card-icon">{m.icon}</span>
                        <div class="card-body">
                            <span class="card-label">
                                {k.label}
                                {#if src}
                                    <span class="power-source" title="Jurisdiction declared in §{src.sectionId}">§{src.sectionId}</span>
                                {/if}
                            </span>
                            <span class="card-desc">{m.desc}</span>
                        </div>
                        <span class="card-chevron">{isSelected ? "▲" : "▼"}</span>
                    </button>

                    {#if isSelected}
                        <div class="inline-form">
                            <label class="field-label">Motion title
                                <input
                                    class="field-input"
                                    type="text"
                                    placeholder="Brief, descriptive title…"
                                    bind:value={formTitle}
                                    disabled={submitting}
                                />
                            </label>

                            <label class="field-label">Rationale
                                <textarea
                                    class="field-input"
                                    rows={3}
                                    placeholder="Explain why this action should be taken…"
                                    bind:value={formDesc}
                                    disabled={submitting}
                                ></textarea>
                            </label>

                            {#if !k.authorityId}
                                <label class="field-label">Authority
                                    <select class="field-input" bind:value={formAuthority} disabled={submitting}>
                                        {#each authorities as a (a.id)}
                                            <option value={a.id}>{a.name}</option>
                                        {/each}
                                    </select>
                                </label>
                            {:else}
                                <div class="field-label">Authority
                                    <div class="authority-row">
                                        <AuthorityBadge authorityId={formAuthority} {authorities} />
                                        <span class="authority-fixed-note">(fixed by action type)</span>
                                    </div>
                                </div>
                            {/if}

                            <div class="effect-fields">
                                <EffectPayloadForm kind={k.kind} bind:payload={formPayload} />
                            </div>

                            {#if submitError}
                                <p class="submit-error">{submitError}</p>
                            {/if}

                            <div class="form-actions">
                                <button
                                    class="btn-propose"
                                    onclick={submit}
                                    disabled={submitting || !formTitle.trim() || !formDesc.trim()}
                                >
                                    {submitting ? "Submitting…" : "Create draft motion"}
                                </button>
                                <button class="btn-cancel" onclick={() => { selectedKind = ""; }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        {/snippet}

        {#if filterAuthorityId === "all"}
            <!-- Default grouped view -->
            {#each [...governedGroups.groups.entries()] as [authorityId, kinds] (authorityId)}
                <section class="group">
                    <div class="group-header">
                        <button class="authority-link" onclick={() => openAuthorityPage(authorityId)}>
                            <AuthorityBadge {authorityId} {authorities} />
                        </button>
                        <span class="group-hint">Governed by {authorityName(authorityId)}</span>
                    </div>
                    {@render kindList(kinds)}
                </section>
            {/each}
            {#if governedGroups.free.length}
                <section class="group">
                    <div class="group-header">
                        <span class="group-label">General</span>
                        <span class="group-hint">Choose which authority votes on these</span>
                    </div>
                    {@render kindList(governedGroups.free)}
                </section>
            {/if}
        {:else}
            <!-- Filtered view: all visible effects flat, grouped same way -->
            {#each [...governedGroups.groups.entries()] as [authorityId, kinds] (authorityId)}
                <section class="group">
                    <div class="group-header">
                        <button class="authority-link" onclick={() => openAuthorityPage(authorityId)}>
                            <AuthorityBadge {authorityId} {authorities} />
                        </button>
                        <span class="group-hint">Governed by {authorityName(authorityId)}</span>
                    </div>
                    {@render kindList(kinds)}
                </section>
            {/each}
            {#if governedGroups.free.length}
                <section class="group">
                    <div class="group-header">
                        <span class="group-label">General</span>
                        <span class="group-hint">Choose which authority votes on these</span>
                    </div>
                    {@render kindList(governedGroups.free)}
                </section>
            {/if}
            {#if visibleEffects.length === 0}
                <p class="empty-note">No actions are governed by this authority.</p>
            {/if}
        {/if}

    {/if}
</div>

<style>
    .page {
        padding: 1.5rem 1.5rem 6rem;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .back-btn {
        background: none;
        border: none;
        color: #16a34a;
        font-size: 1rem;
        cursor: pointer;
        padding: 0;
        flex-shrink: 0;
    }

    .page-title {
        font-size: 1.2rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
    }

    .state-msg { color: #64748b; font-size: 0.9rem; text-align: center; padding: 2rem 0; }

    /* ── Authority filter pills ──────────────────────────────────────── */
    .authority-filter {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    .filter-pill {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        color: #475569;
        font-size: 0.8rem;
        font-weight: 500;
        padding: 0.25rem 0.75rem;
        cursor: pointer;
    }
    .filter-pill:hover { background: #e2e8f0; }
    .filter-pill.active {
        background: #dcfce7;
        border-color: #86efac;
        color: #15803d;
    }

    /* ── Power source badge ──────────────────────────────────────────── */
    .power-source {
        display: inline-block;
        margin-left: 0.35rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 4px;
        color: #16a34a;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.05rem 0.3rem;
        vertical-align: middle;
    }

    /* ── Authority link button in group header ───────────────────────── */
    .authority-link {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
    }

    /* ── Empty note ──────────────────────────────────────────────────── */
    .empty-note { color: #64748b; font-size: 0.9rem; font-style: italic; text-align: center; padding: 1.5rem 0; }
    .error-msg { color: #dc2626; font-size: 0.88rem; }

    /* ── Groups ────────────────────────────────────────────────────────── */

    .group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .group-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding-bottom: 0.25rem;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 0.25rem;
    }

    .group-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 99px;
        padding: 0.15rem 0.55rem;
    }

    .group-hint {
        font-size: 0.78rem;
        color: #94a3b8;
    }

    /* ── Action cards ──────────────────────────────────────────────────── */

    .action-card {
        border: 1px solid #e2e8f0;
        border-radius: 0.6rem;
        overflow: hidden;
        transition: border-color 0.15s;
    }

    .action-card.selected {
        border-color: #16a34a;
    }

    .card-btn {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #fff;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s;
    }

    .card-btn:hover { background: #f8fafc; }
    .action-card.selected .card-btn { background: #f0fdf4; }

    .card-icon {
        font-size: 1.1rem;
        width: 1.6rem;
        text-align: center;
        flex-shrink: 0;
        color: #334155;
    }

    .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
    }

    .card-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #0f172a;
    }

    .card-desc {
        font-size: 0.78rem;
        color: #64748b;
        line-height: 1.3;
    }

    .card-chevron {
        font-size: 0.65rem;
        color: #94a3b8;
        flex-shrink: 0;
    }

    /* ── Inline form ───────────────────────────────────────────────────── */

    .inline-form {
        padding: 1rem;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .field-label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: #374151;
    }

    .field-input {
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.4rem;
        font-size: 0.85rem;
        font-family: inherit;
        color: #0f172a;
        background: #fff;
        box-sizing: border-box;
        resize: vertical;
    }

    .field-input:focus {
        outline: none;
        border-color: #16a34a;
    }

    .authority-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.15rem;
    }

    .authority-fixed-note {
        font-size: 0.72rem;
        color: #94a3b8;
        font-weight: 400;
    }

    .effect-fields {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 0.75rem;
    }

    .submit-error {
        font-size: 0.82rem;
        color: #dc2626;
        margin: 0;
    }

    .form-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .btn-propose {
        padding: 0.5rem 1.1rem;
        background: #16a34a;
        color: #fff;
        border: none;
        border-radius: 0.45rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
    }

    .btn-propose:hover:not(:disabled) { background: #15803d; }
    .btn-propose:disabled { opacity: 0.5; cursor: default; }

    .btn-cancel {
        padding: 0.5rem 0.9rem;
        background: none;
        border: 1px solid #cbd5e1;
        border-radius: 0.45rem;
        font-size: 0.85rem;
        color: #64748b;
        cursor: pointer;
    }

    .btn-cancel:hover { background: #f1f5f9; }
</style>
