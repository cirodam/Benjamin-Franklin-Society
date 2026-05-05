<script lang="ts">
    import { listVacancies, listPersons, createNomination } from "../lib/api.js";
    import type { VacancyDto, PersonDto } from "../lib/api.js";
    import { session, currentPage, selectedRoleId } from "../lib/session.js";

    let vacancies: VacancyDto[] = $state([]);
    let persons: PersonDto[]    = $state([]);
    let loading = $state(true);
    let error   = $state("");

    // Nomination form state
    let nominatingRole: VacancyDto | null = $state(null);
    let nomineeHandle = $state("");
    let statement = $state("");
    let submitting = $state(false);
    let submitError = $state("");
    let submitSuccess = $state(false);

    async function load() {
        loading = true;
        error = "";
        try {
            [vacancies, persons] = await Promise.all([listVacancies(), listPersons()]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load vacancies";
        } finally {
            loading = false;
        }
    }

    $effect(() => { load(); });

    // Group vacancies by domain
    let grouped = $derived(
        vacancies.reduce<Record<string, { domainName: string; rows: VacancyDto[] }>>((acc, v) => {
            if (!acc[v.domainId]) acc[v.domainId] = { domainName: v.domainName, rows: [] };
            acc[v.domainId].rows.push(v);
            return acc;
        }, {})
    );

    function startNominate(v: VacancyDto) {
        nominatingRole = v;
        nomineeHandle = $session?.handle ?? "";
        statement = "";
        submitError = "";
        submitSuccess = false;
    }

    function cancelNominate() {
        nominatingRole = null;
        submitError = "";
        submitSuccess = false;
    }

    async function submitNomination() {
        if (!nominatingRole || !nomineeHandle) { submitError = "Please select a nominee."; return; }
        submitting = true;
        submitError = "";
        try {
            await createNomination({ roleId: nominatingRole.roleId, nomineeHandle, statement });
            submitSuccess = true;
            // Remove from local list so the vacancy disappears after a moment
            setTimeout(() => {
                vacancies = vacancies.filter(v => v.roleId !== nominatingRole!.roleId);
                nominatingRole = null;
                submitSuccess = false;
            }, 1500);
        } catch (e) {
            submitError = e instanceof Error ? e.message : "Submission failed";
        } finally {
            submitting = false;
        }
    }

    function fmt(n: number): string {
        return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
</script>

<div class="page">
    <div class="page-header">
        <div>
            <h2 class="page-title">Open Roles</h2>
            <p class="page-subtitle">Unfilled positions across all functional domains. Any member can nominate someone for a vacancy.</p>
        </div>
    </div>

    {#if loading}
        <div class="skeleton wide"></div>
        <div class="skeleton short"></div>
        <div class="skeleton"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if vacancies.length === 0}
        <p class="empty-msg">No vacancies right now — all roles are filled.</p>
    {:else}
        {#each Object.values(grouped) as group (group.domainName)}
            <section class="domain-section">
                <h3 class="domain-name">{group.domainName}</h3>
                <div class="vacancy-list">
                    {#each group.rows as v (v.roleId)}
                        <div class="vacancy-card">
                            <div class="vacancy-top">
                                <div class="vacancy-info">
                                    <button class="vacancy-role-link" onclick={() => { selectedRoleId.set(v.roleId); currentPage.go("vacancy-detail"); }}>{v.roleTitle}</button>
                                    <span class="vacancy-unit">{v.unitName}</span>
                                </div>
                                <div class="vacancy-right">
                                    <span class="vacancy-pay">{fmt(v.kinPerMonth)} kin/mo</span>
                                    {#if !nominatingRole || nominatingRole.roleId !== v.roleId}
                                        <button class="nominate-btn" onclick={() => startNominate(v)}>Nominate</button>
                                    {/if}
                                </div>
                            </div>

                            {#if nominatingRole?.roleId === v.roleId}
                                {#if submitSuccess}
                                    <div class="success-msg">Nomination submitted!</div>
                                {:else}
                                    <div class="nominate-form">
                                        <p class="form-label">Who should fill this role?</p>
                                        <select class="form-select" bind:value={nomineeHandle}>
                                            <option value="">— select a member —</option>
                                            {#each persons as p (p.handle)}
                                                <option value={p.handle}>{p.firstName} {p.lastName}</option>
                                            {/each}
                                        </select>
                                        <textarea
                                            class="form-textarea"
                                            bind:value={statement}
                                            placeholder="Why are they a good fit? (optional)"
                                            rows="2"
                                        ></textarea>
                                        {#if submitError}
                                            <p class="form-error">{submitError}</p>
                                        {/if}
                                        <div class="form-actions">
                                            <button class="submit-btn" onclick={submitNomination} disabled={submitting || !nomineeHandle}>
                                                {submitting ? "Submitting…" : "Submit nomination"}
                                            </button>
                                            <button class="cancel-btn" onclick={cancelNominate}>Cancel</button>
                                        </div>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>
        {/each}
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
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
}
.page-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #14532d;
    margin: 0 0 0.25rem;
}
.page-subtitle {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 0;
}
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
.empty-msg {
    color: #6b7280;
    font-size: 0.88rem;
    text-align: center;
    padding: 2rem 0;
}
.domain-section {
    margin-bottom: 1.5rem;
}
.domain-name {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #15803d;
    margin: 0 0 0.6rem;
}
.vacancy-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}
.vacancy-card {
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    padding: 0.85rem 1rem;
}
.vacancy-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}
.vacancy-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
}
.vacancy-role-link {
    background: none;
    border: none;
    padding: 0;
    font-weight: 600;
    font-size: 0.92rem;
    color: #14532d;
    cursor: pointer;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: #bbf7d0;
}
.vacancy-role-link:hover { text-decoration-color: #16a34a; }
.vacancy-unit {
    font-size: 0.78rem;
    color: #6b7280;
}
.vacancy-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;
    flex-shrink: 0;
}
.vacancy-pay {
    font-size: 0.78rem;
    color: #15803d;
    font-weight: 600;
}
.nominate-btn {
    background: #15803d;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.3rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}
.nominate-btn:hover { background: #166534; }
.nominate-form {
    margin-top: 0.85rem;
    border-top: 1px solid #d1fae5;
    padding-top: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.form-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
}
.form-select,
.form-textarea {
    width: 100%;
    border: 1px solid #d1fae5;
    border-radius: 7px;
    padding: 0.5rem 0.7rem;
    font-size: 0.85rem;
    font-family: inherit;
    color: #111827;
    background: #f9fafb;
    box-sizing: border-box;
}
.form-textarea { resize: vertical; min-height: 2.5rem; }
.form-error {
    font-size: 0.8rem;
    color: #dc2626;
    margin: 0;
}
.form-actions {
    display: flex;
    gap: 0.6rem;
}
.submit-btn {
    background: #15803d;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
}
.submit-btn:disabled { opacity: 0.5; cursor: default; }
.submit-btn:not(:disabled):hover { background: #166534; }
.cancel-btn {
    background: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 7px;
    padding: 0.45rem 0.85rem;
    font-size: 0.85rem;
    cursor: pointer;
}
.cancel-btn:hover { background: #f3f4f6; }
.success-msg {
    margin-top: 0.85rem;
    border-top: 1px solid #d1fae5;
    padding-top: 0.85rem;
    color: #15803d;
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
}
</style>
