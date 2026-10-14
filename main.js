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
