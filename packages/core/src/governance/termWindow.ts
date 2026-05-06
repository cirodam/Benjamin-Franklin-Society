// ── Term window utilities ─────────────────────────────────────────────────────
//
// Pure functions for computing assembly term boundaries from constitutional
// parameters. No dependencies on any loader or service.

export interface TermWindowParams {
    /** Calendar month (1–12) on which a term begins. */
    startMonth: number;
    /** Day of month on which a term begins. */
    startDay:   number;
    /** Term duration in months. */
    termMonths: number;
}

export interface TermWindow {
    start: Date;
    end:   Date;
}

/**
 * Returns the term window containing `today`.
 * Finds the most recent anchor date (startMonth/startDay) on or before today
 * and projects forward by termMonths.
 */
export function currentTermWindow(params: TermWindowParams, today: Date = new Date()): TermWindow {
    const { startMonth, startDay, termMonths } = params;
    let anchor = new Date(today.getFullYear(), startMonth - 1, startDay);
    if (anchor > today) anchor = new Date(today.getFullYear() - 1, startMonth - 1, startDay);
    const end = new Date(anchor);
    end.setMonth(end.getMonth() + termMonths);
    return { start: anchor, end };
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the next term start after `today`.
 */
export function nextTermStartDate(params: TermWindowParams, today: Date = new Date()): string {
    const { startMonth, startDay } = params;
    let anchor = new Date(today.getFullYear(), startMonth - 1, startDay);
    if (anchor <= today) anchor = new Date(today.getFullYear() + 1, startMonth - 1, startDay);
    return anchor.toISOString().slice(0, 10);
}
