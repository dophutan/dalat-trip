// Classic script: planner-core.js must load first (both use `defer`, so order is kept).
const {
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
  parseSavedPlan,
  resizeDays,
  sortEntries
} = globalThis.PlannerCore;

const HTML2CANVAS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const HTML2CANVAS_INTEGRITY = 'sha512-BNaRQnYJYiPSqHHDb58B0yaPfCu+Wgds8Gp/gU33kqBtgNS4tSPHuGibyoeqMV/TJlSKda6FXzoEyYGjTe+vXA==';
const PLANNER_STORAGE_KEY = 'dalat-personal-itinerary';
const PLANNER_DRAFT_KEY = 'dalat-planner-draft';
const UNDO_MS = 5000;
const FEEDBACK_MS = 1800;
const REVEAL_STAGGER_MS = 60;

// Colors used inline by the PNG export (html2canvas cannot read Tailwind classes reliably).
const EXPORT_COLORS = {
  pine: '#16342c',
  clay: '#c76d52',
  sand: '#ded3bd',
  muted: '#657e69',
  rule: '#ece7dc'
};

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function prefersReducedMotion() {
  return Boolean(reducedMotion?.matches);
}

/** Restarts a one-shot CSS animation class on an element. */
function replayAnimation(element, className) {
  if (prefersReducedMotion()) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

/** Plays an exit animation, then runs `done` (immediately when motion is reduced). */
function animateOut(element, className, done) {
  if (prefersReducedMotion() || typeof element.getAnimations !== 'function') {
    done();
    return;
  }
  element.classList.add(className);
  const animations = element.getAnimations();
  if (!animations.length) {
    done();
    return;
  }
  Promise.all(animations.map((animation) => animation.finished)).then(done, done);
}

function showTemporaryText(button, text, restoreText) {
  button.textContent = text;
  setTimeout(() => { button.textContent = restoreText; }, FEEDBACK_MS);
}

function navigateButtonGroup(event, buttons) {
  const items = [...buttons];
  const nextIndex = getNavigationIndex(event.key, items.indexOf(event.currentTarget), items.length);
  if (nextIndex === null) return;
  event.preventDefault();
  items[nextIndex].focus();
  items[nextIndex].click();
}

/* ---------- Mobile menu ---------- */

const menuButton = document.getElementById('menu-button');
const mobileMenu = document.getElementById('mobile-menu');

function isMenuOpen() {
  return menuButton.getAttribute('aria-expanded') === 'true';
}

function openMenu() {
  menuButton.setAttribute('aria-expanded', 'true');
  menuButton.setAttribute('aria-label', 'Đóng menu');
  mobileMenu.classList.remove('hidden', 'menu-leave');
  replayAnimation(mobileMenu, 'menu-enter');
}

function closeMenu() {
  if (!isMenuOpen()) return;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Mở menu');
  mobileMenu.classList.remove('menu-enter');
  animateOut(mobileMenu, 'menu-leave', () => {
    if (!isMenuOpen()) mobileMenu.classList.add('hidden');
    mobileMenu.classList.remove('menu-leave');
  });
}

menuButton.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
mobileMenu.querySelectorAll('a, [data-open-planner]').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isMenuOpen()) {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', (event) => {
  if (isMenuOpen() && !mobileMenu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
});

/* ---------- Click ripple ---------- */

/** Spreads a ripple from the pointer position inside a [data-ripple] button. */
function spawnRipple(event) {
  if (prefersReducedMotion()) return;
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.hypot(rect.width, rect.height) * 2;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  ripple.addEventListener('animationend', () => ripple.remove());
  button.append(ripple);
}

document.querySelectorAll('[data-ripple]').forEach((button) => button.addEventListener('pointerdown', spawnRipple));

/* ---------- Scroll: fixed header state + scroll to top ---------- */

const siteHeader = document.getElementById('site-header');
const scrollTopButton = document.getElementById('scroll-top');

function handleScroll() {
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
  const visible = window.scrollY > 480;
  scrollTopButton.classList.toggle('opacity-0', !visible);
  scrollTopButton.classList.toggle('translate-y-4', !visible);
  scrollTopButton.classList.toggle('pointer-events-none', !visible);
}

scrollTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll();

/* ---------- Scroll reveal ---------- */

