document.addEventListener('DOMContentLoaded', () => {
  const siteHeader = document.getElementById('site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.getElementById('primary-nav');

  const setHeaderState = () => {
    if (!siteHeader) {
      return;
    }

    if (window.scrollY > 10) {
      siteHeader.classList.add('is-scrolled');
    } else {
      siteHeader.classList.remove('is-scrolled');
    }
  };

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
    });

    primaryNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navToggle.setAttribute('aria-expanded', 'false');
        primaryNav.classList.remove('is-open');
      });
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (!primaryNav.contains(target) && !navToggle.contains(target)) {
        navToggle.setAttribute('aria-expanded', 'false');
        primaryNav.classList.remove('is-open');
      }
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

  projectCards.forEach((card, index) => {
    card.style.transitionDelay = `${Math.min(index * 45, 260)}ms`;

    const url = card.getAttribute('data-project-url');
    if (!url) {
      return;
    }

    const openProject = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(interactiveSelector)) {
        return;
      }

      window.location.href = url;
    };

    card.addEventListener('click', openProject);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openProject(event);
      }
    });
  });

  const revealNodes = document.querySelectorAll('.reveal');
  if (!revealNodes.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('in-view');
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: '0px 0px -8% 0px',
    },
  );

  revealNodes.forEach((node, index) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (!node.style.transitionDelay) {
      node.style.transitionDelay = `${Math.min(index * 32, 260)}ms`;
    }

    observer.observe(node);
  });
});
