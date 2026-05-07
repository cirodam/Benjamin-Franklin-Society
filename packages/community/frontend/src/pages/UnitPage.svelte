<script lang="ts">
    import { getUnit, listRoles, listRoleTypes, listPersons, createRole, updateRole, deleteRole, createMotion, updateUnit } from "../lib/api.js";
    import type { UnitDto, RoleDto, RoleTypeDto, PersonDto, ScheduleSlot } from "../lib/api.js";
    import { currentPage, selectedUnitId, selectedDomainId } from "../lib/session.js";

    let unit: UnitDto | null = $state(null);
    let roles: RoleDto[] = $state([]);
    let roleTypes: RoleTypeDto[] = $state([]);
    let loading = $state(true);
    let error = $state("");

    // Add-role form
    let showAddRole = $state(false);
    let addMode: "type" | "custom" = $state("custom");
    let newRoleTitle = $state("");
    let newRoleDescription = $state("");
    let newRoleKin = $state("");
    let newRoleTypeId = $state("");
    let addError = $state("");
    let adding = $state(false);

    // Inline kin editing
    let editingKinId: string | null = $state(null);
    let editKinValue = $state("");
    let savingKin = $state(false);

    // Delete
    let deletingId: string | null = $state(null);

    // Rename unit
    let renaming = $state(false);
    let renameValue = $state("");
    let renameSaving = $state(false);

    function startRename() {
        if (!unit) return;
        renameValue = unit.name;
        renaming = true;
    }

    async function saveRename() {
        if (!unit || !renameValue.trim()) return;
        renameSaving = true;
        try {
            const updated = await updateUnit(unit.id, { name: renameValue.trim() });
            unit = updated;
            renaming = false;
        } catch {
            // leave the rename input open so user can retry
        } finally {
            renameSaving = false;
        }
    }

    // Nominate for a vacant role
    let nominatingRoleId: string | null = $state(null);
    let nomineeHandle = $state("");
    let nominationStatement = $state("");
    let nominating = $state(false);
    let nominationError = $state("");
    let nominationSuccess = $state(false);

    // Assign member to role
    let persons: PersonDto[] = $state([]);
    let assigningRoleId: string | null = $state(null);
    let assignPersonHandle = $state("");
    let assignSaving = $state(false);

    // Schedule editing
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let scheduleRoleId: string | null = $state(null);
    let editSlots: ScheduleSlot[] = $state([]);
    let scheduleSaving = $state(false);
    let scheduleError = $state("");

    function openSchedule(role: RoleDto) {
        scheduleRoleId = role.id;
        editSlots = role.weeklySchedule.map(s => ({ ...s }));
        scheduleError = "";
    }

    function closeSchedule() { scheduleRoleId = null; }

    function addSlot() {
        editSlots = [...editSlots, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }];
    }

    function removeSlot(i: number) {
        editSlots = editSlots.filter((_, idx) => idx !== i);
    }

    async function saveSchedule(roleId: string) {
        scheduleSaving = true;
        scheduleError = "";
        try {
            const updated = await updateRole(roleId, { weeklySchedule: editSlots });
            roles = roles.map(r => r.id === updated.id ? updated : r);
            scheduleRoleId = null;
        } catch (e) {
            scheduleError = e instanceof Error ? e.message : "Failed to save";
        } finally {
            scheduleSaving = false;
        }
    }

    // Sorted role types: preferred for this unit type first, then the rest
    const sortedRoleTypes = $derived(() => {
        const unitType = unit?.type ?? "";
        if (!unitType) return { preferred: [], others: roleTypes };
        const preferred = roleTypes.filter(rt => rt.preferredUnitTypes.includes(unitType));
        const others    = roleTypes.filter(rt => !rt.preferredUnitTypes.includes(unitType));
        return { preferred, others };
    });

    function startAssign(role: RoleDto) {
        assigningRoleId = role.id;
        assignPersonHandle = role.memberHandle ?? "";
    }

    async function saveAssign(roleId: string) {
        if (!assignPersonHandle && !roles.find(r => r.id === roleId)?.memberHandle) return;
        assignSaving = true;
        try {
            const updated = await updateRole(roleId, { memberHandle: assignPersonHandle || null });
            roles = roles.map(r => r.id === updated.id ? updated : r);
        } catch {
            // silently revert
        } finally {
            assignSaving  = false;
            assigningRoleId = null;
        }
    }

    async function load(id: string) {
        loading = true;
        error = "";
        try {
            const [u, allRoles, rts, ps] = await Promise.all([
                getUnit(id),
                listRoles(),
                listRoleTypes(),
                listPersons(),
            ]);
            unit = u;
            roles = allRoles.filter(r => u.roleIds.includes(r.id));
            roleTypes = rts;
            persons = ps;
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load unit";
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        const id = $selectedUnitId;
        if (id) load(id);
    });

    function back() {
        currentPage.go("domain");
    }

    async function doAddRole() {
        if (!unit) return;
        addError = "";

        if (addMode === "type") {
            if (!newRoleTypeId) { addError = "Select a role type"; return; }
        } else {
            if (!newRoleTitle.trim()) { addError = "Title is required"; return; }
        }

        adding = true;
        try {
            const payload =
                addMode === "type"
                    ? { unitId: unit.id, roleTypeId: newRoleTypeId }
                    : {
                          unitId:      unit.id,
                          title:       newRoleTitle.trim(),
                          description: newRoleDescription.trim(),
                          kinPerMonth: parseFloat(newRoleKin) || 0,
                      };
            await createRole(payload);
            await load(unit.id);
            showAddRole = false;
            newRoleTitle = ""; newRoleDescription = ""; newRoleKin = ""; newRoleTypeId = "";
        } catch (e) {
            addError = e instanceof Error ? e.message : "Failed to add role";
        } finally {
            adding = false;
        }
    }

    function startEditKin(role: RoleDto) {
        editingKinId = role.id;
        editKinValue = String(role.kinPerMonth);
    }

    async function saveKin(role: RoleDto) {
        const val = parseFloat(editKinValue);
        if (isNaN(val) || val < 0) { editingKinId = null; return; }
        savingKin = true;
        try {
            const updated = await updateRole(role.id, { kinPerMonth: val, funded: val > 0 });
            roles = roles.map(r => r.id === updated.id ? updated : r);
        } catch {
            // silently revert
        } finally {
            savingKin = false;
            editingKinId = null;
        }
    }

    async function doDelete(roleId: string) {
        if (!unit) return;
        deletingId = roleId;
        try {
            await deleteRole(roleId);
            await load(unit.id);
        } catch {
            // silently ignore
        } finally {
            deletingId = null;
        }
    }

    function startNominate(roleId: string) {
        nominatingRoleId = roleId;
        nomineeHandle = "";
        nominationStatement = "";
        nominationError = "";
        nominationSuccess = false;
    }

    async function submitNomination(roleId: string) {
        if (!nomineeHandle) { nominationError = "Please select a nominee."; return; }
        const role = roles.find(r => r.id === roleId);
        nominating = true;
        nominationError = "";
        try {
            await createMotion({
                authorityId: "assembly",
                kind:        "nominate-for-role",
                title:       `Nominate @${nomineeHandle} for ${role?.title ?? roleId}`,
                description: nominationStatement || `Motion to appoint @${nomineeHandle} to the role of ${role?.title ?? roleId}.`,
                payload:     { roleId, nomineeHandle, statement: nominationStatement },
            });
            nominationSuccess = true;
            setTimeout(() => {
                nominatingRoleId = null;
                nominationSuccess = false;
            }, 1500);
        } catch (e) {
            nominationError = e instanceof Error ? e.message : "Submission failed";
        } finally {
            nominating = false;
        }
    }

    function daysUntil(iso: string | null): number | null {
        if (!iso) return null;
        return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }

    function fmt(n: number): string {
        return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
</script>

<div class="unit-page">
    <div class="page-header">
        <button class="back-btn" onclick={back}>‹ Domain</button>
    </div>

    {#if loading}
        <div class="skeleton wide"></div>
        <div class="skeleton short"></div>
        <div class="skeleton"></div>
    {:else if error}
        <div class="error-msg">{error}</div>
    {:else if unit}
        <div class="unit-header">
            <div class="unit-type-badge">{unit.type}</div>
            {#if renaming}
                <div class="rename-row">
                    <input
                        class="rename-input"
                        type="text"
                        bind:value={renameValue}
                        onkeydown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") renaming = false; }}
                        autofocus
                    />
                    <button class="rename-save" onclick={saveRename} disabled={renameSaving || !renameValue.trim()}>Save</button>
                    <button class="rename-cancel" onclick={() => renaming = false}>Cancel</button>
                </div>
            {:else}
                <div class="rename-row">
                    <h2 class="unit-name">{unit.name}</h2>
                    <button class="rename-btn" onclick={startRename} title="Rename">✎</button>
                </div>
            {/if}
            {#if unit.description}
                <p class="unit-desc">{unit.description}</p>
            {/if}
        </div>

        <section class="roles-section">
            <div class="section-row">
                <h3 class="section-title">Roles</h3>
                <button class="add-btn" onclick={() => { showAddRole = !showAddRole; addError = ""; }}>
                    {showAddRole ? "Cancel" : "+ Add role"}
                </button>
            </div>

            {#if roles.length === 0 && !showAddRole}
                <p class="empty-msg">No roles defined yet.</p>
            {:else}
                <div class="role-list">
                    {#each roles as role (role.id)}
                        <div class="role-card">
                            <div class="role-card-top">
                                <div class="role-title-row">
                                    <span class="role-title">{role.title}</span>
                                    {#if !role.memberHandle}
                                        <span class="vacant-badge">vacant</span>
                                    {/if}
                                    {#if !role.funded}
                                        <span class="unfunded-badge">unfunded</span>
                                    {/if}
                                </div>
                                {#if role.memberHandle}
                                    <div class="role-holder-row">
                                        <span class="role-holder">@{role.memberHandle}</span>
                                        <button class="reassign-btn" onclick={() => startAssign(role)} title="Reassign">✎</button>
                                    </div>
                                {/if}
                                <button
                                    class="delete-btn"
                                    onclick={() => doDelete(role.id)}
                                    disabled={deletingId === role.id}
                                    aria-label="Remove role"
                                >✕</button>
                            </div>

                            {#if role.description}
                                <p class="role-desc">{role.description}</p>
                            {/if}

                            {#if assigningRoleId === role.id}
                                <div class="assign-row">
                                    <select class="assign-select" bind:value={assignPersonHandle}>
                                        <option value="">— unassign —</option>
                                        {#each persons as p (p.handle)}
                                            <option value={p.handle}>{p.firstName} {p.lastName}</option>
                                        {/each}
                                    </select>
                                    <button class="assign-save-btn" onclick={() => saveAssign(role.id)} disabled={assignSaving}>
                                        {assignSaving ? "…" : "Save"}
                                    </button>
                                    <button class="assign-cancel-btn" onclick={() => assigningRoleId = null}>Cancel</button>
                                </div>
                            {:else if !role.memberHandle}
                                <div class="vacant-actions">
                                    {#if nominatingRoleId !== role.id}
                                        <button class="nominate-btn" onclick={() => startNominate(role.id)}>Nominate</button>
                                    {/if}
                                </div>
                            {/if}

                            {#if nominatingRoleId === role.id}
                                {#if nominationSuccess}
                                    <p class="nomination-success">Nomination submitted!</p>
                                {:else}
                                    <div class="nomination-form">
                                        <p class="nomination-label">Nominate someone for this role:</p>
                                        <select class="assign-select" bind:value={nomineeHandle}>
                                            <option value="">— select a member —</option>
                                            {#each persons as p (p.handle)}
                                                <option value={p.handle}>{p.firstName} {p.lastName}</option>
                                            {/each}
                                        </select>
                                        <textarea
                                            class="nomination-statement"
                                            bind:value={nominationStatement}
                                            placeholder="Why are they a good fit? (optional)"
                                            rows="2"
                                        ></textarea>
                                        {#if nominationError}
                                            <p class="nomination-error">{nominationError}</p>
                                        {/if}
                                        <div class="assign-row" style="margin-top:0;">
                                            <button class="assign-save-btn" style="background:#15803d;" onclick={() => submitNomination(role.id)} disabled={nominating || !nomineeHandle}>
                                                {nominating ? "…" : "Submit"}
                                            </button>
                                            <button class="assign-cancel-btn" onclick={() => nominatingRoleId = null}>Cancel</button>
                                        </div>
                                    </div>
                                {/if}
                            {/if}

                            {#if role.memberHandle && role.termEndDate}
                                {@const days = daysUntil(role.termEndDate)}
                                {#if days !== null && days <= 60}
                                    <div class="expiry-row">
                                        <span class="expiry-label" class:urgent={days <= 14}>
                                            Term ends in {days}d
                                        </span>
                                        <button class="nominate-btn" onclick={() => startNominate(role.id)}>Nominate replacement</button>
                                    </div>
                                {/if}
                            {/if}

                            <div class="role-footer">
                                {#if editingKinId === role.id}
                                    <div class="kin-edit-row">
                                        <input
                                            class="kin-input"
                                            type="number"
                                            min="0"
                                            bind:value={editKinValue}
                                            onkeydown={(e) => { if (e.key === "Enter") saveKin(role); if (e.key === "Escape") editingKinId = null; }}

                                        />
                                        <button class="kin-save-btn" onclick={() => saveKin(role)} disabled={savingKin}>
                                            {savingKin ? "…" : "Save"}
                                        </button>
                                        <button class="kin-cancel-btn" onclick={() => editingKinId = null}>Cancel</button>
                                    </div>
                                {:else}
                                    <button class="kin-display" onclick={() => startEditKin(role)} title="Click to edit">
                                        {fmt(role.kinPerMonth)} kin/mo
                                    </button>
                                {/if}
                            </div>

                            <!-- Schedule editor -->
                            {#if scheduleRoleId === role.id}
                                <div class="schedule-editor">
                                    <div class="schedule-header">
                                        <span class="schedule-title">Weekly schedule</span>
                                        <button class="schedule-add-btn" onclick={addSlot}>+ Add day</button>
                                    </div>
                                    {#if editSlots.length === 0}
                                        <p class="schedule-empty">No recurring shifts. Add a day above.</p>
                                    {/if}
                                    {#each editSlots as slot, i}
                                        <div class="slot-row">
                                            <select class="slot-input" bind:value={slot.dayOfWeek}>
                                                {#each DAYS as day, idx}
                                                    <option value={idx}>{day}</option>
                                                {/each}
                                            </select>
                                            <input class="slot-input time" type="time" bind:value={slot.startTime} />
                                            <span class="slot-sep">–</span>
                                            <input class="slot-input time" type="time" bind:value={slot.endTime} />
                                            <button class="slot-remove" onclick={() => removeSlot(i)}>✕</button>
                                        </div>
                                    {/each}
                                    {#if scheduleError}
                                        <p class="schedule-err">{scheduleError}</p>
                                    {/if}
                                    <div class="schedule-actions">
                                        <button class="kin-save-btn" onclick={() => saveSchedule(role.id)} disabled={scheduleSaving}>
                                            {scheduleSaving ? "Saving…" : "Save schedule"}
                                        </button>
                                        <button class="kin-cancel-btn" onclick={closeSchedule} disabled={scheduleSaving}>Cancel</button>
                                    </div>
                                </div>
                            {:else}
                                <div class="schedule-summary">
                                    {#if role.weeklySchedule.length > 0}
                                        <span class="schedule-chips">
                                            {#each role.weeklySchedule as slot}
                                                <span class="schedule-chip">{DAYS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}</span>
                                            {/each}
                                        </span>
                                    {/if}
                                    <button class="schedule-edit-btn" onclick={() => openSchedule(role)}>
                                        {role.weeklySchedule.length > 0 ? "Edit schedule" : "Set schedule"}
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}

            {#if showAddRole}
                <div class="add-role-form">
                    {#if addError}<p class="form-error">{addError}</p>{/if}

                    {#if roleTypes.length > 0}
                        <div class="mode-tabs">
                            <button
                                class="mode-tab"
                                class:active={addMode === "custom"}
                                onclick={() => addMode = "custom"}
                            >Custom role</button>
                            <button
                                class="mode-tab"
                                class:active={addMode === "type"}
                                onclick={() => addMode = "type"}
                            >From role type</button>
                        </div>
                    {/if}

                    {#if addMode === "type"}
                        <select class="form-input" bind:value={newRoleTypeId}>
                            <option value="">Select role type…</option>
                            {#if sortedRoleTypes().preferred.length > 0}
                                <optgroup label="Suggested for this unit">
                                    {#each sortedRoleTypes().preferred as rt (rt.id)}
                                        <option value={rt.id}>{rt.title} ({fmt(rt.defaultKinPerMonth)} kin/mo)</option>
                                    {/each}
                                </optgroup>
                                {#if sortedRoleTypes().others.length > 0}
                                    <optgroup label="Other roles">
                                        {#each sortedRoleTypes().others as rt (rt.id)}
                                            <option value={rt.id}>{rt.title} ({fmt(rt.defaultKinPerMonth)} kin/mo)</option>
                                        {/each}
                                    </optgroup>
                                {/if}
                            {:else}
                                {#each roleTypes as rt (rt.id)}
                                    <option value={rt.id}>{rt.title} ({fmt(rt.defaultKinPerMonth)} kin/mo)</option>
                                {/each}
                            {/if}
                        </select>
                    {:else}
                        <input
                            class="form-input"
                            type="text"
                            bind:value={newRoleTitle}
                            placeholder="Role title (e.g. Coordinator)"
                        />
                        <input
                            class="form-input"
                            type="text"
                            bind:value={newRoleDescription}
                            placeholder="Description (optional)"
                        />
                        <input
                            class="form-input"
                            type="number"
                            min="0"
                            bind:value={newRoleKin}
                            placeholder="kin/month (0 = unfunded)"
                        />
                    {/if}

                    <button class="save-btn" onclick={doAddRole} disabled={adding}>
                        {adding ? "Adding…" : "Add role"}
                    </button>
                </div>
            {/if}
        </section>
    {/if}
</div>

<style>
    .unit-page {
        padding: 1rem 1.5rem 6rem;
        max-width: 480px;
        margin: 0 auto;
    }

    @media (min-width: 768px) {
        .unit-page { padding-bottom: 2rem; max-width: 680px; }
    }

    .page-header { margin-bottom: 1.25rem; }

    .back-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #3b82f6;
        padding: 0;
    }

    .unit-header { margin-bottom: 1.75rem; }

    .unit-type-badge {
        display: inline-block;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #64748b;
        background: #e2e8f0;
        border-radius: 9999px;
        padding: 0.2rem 0.6rem;
        margin-bottom: 0.5rem;
    }

    .unit-name {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 0.4rem;
    }

    .rename-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.4rem;
    }
    .rename-row .unit-name { margin: 0; }

    .rename-input {
        font-size: 1.25rem;
        font-weight: 700;
        color: #0f172a;
        border: 1px solid #3b82f6;
        border-radius: 0.4rem;
        padding: 0.2rem 0.5rem;
        outline: none;
        flex: 1;
        min-width: 0;
        font-family: inherit;
    }

    .rename-btn {
        font-size: 0.9rem;
        color: #94a3b8;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.1rem 0.3rem;
        line-height: 1;
        flex-shrink: 0;
    }
    .rename-btn:hover { color: #475569; }

    .rename-save, .rename-cancel {
        font-size: 0.78rem;
        font-weight: 500;
        border-radius: 0.375rem;
        padding: 0.25rem 0.65rem;
        cursor: pointer;
        border: 1px solid;
        white-space: nowrap;
        flex-shrink: 0;
    }
    .rename-save   { background: #16a34a; color: #fff; border-color: #16a34a; }
    .rename-save:hover:not(:disabled) { background: #15803d; }
    .rename-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .rename-cancel { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
    .rename-cancel:hover { background: #e2e8f0; }

    .unit-desc {
        font-size: 0.9rem;
        color: #475569;
        margin: 0;
        line-height: 1.55;
    }

    .roles-section { margin-top: 0; }

    .section-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
    }

    .section-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #94a3b8;
        margin: 0;
    }

    .add-btn {
        font-size: 0.8rem;
        font-weight: 600;
        color: #3b82f6;
        background: none;
        border: 1px solid #bfdbfe;
        border-radius: 0.375rem;
        padding: 0.25rem 0.65rem;
        cursor: pointer;
        transition: background 0.15s;
    }
    .add-btn:hover { background: #eff6ff; }

    .role-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .role-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.85rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .role-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .role-title-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        flex: 1;
        min-width: 0;
    }

    .role-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: #0f172a;
    }

    .vacant-badge {
        font-size: 0.68rem;
        font-weight: 600;
        color: #d97706;
        background: #fef3c7;
        border-radius: 9999px;
        padding: 0.1rem 0.4rem;
    }

    .unfunded-badge {
        font-size: 0.68rem;
        font-weight: 600;
        color: #94a3b8;
        background: #f1f5f9;
        border-radius: 9999px;
        padding: 0.1rem 0.4rem;
    }

    .role-holder-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-top: 0.1rem;
    }
    .role-holder {
        font-size: 0.8rem;
        color: #16a34a;
        font-weight: 500;
    }
    .reassign-btn {
        background: none;
        border: none;
        font-size: 0.8rem;
        color: #94a3b8;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }
    .reassign-btn:hover { color: #475569; }

    .assign-btn {
        align-self: flex-start;
        font-size: 0.75rem;
        color: #3b82f6;
        background: none;
        border: 1px solid #bfdbfe;
        border-radius: 0.375rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
        margin-top: 0.1rem;
        transition: background 0.15s;
    }
    .assign-btn:hover { background: #eff6ff; }

    .assign-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.25rem;
        flex-wrap: wrap;
    }
    .assign-select {
        font-size: 0.82rem;
        padding: 0.25rem 0.45rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.375rem;
        color: #0f172a;
        background: #fff;
        flex: 1;
        min-width: 0;
    }
    .assign-save-btn {
        font-size: 0.78rem;
        padding: 0.25rem 0.6rem;
        background: #3b82f6;
        color: #fff;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        white-space: nowrap;
    }
    .assign-save-btn:disabled { opacity: 0.5; }
    .assign-cancel-btn {
        font-size: 0.78rem;
        padding: 0.25rem 0.5rem;
        background: none;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        color: #64748b;
        cursor: pointer;
    }

    .role-desc {
        font-size: 0.82rem;
        color: #64748b;
        margin: 0;
        line-height: 1.45;
    }

    .role-footer {
        display: flex;
        align-items: center;
        margin-top: 0.2rem;
    }

    .kin-display {
        font-size: 0.82rem;
        font-weight: 600;
        color: #334155;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }
    .kin-display:hover { background: #f1f5f9; border-color: #94a3b8; }

    .kin-edit-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .kin-input {
        width: 7rem;
        font-size: 0.85rem;
        font-family: inherit;
        padding: 0.2rem 0.5rem;
        border: 1px solid #3b82f6;
        border-radius: 0.375rem;
        outline: none;
    }

    .kin-save-btn {
        font-size: 0.8rem;
        font-weight: 600;
        color: #fff;
        background: #3b82f6;
        border: none;
        border-radius: 0.375rem;
        padding: 0.2rem 0.6rem;
        cursor: pointer;
    }
    .kin-save-btn:disabled { opacity: 0.5; }

    .kin-cancel-btn {
        font-size: 0.8rem;
        color: #94a3b8;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
    }

    .delete-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.75rem;
        color: #cbd5e1;
        padding: 0;
        line-height: 1;
        flex-shrink: 0;
        transition: color 0.15s;
    }
    .delete-btn:hover:not(:disabled) { color: #ef4444; }
    .delete-btn:disabled { opacity: 0.4; }

    /* ── Add role form ── */
    .add-role-form {
        margin-top: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.85rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .mode-tabs {
        display: flex;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        overflow: hidden;
        margin-bottom: 0.25rem;
    }

    .mode-tab {
        flex: 1;
        font-size: 0.8rem;
        font-weight: 500;
        padding: 0.4rem 0;
        background: #fff;
        border: none;
        cursor: pointer;
        color: #64748b;
        transition: background 0.15s, color 0.15s;
    }
    .mode-tab.active {
        background: #3b82f6;
        color: #fff;
        font-weight: 600;
    }

    .form-input {
        width: 100%;
        box-sizing: border-box;
        font-size: 0.875rem;
        font-family: inherit;
        padding: 0.45rem 0.7rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        outline: none;
        background: #fff;
        transition: border-color 0.15s;
    }
    .form-input:focus { border-color: #3b82f6; }

    .form-error {
        font-size: 0.8rem;
        color: #ef4444;
        margin: 0;
    }

    .save-btn {
        align-self: flex-start;
        font-size: 0.85rem;
        font-weight: 600;
        color: #fff;
        background: #3b82f6;
        border: none;
        border-radius: 0.5rem;
        padding: 0.45rem 1rem;
        cursor: pointer;
        transition: background 0.15s;
    }
    .save-btn:hover:not(:disabled) { background: #2563eb; }
    .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .empty-msg {
        font-size: 0.875rem;
        color: #94a3b8;
        padding: 0.5rem 0;
    }

    .error-msg {
        font-size: 0.9rem;
        color: #ef4444;
        padding: 1rem 0;
    }

    .skeleton {
        height: 2.5rem;
        border-radius: 0.5rem;
        background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
        background-size: 200% 100%;
        animation: shimmer 1.2s infinite;
        margin-bottom: 0.5rem;
    }
    .skeleton.wide { height: 2rem; width: 70%; }
    .skeleton.short { width: 40%; height: 1.2rem; }

    @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    .vacant-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .nominate-btn {
        font-size: 0.75rem;
        font-weight: 600;
        color: #15803d;
        background: none;
        border: 1px solid #a7f3d0;
        border-radius: 0.375rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
        transition: background 0.15s;
    }
    .nominate-btn:hover { background: #f0fdf4; }

    .nomination-form {
        margin-top: 0.35rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .nomination-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #374151;
        margin: 0;
    }
    .nomination-statement {
        width: 100%;
        box-sizing: border-box;
        font-size: 0.82rem;
        font-family: inherit;
        padding: 0.35rem 0.55rem;
        border: 1px solid #d1fae5;
        border-radius: 0.375rem;
        background: #f9fafb;
        resize: vertical;
        min-height: 2rem;
    }
    .nomination-error {
        font-size: 0.78rem;
        color: #dc2626;
        margin: 0;
    }
    .nomination-success {
        font-size: 0.82rem;
        color: #15803d;
        font-weight: 600;
        margin: 0.35rem 0 0;
    }

    .expiry-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-top: 0.3rem;
        flex-wrap: wrap;
    }
    .expiry-label {
        font-size: 0.74rem;
        font-weight: 700;
        color: #d97706;
        background: #fef3c7;
        border-radius: 5px;
        padding: 0.15rem 0.4rem;
    }
    .expiry-label.urgent {
        color: #dc2626;
        background: #fee2e2;
    }

    /* Schedule editor */
    .schedule-editor {
        margin-top: 0.75rem;
        padding: 0.75rem;
        background: #f0fdf4;
        border: 1px solid #a7f3d0;
        border-radius: 8px;
    }
    .schedule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    .schedule-title {
        font-size: 0.8rem;
        font-weight: 700;
        color: #14532d;
    }
    .schedule-add-btn {
        background: transparent;
        border: 1px dashed #a7f3d0;
        border-radius: 5px;
        color: #15803d;
        font-size: 0.75rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
    }
    .schedule-add-btn:hover { background: #d1fae5; }
    .schedule-empty {
        color: #9ca3af;
        font-size: 0.78rem;
        margin: 0 0 0.5rem;
    }
    .slot-row {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        margin-bottom: 0.4rem;
    }
    .slot-input {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 0.25rem 0.4rem;
        font-size: 0.8rem;
        font-family: inherit;
        background: #fff;
        color: #111827;
    }
    .slot-input.time { width: 6.5rem; }
    .slot-sep { color: #9ca3af; font-size: 0.85rem; }
    .slot-remove {
        background: transparent;
        border: none;
        color: #dc2626;
        cursor: pointer;
        font-size: 0.75rem;
        opacity: 0.55;
        padding: 0.1rem 0.25rem;
    }
    .slot-remove:hover { opacity: 1; }
    .schedule-err {
        color: #dc2626;
        font-size: 0.78rem;
        margin: 0.25rem 0;
    }
    .schedule-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.4rem;
    }

    /* Schedule summary (collapsed view) */
    .schedule-summary {
        margin-top: 0.6rem;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    .schedule-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
    }
    .schedule-chip {
        background: #d1fae5;
        color: #065f46;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.15rem 0.45rem;
        border-radius: 4px;
    }
    .schedule-edit-btn {
        background: transparent;
        border: 1px solid #a7f3d0;
        border-radius: 5px;
        color: #15803d;
        font-size: 0.74rem;
        padding: 0.18rem 0.5rem;
        cursor: pointer;
        margin-left: auto;
    }
    .schedule-edit-btn:hover { background: #f0fdf4; }
</style>