function setupReveal() {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    [...group.children].forEach((child, index) => {
      child.style.setProperty('--reveal-delay', `${index * REVEAL_STAGGER_MS}ms`);
      targets.push(child);
    });
  });

  if (prefersReducedMotion() || typeof IntersectionObserver !== 'function') {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  targets.forEach((target) => observer.observe(target));
}

setupReveal();

/* ---------- Suggested itinerary tabs ---------- */

const dayTabs = document.querySelectorAll('.day-tab');
const dayPanels = document.querySelectorAll('.day-panel');

function selectDayTab(tab) {
  const panelId = `day-${tab.dataset.day}-panel`;

  dayTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    item.classList.toggle('bg-pine', selected);
    item.classList.toggle('text-white', selected);
    item.classList.toggle('border', !selected);
    item.classList.toggle('border-pine/20', !selected);
    item.classList.toggle('bg-white', !selected);
    item.classList.toggle('text-pine', !selected);
  });

  dayPanels.forEach((panel) => {
    const selected = panel.id === panelId;
    const wasHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !selected);
    if (selected && wasHidden) replayAnimation(panel, 'panel-enter');
  });
}

dayTabs.forEach((tab) => {
  tab.addEventListener('click', () => selectDayTab(tab));
  tab.addEventListener('keydown', (event) => navigateButtonGroup(event, dayTabs));
});

/** Slides a pill behind the selected day tab; tabs keep their own colours without JS. */
function setupDayTabIndicator() {
  const tabList = dayTabs[0]?.parentElement;
  if (!tabList) return;

  const indicator = document.createElement('span');
  indicator.className = 'day-tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  tabList.prepend(indicator);
  tabList.classList.add('relative', 'has-indicator');

  const moveIndicator = () => {
    const selected = tabList.querySelector('.day-tab[aria-selected="true"]');
    if (!selected) return;
    indicator.style.width = `${selected.offsetWidth}px`;
    indicator.style.height = `${selected.offsetHeight}px`;
    indicator.style.translate = `${selected.offsetLeft}px ${selected.offsetTop}px`;
  };

  dayTabs.forEach((tab) => tab.addEventListener('click', moveIndicator));
  if (typeof ResizeObserver === 'function') new ResizeObserver(moveIndicator).observe(tabList);
  document.fonts?.ready.then(moveIndicator);
  moveIndicator();
  // Place it first, then enable the slide so it does not glide in on page load.
  window.requestAnimationFrame?.(() => indicator.classList.add('is-ready'));
}

setupDayTabIndicator();

/* ---------- Budget count-up ---------- */

const COUNT_UP_MS = 900;
const NUMBER_PATTERN = /\d+(?:,\d+)?/g;

/** Rewrites every number in `text` to `progress` (0–1) of its value, keeping its decimals. */
function scaleNumbersInText(text, progress) {
  return text.replace(NUMBER_PATTERN, (match) => {
    const decimals = match.split(',')[1]?.length ?? 0;
    const value = Number(match.replace(',', '.')) * progress;
    return value.toFixed(decimals).replace('.', ',');
  });
}

