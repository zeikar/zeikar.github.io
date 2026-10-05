// About logo: the >_< face turns toward the mouse and flinches when poked.
// The poke itself is CSS (.is-poked in _sass/_about.scss).
(() => {
  const logo = document.querySelector('.about-logo');
  if (!logo) {
    return;
  }

  const face = logo.querySelector('.logo-face');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  logo.addEventListener('pointerdown', () => {
    // Re-adding the class restarts the flinch when poked again mid-flinch,
    // but only after a reflow commits the removal.
    logo.classList.remove('is-poked');
    void logo.getBoundingClientRect();
    logo.classList.add('is-poked');
  });

  logo.addEventListener('animationend', (event) => {
    if (event.target === logo) {
      logo.classList.remove('is-poked');
    }
  });

  if (reduceMotion) {
    return;
  }

  // How far the features slide toward the cursor, in viewBox units, and how
  // far away (in CSS px) the cursor must be for the full slide.
  const REACH = 30;
  const FULL_AT = 360;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let raf = 0;

  // A mouse only: a finger has no hover to follow.
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    const rect = logo.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(dist / FULL_AT, 1) * REACH;
    targetX = (dx / dist) * reach;
    targetY = (dy / dist) * reach;
    look();
  });

  document.documentElement.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
    look();
  });

  function look() {
    if (!raf) {
      raf = window.requestAnimationFrame(step);
    }
  }

  function step() {
    x += (targetX - x) * 0.16;
    y += (targetY - y) * 0.16;
    face.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const moving = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.05;
    raf = moving ? window.requestAnimationFrame(step) : 0;
  }
})();
