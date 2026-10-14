const menuButton = document.getElementById('menu-button');
const mobileMenu = document.getElementById('mobile-menu');

menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  mobileMenu.classList.toggle('hidden');
});

mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

const dayTabs = document.querySelectorAll('.day-tab');
const dayPanels = document.querySelectorAll('.day-panel');

dayTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const selectedDay = tab.dataset.day;

    dayTabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.classList.toggle('bg-pine', selected);
      item.classList.toggle('text-white', selected);
      item.classList.toggle('border-pine/20', !selected);
      item.classList.toggle('bg-white', !selected);
      item.classList.toggle('text-pine', !selected);
    });

    dayPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== `day-${selectedDay}-panel`);
    });
  });
});

const placeFilters = document.querySelectorAll('.place-filter');
const placeItems = document.querySelectorAll('.place-item');
const placeEmpty = document.getElementById('place-empty');

placeFilters.forEach((filter) => {
  filter.addEventListener('click', () => {
    const category = filter.dataset.filter;
    let visibleItems = 0;

    placeFilters.forEach((item) => {
      const selected = item === filter;
      item.setAttribute('aria-pressed', String(selected));
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
  });
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
  const cost = Number(entry.cost);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
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
  const tripTotal = Object.values(personalPlan.days)
    .flat()
    .reduce((total, entry) => total + getEntryCost(entry), 0);
  plannerDayTotal.textContent = formatCurrency(dayTotal);
  plannerTripTotal.textContent = formatCurrency(tripTotal);
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

plannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const time = document.getElementById('planner-time');
  const place = document.getElementById('planner-place');
  const address = document.getElementById('planner-address');
  const cost = document.getElementById('planner-cost');
  const note = document.getElementById('planner-note');
  personalPlan.days[activePlannerDay].push({
    time: time.value,
    place: place.value.trim(),
    address: address.value.trim(),
    cost: Number(cost.value) || 0,
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

plannerClear.addEventListener('click', () => {
  personalPlan = { startDate: '', endDate: '', days: {} };
  tripStartDate.value = '';
  tripEndDate.value = '';
  activePlannerDay = '';
  savePlan();
  syncTripDays();
});