function countUp(element) {
  const finalText = element.textContent;
  const startedAt = performance.now();

  const tick = (now) => {
    const linear = Math.min((now - startedAt) / COUNT_UP_MS, 1);
    const eased = 1 - (1 - linear) ** 3;
    element.textContent = linear < 1 ? scaleNumbersInText(finalText, eased) : finalText;
    if (linear < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function setupBudgetCountUp() {
  const values = document.querySelectorAll('[data-count-up]');
  const canAnimate = typeof IntersectionObserver === 'function' && typeof requestAnimationFrame === 'function';
  if (!values.length || !canAnimate || prefersReducedMotion()) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  values.forEach((value) => observer.observe(value));
}

setupBudgetCountUp();

/* ---------- Place filters ---------- */

const placeFilters = document.querySelectorAll('.place-filter');
const placeItems = document.querySelectorAll('.place-item');
const placeEmpty = document.getElementById('place-empty');

function selectPlaceFilter(filter) {
  const category = filter.dataset.filter;
  let visibleItems = 0;

  placeFilters.forEach((item) => {
    const selected = item === filter;
    item.setAttribute('aria-pressed', String(selected));
    item.tabIndex = selected ? 0 : -1;
    item.classList.toggle('bg-white', selected);
    item.classList.toggle('text-pine', selected);
    item.classList.toggle('border', !selected);
    item.classList.toggle('border-white/25', !selected);
    item.classList.toggle('text-white/80', !selected);
  });

  placeItems.forEach((item) => {
    const visible = category === 'all' || item.dataset.category === category;
    item.classList.toggle('hidden', !visible);
    if (!visible) return;
    item.classList.add('is-visible');
    item.style.setProperty('--reveal-delay', `${visibleItems * REVEAL_STAGGER_MS}ms`);
    replayAnimation(item, 'item-enter');
    visibleItems += 1;
  });

  placeEmpty.classList.toggle('hidden', visibleItems > 0);
}

placeFilters.forEach((filter) => {
  filter.addEventListener('click', () => selectPlaceFilter(filter));
  filter.addEventListener('keydown', (event) => navigateButtonGroup(event, placeFilters));
});

/* ---------- Personal planner ---------- */

const plannerDialog = document.getElementById('planner-dialog');
const plannerOpenButtons = document.querySelectorAll('[data-open-planner]');
const plannerCloseButton = document.querySelector('[data-close-planner]');
const plannerForm = document.getElementById('planner-form');
const plannerList = document.getElementById('planner-list');
const plannerEmpty = document.getElementById('planner-empty');
const plannerDayTabs = document.getElementById('planner-day-tabs');
const tripStartDate = document.getElementById('trip-start-date');
const tripEndDate = document.getElementById('trip-end-date');
const plannerDuration = document.getElementById('planner-duration');
const plannerDayTotal = document.getElementById('planner-day-total');
const plannerTripTotal = document.getElementById('planner-trip-total');
const plannerClear = document.getElementById('planner-clear');
const plannerSave = document.getElementById('planner-save');
const plannerImage = document.getElementById('planner-image');
const plannerCost = document.getElementById('planner-cost');
const plannerStatus = document.getElementById('planner-status');
const plannerSaved = document.getElementById('planner-saved');
const plannerToast = document.getElementById('planner-toast');
const plannerToastMessage = document.getElementById('planner-toast-message');
const plannerToastUndo = document.getElementById('planner-toast-undo');
const plannerConfirm = document.getElementById('planner-confirm');
const plannerConfirmMessage = document.getElementById('planner-confirm-message');
const plannerConfirmOk = document.getElementById('planner-confirm-ok');
const plannerConfirmCancel = document.getElementById('planner-confirm-cancel');
const plannerDraftFields = ['planner-time', 'planner-place', 'planner-address', 'planner-cost', 'planner-note']
  .map((id) => document.getElementById(id));
const itineraryKicker = document.getElementById('itinerary-kicker');
const itineraryHeading = document.getElementById('itinerary-heading');
const itineraryDescription = document.getElementById('itinerary-description');
const suggestedItinerary = document.getElementById('suggested-itinerary');
const personalItinerary = document.getElementById('personal-itinerary');

const SUGGESTED_COPY = {
  kicker: itineraryKicker.textContent,
  heading: itineraryHeading.textContent,
  description: itineraryDescription.textContent
};

let activePlannerDay = '';
let personalPlan = loadPlan();

function loadPlan() {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    return raw ? parseSavedPlan(raw) : createEmptyPlan();
  } catch (error) {
    console.error('Không đọc được lịch đã lưu.', error);
    return createEmptyPlan();
  }
}

/** Persists the plan; returns false (and informs the user) when storage is unavailable. */
function savePlan() {
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(personalPlan));
    plannerStatus.textContent = '';
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    plannerSaved.textContent = `✓ Đã tự lưu lúc ${time}`;
    return true;
  } catch (error) {
    console.error('Không lưu được lịch trình.', error);
    plannerStatus.textContent = 'Không lưu được trên thiết bị này (bộ nhớ đầy hoặc bị chặn). Lịch chỉ còn đến khi tải lại trang.';
    return false;
  }
}

function getPlanDayCount() {
  return getDayCount(personalPlan.startDate, personalPlan.endDate);
}

/** Days 1..N of the saved range (a view: never drops stored data). */
function getPlanDays() {
  return resizeDays(personalPlan.days, getPlanDayCount());
}

function getActiveEntries() {
  return activePlannerDay ? personalPlan.days[activePlannerDay] ?? [] : [];
}

function formatRange() {
  return `${formatDisplayDate(personalPlan.startDate)} → ${formatDisplayDate(personalPlan.endDate)}`;
}

