/* Navigation and research figure carousel. Publications load once in index.html. */
(() => {
  const header = document.querySelector('.site-header');
  const menu = document.getElementById('menuToggle');
  const links = Array.from(document.querySelectorAll('header nav a'));
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
  function closeMenu() {
    header?.classList.remove('nav-open');
    menu?.setAttribute('aria-expanded', 'false');
  }
  menu?.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    menu.setAttribute('aria-expanded', String(open));
  });
  links.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  let scheduled = false;
  function updateActive() {
    const threshold = (header?.getBoundingClientRect().height || 76) + 130;
    let active = 'home';
    document.querySelectorAll('main section[id]').forEach(section => {
      if (section.getBoundingClientRect().top <= threshold) active = section.id;
    });
    links.forEach(link => {
      const selected = link.getAttribute('href') === `#${active}`;
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateActive); }
  }, { passive: true });
  updateActive();
  const root = document.querySelector('.carousel');
  if (!root) return;
  const slides = [...root.querySelectorAll('.slide')];
  const track = root.querySelector('.slides');
  const dots = root.querySelector('.dots');
  let index = 0;
  let timer;
  function go(next) {
    index = (next + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
    [...dots.children].forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
      dot.setAttribute('aria-pressed', String(i === index));
    });
  }
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => go(i));
    dots.appendChild(dot);
  });
  root.querySelector('.prev').addEventListener('click', () => go(index - 1));
  root.querySelector('.next').addEventListener('click', () => go(index + 1));
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); go(index + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  const pause = () => clearInterval(timer);
  const play = () => {
    pause();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden) {
      timer = setInterval(() => go(index + 1), 7000);
    }
  };
  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', play);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) play(); });
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
  go(0); play();
})();
