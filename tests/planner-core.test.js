import { describe, expect, it } from 'vitest';

// planner-core.js is a classic script that registers globalThis.PlannerCore.
import '../planner-core.js';

const {
  addDays,
  createEmptyPlan,
  formatCostInput,
  formatCurrency,
  formatDisplayDate,
  formatTripDay,
  getDayCount,
  getDayTotal,
  getDaysLostByRange,
  getNavigationIndex,
  getTripTotal,
  parseCost,
  parseIsoDate,
  parseSavedPlan,
  resizeDays,
  sanitizeEntry,
  sortEntries,
  toIsoDate
} = globalThis.PlannerCore;

const entry = (time, place, cost = 0) => ({ time, place, address: '', cost, note: '' });

describe('parseIsoDate / toIsoDate / addDays', () => {
  it('UT-01 parses a valid yyyy-mm-dd as a local date', () => {
    const date = parseIsoDate('2026-10-26');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(26);
  });

  it.each(['', '2026-1-1', '26/10/2026', '2026-13-40', null, undefined, 20261026])(
    'UT-02 rejects invalid input %s',
    (value) => expect(parseIsoDate(value)).toBeNull()
  );

  it('UT-03 round-trips and adds days across month/year boundaries', () => {
    expect(toIsoDate(parseIsoDate('2026-02-05'))).toBe('2026-02-05');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('bad', 1)).toBe('');
  });
});

describe('getDayCount', () => {
  it('UT-04 counts inclusive days', () => {
    expect(getDayCount('2026-10-26', '2026-10-26')).toBe(1);
    expect(getDayCount('2026-10-26', '2026-10-28')).toBe(3);
  });

  it('UT-05 returns 0 for incomplete or reversed ranges', () => {
    expect(getDayCount('', '2026-10-28')).toBe(0);
    expect(getDayCount('2026-10-26', '')).toBe(0);
    expect(getDayCount('2026-10-28', '2026-10-26')).toBe(0);
  });

  it('UT-06 is stable across DST-like boundaries (rounding)', () => {
    expect(getDayCount('2026-03-01', '2026-03-31')).toBe(31);
    expect(getDayCount('2026-10-20', '2026-11-05')).toBe(17);
  });
});

describe('date formatting', () => {
  it('UT-07 formats trip day N relative to the start date', () => {
    // ICU's vi-VN day+month pattern uses "-" in current engines; accept either separator.
    expect(formatTripDay('2026-10-30', 3)).toMatch(/^01[-/]11$/);
    expect(formatTripDay('', 1)).toBe('');
  });

  it('UT-08 formats display dates as dd/mm/yyyy', () => {
    expect(formatDisplayDate('2026-10-26')).toBe('26/10/2026');
    expect(formatDisplayDate('')).toBe('');
  });
});

describe('cost helpers', () => {
  it('UT-09 parses digits only and ignores invalid values', () => {
    expect(parseCost('1.000.000')).toBe(1000000);
    expect(parseCost('150k đ')).toBe(150);
    expect(parseCost('')).toBe(0);
    expect(parseCost(null)).toBe(0);
    expect(parseCost(-5)).toBe(5);
    expect(parseCost('abc')).toBe(0);
  });

  it('UT-10 formats the cost input with vi-VN grouping', () => {
    expect(formatCostInput('1000000')).toBe('1.000.000');
    expect(formatCostInput('12a3')).toBe('123');
    expect(formatCostInput('')).toBe('');
  });

  it('UT-11 formats VND currency without decimals', () => {
    const text = formatCurrency(1500000);
    expect(text).toMatch(/1\.500\.000/);
    expect(text).toContain('₫');
  });
});

describe('entries and totals', () => {
  it('UT-12 sorts by time without mutating the input', () => {
    const input = [entry('14:00', 'B'), entry('07:30', 'A')];
    const sorted = sortEntries(input);
    expect(sorted.map((item) => item.place)).toEqual(['A', 'B']);
    expect(input[0].place).toBe('B');
    expect(sorted[0]).toBe(input[1]);
  });

  it('UT-13 sums day and trip totals', () => {
    const days = { 1: [entry('07:00', 'A', 100), entry('08:00', 'B', '2.000')], 2: [], 3: [entry('09:00', 'C', 50)] };
    expect(getDayTotal(days[1])).toBe(2100);
    expect(getDayTotal()).toBe(0);
    expect(getTripTotal(days)).toBe(2150);
    expect(getTripTotal()).toBe(0);
  });
});

