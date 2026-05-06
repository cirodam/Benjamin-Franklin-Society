<script lang="ts">
    import { getConstitution, listPersons, listPools, listNominations, listBylaws, listRoleTypes, listUnitTypes, listDomains } from "../lib/api.js";
    import type { ConstitutionDto, PersonDto, PoolDto, NominationDto, BylawDto, RoleTypeDto, UnitTypeDto, DomainDto } from "../lib/api.js";

    let {
        kind,
        payload = $bindable<Record<string, unknown>>({}),
    }: {
        kind: string;
        payload: Record<string, unknown>;
    } = $props();

    // Lazy-loaded reference data
    let constitution = $state<ConstitutionDto | null>(null);
    let persons      = $state([] as PersonDto[]);
    let pools        = $state([] as PoolDto[]);
    let nominations  = $state([] as NominationDto[]);
    let bylaws       = $state([] as BylawDto[]);
    let roleTypes    = $state([] as RoleTypeDto[]);
    let unitTypes    = $state([] as UnitTypeDto[]);
    let domains      = $state([] as DomainDto[]);

    $effect(() => {
        if (kind === "amend-constitution" && !constitution) {
            getConstitution().then(c => { constitution = c; }).catch(() => {});
        } else if ((kind === "suspend-member" || kind === "reinstate-member") && !persons.length) {
            listPersons().then(p => { persons = p; }).catch(() => {});
        } else if (kind === "remove-role" && !pools.length) {
            listPools().then(p => { pools = p; }).catch(() => {});
        } else if (kind === "accept-nomination" && !nominations.length) {
            listNominations().then(ns => { nominations = ns.filter(n => n.status === "pending"); }).catch(() => {});
        } else if (kind === "amend-bylaw" && !bylaws.length) {
            listBylaws().then(b => { bylaws = b; }).catch(() => {});
        } else if (kind === "remove-role-type" && !roleTypes.length) {
            listRoleTypes().then(r => { roleTypes = r; }).catch(() => {});
        } else if (kind === "remove-unit-type" && !unitTypes.length) {
            listUnitTypes().then(u => { unitTypes = u; }).catch(() => {});
        } else if (kind === "deploy-unit") {
            if (!roleTypes.length) listRoleTypes().then(r => { roleTypes = r; }).catch(() => {});
            if (!unitTypes.length) listUnitTypes().then(u => { unitTypes = u; }).catch(() => {});
            if (!domains.length)   listDomains().then(d => { domains = d; }).catch(() => {});
        } else if (kind === "add-pool-member") {
            if (!pools.length)   listPools().then(p => { pools = p; }).catch(() => {});
            if (!persons.length) listPersons().then(p => { persons = p; }).catch(() => {});
        }
    });

    // Per-kind field state
    let amendParam       = $state("");
    let amendBool        = $state("true");
    let amendNum         = $state("");
    let selectedPersonId = $state("");
    let roleName         = $state("");
    let roleDesc         = $state("");
    let selectedPoolId   = $state("");
    let nominationId     = $state("");

    // set-dues-rate fields
    let duesRatePct = $state("");

    // set-retirement-age / set-retirement-payout fields
    let retirementAgeInput    = $state("");
    let retirementPayoutInput = $state("");

    // add-person fields
    let apFirstName      = $state("");
    let apLastName       = $state("");
    let apBirthDate      = $state("");
    let apPhone          = $state("");

    let bylawTitle       = $state("");
    let bylawPreamble    = $state("");
    let bylawId          = $state("");
    let bylawSunsetYears = $state("");
    let bylawRenewYears  = $state("");

    // add-role-type fields
    let rtTitle     = $state("");
    let rtDesc      = $state("");
    let rtKin       = $state("");

    // remove-role-type fields
    let selectedRoleTypeId = $state("");

    // add-unit-type fields
    let utType  = $state("");
    let utLabel = $state("");
    let utDesc  = $state("");

    // remove-unit-type fields
    let selectedUnitType = $state("");

    // deploy-unit fields
    let deployDomainId   = $state("");
    let deployUnitType   = $state("");
    let deployUnitName   = $state("");
    let deployUnitDesc   = $state("");
    let deployRoles      = $state([] as Array<{ roleTypeId: string; count: number; kinOverride: string }>);

    function addDeployRoleSlot() {
        deployRoles = [...deployRoles, { roleTypeId: "", count: 1, kinOverride: "" }];
    }
    function removeDeployRoleSlot(i: number) {
        deployRoles = deployRoles.filter((_, idx) => idx !== i);
    }

    // found-marketplace fields
    let mpName            = $state("");
    let mpLocationName    = $state("");
    let mpLocationAddress = $state("");
    let mpDescription     = $state("");

    // create-association fields
    let assocName        = $state("");
    let assocHandle      = $state("");
    let assocDescription = $state("");

    // add-pool-member fields
    let addPoolMemberPoolId   = $state("");
    let addPoolMemberPersonId = $state("");

    function autoAssocHandle() {
        if (!assocHandle) {
            assocHandle = assocName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        }
    }

    // schedule-community-event fields
    let evtTitle            = $state("");
    let evtDate             = $state("");
    let evtStartTime        = $state("09:00");
    let evtEndTime          = $state("");
    let evtAllDay           = $state(false);
    let evtLocation         = $state("");
    let evtDescription      = $state("");
    let evtRecurrence       = $state("");
    let evtRecurrenceEndsAt = $state("");

    const amendParamInfo = $derived(
        constitution && amendParam ? (constitution.meta.parameters[amendParam] ?? null) : null
    );
    const amendIsBoolean = $derived(amendParamInfo ? typeof amendParamInfo.value === "boolean" : false);

    // Sync local fields → payload
    $effect(() => {
        if (kind === "amend-constitution") {
            if (!amendParam || !amendParamInfo) { payload = {}; return; }
            if (amendIsBoolean) {
                payload = { parameter: amendParam, newValue: amendBool === "true" };
            } else {
                const n = Number(amendNum);
                if (!amendNum || isNaN(n)) { payload = {}; return; }
                payload = { parameter: amendParam, newValue: n };
            }
        } else if (kind === "set-dues-rate") {
            const r = parseFloat(duesRatePct);
            payload = (!duesRatePct || isNaN(r) || r < 0 || r > 10) ? {} : { rate: r };
        } else if (kind === "set-retirement-age") {
            const a = parseInt(retirementAgeInput, 10);
            payload = (!retirementAgeInput || isNaN(a) || a < 55 || a > 75) ? {} : { age: a };
        } else if (kind === "set-retirement-payout") {
            const amt = parseInt(retirementPayoutInput, 10);
            payload = (!retirementPayoutInput || isNaN(amt) || amt < 0 || amt > 100_000) ? {} : { amount: amt };
        } else if (kind === "add-person") {
            const fn = apFirstName.trim();
            const ln = apLastName.trim();
            if (!fn || !ln || !apBirthDate) { payload = {}; }
            else {
                payload = {
                    firstName:       fn,
                    lastName:        ln,
                    birthDate:       apBirthDate,
                    ...(apPhone.trim() ? { phone: apPhone.trim() } : {}),
                };
            }
        } else if (kind === "suspend-member" || kind === "reinstate-member") {
            payload = selectedPersonId ? { personId: selectedPersonId } : {};
        } else if (kind === "add-role") {
            const name = roleName.trim();
            const desc = roleDesc.trim();
            payload = name ? { name, ...(desc ? { description: desc } : {}) } : {};
        } else if (kind === "remove-role") {
            payload = selectedPoolId ? { poolId: selectedPoolId } : {};
        } else if (kind === "accept-nomination") {
            payload = nominationId ? { nominationId } : {};
        } else if (kind === "schedule-community-event") {
            if (!evtTitle.trim() || !evtDate) { payload = {}; return; }
            const startAt = evtAllDay
                ? `${evtDate}T00:00:00.000Z`
                : new Date(`${evtDate}T${evtStartTime}:00`).toISOString();
            const endAt = (!evtAllDay && evtEndTime)
                ? new Date(`${evtDate}T${evtEndTime}:00`).toISOString()
                : null;
            const recurrenceEndsAt = evtRecurrenceEndsAt
                ? new Date(evtRecurrenceEndsAt + "T23:59:59").toISOString()
                : null;
            payload = {
                title:       evtTitle.trim(),
                startAt,
                ...(endAt            ? { endAt }            : {}),
                ...(evtAllDay        ? { allDay: true }      : {}),
                ...(evtLocation.trim()     ? { location:    evtLocation.trim() }     : {}),
                ...(evtDescription.trim()  ? { description: evtDescription.trim() }  : {}),
                ...(evtRecurrence          ? { recurrence:  evtRecurrence }           : {}),
                ...(recurrenceEndsAt       ? { recurrenceEndsAt }                     : {}),
            };
        } else if (kind === "create-bylaw") {
            const title = bylawTitle.trim();
            const sy = bylawSunsetYears.trim() ? parseInt(bylawSunsetYears.trim(), 10) : null;
            payload = title
                ? {
                    title,
                    ...(bylawPreamble.trim() ? { preamble: bylawPreamble.trim() } : {}),
                    ...(sy && sy > 0 ? { sunsetYears: sy } : {}),
                  }
                : {};
        } else if (kind === "amend-bylaw") {
            const ry = bylawRenewYears.trim() ? parseInt(bylawRenewYears.trim(), 10) : null;
            payload = bylawId
                ? {
                    bylawId,
                    ...(bylawTitle.trim()    ? { title:      bylawTitle.trim() }    : {}),
                    ...(bylawPreamble.trim() ? { preamble:   bylawPreamble.trim() } : {}),
                    ...(ry && ry > 0         ? { renewYears: ry }                   : {}),
                  }
                : {};
        } else if (kind === "add-role-type") {
            const title = rtTitle.trim();
            if (!title) { payload = {}; return; }
            const kin = rtKin.trim() ? Number(rtKin.trim()) : 0;
            payload = {
                title,
                ...(rtDesc.trim() ? { description: rtDesc.trim() } : {}),
                ...(kin > 0       ? { defaultKinPerMonth: kin }     : {}),
            };
        } else if (kind === "remove-role-type") {
            payload = selectedRoleTypeId ? { roleTypeId: selectedRoleTypeId } : {};
        } else if (kind === "add-unit-type") {
            const type  = utType.trim().toLowerCase().replace(/\s+/g, "-");
            const label = utLabel.trim();
            if (!type || !label) { payload = {}; return; }
            payload = { type, label, description: utDesc.trim() };
        } else if (kind === "remove-unit-type") {
            payload = selectedUnitType ? { unitType: selectedUnitType } : {};
        } else if (kind === "deploy-unit") {
            if (!deployDomainId || !deployUnitType) { payload = {}; return; }
            const validRoles = deployRoles
                .filter(s => s.roleTypeId)
                .map(s => ({
                    roleTypeId: s.roleTypeId,
                    count:      Math.max(1, s.count),
                    ...(s.kinOverride.trim() && !isNaN(Number(s.kinOverride))
                        ? { kinPerMonth: Number(s.kinOverride) }
                        : {}),
                }));
            payload = {
                domainId: deployDomainId,
                unitType: deployUnitType,
                ...(deployUnitName.trim() ? { name:        deployUnitName.trim() } : {}),
                ...(deployUnitDesc.trim() ? { description: deployUnitDesc.trim() } : {}),
                ...(validRoles.length     ? { roles: validRoles }                  : {}),
            };
        } else if (kind === "create-association") {
            const name   = assocName.trim();
            const handle = assocHandle.trim();
            if (!name || !handle) { payload = {}; return; }
            payload = {
                name,
                handle,
                ...(assocDescription.trim() ? { description: assocDescription.trim() } : {}),
            };
        } else if (kind === "add-pool-member") {
            payload = (addPoolMemberPoolId && addPoolMemberPersonId)
                ? { poolId: addPoolMemberPoolId, personId: addPoolMemberPersonId }
                : {};
        } else if (kind === "found-marketplace") {
            const name    = mpName.trim();
            const locName = mpLocationName.trim();
            const locAddr = mpLocationAddress.trim();
            if (!name || !locName || !locAddr) { payload = {}; return; }
            payload = {
                name,
                locationName:    locName,
                locationAddress: locAddr,
                ...(mpDescription.trim() ? { description: mpDescription.trim() } : {}),
            };
        } else {
            payload = {};
        }
    });
