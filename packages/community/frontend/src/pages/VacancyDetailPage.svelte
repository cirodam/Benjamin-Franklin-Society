<script lang="ts">
    import { getRole, listPersons, createNomination } from "../lib/api.js";
    import type { RoleDto, PersonDto } from "../lib/api.js";
    import { currentPage, selectedRoleId } from "../lib/session.js";

    let role: RoleDto | null = $state(null);
    let persons: PersonDto[] = $state([]);
    let loading = $state(true);
    let error = $state("");

    // Nomination form state
    let nomineeHandle = $state("");
    let statement = $state("");
    let submitting = $state(false);
    let submitError = $state("");
    let submitSuccess = $state(false);
    let showNominate = $state(false);

    $effect(() => {
        const id = $selectedRoleId;
        if (!id) return;
        loading = true;
        error = "";
        Promise.all([getRole(id), listPersons()])
            .then(([r, p]) => { role = r; persons = p; })
            .catch(e => { error = e instanceof Error ? e.message : "Failed to load role"; })
            .finally(() => { loading = false; });
    });

    function fmt(n: number): string {
        return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }

    function fmtDate(s: string | null): string {
        if (!s) return "—";
        return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }

    function back() {
        currentPage.go("vacancies");
    }

    async function submitNomination() {
        if (!role || !nomineeHandle) { submitError = "Please select a nominee."; return; }
        submitting = true;
        submitError = "";
        try {
            await createNomination({ roleId: role.id, nomineeHandle, statement });
            submitSuccess = true;
        } catch (e) {
            submitError = e instanceof Error ? e.message : "Submission failed";
        } finally {
            submitting = false;
        }
    }
</script>

<div class="page">
    <button class="back-btn" onclick={back}>← Open Roles</button>

    {#if loading}
        <div class="skeleton wide"></div>
        <div class="skeleton short"></div>
        <div class="skeleton"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if role}
        <div class="header">
            <div>
                <h2 class="title">{role.title}</h2>
                <span class="kin-badge">{fmt(role.kinPerMonth)} kin / mo</span>
            </div>
            {#if !showNominate && !submitSuccess}
                <button class="nominate-btn" onclick={() => { showNominate = true; }}>Nominate someone</button>
            {/if}
        </div>

        {#if role.description}
            <p class="description">{role.description}</p>
        {/if}

        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">Status</span>
                <span class="meta-value {role.isActive ? 'active' : 'vacant'}">{role.isActive ? "Filled" : "Vacant"}</span>
            </div>
            {#if role.memberHandle}
                <div class="meta-item">
                    <span class="meta-label">Current holder</span>
                    <span class="meta-value">@{role.memberHandle}</span>
                </div>
            {/if}
            <div class="meta-item">
                <span class="meta-label">Term start</span>
                <span class="meta-value">{fmtDate(role.termStartDate)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Term end</span>
                <span class="meta-value">{fmtDate(role.termEndDate)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Funded</span>
                <span class="meta-value">{role.funded ? "Yes" : "No"}</span>
            </div>
            {#if role.weeklySchedule}
                <div class="meta-item wide">
                    <span class="meta-label">Weekly schedule</span>
                    <span class="meta-value">{role.weeklySchedule}</span>
                </div>
            {/if}
        </div>

        {#if showNominate}
            <div class="nominate-section">
                <h3 class="section-title">Submit a nomination</h3>
                {#if submitSuccess}
                    <div class="success-msg">Nomination submitted!</div>
                {:else}
                    <p class="form-hint">Any member can nominate someone for this vacancy. Nominations go to the Farmers pool for review.</p>
                    <label class="form-label" for="nominee-select">Who should fill this role?</label>
                    <select id="nominee-select" class="form-select" bind:value={nomineeHandle}>
                        <option value="">— select a member —</option>
                        {#each persons as p (p.handle)}
                            <option value={p.handle}>{p.firstName} {p.lastName}</option>
                        {/each}
                    </select>
                    <label class="form-label" for="statement">Why are they a good fit? <span class="optional">(optional)</span></label>
                    <textarea
                        id="statement"
                        class="form-textarea"
                        bind:value={statement}
                        placeholder="Describe their qualifications or experience…"
                        rows="3"
                    ></textarea>
                    {#if submitError}
                        <p class="form-error">{submitError}</p>
                    {/if}
                    <div class="form-actions">
                        <button class="submit-btn" onclick={submitNomination} disabled={submitting || !nomineeHandle}>
                            {submitting ? "Submitting…" : "Submit nomination"}
                        </button>
                        <button class="cancel-btn" onclick={() => { showNominate = false; submitError = ""; }}>Cancel</button>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
.page {
    padding: 1rem 1rem 5rem;
    max-width: 600px;
    margin: 0 auto;
    background: #f0fdf4;
    min-height: 100vh;
}
.back-btn {
    background: none;
    border: none;
    color: #6b7280;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 1.25rem;
    display: block;
}
.back-btn:hover { color: #14532d; }
.skeleton {
    height: 1rem;
    border-radius: 6px;
    background: #d1fae5;
    margin-bottom: 0.75rem;
    animation: pulse 1.5s infinite;
}
.skeleton.wide  { width: 80%; }
.skeleton.short { width: 50%; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
.error-msg {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
}
.title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #14532d;
    margin: 0 0 0.35rem;
}
.kin-badge {
    display: inline-block;
    background: #dcfce7;
    color: #15803d;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
}
.nominate-btn {
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}
.nominate-btn:hover { background: #15803d; }
.description {
    color: #374151;
    font-size: 0.9rem;
    line-height: 1.6;
    margin: 0 0 1.25rem;
}
.meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1.5rem;
}
.meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}
.meta-item.wide {
    grid-column: 1 / -1;
}
.meta-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9ca3af;
    font-weight: 600;
}
.meta-value {
    font-size: 0.88rem;
    color: #111827;
}
.meta-value.vacant { color: #15803d; font-weight: 600; }
.meta-value.active  { color: #6b7280; }
.nominate-section {
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    padding: 1.1rem;
}
.section-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #14532d;
    margin: 0 0 0.75rem;
}
.form-hint {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 0 0 1rem;
    line-height: 1.5;
}
.form-label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.3rem;
}
.optional { font-weight: 400; color: #9ca3af; }
.form-select, .form-textarea {
    width: 100%;
    border: 1px solid #d1fae5;
    border-radius: 8px;
    padding: 0.55rem 0.75rem;
    font-size: 0.88rem;
    background: #f9fafb;
    color: #111827;
    margin-bottom: 0.85rem;
    box-sizing: border-box;
}
.form-textarea { resize: vertical; font-family: inherit; }
.form-error {
    color: #dc2626;
    font-size: 0.82rem;
    margin: 0 0 0.75rem;
}
.form-actions {
    display: flex;
    gap: 0.6rem;
}
.submit-btn {
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.55rem 1.1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; cursor: default; }
.cancel-btn {
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 0.55rem 1rem;
    font-size: 0.85rem;
    color: #6b7280;
    cursor: pointer;
}
.success-msg {
    background: #dcfce7;
    color: #15803d;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 0.88rem;
    font-weight: 600;
}
</style>
