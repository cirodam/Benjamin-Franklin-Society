<script lang="ts">
    import {
        getConstitution,
        getBylaw,
        listVoteRules,
        updateConstitutionSection,
        updateBylawSection,
    } from "../lib/api.js";
    import type {
        ConstitutionParam,
        DocumentSection,
        GoverningDocumentDto,
        VoteRule,
    } from "../lib/api.js";
    import { currentPage, session, selectedSection } from "../lib/session.js";
    import { formatDate } from "../lib/utils.js";
    import VoteRuleDetails from "../components/VoteRuleDetails.svelte";

    const ctx         = $derived($selectedSection);
    const isAdmin   = $derived($session?.isAdmin ?? false);

    // Loaded data
    let constitutionDoc: GoverningDocumentDto | null = $state(null);
    let bylawDoc:     GoverningDocumentDto | null = $state(null);
    let voteRules:    VoteRule[]             = $state([]);
    let loading = $state(true);
    let error   = $state("");

    // Editing
    let editing    = $state(false);
    let editBody   = $state("");
    let saving     = $state(false);
    let saveError  = $state("");

    $effect(() => {
        const c = ctx;
        if (!c) return;
        loading = true; error = ""; constitutionDoc = null; bylawDoc = null;
        const docP = c.docId === "constitution"
            ? getConstitution().then(d => { constitutionDoc = d; })
            : getBylaw(c.docId).then(d  => { bylawDoc = d;  });
        Promise.all([docP, listVoteRules().then(r => { voteRules = r; })])
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load"; })
            .finally(() => { loading = false; });
    });

    // Derived: locate the section in whichever doc loaded
    const section = $derived.by<DocumentSection | null>(() => {
        const id = ctx?.sectionId;
        if (!id) return null;
        const doc = constitutionDoc ?? bylawDoc ?? null;
        if (!doc) return null;
        for (const a of doc.articles) {
            const s = a.sections.find(s => s.id === id);
            if (s) return s;
        }
        return null;
    });

    const doc = $derived<GoverningDocumentDto | null>(
        constitutionDoc ?? bylawDoc ?? null
    );

    const params = $derived(constitutionDoc?.parameters ?? {});

    const sectionHasOwnRule = $derived(
        !!section?.voteRuleId && section.voteRuleId !== doc?.voteRuleId
    );

    // ── Param chip helpers (constitution only) ────────────────────────────────

    function isRateParam(p: ConstitutionParam): boolean {
        if (typeof p.value !== "number") return false;
        return p.value > 0 && p.value < 1 && (p.constraints?.max ?? 2) <= 1;
    }

    function fmtParam(key: string): string {
        const p = params[key];
        if (!p) return `{${key}}`;
        const v = p.value;
        if (typeof v === "boolean") return v ? "guaranteed" : "disabled";
        if (isRateParam(p)) {
            const pct = v * 100;
            return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
        }
        return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }

    type Segment = { type: "text"; content: string } | { type: "param"; key: string };

    function parseBody(body: string): Segment[] {
        const segs: Segment[] = [];
        const parts = body.split(/\{([^}]+)\}/g);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) { if (parts[i]) segs.push({ type: "text", content: parts[i] }); }
            else segs.push({ type: "param", key: parts[i] });
        }
        return segs;
    }

    // ── Edit ──────────────────────────────────────────────────────────────────

    function startEdit() {
        if (!section) return;
        editBody = section.body;
        saveError = "";
        editing = true;
    }

    async function save() {
        if (!ctx || !section) return;
        saving = true; saveError = "";
        try {
            if (ctx.docId === "constitution") {
                constitutionDoc = await updateConstitutionSection(section.id, editBody);
            } else {
                bylawDoc = await updateBylawSection(ctx.docId, section.id, editBody);
            }
            editing = false;
        } catch (e) {
            saveError = e instanceof Error ? e.message : "Failed to save";
        } finally {
            saving = false;
        }
    }

    function goBack() {
        if (ctx) currentPage.go(ctx.backPage);
        else currentPage.go("documents");
    }
</script>

