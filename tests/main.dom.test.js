// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'dalat-personal-itinerary';
// jsdom rewrites import.meta.url, so resolve from the project root (vitest cwd).
const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

const stop = (time, place, cost = 0) => ({ time, place, address: '', cost, note: '' });
const threeDayPlan = () => ({
  startDate: '2026-10-26',
  endDate: '2026-10-28',
  days: { 1: [stop('07:00', 'Ga Đà Lạt', 50000)], 2: [], 3: [stop('05:30', 'Cầu Đất')] }
});

const $ = (selector) => document.querySelector(selector);
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

async function boot(plan) {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/, '').replace(/<\/html>\s*$/, '');
  if (plan !== undefined) localStorage.setItem(STORAGE_KEY, typeof plan === 'string' ? plan : JSON.stringify(plan));
  vi.resetModules();
  await import('../planner-core.js');
  await import('../main.js');
}

function setRange(start, end) {
  $('#trip-start-date').value = start;
  $('#trip-end-date').value = end;
  $('#trip-end-date').dispatchEvent(new Event('change'));
}

function openPlanner() {
  $('[data-open-planner]').click();
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const confirmShown = () => !$('#planner-confirm').classList.contains('hidden');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('planner range changes never silently lose data', () => {
  it('DOM-01 clearing the end date keeps stored days', async () => {
    await boot(threeDayPlan());
    openPlanner();
    setRange('2026-10-26', '');
    expect(stored()).toEqual(threeDayPlan());
    expect($('#planner-form button[type="submit"]').disabled).toBe(true);
    expect($('#personal-itinerary').classList.contains('hidden')).toBe(false);
  });

  it('DOM-02 a reversed range keeps stored days and explains why', async () => {
    await boot(threeDayPlan());
    openPlanner();
    setRange('2026-10-30', '2026-10-26');
    expect(stored()).toEqual(threeDayPlan());
    expect($('#planner-duration').textContent).toContain('Ngày trở về cần từ ngày khởi hành trở đi');
  });

  it('DOM-03 shrinking over days with stops asks in-dialog; cancelling restores the range', async () => {
    await boot(threeDayPlan());
    openPlanner();
    setRange('2026-10-26', '2026-10-27');
    expect(confirmShown()).toBe(true);
    expect($('#planner-confirm-message').textContent).toContain('ngày 3');
    $('#planner-confirm-cancel').click();
    await flush();
    expect(confirmShown()).toBe(false);
    expect($('#trip-end-date').value).toBe('2026-10-28');
    expect(stored()).toEqual(threeDayPlan());
  });

  it('DOM-04 confirming the shrink drops only the removed days', async () => {
    await boot(threeDayPlan());
    openPlanner();
    setRange('2026-10-26', '2026-10-27');
    $('#planner-confirm-ok').click();
    await flush();
    expect(stored()).toEqual({ startDate: '2026-10-26', endDate: '2026-10-27', days: { 1: threeDayPlan().days[1], 2: [] } });
  });

  it('DOM-05 shrinking over empty days or extending does not ask', async () => {
    await boot(threeDayPlan());
    openPlanner();
    setRange('2026-10-26', '2026-10-30');
    expect(Object.keys(stored().days)).toEqual(['1', '2', '3', '4', '5']);
    setRange('2026-10-26', '2026-10-28');
    expect(confirmShown()).toBe(false);
    expect(stored().days[3]).toEqual(threeDayPlan().days[3]);
  });
});

describe('planner entries', () => {
  it('DOM-06 adds a stop, sorts by time, updates totals, then removes it', async () => {
    await boot(threeDayPlan());
    openPlanner();
    $('#planner-time').value = '06:00';
    $('#planner-place').value = '  Chợ Đà Lạt ';
    $('#planner-cost').value = '20.000';
    $('#planner-form').dispatchEvent(new Event('submit', { cancelable: true }));

    expect(stored().days[1].map((item) => item.place)).toEqual(['Ga Đà Lạt', 'Chợ Đà Lạt']);
    const rendered = [...document.querySelectorAll('#planner-list .planner-entry > div > p:first-child')].map((node) => node.textContent);
    expect(rendered).toEqual(['Chợ Đà Lạt', 'Ga Đà Lạt']);
    expect($('#planner-day-total').textContent).toMatch(/70\.000/);

    $('#planner-list [aria-label="Xóa Chợ Đà Lạt"]').click();
    expect(stored().days[1].map((item) => item.place)).toEqual(['Ga Đà Lạt']);
  });

  it('DOM-07 ignores a whitespace-only place', async () => {
    await boot(threeDayPlan());
    openPlanner();
    $('#planner-time').value = '06:00';
    $('#planner-place').value = '   ';
    $('#planner-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(stored().days[1]).toHaveLength(1);
    expect(document.querySelectorAll('#planner-list .planner-entry')).toHaveLength(1);
  });

  it('DOM-08 planner day tabs expose tab semantics and keyboard navigation', async () => {
    await boot(threeDayPlan());
    openPlanner();
    const tabs = [...document.querySelectorAll('#planner-day-tabs [role="tab"]')];
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-controls')).toBe('planner-list');
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect($('#planner-day-tabs [aria-selected="true"]').dataset.plannerDay).toBe('3');
    expect($('#planner-list').textContent).toContain('Cầu Đất');
  });
});

describe('storage robustness', () => {
  it('DOM-09 corrupted storage does not crash and shows the suggested itinerary', async () => {
    await boot('{"startDate":"2026-10-26","endDate":"2026-10-27","days":{"1":[{"place":"no time"}]}}');
    expect($('#suggested-itinerary').classList.contains('hidden')).toBe(true);
    expect($('#personal-itinerary').textContent).toContain('Chưa có điểm dừng');
    await boot('not json');
    expect($('#suggested-itinerary').classList.contains('hidden')).toBe(false);
  });

  it('DOM-10 a failing localStorage write is reported to the user', async () => {
    await boot(threeDayPlan());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    openPlanner();
    $('#planner-save').click();
    expect($('#planner-status').textContent).toContain('Không lưu được');
  });

  it('DOM-11 itinerary description uses dd/mm/yyyy dates', async () => {
    await boot(threeDayPlan());
    expect($('#itinerary-description').textContent).toContain('26/10/2026 → 28/10/2026');
    expect($('#itinerary-kicker').textContent).toBe('01 — Lịch trình của bạn');
  });

  it('DOM-12 clearing the plan restores the suggested copy', async () => {
    await boot(threeDayPlan());
    openPlanner();
    $('#planner-clear').click();
    expect(confirmShown()).toBe(true);
    $('#planner-confirm-ok').click();
    await flush();
    expect(stored()).toEqual({ startDate: '', endDate: '', days: {} });
    expect($('#itinerary-kicker').textContent).toBe('01 — Lịch trình gợi ý');
    expect($('#suggested-itinerary').classList.contains('hidden')).toBe(false);
  });
});

describe('page interactions', () => {
  it('DOM-13 mobile menu toggles label and closes with Escape', async () => {
    await boot();
    const button = $('#menu-button');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Đóng menu');
    expect($('#mobile-menu').classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect($('#mobile-menu').classList.contains('hidden')).toBe(true);
  });

  it('DOM-14 suggested day tabs switch panels with the keyboard', async () => {
    await boot();
    $('#day-1-tab').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect($('#day-2-tab').getAttribute('aria-selected')).toBe('true');
    expect($('#day-2-panel').classList.contains('hidden')).toBe(false);
    expect($('#day-1-panel').classList.contains('hidden')).toBe(true);
  });

  it('DOM-15 place filters show only the chosen category', async () => {
    await boot();
    $('[data-filter="an-uong"]').click();
    const visible = [...document.querySelectorAll('.place-item:not(.hidden)')];
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((item) => item.dataset.category === 'an-uong')).toBe(true);
    expect($('#place-empty').classList.contains('hidden')).toBe(true);
  });

  it('DOM-16 removed sections are gone and no link targets a missing id', async () => {
    await boot();
    expect($('#hanh-trinh')).toBeNull();
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      expect(document.getElementById(link.getAttribute('href').slice(1))).not.toBeNull();
    });
  });

  it('DOM-17 reveal targets are visible when IntersectionObserver is unavailable', async () => {
    await boot();
    const targets = document.querySelectorAll('[data-reveal], [data-reveal-group] > *');
    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((target) => expect(target.classList.contains('is-visible')).toBe(true));
  });

  it('DOM-18 scripts load as classic deferred scripts (works from file://), core first', async () => {
    await boot();
    const scripts = [...document.querySelectorAll('script[src]')];
    expect(scripts.map((script) => script.getAttribute('src'))).toEqual(['planner-core.js', 'main.js']);
    scripts.forEach((script) => {
      expect(script.type).toBe('');
      expect(script.defer).toBe(true);
    });
  });

  it('DOM-19 header is fixed and gets a solid background after scrolling', async () => {
    await boot();
    const header = $('#site-header');
    expect(header.classList.contains('fixed')).toBe(true);
    expect(header.classList.contains('is-scrolled')).toBe(false);
    window.scrollY = 200;
    window.dispatchEvent(new Event('scroll'));
    expect(header.classList.contains('is-scrolled')).toBe(true);
    window.scrollY = 0;
    window.dispatchEvent(new Event('scroll'));
    expect(header.classList.contains('is-scrolled')).toBe(false);
  });

  it('DOM-20 day tabs get a decorative sliding indicator that is hidden from assistive tech', async () => {
    await boot();
    const tabList = $('#day-1-tab').parentElement;
    const indicator = tabList.querySelector('.day-tab-indicator');
    expect(tabList.classList.contains('has-indicator')).toBe(true);
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(tabList.querySelectorAll('[role="tab"]')).toHaveLength(3);
    $('#day-3-tab').click();
    expect($('#day-3-tab').getAttribute('aria-selected')).toBe('true');
  });

  it('DOM-21 budget values keep their final text when count-up cannot run', async () => {
    await boot();
    const values = [...document.querySelectorAll('[data-count-up]')].map((value) => value.textContent);
    expect(values).toEqual(['1,2–1,8 triệu', '1,1–1,5 triệu', '0,8–1,4 triệu', '3,4–5 triệu']);
  });

  it('DOM-22 planner buttons spawn a decorative ripple that cleans itself up', async () => {
    await boot();
    const button = $('[data-ripple]');
    button.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10 }));
    const ripple = button.querySelector('.ripple');
    expect(ripple.getAttribute('aria-hidden')).toBe('true');
    ripple.dispatchEvent(new Event('animationend'));
    expect(button.querySelector('.ripple')).toBeNull();
    expect(button.textContent.trim()).toBe('Lên lịch trình');
  });

  it('DOM-23 planner closes via the close button, the backdrop and Escape', async () => {
    await boot();
    const dialog = $('#planner-dialog');

    openPlanner();
    $('[data-close-planner]').click();
    expect(dialog.open).toBe(false);

    openPlanner();
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.open).toBe(false);

    openPlanner();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    expect(dialog.classList.contains('is-closing')).toBe(false);
  });
});

