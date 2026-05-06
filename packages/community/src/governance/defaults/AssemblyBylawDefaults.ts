import { type GoverningDocument } from "@ecf/core";

/**
 * The default Assembly and Voting bylaw.
 *
 * Fixed id: "assembly-voting"
 *
 * This bylaw governs how the assembly meets, deliberates, and votes.
 * Its parameters drive runtime behavior — quorum checks, notice period
 * validation, speaking time, recall thresholds, and emergency assembly logic.
 *
 * Parameters:
 *   assemblyQuorumPercent          — % of seated assembly members required for quorum (default 20)
 *   assemblyQuorumMin              — absolute minimum quorum count of seated members regardless of % (default 5)
 *   regularAssemblyNoticeDays      — days of advance notice required for a regular assembly (default 7)
 *   agendaSubmissionDeadlineDays   — days before meeting by which agenda items must be submitted (default 5)
 *   specialAssemblyNoticeDays      — days of advance notice required for a special assembly (default 5)
 *   emergencyAssemblyNoticeHours   — hours of advance notice required for an emergency assembly (default 24)
 *   defaultSpeakingMinutes         — default per-turn speaking time in minutes (default 3)
 *   specialAssemblyPetitionPercent — % of active members required to petition for a special assembly (default 15)
 *   recallPetitionPercent          — % of active members required to initiate a recall (default 20)
 *   minutesDistributionDays        — days after meeting by which draft minutes must be distributed (default 7)
 */
