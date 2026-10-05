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

  // Project and post pages: mark the section being read in the sticky
  // contents list (_includes/toc.html).
  const tocLinks = Array.from(document.querySelectorAll('.toc a'));

  if (tocLinks.length > 0) {
    const headings = tocLinks.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))));
    let queued = false;
    // A clicked (or linked-to) entry stays marked until the reader scrolls on
    // their own: a short last section never reaches the line that picks one.
    let pinned = tocLinks.findIndex((link) => link.hash === window.location.hash);

    const markCurrent = () => {
      queued = false;
      // The last heading past the top third of the window, or the last one
      // once the page bottoms out, since a short final section never gets there.
      const line = window.innerHeight / 3;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = -1;
      headings.forEach((heading, i) => {
        if (heading && heading.getBoundingClientRect().top <= line) {
          current = i;
        }
      });
      if (atBottom) {
        current = headings.length - 1;
      }
      if (pinned >= 0) {
        current = pinned;
      }

      tocLinks.forEach((link, i) => {
        if (i === current) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    window.addEventListener('scroll', () => {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(markCurrent);
      }
    }, { passive: true });

    tocLinks.forEach((link, i) => {
      link.addEventListener('click', () => {
        pinned = i;
        markCurrent();
      });
    });
    ['wheel', 'touchstart', 'keydown'].forEach((type) => {
      window.addEventListener(type, () => {
        pinned = -1;
      }, { passive: true });
    });
    markCurrent();
  }

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

      // A drag that selected some of the card's text isn't a click on it.
      if (String(window.getSelection())) {
        return;
      }

      // Cmd/Ctrl/Shift-click opens a new tab, as it would on a real link.
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        window.open(url, '_blank', 'noopener');
        return;
      }

      window.location.href = url;
    });
  });
});