/** Shared markup for one stop; used by the dialog list and the on-page itinerary. */
function createEntryDetails(entry) {
  const details = document.createElement('div');
  const place = document.createElement('p');
  place.className = 'font-semibold';
  place.textContent = entry.place;
  details.append(place);

  if (entry.address) {
    const address = document.createElement('p');
    address.className = 'mt-1 text-sm leading-5 text-pine/60';
    const pin = document.createElement('span');
    pin.setAttribute('aria-hidden', 'true');
    pin.textContent = '📍 ';
    address.append(pin, entry.address);
    details.append(address);
  }
  if (entry.note) {
    const note = document.createElement('p');
    note.className = 'mt-1 text-sm leading-5 text-pine/60';
    note.textContent = entry.note;
    details.append(note);
  }
  return details;
}

function createEntryTime(entry) {
  const time = document.createElement('strong');
  time.className = 'font-mono text-sm text-clay';
  time.textContent = entry.time;
  return time;
}

function createActionButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderSuggestedCopy() {
  itineraryKicker.textContent = SUGGESTED_COPY.kicker;
  itineraryHeading.textContent = SUGGESTED_COPY.heading;
  itineraryDescription.textContent = SUGGESTED_COPY.description;
}

function renderPersonalDayCard(day) {
  const entries = sortEntries(personalPlan.days[day] ?? []);
  const card = document.createElement('article');
  card.className = 'rounded-2xl bg-white p-5 shadow-card';

  const title = document.createElement('div');
  title.className = 'flex items-start justify-between gap-3 border-b border-pine/10 pb-4';
  const dayName = document.createElement('h3');
  dayName.className = 'font-display text-2xl italic';
  dayName.textContent = `Ngày ${day} · ${formatTripDay(personalPlan.startDate, Number(day), { weekday: 'long', day: '2-digit', month: '2-digit' })}`;
  const total = document.createElement('span');
  total.className = 'shrink-0 text-sm font-semibold text-clay';
  total.textContent = formatCurrency(getDayTotal(entries));
  title.append(dayName, total);
  card.append(title);

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'py-5 text-sm text-pine/55';
    empty.textContent = 'Chưa có điểm dừng cho ngày này.';
    card.append(empty);
  }

  entries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[64px_1fr] gap-3 border-b border-pine/10 py-4 last:border-0 sm:grid-cols-[78px_1fr_auto]';
    row.append(createEntryTime(entry), createEntryDetails(entry));
    if (entry.cost) {
      const cost = document.createElement('span');
      cost.className = 'col-start-2 text-sm font-semibold text-clay sm:col-start-auto';
      cost.textContent = formatCurrency(entry.cost);
      row.append(cost);
    }
    card.append(row);
  });
  return card;
}

function renderItineraryView() {
  const dayCount = getPlanDayCount();
  suggestedItinerary.classList.toggle('hidden', dayCount > 0);
  personalItinerary.classList.toggle('hidden', dayCount === 0);
  personalItinerary.replaceChildren();

  if (!dayCount) {
    renderSuggestedCopy();
    return;
  }

  const tripTotal = formatCurrency(getTripTotal(getPlanDays()));
  itineraryKicker.textContent = '01 — Lịch trình của bạn';
  itineraryHeading.textContent = 'Chuyến đi, theo nhịp của riêng bạn.';
  itineraryDescription.textContent = `${formatRange()} · ${dayCount} ngày · tổng chi phí ${tripTotal}.`;

  const actions = document.createElement('div');
  actions.className = 'mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card';
  const summary = document.createElement('p');
  summary.className = 'text-sm text-pine/65';
  summary.textContent = `Lịch cá nhân · ${dayCount} ngày · ${tripTotal}`;
  const actionGroup = document.createElement('div');
  actionGroup.className = 'flex gap-2';
  actionGroup.append(
    createActionButton('Chỉnh sửa lịch trình', 'rounded-full bg-pine px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-moss', openPlanner),
    createActionButton('Xóa lịch', 'rounded-full border border-pine/15 px-4 py-2.5 text-sm font-semibold text-pine transition hover:border-clay hover:text-clay', () => {
      if (window.confirm('Xóa lịch cá nhân và quay lại lịch trình gợi ý?')) clearPersonalPlan();
    })
  );
  actions.append(summary, actionGroup);

  const days = document.createElement('div');
  days.className = 'grid gap-4 lg:grid-cols-2';
  Object.keys(getPlanDays()).forEach((day) => days.append(renderPersonalDayCard(day)));
  personalItinerary.append(actions, days);
}

