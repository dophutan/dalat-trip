// Pure planner helpers: no DOM, no storage. Shared by main.js and unit tests.
// Classic script (not an ES module) so index.html also works when opened via file://.
// Exposes the helpers as `globalThis.PlannerCore`.
(function registerPlannerCore(global) {
'use strict';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const DAY_MS = 86400000;

const NAVIGATION_KEYS = {
  Home: (_current, _length) => 0,
  End: (_current, length) => length - 1,
  ArrowLeft: (current, length) => (current - 1 + length) % length,
  ArrowRight: (current, length) => (current + 1) % length
};

/** Parses a `yyyy-mm-dd` string as a local date; returns null when invalid. */
function parseIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(isoDate, amount) {
  const date = parseIsoDate(isoDate);
  if (!date) return '';
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

/** Number of days in an inclusive range; 0 when incomplete or reversed. */
function getDayCount(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return 0;
  const difference = Math.round((end - start) / DAY_MS);
  return difference >= 0 ? difference + 1 : 0;
}

/** Formats day N of a trip (1-based) with Intl vi-VN options. */
function formatTripDay(startDate, dayNumber, options = { day: '2-digit', month: '2-digit' }) {
  const date = parseIsoDate(startDate);
  if (!date) return '';
  date.setDate(date.getDate() + dayNumber - 1);
  return new Intl.DateTimeFormat('vi-VN', options).format(date);
}

function formatDisplayDate(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function parseCost(value) {
  const cost = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

function formatCostInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => a.time.localeCompare(b.time));
}

function getDayTotal(entries = []) {
  return entries.reduce((total, entry) => total + parseCost(entry.cost), 0);
}

function getTripTotal(days = {}) {
  return Object.values(days).reduce((total, entries) => total + getDayTotal(entries), 0);
}

/** Returns a clean entry, or null when the stored value is unusable. */
function sanitizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const place = typeof value.place === 'string' ? value.place.trim() : '';
  if (typeof value.time !== 'string' || !TIME_PATTERN.test(value.time) || !place) return null;
  return {
    time: value.time,
    place,
    address: typeof value.address === 'string' ? value.address.trim() : '',
    cost: parseCost(value.cost),
    note: typeof value.note === 'string' ? value.note.trim() : ''
  };
}

function createEmptyPlan() {
  return { startDate: '', endDate: '', days: {} };
}

/** Parses the stored JSON plan, dropping malformed parts instead of throwing. */
function parseSavedPlan(raw) {
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return createEmptyPlan();
  }
  if (!saved || typeof saved !== 'object' || !saved.days || typeof saved.days !== 'object') {
    return createEmptyPlan();
  }

  const days = {};
  Object.entries(saved.days).forEach(([day, entries]) => {
    if (!/^[1-9]\d*$/.test(day) || !Array.isArray(entries)) return;
    days[day] = entries.map(sanitizeEntry).filter(Boolean);
  });

  const startDate = parseIsoDate(saved.startDate) ? saved.startDate : '';
  let endDate = parseIsoDate(saved.endDate) ? saved.endDate : '';
  // Legacy plans stored only the start date: derive the end from the number of days.
  if (startDate && !endDate) {
    endDate = addDays(startDate, Math.max(Object.keys(days).length - 1, 0));
  }
  return { startDate, endDate, days };
}

/** Day keys beyond `dayCount` that still hold entries (would be lost on shrink). */
function getDaysLostByRange(days, dayCount) {
  return Object.keys(days)
    .filter((day) => Number(day) > dayCount && days[day].length > 0)
    .sort((a, b) => Number(a) - Number(b));
}

/** Returns a days object with exactly keys 1..dayCount, keeping existing entries. */
function resizeDays(days, dayCount) {
  const resized = {};
  for (let day = 1; day <= dayCount; day += 1) {
    const key = String(day);
    resized[key] = Array.isArray(days[key]) ? days[key] : [];
  }
  return resized;
}

/** Roving-focus target for arrow/Home/End keys; null for other keys. */
function getNavigationIndex(key, currentIndex, length) {
  const resolve = NAVIGATION_KEYS[key];
  if (!resolve || length <= 0) return null;
  return resolve(currentIndex, length);
}

global.PlannerCore = Object.freeze({
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
});
})(globalThis);
