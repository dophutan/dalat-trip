const menuButton = document.getElementById('menu-button');
const mobileMenu = document.getElementById('mobile-menu');

menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  mobileMenu.classList.toggle('hidden');
});

mobileMenu.querySelectorAll('a, [data-open-planner]').forEach((link) => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

const scrollTopButton = document.getElementById('scroll-top');

function toggleScrollTopButton() {
  const visible = window.scrollY > 480;
  scrollTopButton.classList.toggle('opacity-0', !visible);
  scrollTopButton.classList.toggle('translate-y-4', !visible);
  scrollTopButton.classList.toggle('pointer-events-none', !visible);
}

scrollTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', toggleScrollTopButton, { passive: true });
toggleScrollTopButton();

const dayTabs = document.querySelectorAll('.day-tab');
const dayPanels = document.querySelectorAll('.day-panel');

function navigateButtonGroup(event, buttons) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const items = [...buttons];
  const currentIndex = items.indexOf(event.currentTarget);
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
  items[nextIndex].focus();
  items[nextIndex].click();
}

function selectDayTab(tab) {
  const selectedDay = tab.dataset.day;

  dayTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    item.classList.toggle('bg-pine', selected);
    item.classList.toggle('text-white', selected);
    item.classList.toggle('border-pine/20', !selected);
    item.classList.toggle('bg-white', !selected);
    item.classList.toggle('text-pine', !selected);
  });

  dayPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `day-${selectedDay}-panel`);
  });
}

dayTabs.forEach((tab) => {
  tab.addEventListener('click', () => selectDayTab(tab));
  tab.addEventListener('keydown', (event) => navigateButtonGroup(event, dayTabs));
});

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
    item.classList.toggle('border-white/25', !selected);
    item.classList.toggle('text-white/80', !selected);
  });

  placeItems.forEach((item) => {
    const visible = category === 'all' || item.dataset.category === category;
    item.classList.toggle('hidden', !visible);
    if (visible) visibleItems += 1;
  });

  placeEmpty.classList.toggle('hidden', visibleItems > 0);
}

placeFilters.forEach((filter) => {
  filter.addEventListener('click', () => selectPlaceFilter(filter));
  filter.addEventListener('keydown', (event) => navigateButtonGroup(event, placeFilters));
});

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
const plannerStorageKey = 'dalat-personal-itinerary';
let activePlannerDay = '';
let personalPlan = { startDate: '', endDate: '', days: {} };

try {
  const savedPlan = JSON.parse(localStorage.getItem(plannerStorageKey));
  if (savedPlan?.days) {
    personalPlan = {
      startDate: savedPlan.startDate || '',
      endDate: savedPlan.endDate || '',
      days: savedPlan.days
    };
    if (personalPlan.startDate && !personalPlan.endDate) {
      const legacyEndDate = new Date(`${personalPlan.startDate}T00:00:00`);
      legacyEndDate.setDate(legacyEndDate.getDate() + Math.max(Object.keys(personalPlan.days).length - 1, 0));
      personalPlan.endDate = `${legacyEndDate.getFullYear()}-${String(legacyEndDate.getMonth() + 1).padStart(2, '0')}-${String(legacyEndDate.getDate()).padStart(2, '0')}`;
    }
  }
} catch {
  localStorage.removeItem(plannerStorageKey);
}

function savePlan() {
  personalPlan.startDate = tripStartDate.value;
  personalPlan.endDate = tripEndDate.value;
  localStorage.setItem(plannerStorageKey, JSON.stringify(personalPlan));
}

function getTripDayCount() {
  if (!tripStartDate.value || !tripEndDate.value) return 0;
  const start = new Date(`${tripStartDate.value}T00:00:00`);
  const end = new Date(`${tripEndDate.value}T00:00:00`);
  const difference = Math.round((end - start) / 86400000);
  return difference >= 0 ? difference + 1 : 0;
}