function renderTotals() {
  const dayTotal = formatCurrency(getDayTotal(getActiveEntries()));
  const tripTotal = formatCurrency(getTripTotal(getPlanDays()));
  [[plannerDayTotal, dayTotal], [plannerTripTotal, tripTotal]].forEach(([element, text]) => {
    if (element.textContent === text) return;
    element.textContent = text;
    replayAnimation(element, 'value-flash');
  });
}

function renderPlannerDays(dayCount, startDate) {
  plannerDayTabs.replaceChildren();
  for (let index = 1; index <= dayCount; index += 1) {
    const day = String(index);
    const selected = day === activePlannerDay;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `planner-day-${day}`;
    button.className = `planner-day whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition ${selected ? 'bg-pine text-white' : 'border border-pine/15 bg-white text-pine'}`;
    button.dataset.plannerDay = day;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(selected));
    button.setAttribute('aria-controls', 'planner-list');
    button.tabIndex = selected ? 0 : -1;
    button.textContent = `Ngày ${day} · ${formatTripDay(startDate, index)}`;
    button.addEventListener('click', () => setPlannerDay(day));
    button.addEventListener('keydown', (event) => navigateButtonGroup(event, plannerDayTabs.querySelectorAll('[role="tab"]')));
    plannerDayTabs.append(button);
  }
  if (activePlannerDay) plannerList.setAttribute('aria-labelledby', `planner-day-${activePlannerDay}`);
  else plannerList.removeAttribute('aria-labelledby');
}

function removeEntry(entry, card) {
  const day = activePlannerDay;
  animateOut(card, 'entry-leave', () => {
    personalPlan.days[day] = getActiveEntries().filter((item) => item !== entry);
    savePlan();
    renderPlan();
    renderItineraryView();
    showUndoToast(`Đã xóa ${entry.place}`, () => restoreEntry(entry, day));
  });
}

function restoreEntry(entry, day) {
  personalPlan.days[day] = [...(personalPlan.days[day] ?? []), entry];
  savePlan();
  renderPlan(day === activePlannerDay ? entry : null);
  renderItineraryView();
}

/* ---------- Planner feedback: undo toast + in-dialog confirm ---------- */

let undoTimer = 0;
let undoAction = null;

function hideUndoToast() {
  clearTimeout(undoTimer);
  undoAction = null;
  plannerToast.classList.add('hidden');
  plannerToast.classList.remove('flex');
}

/** Shows "<message> · Hoàn tác" for a few seconds; a newer toast replaces the older one. */
function showUndoToast(message, onUndo) {
  clearTimeout(undoTimer);
  undoAction = onUndo;
  plannerToastMessage.textContent = message;
  plannerToast.classList.remove('hidden');
  plannerToast.classList.add('flex');
  replayAnimation(plannerToast, 'panel-enter');
  undoTimer = setTimeout(hideUndoToast, UNDO_MS);
}

plannerToastUndo.addEventListener('click', () => {
  const action = undoAction;
  hideUndoToast();
  action?.();
});

let resolveConfirm = null;
const plannerConfirmBackground = [...plannerConfirm.parentElement.children].filter((element) => element !== plannerConfirm);

/** Resolves the open confirm panel (if any) and gives the rest of the dialog back. */
function settleConfirm(confirmed) {
  if (!resolveConfirm) return;
  const resolve = resolveConfirm;
  resolveConfirm = null;
  plannerConfirm.classList.add('hidden');
  plannerConfirm.classList.remove('grid');
  plannerConfirmBackground.forEach((element) => { element.inert = false; });
  resolve(confirmed);
}

/** In-dialog replacement for window.confirm, styled like the planner. Resolves true / false. */
function askConfirm(message, confirmLabel) {
  settleConfirm(false);
  plannerConfirmMessage.textContent = message;
  plannerConfirmOk.textContent = confirmLabel;
  plannerConfirm.classList.remove('hidden');
  plannerConfirm.classList.add('grid');
  plannerConfirmBackground.forEach((element) => { element.inert = true; });
  replayAnimation(plannerConfirm.firstElementChild, 'item-enter');
  plannerConfirmCancel.focus();
  return new Promise((resolve) => { resolveConfirm = resolve; });
}

