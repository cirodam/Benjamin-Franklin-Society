<script lang="ts">
    import { listShifts, createShift, claimShift, unclaimShift, deleteShift, listDomains, listRoles, listUnits, listLocations } from "../lib/api.js";
    import type { ShiftDto, DomainDto, RoleDto, UnitDto, LocationDto } from "../lib/api.js";
    import { session } from "../lib/session.js";

    // ── Week navigation ────────────────────────────────────────────────────────

    function mondayOf(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sun
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date: Date, n: number): Date {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function isoDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    function fmtTime(iso: string): string {
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function fmtDateHeader(date: Date): string {
        return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }

    function fmtWeekRange(start: Date): string {
        const end = addDays(start, 6);
        return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} – ${end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
    }

    let weekStart = $state(mondayOf(new Date()));

    const weekDays = $derived(
        Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    );

    function prevWeek() { weekStart = addDays(weekStart, -7); }
    function nextWeek() { weekStart = addDays(weekStart,  7); }
    function goToday()  { weekStart = mondayOf(new Date()); }

    // ── Data ───────────────────────────────────────────────────────────────────

    let shifts:    ShiftDto[]    = $state([]);
    let domains:   DomainDto[]   = $state([]);
    let units:     UnitDto[]     = $state([]);
    let roles:     RoleDto[]     = $state([]);
    let locations: LocationDto[] = $state([]);
    let loading = $state(true);
    let error   = $state("");

    let filterDomainId = $state("");
    let filterUnitId   = $state("");

    async function load() {
        loading = true;
        error = "";
        try {
            const from = weekStart.toISOString();
            const to   = addDays(weekStart, 7).toISOString();
            [shifts, domains, units, roles, locations] = await Promise.all([
                listShifts({ from, to, domainId: filterDomainId || undefined }),
                listDomains(),
                listUnits(),
                listRoles(),
                listLocations(),
            ]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load schedule";
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        // Re-run whenever weekStart or filterDomainId changes
        weekStart;
        filterDomainId;
        load();
    });

    // Clear unit filter when domain changes
    $effect(() => {
        filterDomainId;
        filterUnitId = "";
    });

    // ── Derived: group shifts by calendar day ──────────────────────────────────

    // ── Domain lookup ─────────────────────────────────────────────────────────

    const domainMap = $derived(
        new Map(domains.map(d => [d.id, d]))
    );

    /** Map from roleId → domainId. */
    const roleDomainMap = $derived((() => {
        const m = new Map<string, string>();
        for (const domain of domains) {
            for (const unitId of domain.unitIds) {
                const unit = units.find(u => u.id === unitId);
                if (!unit) continue;
                for (const roleId of unit.roleIds) {
                    m.set(roleId, domain.id);
                }
            }
        }
        return m;
    })());

    /** Map from roleId → unitId. */
    const roleUnitMap = $derived((() => {
        const m = new Map<string, string>();
        for (const unit of units) {
            for (const roleId of unit.roleIds) {
                m.set(roleId, unit.id);
            }
        }
        return m;
    })());

    const unitMap = $derived(new Map(units.map(u => [u.id, u])));
    const locationMap = $derived(new Map(locations.map(l => [l.id, l])));

    function unitLabel(u: UnitDto): string {
        const loc = u.locationId ? locationMap.get(u.locationId) : null;
        return loc ? `${u.name} · ${loc.name}` : u.name;
    }

    /** Units belonging to the currently-selected domain (for the unit filter). */
    const domainUnits = $derived(
        filterDomainId
            ? units.filter(u => domains.find(d => d.id === filterDomainId)?.unitIds.includes(u.id))
            : []
    );

    // ── Derived: role schedule slots for the displayed week ────────────────────

    /** A virtual slot expanded from a role's weeklySchedule for a specific date. */
    interface RoleSlot {
        kind: "role";
        roleId: string;
        roleTitle: string;
        domainId: string;
        unitId: string;
        memberHandle: string | null;
        date: string;       // YYYY-MM-DD
        startTime: string;  // HH:MM
        endTime: string;    // HH:MM
    }

    /** Expand all role weekly schedules into concrete slots for the displayed week. */
    const roleSlots = $derived((() => {
        const slots: RoleSlot[] = [];

        for (const role of roles) {
            if (!role.weeklySchedule.length) continue;
            const domainId = roleDomainMap.get(role.id) ?? "";
            const unitId   = roleUnitMap.get(role.id) ?? "";
            if (filterDomainId && domainId !== filterDomainId) continue;
            if (filterUnitId   && unitId   !== filterUnitId)   continue;

            for (const slot of role.weeklySchedule) {
                for (const day of weekDays) {
                    if (day.getDay() === slot.dayOfWeek) {
                        slots.push({
                            kind: "role",
                            roleId: role.id,
                            roleTitle: role.title,
                            domainId,
                            unitId,
                            memberHandle: role.memberHandle,
                            date: isoDate(day),
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                        });
                    }
                }
            }
        }
        return slots;
    })());

    const shiftsByDay = $derived(
        weekDays.map(day => {
            const key = isoDate(day);
            return {
                day,
                key,
                shifts: shifts.filter(s => s.startAt.slice(0, 10) === key)
                              .sort((a, b) => a.startAt.localeCompare(b.startAt)),
                roleSlots: roleSlots.filter(rs => rs.date === key)
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime)),
            };
        })
    );

    // ── Claim / unclaim ────────────────────────────────────────────────────────

    let actionError = $state("");

    async function handleClaim(shift: ShiftDto) {
        actionError = "";
        try {
            const updated = await claimShift(shift.id);
            shifts = shifts.map(s => s.id === updated.id ? updated : s);
        } catch (e) {
            actionError = e instanceof Error ? e.message : "Failed";
        }
    }

    async function handleUnclaim(shift: ShiftDto) {
        actionError = "";
        try {
            const updated = await unclaimShift(shift.id);
            shifts = shifts.map(s => s.id === updated.id ? updated : s);
        } catch (e) {
            actionError = e instanceof Error ? e.message : "Failed";
        }
    }

    async function handleDelete(shift: ShiftDto) {
        actionError = "";
        try {
            await deleteShift(shift.id);
            shifts = shifts.filter(s => s.id !== shift.id);
        } catch (e) {
            actionError = e instanceof Error ? e.message : "Failed";
        }
    }

    // ── Create shift form ──────────────────────────────────────────────────────

    let showForm  = $state(false);
    let formDomainId = $state("");
    let formLabel    = $state("");
    let formStartAt  = $state("");
    let formEndAt    = $state("");
    let formNote     = $state("");
    let formError    = $state("");
    let formSaving   = $state(false);

    function openForm() {
        formDomainId = domains[0]?.id ?? "";
        formLabel    = "";
        formStartAt  = "";
        formEndAt    = "";
        formNote     = "";
        formError    = "";
        showForm     = true;
    }

    function closeForm() { showForm = false; }

    async function submitForm() {
        if (!formDomainId) { formError = "Select a domain"; return; }
        if (!formLabel.trim()) { formError = "Label is required"; return; }
        if (!formStartAt) { formError = "Start time is required"; return; }
        if (!formEndAt)   { formError = "End time is required"; return; }

        formSaving = true;
        formError  = "";
        try {
            const shift = await createShift({
                domainId: formDomainId,
                label:    formLabel.trim(),
                startAt:  new Date(formStartAt).toISOString(),
                endAt:    new Date(formEndAt).toISOString(),
                note:     formNote.trim() || null,
            });
            shifts = [...shifts, shift];
            showForm = false;
        } catch (e) {
            formError = e instanceof Error ? e.message : "Failed to create shift";
        } finally {
            formSaving = false;
        }
    }

    const isAdmin = $derived($session?.isAdmin ?? false);
    const myHandle  = $derived($session?.handle ?? "");
    const today     = $derived(isoDate(new Date()));
</script>

<div class="page">
    <!-- Header -->
    <div class="page-header">
        <div>
            <h2 class="page-title">Schedule</h2>
            <p class="page-subtitle">Role schedules and one-off shifts by unit</p>
        </div>
        {#if isAdmin}
            <button class="add-btn" onclick={openForm}>+ Add shift</button>
        {/if}
    </div>

    <!-- Week navigation -->
    <div class="week-nav">
        <button class="nav-btn" onclick={prevWeek}>‹</button>
        <div class="week-label">
            <span>{fmtWeekRange(weekStart)}</span>
            <button class="today-btn" onclick={goToday}>Today</button>
        </div>
        <button class="nav-btn" onclick={nextWeek}>›</button>
    </div>

    <!-- Domain + unit filters -->
    <div class="filter-row">
        <select class="filter-select" bind:value={filterDomainId}>
            <option value="">All domains</option>
            {#each domains as d (d.id)}
                <option value={d.id}>{d.name}</option>
            {/each}
        </select>
        {#if domainUnits.length > 0}
            <select class="filter-select" bind:value={filterUnitId}>
                <option value="">All units</option>
                {#each domainUnits as u (u.id)}
                    <option value={u.id}>{unitLabel(u)}</option>
                {/each}
            </select>
        {/if}
    </div>

    {#if actionError}
        <div class="error-msg">{actionError}</div>
    {/if}

    <!-- Create shift form -->
    {#if showForm}
        <div class="form-card">
            <h3 class="form-title">New shift</h3>
            <div class="form-grid">
                <label class="form-label">
                    Domain
                    <select class="form-input" bind:value={formDomainId}>
                        <option value="">— select —</option>
                        {#each domains as d (d.id)}
                            <option value={d.id}>{d.name}</option>
                        {/each}
                    </select>
                </label>
                <label class="form-label">
                    Label
                    <input class="form-input" type="text" bind:value={formLabel} placeholder="e.g. Kitchen prep" />
                </label>
                <label class="form-label">
                    Start
                    <input class="form-input" type="datetime-local" bind:value={formStartAt} />
                </label>
                <label class="form-label">
                    End
                    <input class="form-input" type="datetime-local" bind:value={formEndAt} />
                </label>
                <label class="form-label full">
                    Note (optional)
                    <input class="form-input" type="text" bind:value={formNote} placeholder="Any instructions?" />
                </label>
            </div>
            {#if formError}
                <p class="form-error">{formError}</p>
            {/if}
            <div class="form-actions">
                <button class="save-btn" onclick={submitForm} disabled={formSaving}>
                    {formSaving ? "Saving…" : "Create shift"}
                </button>
                <button class="cancel-btn" onclick={closeForm} disabled={formSaving}>Cancel</button>
            </div>
        </div>
    {/if}

    <!-- Week grid -->
    {#if loading}
        <div class="skeleton wide"></div>
        <div class="skeleton short"></div>
        <div class="skeleton"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else}
        <div class="week-grid">
            {#each shiftsByDay as { day, key, shifts: dayShifts, roleSlots: dayRoleSlots } (key)}
                <div class="day-col" class:today={key === today}>
                    <div class="day-header">{fmtDateHeader(day)}</div>

                    {#if dayShifts.length === 0 && dayRoleSlots.length === 0}
                        <div class="day-empty">–</div>
                    {:else}
                        {#each dayRoleSlots as rs (`${rs.roleId}-${rs.date}`)}
                            <div class="shift-card role-slot">
                                <div class="shift-top">
                                    <span class="shift-label">{rs.roleTitle}</span>
                                    <span class="badge role-badge">Role</span>
                                </div>
                                <div class="shift-time">{rs.startTime} – {rs.endTime}</div>
                                <div class="shift-domain">{unitMap.get(rs.unitId)?.name ?? domainMap.get(rs.domainId)?.name ?? ""}</div>
                                {#if unitMap.get(rs.unitId)?.locationId}
                                    <div class="shift-location">📍 {locationMap.get(unitMap.get(rs.unitId)!.locationId!)?.name ?? ""}</div>
                                {/if}
                                <div class="shift-person">{rs.memberHandle ?? ""}</div>
                            </div>
                        {/each}

                        {#each dayShifts as shift (shift.id)}
                            <div class="shift-card" class:open={shift.isOpen}>
                                <div class="shift-top">
                                    <span class="shift-label">{shift.label}</span>
                                    {#if shift.isOpen}
                                        <span class="badge open-badge">Open</span>
                                    {/if}
                                </div>
                                <div class="shift-time">{fmtTime(shift.startAt)} – {fmtTime(shift.endAt)}</div>
                                <div class="shift-domain">{domainMap.get(shift.domainId)?.name ?? shift.domainId}</div>

                                {#if !shift.isOpen}
                                    <div class="shift-person">{shift.assignedHandle ?? ""}</div>
                                {/if}

                                {#if shift.note}
                                    <div class="shift-note">{shift.note}</div>
                                {/if}

                                <div class="shift-actions">
                                    {#if shift.isOpen && myHandle}
                                        <button class="claim-btn" onclick={() => handleClaim(shift)}>Claim</button>
                                    {:else if shift.assignedHandle === myHandle}
                                        <button class="unclaim-btn" onclick={() => handleUnclaim(shift)}>Drop shift</button>
                                    {/if}
                                    {#if isAdmin}
                                        <button class="delete-btn" onclick={() => handleDelete(shift)}>✕</button>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
.page {
    padding: 1rem 1rem 5rem;
    max-width: 900px;
    margin: 0 auto;
    background: #f0fdf4;
    min-height: 100vh;
}
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}
.page-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #14532d;
    margin: 0 0 0.2rem;
}
.page-subtitle {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 0;
}
.add-btn {
    background: #15803d;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 0.45rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}
.add-btn:hover { background: #166534; }

/* Week nav */
.week-nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}
.nav-btn {
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 6px;
    padding: 0.3rem 0.65rem;
    font-size: 1rem;
    cursor: pointer;
    color: #15803d;
    line-height: 1;
}
.nav-btn:hover { background: #f0fdf4; }
.week-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.88rem;
    font-weight: 600;
    color: #374151;
    flex: 1;
}
.today-btn {
    font-size: 0.75rem;
    color: #15803d;
    background: none;
    border: 1px solid #d1fae5;
    border-radius: 5px;
    padding: 0.15rem 0.5rem;
    cursor: pointer;
}
.today-btn:hover { background: #f0fdf4; }

/* Filter */
.filter-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}
.filter-select {
    border: 1px solid #d1fae5;
    border-radius: 7px;
    padding: 0.35rem 0.65rem;
    font-size: 0.85rem;
    font-family: inherit;
    background: #fff;
    color: #111827;
}

/* Error */
.error-msg {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
}

/* Create form */
.form-card {
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
}
.form-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #14532d;
    margin: 0 0 0.85rem;
}
.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    margin-bottom: 0.65rem;
}
.form-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
}
.form-label.full { grid-column: 1 / -1; }
.form-input {
    border: 1px solid #d1fae5;
    border-radius: 7px;
    padding: 0.4rem 0.6rem;
    font-size: 0.85rem;
    font-family: inherit;
    background: #f9fafb;
    color: #111827;
}
.form-error {
    font-size: 0.8rem;
    color: #dc2626;
    margin: 0 0 0.5rem;
}
.form-actions {
    display: flex;
    gap: 0.6rem;
}
.save-btn {
    background: #15803d;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 0.45rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
}
.save-btn:disabled { opacity: 0.5; cursor: default; }
.save-btn:not(:disabled):hover { background: #166534; }
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

/* Skeletons */
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

/* Week grid */
.week-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.5rem;
    overflow-x: auto;
}
@media (max-width: 700px) {
    .week-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 420px) {
    .week-grid { grid-template-columns: 1fr 1fr; }
}
.day-col {
    min-width: 0;
}
.day-col.today .day-header {
    color: #15803d;
    font-weight: 800;
}
.day-header {
    font-size: 0.72rem;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.3rem 0;
    border-bottom: 1px solid #d1fae5;
    margin-bottom: 0.4rem;
}
.day-empty {
    color: #d1d5db;
    font-size: 0.8rem;
    text-align: center;
    padding: 0.5rem 0;
}

/* Shift card */
.shift-card {
    background: #fff;
    border: 1px solid #d1fae5;
    border-radius: 8px;
    padding: 0.55rem 0.65rem;
    margin-bottom: 0.4rem;
    font-size: 0.8rem;
}
.shift-card.open {
    border-color: #bbf7d0;
    background: #f0fdf4;
}
.shift-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.3rem;
    margin-bottom: 0.2rem;
}
.shift-label {
    font-weight: 600;
    color: #14532d;
    font-size: 0.82rem;
    line-height: 1.3;
}
.badge {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
}
.open-badge {
    background: #dcfce7;
    color: #15803d;
}
.shift-time {
    color: #6b7280;
    font-size: 0.75rem;
    margin-bottom: 0.15rem;
}
.shift-domain {
    color: #9ca3af;
    font-size: 0.72rem;
    margin-bottom: 0.15rem;
}
.shift-person {
    color: #374151;
    font-size: 0.78rem;
    font-weight: 500;
    margin-bottom: 0.2rem;
}
.shift-note {
    color: #9ca3af;
    font-size: 0.72rem;
    font-style: italic;
    margin-bottom: 0.3rem;
}
.shift-location {
    color: #6b7280;
    font-size: 0.72rem;
    margin-bottom: 0.15rem;
}
.shift-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.35rem;
}
.claim-btn {
    background: #15803d;
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
}
.claim-btn:hover { background: #166534; }
.unclaim-btn {
    background: transparent;
    color: #6b7280;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    cursor: pointer;
}
.unclaim-btn:hover { background: #f3f4f6; }
.delete-btn {
    background: transparent;
    color: #dc2626;
    border: none;
    padding: 0.2rem 0.35rem;
    font-size: 0.75rem;
    cursor: pointer;
    margin-left: auto;
    opacity: 0.5;
}
.delete-btn:hover { opacity: 1; }

/* Role slot card — dashed border to distinguish from one-off shifts */
.shift-card.role-slot {
    border-style: dashed;
    border-color: #a7f3d0;
    background: #f0fdf4;
}
.role-badge {
    background: #d1fae5;
    color: #065f46;
}
</style>