describe('sanitizeEntry', () => {
  it('UT-14 keeps and trims a valid entry', () => {
    expect(sanitizeEntry({ time: '07:30', place: ' Ga ', address: ' QT ', cost: '1.000', note: ' x ' }))
      .toEqual({ time: '07:30', place: 'Ga', address: 'QT', cost: 1000, note: 'x' });
  });

  it.each([null, 'x', {}, { time: '7:30', place: 'Ga' }, { time: '07:30', place: '  ' }, { time: 730, place: 'Ga' }])(
    'UT-15 drops an unusable entry %j',
    (value) => expect(sanitizeEntry(value)).toBeNull()
  );
});

describe('parseSavedPlan', () => {
  it('UT-16 returns an empty plan for broken JSON or shape', () => {
    expect(parseSavedPlan('{oops')).toEqual(createEmptyPlan());
    expect(parseSavedPlan('null')).toEqual(createEmptyPlan());
    expect(parseSavedPlan('{"days":"x"}')).toEqual(createEmptyPlan());
  });

  it('UT-17 drops malformed days and entries instead of throwing', () => {
    const raw = JSON.stringify({
      startDate: '2026-10-26',
      endDate: '2026-10-27',
      days: { 1: [{ time: '07:00', place: 'Ga' }, { place: 'no time' }], 2: 'bad', abc: [] }
    });
    expect(parseSavedPlan(raw)).toEqual({
      startDate: '2026-10-26',
      endDate: '2026-10-27',
      days: { 1: [{ time: '07:00', place: 'Ga', address: '', cost: 0, note: '' }] }
    });
  });

  it('UT-18 derives the end date for legacy plans without one', () => {
    const raw = JSON.stringify({ startDate: '2026-10-30', days: { 1: [], 2: [], 3: [] } });
    expect(parseSavedPlan(raw).endDate).toBe('2026-11-01');
  });

  it('UT-19 clears invalid stored dates', () => {
    const plan = parseSavedPlan(JSON.stringify({ startDate: 'x', endDate: '2026-99-99', days: {} }));
    expect(plan.startDate).toBe('');
    expect(plan.endDate).toBe('');
  });
});

describe('range resizing (data-loss protection)', () => {
  const days = { 1: [entry('07:00', 'A')], 2: [], 3: [entry('08:00', 'C')], 4: [entry('09:00', 'D')] };

  it('UT-20 lists only removed days that still hold entries, sorted', () => {
    expect(getDaysLostByRange(days, 2)).toEqual(['3', '4']);
    expect(getDaysLostByRange(days, 3)).toEqual(['4']);
    expect(getDaysLostByRange(days, 4)).toEqual([]);
    expect(getDaysLostByRange({ 1: [], 5: [] }, 1)).toEqual([]);
  });

  it('UT-21 resizes to exactly 1..N, keeping entries and adding empty days', () => {
    expect(resizeDays(days, 2)).toEqual({ 1: days[1], 2: [] });
    expect(Object.keys(resizeDays(days, 6))).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(resizeDays(days, 6)[3]).toBe(days[3]);
    expect(resizeDays(days, 0)).toEqual({});
  });

  it('UT-22 does not mutate the source days', () => {
    const snapshot = JSON.stringify(days);
    resizeDays(days, 1);
    expect(JSON.stringify(days)).toBe(snapshot);
  });
});

describe('getNavigationIndex', () => {
  it('UT-23 wraps arrows and jumps with Home/End', () => {
    expect(getNavigationIndex('ArrowRight', 2, 3)).toBe(0);
    expect(getNavigationIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(getNavigationIndex('ArrowRight', 0, 3)).toBe(1);
    expect(getNavigationIndex('Home', 2, 3)).toBe(0);
    expect(getNavigationIndex('End', 0, 3)).toBe(2);
  });

  it('UT-24 ignores other keys and empty groups', () => {
    expect(getNavigationIndex('Enter', 0, 3)).toBeNull();
    expect(getNavigationIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