plannerConfirmOk.addEventListener('click', () => settleConfirm(true));
plannerConfirmCancel.addEventListener('click', () => settleConfirm(false));

function renderPlan(addedEntry = null) {
  const entries = sortEntries(getActiveEntries());
  plannerList.replaceChildren();
  renderTotals();
  plannerEmpty.classList.toggle('hidden', entries.length > 0);
  plannerEmpty.textContent = activePlannerDay
    ? 'Ngày này chưa có điểm dừng. Thêm mốc đầu tiên bên dưới nhé.'
    : 'Chọn ngày đi và ngày về để tạo lịch theo từng ngày.';

  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'planner-entry rounded-2xl bg-white p-4';
    if (entry === addedEntry) card.classList.add('entry-enter');

    const details = createEntryDetails(entry);
    if (entry.cost) {
      const cost = document.createElement('p');
      cost.className = 'mt-2 text-sm font-semibold text-clay';
      cost.textContent = formatCurrency(entry.cost);
      details.append(cost);
    }

    const remove = createActionButton('×', 'grid h-9 w-9 place-items-center rounded-full text-pine/45 transition hover:bg-[#fff0ed] hover:text-clay', () => removeEntry(entry, card));
    remove.setAttribute('aria-label', `Xóa ${entry.place}`);

    card.append(createEntryTime(entry), details, remove);
    plannerList.append(card);
  });
}

function setPlannerFormState(enabled) {
  plannerForm.querySelectorAll('input, button').forEach((element) => {
    element.disabled = !enabled;
  });
  plannerForm.classList.toggle('opacity-50', !enabled);
  plannerImage.disabled = !enabled;
}

function describeRange(dayCount, startDate, endDate) {
  if (dayCount) return `Chuyến đi có ${dayCount} ngày · chọn một ngày để thêm lịch.`;
  if (startDate && endDate) return 'Ngày trở về cần từ ngày khởi hành trở đi.';
  return 'Chọn ngày đi và ngày về để tạo lịch theo từng ngày.';
}

/** Renders the dialog for a date range without persisting anything. */
function renderPlanner(startDate, endDate) {
  const dayCount = getDayCount(startDate, endDate);
  plannerDuration.textContent = describeRange(dayCount, startDate, endDate);
  if (!dayCount) activePlannerDay = '';
  else if (!activePlannerDay || Number(activePlannerDay) > dayCount) activePlannerDay = '1';
  renderPlannerDays(dayCount, startDate);
  setPlannerFormState(dayCount > 0);
  renderPlan();
}

/**
 * Applies the date inputs to the plan. An incomplete or reversed range is only
 * displayed — stored days stay untouched until the range is valid again.
 * Shrinking a range that would drop days with stops asks for confirmation.
 */
async function handleRangeChange() {
  const startDate = tripStartDate.value;
  const endDate = tripEndDate.value;
  const dayCount = getDayCount(startDate, endDate);

  if (!dayCount) {
    renderPlanner(startDate, endDate);
    return;
  }

  const lostDays = getDaysLostByRange(personalPlan.days, dayCount);
  const confirmMessage = `Khoảng ngày mới sẽ xóa lịch của ngày ${lostDays.join(', ')}. Tiếp tục?`;
  if (lostDays.length && !(await askConfirm(confirmMessage, 'Xóa các ngày đó'))) {
    tripStartDate.value = personalPlan.startDate;
    tripEndDate.value = personalPlan.endDate;
    renderPlanner(personalPlan.startDate, personalPlan.endDate);
    return;
  }

  personalPlan = { startDate, endDate, days: resizeDays(personalPlan.days, dayCount) };
  hideUndoToast();
  savePlan();
  renderPlanner(startDate, endDate);
  renderItineraryView();
}

function setPlannerDay(day) {
  activePlannerDay = day;
  renderPlannerDays(getPlanDayCount(), personalPlan.startDate);
  plannerDayTabs.querySelector(`[data-planner-day="${day}"]`)?.focus();
  renderPlan();
}

// Bumped on every open/close so a stale exit animation never closes a reopened dialog.
let plannerCloseId = 0;