export const AssemblyBylawDefaults = {
    build(): GoverningDocument {
        return {
            id:          "assembly-voting",
            type:        "bylaw",
            title:       "Assembly and Voting",
            preamble:    "The assembly is the community's primary governing body — not a formality, but the mechanism by which the community governs itself. These rules exist to make the assembly work: to ensure that every member can participate, that deliberation is genuine, that decisions are made clearly, and that the record is honest.",
            adoptedAt:   new Date().toISOString(),
            version:     1,
            authorityId: "assembly",
            voteRuleId:  "two-thirds",
            domainId:    null,
            articles: [
                // ── Article I — The Assembly ──────────────────────────────────────────
                {
                    number:   "I",
                    title:    "The Assembly",
                    sections: [
                        {
                            id:        "I.1",
                            title:     "Nature and Authority",
                            body:      "The Assembly is the sovereign governing body of the community. It is composed of members drawn by sortition from the full membership, as specified in the Constitution. Its decisions are binding on the community, the Stewardship Council, all domain stewards, and all leadership pools. No body within the community may take an action that contradicts a standing assembly decision, except in a declared emergency under §III.3.",
                            rationale: "The assembly is not the full membership voting in mass — it is a randomly drawn cross-section of the membership, sized to be workable as a deliberative body while remaining representative. The full membership retains the right to petition, attend, speak, and vote in referendums.",
                        },
                        {
                            id:        "I.2",
                            title:     "Membership in the Assembly",
                            body:      "Each member seated in the current assembly term holds full voting rights. All active members of the community may attend assembly meetings, submit agenda items, speak during open forum, and file petitions — but only seated assembly members may vote on motions. A suspended seated member retains the right to attend and speak during open forum, but may not vote while suspended. A seated member subject to an active disciplinary proceeding retains all other rights pending the outcome.",
                            rationale: "The full membership is not excluded from the assembly — they can observe, speak, petition, and shape the agenda. But voting rights belong to the drawn seats. This mirrors the logic of a citizen's assembly or grand jury: the drawn body decides, the broader public can make itself heard.",
                        },
                        {
                            id:        "I.3",
                            title:     "The Assembly Secretary",
                            body:      "The Assembly Secretary is responsible for maintaining the agenda, keeping the minutes, distributing notices, and maintaining the public record. The Secretary is drawn by sortition from among seated assembly members who have opted into the Secretary pool for the current term. The Secretary does not chair the meeting and holds no authority to rule on procedure.",
                            rationale: "Separating record-keeping from facilitation prevents the Secretary from shaping outcomes through procedural rulings. The record keeper's job is fidelity, not authority.",
                        },
                    ],
                },
                // ── Article II — Regular Assembly ─────────────────────────────────────
                {
                    number:   "II",
                    title:    "Regular Assembly",
                    preamble: "The regular assembly is the community's primary recurring meeting. These rules govern its notice, agenda, quorum, and facilitation.",
                    sections: [
                        {
                            id:        "II.1",
                            title:     "Schedule",
                            body:      "The Assembly meets regularly on a schedule set by standing rule. The default schedule is once per month. The schedule may be changed by simple majority of the Assembly, effective from the following month.",
                            rationale: "Monthly assemblies are frequent enough to be a real governing body and infrequent enough not to exhaust members. The schedule is a standing rule rather than a bylaw provision so it can be adjusted without a supermajority.",
                        },
                        {
                            id:        "II.2",
                            title:     "Facilitation",
                            body:      "Each regular Assembly is facilitated by a Facilitator selected at the start of the meeting by simple majority. Any active member may serve. The Facilitator manages time, recognizes speakers, calls for votes, and keeps the meeting on track. The Facilitator may not simultaneously vote; if they wish to vote on an item, they step down and a new Facilitator is selected. Procedural rulings by the Facilitator may be appealed by any member; the Assembly decides the appeal by simple majority without debate.",
                            rationale: "Rotating facilitation keeps the role from becoming a power position. The right to appeal procedural rulings prevents the Facilitator from using procedure to shape outcomes.",
                        },
                        {
                            id:        "II.3",
                            title:     "Notice",
                            body:      "Notice of a regular Assembly must be delivered to all seated assembly members at least {regularAssemblyNoticeDays} days before the meeting, and published to the full membership at the same time. Notice must include the date, time, and location; the final agenda; and any background documents required to vote on agenda items. Seated members without reliable digital access must receive physical notice.",
                            rationale: "Notice serves deliberation: members need time to read background materials and form views before the meeting. {regularAssemblyNoticeDays} days is the minimum needed for a monthly meeting cycle.",
                            directives: [
                                { verb: "parameter.define", args: ["regularAssemblyNoticeDays", "7", "false", "3", "30", "Days of advance notice required for a regular assembly meeting"] },
                            ],
                        },
                        {
                            id:        "II.4",
                            title:     "Agenda",
                            body:      "The agenda is open: any active member may place an item on the agenda by submitting it to the Secretary at least {agendaSubmissionDeadlineDays} days before the meeting. The Secretary may not refuse a submission. The default order of business is: (1) call to order and quorum; (2) adoption of agenda; (3) approval of previous minutes; (4) reports from Council, stewards, and pools; (5) new business; (6) open forum; (7) announcements; (8) adjournment. The Assembly may reorder or add items at the start of the meeting by simple majority.",
                            rationale: "An open agenda is a structural expression of member equality: no officer or faction may prevent a member from raising a matter before the community. The default order places open forum after new business so that informal concerns do not crowd out formal decisions.",
                            directives: [
                                { verb: "parameter.define", args: ["agendaSubmissionDeadlineDays", "5", "false", "1", "14", "Days before a meeting by which agenda item submissions are due"] },
                            ],
                        },
                        {
                            id:        "II.5",
                            title:     "Quorum",
                            body:      "Quorum for a regular Assembly is {assemblyQuorumPercent}% of seated assembly members for the current term, with a minimum of {assemblyQuorumMin}. A meeting may not take binding votes without quorum. If quorum is not achieved within 20 minutes of the scheduled start, the meeting proceeds informally for discussion only. No binding votes may be taken.",
                            rationale: "A quorum of {assemblyQuorumPercent}% of seated assembly members is low enough that the assembly can function even when not all seats are present, but high enough that a small fraction cannot make binding decisions. The absolute minimum of {assemblyQuorumMin} provides a floor regardless of assembly size.",
                            directives: [
                                { verb: "parameter.define", args: ["assemblyQuorumPercent", "20", "false", "10", "50", "Percentage of seated assembly members required to achieve quorum at a regular assembly"] },
                                { verb: "parameter.define", args: ["assemblyQuorumMin",     "5",  "false", "3",  "20", "Absolute minimum number of seated assembly members required for quorum, regardless of percentage"] },
                            ],
                        },
                        {
                            id:        "II.6",
                            title:     "Remote Participation",
                            body:      "Assembly members who cannot attend in person may participate remotely by the method specified in standing rule. Remote assembly members count toward quorum, may speak during deliberation, and may vote. Remote members may not serve as Facilitator. Full members of the community who are not seated in the current assembly may attend as observers by the same remote method. The Assembly may close remote participation for a specific meeting when the method is unavailable or materially disruptive.",
                            rationale: "Excluding remote assembly members from quorum and voting would systematically disadvantage members with mobility constraints, caregiving obligations, or work conflicts. Extending the remote attendance option to the full membership preserves openness without granting non-seat voting rights.",
                        },
                    ],
                },
                // ── Article IV — Deliberation ─────────────────────────────────────────
                {
                    number:   "IV",
                    title:    "Deliberation",
                    sections: [
                        {
                            id:        "IV.1",
                            title:     "Purpose of Deliberation",
                            body:      "Deliberation is not a formality before a predetermined vote. It is the process by which members share information, raise objections, and sometimes change their minds. Facilitators should be attentive to whether real deliberation is happening, and willing to extend discussion time when it is not.",
                            rationale: "Communities that treat deliberation as a required delay before the real business get less deliberation over time, until they have none at all. This section names the purpose explicitly so it cannot be quietly abandoned.",
                        },
                        {
                            id:        "IV.2",
                            title:     "Speaker Recognition and Order",
                            body:      "The Facilitator recognizes speakers in order. Priority is given first to members who have not yet spoken on the item, then to those who have spoken once, then to those who have spoken more than once. The Facilitator may depart from this order when a speaker has directly relevant information that is time-sensitive.",
                            rationale: "This ordering prevents a small number of confident speakers from dominating every discussion. The community's full range of views only emerges if the full range of members speaks.",
                        },
                        {
                            id:        "IV.3",
                            title:     "Speaking Time",
                            body:      "The default speaking time is {defaultSpeakingMinutes} minutes per turn. The Assembly may set a different limit for a specific item by simple majority before deliberation begins. A member may yield their remaining time to another member.",
                            rationale: "A default of {defaultSpeakingMinutes} minutes is long enough for a substantive argument and short enough that a single speaker cannot exhaust the meeting. The Assembly can extend it when an item warrants more depth.",
                            directives: [
                                { verb: "parameter.define", args: ["defaultSpeakingMinutes", "3", "false", "1", "10", "Default per-turn speaking time in minutes during assembly deliberation"] },
                            ],
                        },
                        {
                            id:        "IV.4",
                            title:     "Amendments During Deliberation",
                            body:      "Any member may propose an amendment to a motion during deliberation. An amendment must be specific, within the scope of the original motion, and germane. The Facilitator rules on whether a proposed amendment is in order. If in order, the Assembly votes on the amendment first (simple majority), then on the amended motion.",
                            rationale: "The ability to amend during deliberation lets the assembly improve proposals rather than only accept or reject them. Requiring the Facilitator to rule on germaneness prevents a motion from being transformed into something different through serial amendments.",
                        },
                        {
                            id:        "IV.5",
                            title:     "Closing Deliberation",
                            body:      "Deliberation closes when the Facilitator determines all members who wish to speak have spoken, or when the Assembly votes to close (simple majority). A vote to close deliberation requires that at least one member has spoken in opposition, if any exists. A member who has not yet spoken may object to closing deliberation; one objection is sufficient to keep deliberation open for one additional round.",
                            rationale: "The objection right prevents a majority from closing debate before the minority has spoken. It is a single-use delay, not a veto: the majority can close debate after the additional round regardless.",
                        },
                    ],
                },
                // ── Article V — Voting ────────────────────────────────────────────────
                {
                    number:   "V",
                    title:    "Voting",
                    sections: [
                        {
                            id:        "V.1",
                            title:     "One Member, One Vote",
                            body:      "Every seated assembly member present has one vote. Non-seated community members attending as observers may not vote. No seated member may hold more than one vote by any means — proxy, delegation, or otherwise.",
                            rationale: "Voting rights are tied to the drawn seat, not to general membership. An observer who is not seated for the current term cannot vote, even if they are a full member of the community. Proxy voting is prohibited: if a seated member cannot attend, their vote is not cast.",
                        },
                        {
                            id:        "V.2",
                            title:     "Default: Simple Majority",
                            body:      "Unless another governing document specifies a higher threshold, a motion passes by simple majority: more yes votes than no votes among members present and voting. Abstentions are recorded but do not count as yes or no.",
                            rationale: "Simple majority is the default because it is the most direct expression of the will of those present. Higher thresholds are reserved for decisions whose consequences are hardest to reverse.",
                        },
                        {
                            id:        "V.3",
                            title:     "Supermajority Requirements",
                            body:      "The following actions require two-thirds of assembly members present and voting: amending this bylaw or any bylaw with a two-thirds threshold; expelling a member; overturning an Arbitration Panel decision on process grounds; authorizing external debt; joining or leaving the federation; dissolving the community.",
                            rationale: "These actions are structurally consequential or very hard to reverse. The higher threshold ensures they reflect a broad consensus and not a slim majority of one particular meeting's attendance.",
                        },
                        {
                            id:        "V.4",
                            title:     "Methods of Voting",
                            body:      "Show of hands is the default. Written ballot is used for elections of persons to roles or pools, or when the Facilitator or Assembly determines a secret ballot would produce more honest results. Ranked-choice (instant-runoff) is used for single-seat elections with more than two candidates. Approval voting is used for multi-seat elections: members vote for as many candidates as there are seats; the top N vote-getters win.",
                            rationale: "The choice of voting method matters for outcomes. Plurality voting in multi-candidate single-seat elections systematically disadvantages non-frontrunners. Ranked-choice and approval voting better reflect actual preferences.",
                        },
                        {
                            id:        "V.5",
                            title:     "Reconsideration",
                            body:      "A motion voted on may be reconsidered at the same meeting only by a member who voted on the prevailing side and only if new information has emerged. Reconsideration requires a two-thirds vote to proceed. A motion that failed may be brought again at any subsequent meeting without restriction.",
                            rationale: "The prevailing-side requirement prevents the losing side from immediately forcing a re-vote. The new information requirement prevents reconsideration from becoming a tool for grinding down opposition.",
                        },
                    ],
                },
                // ── Article VI — Motions ──────────────────────────────────────────────
                {
                    number:   "VI",
                    title:    "Motions",
                    sections: [
                        {
                            id:        "VI.1",
                            title:     "Bringing a Motion",
                            body:      "Any active member of the community may submit a motion for inclusion on the agenda by sending it to the Secretary in advance (preferred). Any seated assembly member may bring a motion from the floor during new business with the Assembly's consent (simple majority). A motion placed on the agenda must include a written statement of what is proposed and, for significant matters, a brief rationale.",
                            rationale: "Opening agenda submissions to the full membership, not only seated assembly members, ensures the assembly remains connected to the community it represents. Floor motions are restricted to seated members since they are the deliberating body, but anyone in the community can trigger consideration of an issue.",
                        },
                        {
                            id:        "VI.2",
                            title:     "Motion Thresholds",
                            body:      "Standard motions pass by simple majority. Bylaw amendments require two-thirds plus 14 days advance notice. Constitutional amendments require two-thirds plus 30 days advance notice. Expulsion requires two-thirds. Overturning an Arbitration Panel decision requires two-thirds. Emergency spending authorization, ordinances, and standing rules require simple majority. Recall votes require simple majority after a valid recall petition.",
                            rationale: "The threshold list establishes a clear, non-negotiable record of what each action costs. Members and facilitators should not need to look elsewhere to determine whether a motion passed.",
                        },
                        {
                            id:        "VI.3",
                            title:     "Tabling",
                            body:      "The Assembly may table a motion (defer to the next meeting) by simple majority. A tabled motion is placed at the top of new business at the next regular Assembly. It may be tabled again only once.",
                            rationale: "Tabling is not a veto: it is a delay. Limiting re-tabling to once prevents a persistent minority from repeatedly deferring a motion the majority would pass if called.",
                        },
                    ],
                },
                // ── Article VII — Minutes and Records ─────────────────────────────────
                {
                    number:   "VII",
                    title:    "Minutes and Records",
                    sections: [
                        {
                            id:        "VII.1",
                            title:     "What the Minutes Record",
                            body:      "Minutes are not a transcript. They record: date, time, location, and facilitator; attendance and whether quorum was achieved; each motion (exact text, mover, vote count, result); any amendment and its vote; a summary of significant deliberation sufficient to convey the arguments made; reports received (title only; full text filed separately); and outcomes from open forum.",
                            rationale: "A complete transcript is too burdensome to keep and too long to read. A summary sufficient to reconstruct the reasoning behind decisions is the correct standard — future members and arbitrators need to understand why the community decided what it did, not every word that was spoken.",
                        },
                        {
                            id:        "VII.2",
                            title:     "Distribution and Approval",
                            body:      "Draft minutes are distributed to all seated assembly members within {minutesDistributionDays} days of the meeting and published to the full membership at the same time. Assembly members have {minutesDistributionDays} days to submit corrections. The corrected draft is presented at the next regular Assembly for approval by simple majority. Approved minutes are the official record.",
                            rationale: "The correction period ensures that errors are caught before the record becomes official. Publishing to the full membership simultaneously preserves transparency — the whole community should know what its assembly decided and why.",
                            directives: [
                                { verb: "parameter.define", args: ["minutesDistributionDays", "7", "false", "3", "14", "Days after a meeting by which draft minutes must be distributed to all seated assembly members and published to the full membership"] },
                            ],
                        },
                        {
                            id:        "VII.3",
                            title:     "Public Access",
                            body:      "Approved minutes are available to all active members at all times. New members may access all historical minutes upon joining. No minutes are confidential unless the Assembly votes to seal a specific portion (two-thirds required; must state the reason and a date at which the seal expires automatically).",
                            rationale: "An honest ledger applies to governance as well as finance. Members cannot evaluate their community's decisions if they cannot read them. The sealing mechanism exists for genuine confidentiality needs — not to hide unflattering deliberation.",
                        },
                    ],
                },
                // ── Article VIII — Council and Assembly Relationship ───────────────────
                {
                    number:   "VIII",
                    title:    "Council and Assembly Relationship",
                    sections: [
                        {
                            id:        "VIII.1",
                            title:     "Council Accountability",
                            body:      "The Stewardship Council reports to the Assembly at every regular meeting. The Council may be overridden on any decision by simple majority Assembly vote. The Council may not make any decision reserved to the Assembly by this bylaw, another bylaw, or the constitution. It must bring to the Assembly any matter outside its authority, even if urgent.",
                            rationale: "Accountability means more than reporting — it means the Assembly can actually reverse council decisions. The override right must be real, not nominal.",
                        },
                        {
                            id:        "VIII.2",
                            title:     "Matters Reserved to the Assembly",
                            body:      "The following may only be decided by the Assembly and may not be delegated to the Council: any bylaw or constitutional amendment; admission or expulsion of members; the annual budget; spending above the council threshold (per Finance Bylaw); joining or leaving the federation; creating or dissolving a leadership pool; adopting or dissolving a domain charter; any matter that a member specifically requests be brought to the Assembly.",
                            rationale: "The reserved matters list closes the delegation gap — it prevents the Council from accumulating authority through ambiguity. The last item (member request) is especially important: the Council cannot refuse to bring a matter to the Assembly just because it finds the matter inconvenient.",
                        },
                    ],
                },
                // ── Article IX — Amendment ────────────────────────────────────────────
                {
                    number:   "IX",
                    title:    "Amendment",
                    sections: [
                        {
                            id:        "IX.1",
                            title:     "Amendment Procedure",
                            body:      "This bylaw may be amended by two-thirds of seated assembly members present and voting at any regular or special Assembly, provided that: (1) the proposed amendment was included in the meeting notice with at least 14 days advance notice; and (2) the written text of the proposed amendment was distributed to all seated assembly members and published to the full membership with the notice. No amendment may reduce the voting threshold for any category of motion below the threshold set in this bylaw, unless the amendment itself passes by the higher threshold it would create.",
                            rationale: "The entrenchment clause prevents the assembly from lowering its own voting standards by a simple majority vote in a well-attended meeting. To lower a supermajority threshold, you must first achieve that supermajority.",
                        },
                    ],
                },
            ],
            parameters: {
                assemblyQuorumPercent: {
                    value:       20,
                    immutable:   false,
                    description: "Percentage of seated assembly members required to achieve quorum at a regular assembly.",
                    constraints: { min: 10, max: 50 },
                },
                assemblyQuorumMin: {
                    value:       5,
                    immutable:   false,
                    description: "Absolute minimum number of seated assembly members required for quorum, regardless of percentage.",
                    constraints: { min: 3, max: 20 },
                },
                regularAssemblyNoticeDays: {
                    value:       7,
                    immutable:   false,
                    description: "Days of advance notice required for a regular assembly meeting.",
                    constraints: { min: 3, max: 30 },
                },
                agendaSubmissionDeadlineDays: {
                    value:       5,
                    immutable:   false,
                    description: "Days before a meeting by which agenda item submissions are due.",
                    constraints: { min: 1, max: 14 },
                },
                specialAssemblyNoticeDays: {
                    value:       5,
                    immutable:   false,
                    description: "Days of advance notice required for a special assembly.",
                    constraints: { min: 2, max: 14 },
                },
                emergencyAssemblyNoticeHours: {
                    value:       24,
                    immutable:   false,
                    description: "Hours of advance notice required for an emergency assembly.",
                    constraints: { min: 12, max: 72 },
                },
                defaultSpeakingMinutes: {
                    value:       3,
                    immutable:   false,
                    description: "Default per-turn speaking time in minutes during assembly deliberation.",
                    constraints: { min: 1, max: 10 },
                },
                specialAssemblyPetitionPercent: {
                    value:       15,
                    immutable:   false,
                    description: "Percentage of active members (minimum 10) required to petition for a special assembly.",
                    constraints: { min: 5, max: 30 },
                },
                recallPetitionPercent: {
                    value:       20,
                    immutable:   false,
                    description: "Percentage of active members required to initiate a recall petition.",
                    constraints: { min: 5, max: 35 },
                },
                minutesDistributionDays: {
                    value:       7,
                    immutable:   false,
                    description: "Days after a meeting by which draft minutes must be distributed to all seated assembly members and published to the full membership.",
                    constraints: { min: 3, max: 14 },
                },
            },
        };
    },
};
