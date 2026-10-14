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
const plannerDayButtons = document.querySelectorAll('.planner-day');
const tripStartDate = document.getElementById('trip-start-date');
const tripName = document.getElementById('trip-name');
const plannerClear = document.getElementById('planner-clear');
const plannerSave = document.getElementById('planner-save');
const plannerStorageKey = 'dalat-personal-itinerary';
let activePlannerDay = '1';
let personalPlan = { tripName: '', startDate: '', days: { 1: [], 2: [], 3: [] } };

try {
  const savedPlan = JSON.parse(localStorage.getItem(plannerStorageKey));
  if (savedPlan?.days) personalPlan = savedPlan;
} catch {
  localStorage.removeItem(plannerStorageKey);
}

function savePlan() {
  personalPlan.tripName = tripName.value.trim();
  personalPlan.startDate = tripStartDate.value;
  localStorage.setItem(plannerStorageKey, JSON.stringify(personalPlan));
}

function renderPlan() {
  const entries = personalPlan.days[activePlannerDay].sort((a, b) => a.time.localeCompare(b.time));
  plannerList.replaceChildren();
  plannerEmpty.classList.toggle('hidden', entries.length > 0);

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
  plannerDayButtons.forEach((button) => {
    const selected = button.dataset.plannerDay === day;
    button.setAttribute('aria-selected', String(selected));
    button.classList.toggle('bg-pine', selected);
    button.classList.toggle('text-white', selected);
    button.classList.toggle('border-pine/15', !selected);
    button.classList.toggle('bg-white', !selected);
    button.classList.toggle('text-pine', !selected);
  });
  renderPlan();
}

plannerOpenButtons.forEach((button) => button.addEventListener('click', () => {
  tripName.value = personalPlan.tripName;
  tripStartDate.value = personalPlan.startDate;
  plannerDialog.showModal();
  setPlannerDay(activePlannerDay);
}));

plannerCloseButton.addEventListener('click', () => plannerDialog.close());
plannerDialog.addEventListener('click', (event) => {
  if (event.target === plannerDialog) plannerDialog.close();
});
plannerDayButtons.forEach((button) => button.addEventListener('click', () => setPlannerDay(button.dataset.plannerDay)));

plannerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const time = document.getElementById('planner-time');
  const place = document.getElementById('planner-place');
  const note = document.getElementById('planner-note');
  personalPlan.days[activePlannerDay].push({ time: time.value, place: place.value.trim(), note: note.value.trim() });
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
  personalPlan = { tripName: '', startDate: '', days: { 1: [], 2: [], 3: [] } };
  tripName.value = '';
  tripStartDate.value = '';
  savePlan();
  renderPlan();
});