describe('planner UX', () => {
  it('DOM-24 removing a stop offers undo that puts it back', async () => {
    await boot(threeDayPlan());
    openPlanner();
    $('#planner-list [aria-label="Xóa Ga Đà Lạt"]').click();
    expect(stored().days[1]).toEqual([]);
    expect($('#planner-toast').classList.contains('hidden')).toBe(false);
    expect($('#planner-toast-message').textContent).toBe('Đã xóa Ga Đà Lạt');
    $('#planner-toast-undo').click();
    expect(stored().days[1]).toEqual(threeDayPlan().days[1]);
    expect($('#planner-toast').classList.contains('hidden')).toBe(true);
  });

  it('DOM-25 cancelling "clear all" keeps the plan; Escape dismisses the confirm, not the dialog', async () => {
    await boot(threeDayPlan());
    openPlanner();
    $('#planner-clear').click();
    $('#planner-confirm-cancel').click();
    await flush();
    expect(stored()).toEqual(threeDayPlan());

    $('#planner-clear').click();
    $('#planner-dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    await flush();
    expect(confirmShown()).toBe(false);
    expect($('#planner-dialog').open).toBe(true);
    expect(stored()).toEqual(threeDayPlan());
  });

  it('DOM-26 changes auto-save, and "Xong" closes the dialog', async () => {
    await boot(threeDayPlan());
    openPlanner();
    expect($('#planner-save').disabled).toBe(false);
    $('#planner-time').value = '06:00';
    $('#planner-place').value = 'Chợ Đà Lạt';
    $('#planner-form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect($('#planner-saved').textContent).toMatch(/Đã tự lưu lúc/);
    $('#planner-save').click();
    expect($('#planner-dialog').open).toBe(false);
  });

  it('DOM-27 an unfinished stop survives a reload and is pointed out on open', async () => {
    await boot(threeDayPlan());
    $('#planner-place').value = 'Đồi chè';
    $('#planner-form').dispatchEvent(new Event('input', { bubbles: true }));
    await boot(threeDayPlan());
    expect($('#planner-place').value).toBe('Đồi chè');
    openPlanner();
    expect($('#planner-status').textContent).toContain('đang nhập dở');
  });
});