</script>

{#if kind === "amend-constitution"}
    {#if !constitution}
        <p class="hint">Loading constitution…</p>
    {:else}
        <select class="input select" bind:value={amendParam}>
            <option value="">— choose parameter —</option>
            {#each Object.entries(constitution.meta.parameters) as [key, param]}
                <option value={key}>{param.description} ({key})</option>
            {/each}
        </select>
        {#if amendParamInfo}
            <p class="hint">
                Current: <strong>{String(amendParamInfo.value)}</strong>
                {#if amendParamInfo.constraints?.min !== undefined || amendParamInfo.constraints?.max !== undefined}
                    &nbsp;·&nbsp; range: {amendParamInfo.constraints?.min ?? "–"} – {amendParamInfo.constraints?.max ?? "–"}
                {/if}
            </p>
            {#if amendIsBoolean}
                <select class="input select" bind:value={amendBool}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            {:else}
                <input
                    class="input"
                    type="number"
                    placeholder="New value"
                    bind:value={amendNum}
                    min={amendParamInfo.constraints?.min}
                    max={amendParamInfo.constraints?.max}
                />
            {/if}
        {/if}
    {/if}
{:else if kind === "set-dues-rate"}
    <input
        class="input"
        type="number"
        placeholder="New dues rate (% per month, e.g. 2 = 2%)"
        bind:value={duesRatePct}
        min="0" max="10" step="0.1"
    />
    {#if constitution}
        <p class="hint">Current rate: <strong>{(constitution.meta.parameters["communityDuesRate"]?.value as number * 100 ?? 0).toFixed(2)}%</strong> / month &nbsp;·&nbsp; allowed range: 0–10%</p>
    {/if}
{:else if kind === "set-retirement-age"}
    <input
        class="input"
        type="number"
        placeholder="New retirement age (years, 55–75)"
        bind:value={retirementAgeInput}
        min="55" max="75" step="1"
    />
    {#if constitution}
        <p class="hint">Current age: <strong>{constitution.meta.parameters["retirementAge"]?.value ?? 65} years</strong> &nbsp;·&nbsp; allowed range: 55–75</p>
    {/if}
{:else if kind === "set-retirement-payout"}
    <input
        class="input"
        type="number"
        placeholder="New monthly payout per retiree (kin)"
        bind:value={retirementPayoutInput}
        min="0" max="100000" step="1"
    />
    {#if constitution}
        <p class="hint">Current payout: <strong>{constitution.meta.parameters["retirementPayoutRate"]?.value ?? 500} kin/month</strong> &nbsp;·&nbsp; allowed range: 0–100,000</p>
    {/if}
{:else if kind === "add-person"}
    <input class="input" type="text" placeholder="First name *" bind:value={apFirstName} />
    <input class="input" type="text" placeholder="Last name *" bind:value={apLastName} />
    <label class="hint-label">Date of birth *
        <input class="input" type="date" bind:value={apBirthDate} />
    </label>
    <input class="input" type="tel" placeholder="Phone (optional, E.164 e.g. +15551234567)" bind:value={apPhone} />
{:else if kind === "suspend-member" || kind === "reinstate-member"}
    {#if !persons.length}
        <p class="hint">Loading members…</p>
    {:else}
        <select class="input select" bind:value={selectedPersonId}>
            <option value="">— choose member —</option>
            {#each persons.filter(p => kind === "suspend-member" ? !p.disabled : p.disabled) as p (p.id)}
                <option value={p.id}>{p.firstName} {p.lastName}{p.handle ? ` (@${p.handle})` : ""}</option>
            {/each}
        </select>
    {/if}
{:else if kind === "add-role"}
    <input class="input" type="text" placeholder="Pool name" bind:value={roleName} />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={roleDesc} rows="2"></textarea>
{:else if kind === "remove-role"}
    {#if !pools.length}
        <p class="hint">Loading pools…</p>
    {:else}
        <select class="input select" bind:value={selectedPoolId}>
            <option value="">— choose pool —</option>
            {#each pools as p (p.id)}
                <option value={p.id}>{p.name}</option>
            {/each}
        </select>
    {/if}
{:else if kind === "accept-nomination"}
    {#if !nominations.length}
        <p class="hint">No pending nominations.</p>
    {:else}
        <select class="input select" bind:value={nominationId}>
            <option value="">— choose nomination —</option>
            {#each nominations as n (n.id)}
                <option value={n.id}>{n.poolName ?? n.roleId} — {n.nomineeId}</option>
            {/each}
        </select>
    {/if}
{:else if kind === "schedule-community-event"}
    <input class="input" type="text" placeholder="Event title *" bind:value={evtTitle} />

    <div class="row">
        <label class="field">
            <span class="field-label">Date *</span>
            <input class="input" type="date" bind:value={evtDate} />
        </label>
        <label class="field field-check">
            <input type="checkbox" bind:checked={evtAllDay} />
            <span class="field-label">All day</span>
        </label>
    </div>

    {#if !evtAllDay}
        <div class="row">
            <label class="field">
                <span class="field-label">Start time</span>
                <input class="input" type="time" bind:value={evtStartTime} />
            </label>
            <label class="field">
                <span class="field-label">End time</span>
                <input class="input" type="time" bind:value={evtEndTime} />
            </label>
        </div>
    {/if}

    <input class="input" type="text" placeholder="Location (optional)" bind:value={evtLocation} />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={evtDescription} rows="2"></textarea>

    <div class="row">
        <label class="field">
            <span class="field-label">Repeats</span>
            <select class="input select" bind:value={evtRecurrence}>
                <option value="">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
            </select>
        </label>
        {#if evtRecurrence}
            <label class="field">
                <span class="field-label">Ends on</span>
                <input class="input" type="date" bind:value={evtRecurrenceEndsAt} />
            </label>
        {/if}
    </div>
{:else if kind === "create-bylaw"}
    <input class="input" type="text" placeholder="Bylaw title *" bind:value={bylawTitle} />
    <textarea class="input textarea" placeholder="Preamble (optional)" bind:value={bylawPreamble} rows="3"></textarea>
    <input class="input" type="number" placeholder="Sunset after (years, optional — leave blank for permanent)" bind:value={bylawSunsetYears} min="1" />
{:else if kind === "amend-bylaw"}
    {#if !bylaws.length}
        <p class="hint">Loading bylaws…</p>
    {:else}
        <select class="input select" bind:value={bylawId} onchange={() => { bylawTitle = ""; bylawPreamble = ""; bylawRenewYears = ""; }}>
            <option value="">— choose bylaw —</option>
            {#each bylaws as b (b.id)}
                <option value={b.id}>{b.title}{b.domainId ? ` [domain: ${b.domainId}]` : ""}{b.expiresAt ? ` · expires ${new Date(b.expiresAt).getFullYear()}` : ""}</option>
            {/each}
        </select>
    {/if}
    {#if bylawId}
        <input class="input" type="text" placeholder="New title (leave blank to keep current)" bind:value={bylawTitle} />
        <textarea class="input textarea" placeholder="New preamble (leave blank to keep current)" bind:value={bylawPreamble} rows="3"></textarea>
        <input class="input" type="number" placeholder="Renew for (years, optional — extends or sets expiry)" bind:value={bylawRenewYears} min="1" />
    {/if}
{:else if kind === "add-role-type"}
    <input class="input" type="text" placeholder="Role title * (e.g. Nurse Practitioner)" bind:value={rtTitle} />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={rtDesc} rows="2"></textarea>
    <input class="input" type="number" placeholder="Default kin / month (0 = unpaid)" bind:value={rtKin} min="0" />
{:else if kind === "remove-role-type"}
    {#if !roleTypes.length}
        <p class="hint">Loading role types…</p>
    {:else}
        <select class="input select" bind:value={selectedRoleTypeId}>
            <option value="">— choose role type —</option>
            {#each roleTypes as rt (rt.id)}
                <option value={rt.id}>{rt.title} ({rt.defaultKinPerMonth} kin/mo)</option>
            {/each}
        </select>
    {/if}
{:else if kind === "add-unit-type"}
    <input class="input" type="text" placeholder="Type identifier * (kebab-case, e.g. compost-facility)" bind:value={utType} />
    <input class="input" type="text" placeholder="Display label * (e.g. Compost Facility)" bind:value={utLabel} />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={utDesc} rows="2"></textarea>
{:else if kind === "remove-unit-type"}
    {#if !unitTypes.length}
        <p class="hint">Loading unit types…</p>
    {:else}
        <select class="input select" bind:value={selectedUnitType}>
            <option value="">— choose custom unit type —</option>
            {#each unitTypes.filter(u => u.custom) as u (u.type)}
                <option value={u.type}>{u.label} ({u.type})</option>
            {/each}
        </select>
        {#if !unitTypes.some(u => u.custom)}
            <p class="hint">No custom unit types in the bank yet.</p>
        {/if}
    {/if}
{:else if kind === "deploy-unit"}
    {#if !domains.length || !unitTypes.length}
        <p class="hint">Loading…</p>
    {:else}
        <select class="input select" bind:value={deployDomainId}>
            <option value="">— choose institution —</option>
            {#each domains as d (d.id)}
                <option value={d.id}>{d.name}</option>
            {/each}
        </select>
        <select class="input select" bind:value={deployUnitType}>
            <option value="">— choose unit type —</option>
            {#each unitTypes as u (u.type)}
                <option value={u.type}>{u.label}{u.custom ? " ★" : ""}</option>
            {/each}
        </select>
        <input class="input" type="text" placeholder="Custom name (leave blank for default)" bind:value={deployUnitName} />
        <textarea class="input textarea" placeholder="Custom description (optional)" bind:value={deployUnitDesc} rows="2"></textarea>

        <p class="field-label" style="margin-top:0.5rem">Role slots</p>
        {#each deployRoles as slot, i}
            <div class="row role-row">
                <select class="input select" bind:value={slot.roleTypeId}>
                    <option value="">— role type —</option>
                    {#each roleTypes as rt (rt.id)}
                        <option value={rt.id}>{rt.title}</option>
                    {/each}
                </select>
                <input class="input count-input" type="number" min="1" placeholder="×" bind:value={slot.count} />
                <input class="input kin-input" type="number" min="0" placeholder="kin/mo" bind:value={slot.kinOverride} />
                <button type="button" class="remove-slot-btn" onclick={() => removeDeployRoleSlot(i)}>✕</button>
            </div>
        {/each}
        <button type="button" class="add-slot-btn" onclick={addDeployRoleSlot}>+ Add role slot</button>
    {/if}
{:else if kind === "found-marketplace"}
    <input class="input" type="text" placeholder="Marketplace name *" bind:value={mpName} />
    <input class="input" type="text" placeholder="Location name * (e.g. Riverside Park)" bind:value={mpLocationName} />
    <input class="input" type="text" placeholder="Location address *" bind:value={mpLocationAddress} />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={mpDescription} rows="2"></textarea>
{:else if kind === "create-association"}
    <input class="input" type="text" placeholder="Association name * (e.g. First Baptist Church)" bind:value={assocName} onblur={autoAssocHandle} />
    <input class="input" type="text" placeholder="Handle * (unique, letters/numbers/underscores)" bind:value={assocHandle} autocapitalize="none" />
    <textarea class="input textarea" placeholder="Description (optional)" bind:value={assocDescription} rows="2"></textarea>
{:else if kind === "add-pool-member"}
    {#if !pools.length || !persons.length}
        <p class="hint">Loading…</p>
    {:else}
        <select class="input select" bind:value={addPoolMemberPoolId}>
            <option value="">— choose pool —</option>
            {#each pools as p (p.id)}
                <option value={p.id}>{p.name}</option>
            {/each}
        </select>
        <select class="input select" bind:value={addPoolMemberPersonId}>
            <option value="">— choose person —</option>
            {#each persons as p (p.id)}
                <option value={p.id}>{p.firstName} {p.lastName} (@{p.handle})</option>
            {/each}
        </select>
    {/if}
{/if}

<style>
    .input {
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        background: #fff;
        color: #0f172a;
        box-sizing: border-box;
    }
    .input:focus { outline: none; border-color: #16a34a; box-shadow: 0 0 0 2px #bbf7d0; }
    .select { cursor: pointer; }
    .textarea { resize: vertical; min-height: 3.5rem; font-family: inherit; }
    .hint { font-size: 0.78rem; color: #64748b; margin: 0; }
    .hint-label { font-size: 0.78rem; color: #64748b; display: flex; flex-direction: column; gap: 0.25rem; }
    .checkbox-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #475569; cursor: pointer; }
    .row { display: flex; gap: 0.5rem; align-items: flex-end; }
    .field { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
    .field-check { flex-direction: row; align-items: center; gap: 0.35rem; flex: 0 0 auto; padding-bottom: 0.45rem; }
    .field-check input { width: auto; }
    .field-label { font-size: 0.75rem; font-weight: 600; color: #374151; }
    .role-row { align-items: center; }
    .count-input { flex: 0 0 4rem; }
    .kin-input   { flex: 0 0 6rem; }
    .remove-slot-btn {
        flex: 0 0 auto;
        background: none;
        border: none;
        color: #dc2626;
        cursor: pointer;
        font-size: 0.85rem;
        padding: 0.2rem 0.3rem;
        line-height: 1;
    }
    .add-slot-btn {
        margin-top: 0.25rem;
        padding: 0.35rem 0.75rem;
        border: 1px dashed #94a3b8;
        border-radius: 0.5rem;
        background: none;
        color: #475569;
        cursor: pointer;
        font-size: 0.8rem;
    }
    .add-slot-btn:hover { border-color: #16a34a; color: #16a34a; }
</style>