<div class="section-page">
    <div class="page-header">
        <button class="back-btn" onclick={goBack}>
            ‹ {ctx?.docTitle ?? "Back"}
        </button>
    </div>

    {#if loading}
        <div class="state-msg">Loading…</div>
    {:else if error}
        <div class="state-msg error">{error}</div>
    {:else if section && doc}

        <div class="section-header">
            <div class="section-eyebrow">§ {section.id}</div>
            {#if section.title}
                <h1 class="section-title">{section.title}</h1>
            {:else}
                <h1 class="section-title untitled">Section {section.id}</h1>
            {/if}

            <div class="section-chips">
                {#if section.adoptedAt}
                    <span class="chip chip-neutral">Adopted {formatDate(section.adoptedAt)}</span>
                {:else if doc.adoptedAt}
                    <span class="chip chip-neutral">Adopted {formatDate(doc.adoptedAt)}</span>
                {/if}

            </div>
        </div>

        {#if ctx?.docId !== "charter" && (section.voteRuleId || doc.voteRuleId)}
            <div class="section-vote-rule">
                <div class="svr-label">
                    {sectionHasOwnRule ? "Amendment rule (section override)" : "Amendment rule"}
                </div>
                <VoteRuleDetails
                    ruleId={section.voteRuleId}
                    fallbackId={doc.voteRuleId}
                    rules={voteRules}
                />
            </div>
        {/if}

        <!-- Body -->
        <div class="section-body-wrapper">
            {#if editing}
                <div class="edit-area">
                    <textarea
                        class="body-textarea"
                        rows={8}
                        bind:value={editBody}
                        placeholder="Write section prose. Use {'{paramKey}'} to embed live values."
                        disabled={saving}
                    ></textarea>
                    {#if constitutionDoc}
                        <p class="edit-hint">Use {"{paramKey}"} to embed a live constitutional value inline.</p>
                    {/if}
                    {#if saveError}
                        <p class="edit-error">{saveError}</p>
                    {/if}
                    <div class="edit-actions">
                        <button class="save-btn" onclick={save} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button class="cancel-btn" onclick={() => editing = false} disabled={saving}>Cancel</button>
                    </div>
                </div>
            {:else}
                <div class="body-text">
                    {#if constitutionDoc}
                        {#each parseBody(section.body) as seg}
                            {#if seg.type === "text"}
                                {seg.content}
                            {:else}
                                <span
                                    class="param-chip"
                                    title={params[seg.key]?.description ?? seg.key}
                                >{fmtParam(seg.key)}</span>
                            {/if}
                        {/each}
                    {:else}
                        {section.body}
                    {/if}
                </div>
                {#if isAdmin && ctx?.docId !== "charter"}
                    <button class="edit-link" onclick={startEdit}>Edit prose</button>
                {/if}
            {/if}
        </div>

        <!-- Rationale -->
        {#if section.rationale}
            <div class="rationale-block">
                <div class="rationale-label">Rationale</div>
                <p class="rationale-text">{section.rationale}</p>
            </div>
        {/if}

    {:else if !loading}
        <div class="state-msg">Section not found.</div>
    {/if}
</div>

<style>
    .section-page {
        padding: 1.5rem 1.25rem 6rem;
        max-width: 680px;
        margin: 0 auto;
    }

    @media (min-width: 768px) {
        .section-page { padding-bottom: 2rem; }
    }

    .page-header { margin-bottom: 1.5rem; }

    .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #15803d;
        padding: 0;
        font-weight: 500;
    }
    .back-btn:hover { text-decoration: underline; }

    /* ── Header ─────────────────────────────────────────────────────────── */

    .section-header {
        margin-bottom: 1.75rem;
        border-bottom: 2px solid #15803d;
        padding-bottom: 1.25rem;
    }

    .section-eyebrow {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #15803d;
        margin-bottom: 0.25rem;
    }

    .section-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.75rem;
        line-height: 1.3;
    }
    .section-title.untitled { color: #64748b; font-style: italic; }

    .section-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.5rem;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        white-space: nowrap;
    }
    .chip-neutral  { background: #f1f5f9; color: #475569; }
    .chip-sunset   { background: #fef3c7; color: #b45309; }
    .chip-warn     { background: #fee2e2; color: #b91c1c; }

    /* ── Vote rule ──────────────────────────────────────────────────────── */

    .section-vote-rule {
        margin-bottom: 1.5rem;
    }

    .svr-label {
        font-size:      0.68rem;
        font-weight:    700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color:          #94a3b8;
        margin-bottom:  0.4rem;
    }

    /* ── Body ───────────────────────────────────────────────────────────── */

    .section-body-wrapper {
        margin-bottom: 2rem;
    }

    .body-text {
        font-size: 1rem;
        color: #1e293b;
        line-height: 1.8;
        white-space: pre-wrap;
    }

    .param-chip {
        display: inline-block;
        background: #dcfce7;
        color: #15803d;
        font-weight: 600;
        font-size: 0.9em;
        padding: 0.05em 0.35em;
        border-radius: 4px;
        cursor: default;
    }

    .edit-link {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.8rem;
        color: #15803d;
        padding: 0;
        font-weight: 500;
        margin-top: 0.75rem;
        display: inline-block;
    }
    .edit-link:hover { text-decoration: underline; }

    .edit-area {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .body-textarea {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.95rem;
        padding: 0.65rem 0.85rem;
        resize: vertical;
        font-family: inherit;
        outline: none;
        line-height: 1.65;
        box-sizing: border-box;
    }
    .body-textarea:focus { border-color: #15803d; }

    .edit-hint  { font-size: 0.78rem; color: #94a3b8; margin: 0; }
    .edit-error { font-size: 0.82rem; color: #dc2626; margin: 0; }

    .edit-actions { display: flex; gap: 0.5rem; }

    .save-btn {
        background: #15803d;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 0.5rem 1.1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
    }
    .save-btn:disabled { opacity: 0.5; cursor: default; }

    .cancel-btn {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
    }
    .cancel-btn:disabled { opacity: 0.5; cursor: default; }

    /* ── Rationale ──────────────────────────────────────────────────────── */

    .rationale-block {
        background: #f8fafc;
        border-left: 3px solid #bbf7d0;
        padding: 1rem 1.25rem;
        border-radius: 0 8px 8px 0;
    }

    .rationale-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
        margin-bottom: 0.5rem;
    }

    .rationale-text {
        font-size: 0.9rem;
        color: #475569;
        line-height: 1.7;
        font-style: italic;
        margin: 0;
        white-space: pre-wrap;
    }

    /* ── State ──────────────────────────────────────────────────────────── */

    .state-msg {
        color: #64748b;
        font-size: 0.9rem;
        margin-top: 2rem;
        text-align: center;
    }
    .state-msg.error { color: #dc2626; }
</style>