function formatTripDay(dayNumber) {
  const date = new Date(`${tripStartDate.value}T00:00:00`);
  date.setDate(date.getDate() + dayNumber - 1);
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function setPlannerFormState(enabled) {
  plannerForm.querySelectorAll('input, button').forEach((element) => {
    element.disabled = !enabled;
  });
  plannerForm.classList.toggle('opacity-50', !enabled);
}

function getEntryCost(entry) {
  const cost = Number(String(entry.cost || '').replace(/\D/g, ''));
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

function formatCostInput(value) {
  const digits = String(value).replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('vi-VN').format(Number(digits)) : '';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

function renderTotals() {
  const dayTotal = activePlannerDay
    ? personalPlan.days[activePlannerDay].reduce((total, entry) => total + getEntryCost(entry), 0)
    : 0;
  const tripTotal = getTripTotal();
  plannerDayTotal.textContent = formatCurrency(dayTotal);
  plannerTripTotal.textContent = formatCurrency(tripTotal);
}

function getTripTotal() {
  return Object.values(personalPlan.days)
    .flat()
    .reduce((total, entry) => total + getEntryCost(entry), 0);
}

function syncTripDays() {
  const count = getTripDayCount();
  const invalidRange = tripStartDate.value && tripEndDate.value && count === 0;

  if (invalidRange) {
    plannerDuration.textContent = 'Ngày trở về cần từ ngày khởi hành trở đi.';
  } else if (count) {
    plannerDuration.textContent = `Chuyến đi có ${count} ngày · chọn một ngày để thêm lịch.`;
  } else {
    plannerDuration.textContent = 'Chọn ngày đi và ngày về để tạo lịch theo từng ngày.';
  }

  const validDays = new Set(Array.from({ length: count }, (_, index) => String(index + 1)));
  Object.keys(personalPlan.days).forEach((day) => {
    if (!validDays.has(day)) delete personalPlan.days[day];
  });
  validDays.forEach((day) => {
    if (!Array.isArray(personalPlan.days[day])) personalPlan.days[day] = [];
  });

  if (!validDays.has(activePlannerDay)) activePlannerDay = count ? '1' : '';
  renderPlannerDays();
  setPlannerFormState(Boolean(count));
  renderPlan();
  savePlan();
}

function renderPlannerDays() {
  const count = getTripDayCount();
  plannerDayTabs.replaceChildren();

  Array.from({ length: count }, (_, index) => {
    const day = String(index + 1);
    const button = document.createElement('button');
    const selected = day === activePlannerDay;
    button.className = `planner-day whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold ${selected ? 'bg-pine text-white' : 'border border-pine/15 bg-white text-pine'}`;
    button.dataset.plannerDay = day;
    button.type = 'button';
    button.setAttribute('aria-selected', String(selected));
    button.textContent = `Ngày ${day} · ${formatTripDay(index + 1)}`;
    button.addEventListener('click', () => setPlannerDay(day));
    plannerDayTabs.append(button);
  });
}

function renderPlan() {
  const entries = activePlannerDay ? personalPlan.days[activePlannerDay].sort((a, b) => a.time.localeCompare(b.time)) : [];
  plannerList.replaceChildren();
  renderTotals();
  plannerEmpty.classList.toggle('hidden', entries.length > 0);
  if (!activePlannerDay) {
    plannerEmpty.textContent = 'Chọn ngày đi và ngày về để tạo lịch theo từng ngày.';
    return;
  }
  plannerEmpty.textContent = 'Ngày này chưa có điểm dừng. Thêm mốc đầu tiên bên dưới nhé.';

  entries.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'planner-entry rounded-2xl bg-white p-4';

    const time = document.createElement('strong');
    time.className = 'font-mono text-sm text-clay';
    time.textContent = entry.time;

    const copy = document.createElement('div');
    const place = document.createElement('p');
    place.className = 'font-semibold';
    place.textContent = entry.place;
    copy.append(place);
    if (entry.note) {
      const note = document.createElement('p');
      note.className = 'mt-1 text-sm leading-5 text-pine/60';
      note.textContent = entry.note;
      copy.append(note);
    }
    if (entry.address) {
      const address = document.createElement('p');
      address.className = 'mt-1 text-sm leading-5 text-pine/60';
      address.textContent = `📍 ${entry.address}`;
      copy.append(address);
    }
    if (getEntryCost(entry)) {
      const cost = document.createElement('p');
      cost.className = 'mt-2 text-sm font-semibold text-clay';
      cost.textContent = formatCurrency(getEntryCost(entry));
      copy.append(cost);
    }

    const remove = document.createElement('button');
    remove.className = 'grid h-9 w-9 place-items-center rounded-full text-pine/45 transition hover:bg-[#fff0ed] hover:text-clay';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Xóa ${entry.place}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      personalPlan.days[activePlannerDay].splice(index, 1);
      savePlan();
      renderPlan();
    });

    card.append(time, copy, remove);
    plannerList.append(card);
  });
}

function setPlannerDay(day) {
  activePlannerDay = day;
  renderPlannerDays();
  renderPlan();
}

plannerOpenButtons.forEach((button) => button.addEventListener('click', () => {
  tripStartDate.value = personalPlan.startDate;
  tripEndDate.value = personalPlan.endDate;
  plannerDialog.showModal();
  syncTripDays();
}));

plannerCloseButton.addEventListener('click', () => plannerDialog.close());
plannerDialog.addEventListener('click', (event) => {
  if (event.target === plannerDialog) plannerDialog.close();
});
tripStartDate.addEventListener('change', syncTripDays);
tripEndDate.addEventListener('change', syncTripDays);
plannerCost.addEventListener('input', () => {
  plannerCost.value = formatCostInput(plannerCost.value);
});

plannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const time = document.getElementById('planner-time');
  const place = document.getElementById('planner-place');
  const address = document.getElementById('planner-address');
  const note = document.getElementById('planner-note');
  personalPlan.days[activePlannerDay].push({
    time: time.value,
    place: place.value.trim(),
    address: address.value.trim(),
    cost: getEntryCost({ cost: plannerCost.value }),
    note: note.value.trim()
  });
  savePlan();
  plannerForm.reset();
  renderPlan();
  place.focus();
});