function openPlanner() {
  tripStartDate.value = personalPlan.startDate;
  tripEndDate.value = personalPlan.endDate;
  plannerStatus.textContent = hasDraft() ? 'Bạn còn một mốc đang nhập dở ở form bên dưới.' : '';
  plannerSaved.textContent = personalPlan.startDate ? '✓ Lịch được tự lưu trên thiết bị này' : '';
  // Reopened mid-close: cancel the exit animation instead of reopening.
  plannerCloseId += 1;
  if (plannerDialog.open) plannerDialog.classList.remove('is-closing');
  else plannerDialog.showModal();
  renderPlanner(personalPlan.startDate, personalPlan.endDate);
}

/** Plays the exit animation, then closes (focus returns to the opener natively). */
function closePlanner() {
  if (!plannerDialog.open || plannerDialog.classList.contains('is-closing')) return;
  settleConfirm(false);
  plannerCloseId += 1;
  const closeId = plannerCloseId;
  animateOut(plannerDialog, 'is-closing', () => {
    if (closeId !== plannerCloseId) return;
    plannerDialog.classList.remove('is-closing');
    hideUndoToast();
    plannerDialog.close();
  });
}

/* ---------- Planner draft: an unfinished stop survives closing and reloads ---------- */

function hasDraft() {
  return plannerDraftFields.some((field) => field.value.trim());
}

function saveDraft() {
  try {
    if (hasDraft()) sessionStorage.setItem(PLANNER_DRAFT_KEY, JSON.stringify(plannerDraftFields.map((field) => field.value)));
    else sessionStorage.removeItem(PLANNER_DRAFT_KEY);
  } catch {
    // Drafts are a convenience; without sessionStorage they simply live until reload.
  }
}

function restoreDraft() {
  try {
    const values = JSON.parse(sessionStorage.getItem(PLANNER_DRAFT_KEY) ?? '[]');
    if (!Array.isArray(values)) return;
    plannerDraftFields.forEach((field, index) => {
      if (typeof values[index] === 'string') field.value = values[index];
    });
  } catch {
    // Unreadable or corrupt draft: start with an empty form.
  }
}

function clearPersonalPlan() {
  hideUndoToast();
  personalPlan = createEmptyPlan();
  tripStartDate.value = '';
  tripEndDate.value = '';
  activePlannerDay = '';
  savePlan();
  renderPlanner('', '');
  renderItineraryView();
}

plannerOpenButtons.forEach((button) => button.addEventListener('click', openPlanner));
plannerCloseButton.addEventListener('click', closePlanner);
plannerDialog.addEventListener('click', (event) => {
  if (event.target === plannerDialog) closePlanner();
});
// Escape fires `cancel`; route it through the animated close.
plannerDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (resolveConfirm) settleConfirm(false);
  else closePlanner();
});
plannerForm.addEventListener('input', saveDraft);
restoreDraft();
tripStartDate.addEventListener('change', handleRangeChange);
tripEndDate.addEventListener('change', handleRangeChange);
plannerCost.addEventListener('input', () => {
  plannerCost.value = formatCostInput(plannerCost.value);
});

plannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!activePlannerDay) return;
  const time = document.getElementById('planner-time');
  const place = document.getElementById('planner-place');
  const address = document.getElementById('planner-address');
  const note = document.getElementById('planner-note');
  const placeName = place.value.trim();
  if (!placeName) {
    place.focus();
    return;
  }

  const entry = {
    time: time.value,
    place: placeName,
    address: address.value.trim(),
    cost: parseCost(plannerCost.value),
    note: note.value.trim()
  };
  personalPlan.days[activePlannerDay] = [...getActiveEntries(), entry];
  savePlan();
  plannerForm.reset();
  saveDraft();
  renderPlan(entry);
  renderItineraryView();
  place.focus();
});

// Changes save as they happen; "Xong" only double-checks storage, then closes.
plannerSave.addEventListener('click', () => {
  if (!savePlan()) return;
  renderItineraryView();
  closePlanner();
});

plannerClear.addEventListener('click', async () => {
  if (await askConfirm('Xóa toàn bộ lịch cá nhân? Thao tác này không hoàn tác được.', 'Xóa toàn bộ')) clearPersonalPlan();
});

/* ---------- PNG export ---------- */

let html2canvasPromise = null;

