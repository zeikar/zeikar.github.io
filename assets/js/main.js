document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.getElementById('primary-nav');

  if (navToggle && primaryNav) {
    const closeNav = () => {
      navToggle.setAttribute('aria-expanded', 'false');
      primaryNav.classList.remove('is-open');
    };

    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
    });

    primaryNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!primaryNav.contains(target) && !navToggle.contains(target)) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !primaryNav.classList.contains('is-open')) {
        return;
      }

      closeNav();
      navToggle.focus();
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') {
        return;
      }

      const target = document.querySelector(href);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const blogFilter = document.querySelector('.blog-filter');
  const blogList = document.querySelector('.blog-list');
  const blogEmptyStates = document.querySelectorAll('.blog-empty[data-empty-for]');

  if (blogFilter && blogList) {
    const applyFilter = (lang) => {
      blogList.dataset.active = lang;
      blogFilter.querySelectorAll('.blog-filter-btn').forEach((b) => {
        const active = b.dataset.filter === lang;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      const visibleCount = blogList.querySelectorAll(`.blog-card[data-lang="${lang}"]`).length;
      blogEmptyStates.forEach((p) => {
        p.hidden = !(p.dataset.emptyFor === lang && visibleCount === 0);
      });
    };

    blogFilter.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-filter]');
      if (!btn) {
        return;
      }
      applyFilter(btn.dataset.filter);
    });

    applyFilter(blogList.dataset.active || 'en');
  }

  const resumeName = document.querySelector('[data-resume-name]');

  if (resumeName) {
    const defaultName = resumeName.textContent;
    const defaultTitle = document.title;

    const applyName = () => {
      const name = (new URLSearchParams(window.location.hash.slice(1)).get('name') || '').trim();
      resumeName.textContent = name || defaultName;
    };

    applyName();
    // Typing #name=… into the address bar of an open page doesn't reload it.
    window.addEventListener('hashchange', applyName);

    // Chrome and Safari use the document title as the Save-as-PDF file name.
    window.addEventListener('beforeprint', () => {
      document.title = `${resumeName.textContent}_${resumeName.dataset.pdfTitle}`;
    });
    window.addEventListener('afterprint', () => {
      document.title = defaultTitle;
    });
  }

  document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  const interactiveSelector = 'a, button, input, textarea, select, label';
  const projectCards = document.querySelectorAll('.project-card[data-project-url]');

  projectCards.forEach((card) => {
    const url = card.getAttribute('data-project-url');
    if (!url) {
      return;
    }

    // Mouse convenience only: keyboard and screen-reader users get the card's
    // title link, so the card itself is not a focusable control.
    card.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(interactiveSelector)) {
        return;
      }

      window.location.href = url;
    });
  });
});