plannerSave.addEventListener('click', () => {
  savePlan();
  plannerSave.textContent = 'Đã lưu trên thiết bị';
  setTimeout(() => { plannerSave.textContent = 'Lưu lịch trình'; }, 1800);
});

plannerImage.addEventListener('click', async () => {
  if (!getTripDayCount()) {
    plannerDuration.textContent = 'Hãy chọn ngày khởi hành và ngày trở về trước khi lưu ảnh.';
    return;
  }
  if (typeof html2canvas !== 'function') {
    plannerImage.textContent = 'Không tải được ảnh';
    setTimeout(() => { plannerImage.textContent = 'Lưu ảnh PNG'; }, 1800);
    return;
  }

  savePlan();
  plannerImage.disabled = true;
  plannerImage.textContent = 'Đang tạo ảnh…';

  const documentView = document.createElement('article');
  documentView.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:760px;min-height:100vh;box-sizing:border-box;padding:44px;background:#fff;color:#16342c;font-family:Inter,Arial,sans-serif;';
  const heading = document.createElement('h1');
  heading.textContent = 'Lịch trình Đà Lạt';
  heading.style.cssText = 'margin:0;color:#16342c;font-family:Georgia,serif;font-size:32px;';
  const dates = document.createElement('p');
  dates.textContent = `${tripStartDate.value} → ${tripEndDate.value} · ${getTripDayCount()} ngày`;
  dates.style.cssText = 'margin:10px 0 28px;color:#657e69;font-size:14px;';
  documentView.append(heading, dates);

  Object.keys(personalPlan.days).sort((a, b) => Number(a) - Number(b)).forEach((day) => {
    const section = document.createElement('section');
    section.style.cssText = 'margin:0 0 24px;break-inside:avoid;';
    const title = document.createElement('h2');
    title.textContent = `Ngày ${day} · ${formatTripDay(Number(day))}`;
    title.style.cssText = 'margin:0 0 10px;padding-bottom:8px;border-bottom:2px solid #ded3bd;font-size:20px;';
    section.append(title);

    const entries = [...personalPlan.days[day]].sort((a, b) => a.time.localeCompare(b.time));
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Chưa có điểm dừng.';
      empty.style.cssText = 'color:#657e69;font-size:13px;';
      section.append(empty);
    }
    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:74px 1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid #ece7dc;font-size:14px;';
      const time = document.createElement('strong');
      time.textContent = entry.time;
      time.style.color = '#c76d52';
      const details = document.createElement('div');
      const place = document.createElement('strong');
      place.textContent = entry.place;
      details.append(place);
      [entry.address && `Địa chỉ: ${entry.address}`, entry.note].filter(Boolean).forEach((text) => {
        const extra = document.createElement('p');
        extra.textContent = text;
        extra.style.cssText = 'margin:3px 0 0;color:#657e69;font-size:12px;';
        details.append(extra);
      });
      const cost = document.createElement('span');
      cost.textContent = getEntryCost(entry) ? formatCurrency(getEntryCost(entry)) : '';
      cost.style.cssText = 'font-weight:600;color:#c76d52;white-space:nowrap;';
      row.append(time, details, cost);
      section.append(row);
    });
    const dayTotal = document.createElement('p');
    dayTotal.textContent = `Tổng ngày ${day}: ${formatCurrency(personalPlan.days[day].reduce((sum, entry) => sum + getEntryCost(entry), 0))}`;
    dayTotal.style.cssText = 'margin:10px 0 0;text-align:right;font-weight:700;';
    section.append(dayTotal);
    documentView.append(section);
  });

  const total = document.createElement('p');
  total.textContent = `Tổng chi phí chuyến đi: ${formatCurrency(getTripTotal())}`;
  total.style.cssText = 'margin:8px 0 0;padding:16px;background:#16342c;color:#fff;font-size:18px;font-weight:700;text-align:right;';
  documentView.append(total);
  document.body.append(documentView);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await html2canvas(documentView, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Không thể tạo tệp ảnh.');
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `lich-trinh-da-lat-${tripStartDate.value || 'ca-nhan'}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } catch (error) {
    plannerImage.textContent = 'Không tạo được ảnh';
    setTimeout(() => { plannerImage.textContent = 'Lưu ảnh PNG'; }, 1800);
  } finally {
    documentView.remove();
    plannerImage.disabled = false;
    if (plannerImage.textContent === 'Đang tạo ảnh…') plannerImage.textContent = 'Lưu ảnh PNG';
  }
});

plannerClear.addEventListener('click', () => {
  personalPlan = { startDate: '', endDate: '', days: {} };
  tripStartDate.value = '';
  tripEndDate.value = '';
  activePlannerDay = '';
  savePlan();
  syncTripDays();
});