/** Loads html2canvas on first use only, with SRI. */
function loadHtml2canvas() {
  if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
  if (!html2canvasPromise) {
    html2canvasPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HTML2CANVAS_SRC;
      script.integrity = HTML2CANVAS_INTEGRITY;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => {
        html2canvasPromise = null;
        script.remove();
        reject(new Error('Không tải được html2canvas.'));
      };
      document.head.append(script);
    });
  }
  return html2canvasPromise;
}

function createExportElement(tag, text, cssText) {
  const element = document.createElement(tag);
  element.textContent = text;
  element.style.cssText = cssText;
  return element;
}

function buildExportView() {
  const view = document.createElement('article');
  view.style.cssText = `position:fixed;left:0;top:0;z-index:9999;width:760px;min-height:100vh;box-sizing:border-box;padding:44px;background:#fff;color:${EXPORT_COLORS.pine};font-family:Inter,Arial,sans-serif;`;
  view.append(
    createExportElement('h1', 'Lịch trình Đà Lạt', `margin:0;color:${EXPORT_COLORS.pine};font-family:Georgia,serif;font-size:32px;`),
    createExportElement('p', `${formatRange()} · ${getPlanDayCount()} ngày`, `margin:10px 0 28px;color:${EXPORT_COLORS.muted};font-size:14px;`)
  );

  const planDays = getPlanDays();
  Object.keys(planDays).forEach((day) => {
    const entries = sortEntries(planDays[day]);
    const section = document.createElement('section');
    section.style.cssText = 'margin:0 0 24px;break-inside:avoid;';
    section.append(createExportElement('h2', `Ngày ${day} · ${formatTripDay(personalPlan.startDate, Number(day))}`, `margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid ${EXPORT_COLORS.sand};font-size:20px;`));

    if (!entries.length) {
      section.append(createExportElement('p', 'Chưa có điểm dừng.', `color:${EXPORT_COLORS.muted};font-size:13px;`));
    }
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.style.cssText = `display:grid;grid-template-columns:74px 1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid ${EXPORT_COLORS.rule};font-size:14px;`;
      const details = document.createElement('div');
      details.append(createExportElement('strong', entry.place, ''));
      [entry.address && `Địa chỉ: ${entry.address}`, entry.note].filter(Boolean).forEach((text) => {
        details.append(createExportElement('p', text, `margin:3px 0 0;color:${EXPORT_COLORS.muted};font-size:12px;`));
      });
      row.append(
        createExportElement('strong', entry.time, `color:${EXPORT_COLORS.clay};`),
        details,
        createExportElement('span', entry.cost ? formatCurrency(entry.cost) : '', `font-weight:600;color:${EXPORT_COLORS.clay};white-space:nowrap;`)
      );
      section.append(row);
    });
    section.append(createExportElement('p', `Tổng ngày ${day}: ${formatCurrency(getDayTotal(entries))}`, 'margin:10px 0 0;text-align:right;font-weight:700;'));
    view.append(section);
  });

  view.append(createExportElement('p', `Tổng chi phí chuyến đi: ${formatCurrency(getTripTotal(getPlanDays()))}`, `margin:8px 0 0;padding:16px;background:${EXPORT_COLORS.pine};color:#fff;font-size:18px;font-weight:700;text-align:right;`));
  return view;
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

plannerImage.addEventListener('click', async () => {
  if (!getPlanDayCount()) {
    plannerDuration.textContent = 'Hãy chọn ngày khởi hành và ngày trở về trước khi lưu ảnh.';
    return;
  }

  plannerImage.disabled = true;
  plannerImage.textContent = 'Đang tạo ảnh…';
  let view = null;
  let failed = false;

  try {
    const html2canvas = await loadHtml2canvas();
    view = buildExportView();
    document.body.append(view);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await html2canvas(view, { backgroundColor: '#ffffff', scale: 2, logging: false, useCORS: true });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Không thể tạo tệp ảnh.');
    downloadBlob(blob, `lich-trinh-da-lat-${personalPlan.startDate || 'ca-nhan'}.png`);
  } catch (error) {
    failed = true;
    console.error('Xuất ảnh PNG thất bại.', error);
  } finally {
    view?.remove();
    plannerImage.disabled = false;
    if (failed) showTemporaryText(plannerImage, 'Không tạo được ảnh', 'Lưu ảnh PNG');
    else plannerImage.textContent = 'Lưu ảnh PNG';
  }
});

renderPlanner(personalPlan.startDate, personalPlan.endDate);
renderItineraryView();
