
// Smooth active link highlight and year
const links = Array.from(document.querySelectorAll('header nav a'));
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Mobile menu toggle
const header = document.querySelector('.site-header');
document.getElementById('menuToggle').addEventListener('click', () => {
  header.classList.toggle('nav-open');
});

// IntersectionObserver to highlight current section
const sections = Array.from(document.querySelectorAll('main section'));
const byId = id => document.querySelector(`header nav a[href="#${id}"]`);
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const link = byId(entry.target.id);
    if (link) link.classList.toggle('active', entry.isIntersecting && entry.intersectionRatio > 0.5);
  });
}, { threshold: [0.5] });
sections.forEach(sec => observer.observe(sec));

// Publications loader
fetch('data/publications.json')
  .then(r => r.json())
  .then(items => {
    const wrap = document.getElementById('pubList');
    wrap.innerHTML = items.map(p => `
      <div class="pub">
        <div><strong>${p.title}</strong></div>
        <div>${p.authors} — <span class="venue">${p.venue} (${p.year})</span></div>
        ${p.link ? `<div><a href="${p.link}" target="_blank" rel="noopener">Link</a></div>` : ''}
      </div>`
    ).join('');
  }).catch(() => {
    const wrap = document.getElementById('pubList');
    if (wrap) wrap.textContent = 'Add items to data/publications.json to populate this section.';
  });

// Simple Carousel
(function () {
  const root = document.querySelector('.carousel');
  if (!root) return;
  const slides = Array.from(root.querySelectorAll('.slide'));
  const track = root.querySelector('.slides');
  const prev = root.querySelector('.prev');
  const next = root.querySelector('.next');
  const dots = root.querySelector('.dots');
  let index = 0;

  function renderDots() {
    dots.innerHTML = slides.map((_, i) => `<button aria-label="Go to slide ${i+1}" ${i===0?'class="active"':''}></button>`).join('');
    Array.from(dots.children).forEach((btn, i) => btn.addEventListener('click', () => go(i)));
  }

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index*100}%)`;
    Array.from(dots.children).forEach((d, di) => d.classList.toggle('active', di === index));
  }

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  renderDots();
  setInterval(() => go(index + 1), 6000);
}());
