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
