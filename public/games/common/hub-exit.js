// Shared hub exit control — included by every game page.
// Button top-left + Escape pressed twice quickly (within 600ms) to avoid
// hijacking single-Esc game menus (e.g. DOOM).
(() => {
  const b = document.createElement('button');
  b.textContent = '⬅ HUB';
  b.title = 'Back to Game Hub (press Esc twice)';
  Object.assign(b.style, {
    position: 'fixed', top: '10px', left: '10px', zIndex: 9999,
    padding: '7px 14px', borderRadius: '10px', border: '1px solid #3a3552',
    background: 'rgba(20, 17, 30, .82)', color: '#c7cbe0',
    font: '700 12px/1 system-ui, sans-serif', letterSpacing: '1px',
    cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'filter .15s, transform .15s',
  });
  b.onmouseenter = () => { b.style.filter = 'brightness(1.4)'; b.style.transform = 'translateY(-1px)'; };
  b.onmouseleave = () => { b.style.filter = ''; b.style.transform = ''; };
  b.onclick = () => { location.href = '/'; };
  document.body.appendChild(b);

  let lastEsc = 0;
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const now = Date.now();
    if (now - lastEsc < 600) location.href = '/';
    lastEsc = now;
  });
})();
