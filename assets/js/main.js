// Cross-page tape (view transition, _layout.scss): the tape that was clicked
// carries view-transition-name: unit-title, so the project page's title tape
// grows out of it. Only one element may hold a name, so naming one clears the
// last. Outside DOMContentLoaded: pagereveal can fire before it.
let namedTape = null;

const nameTape = (tape) => {
  if (namedTape) {
    namedTape.style.viewTransitionName = '';
  }
  namedTape = tape || null;
  if (namedTape) {
    namedTape.style.viewTransitionName = 'unit-title';
  }
};

document.addEventListener('click', (event) => {
  // A thrown bench tape cancels its click; a modifier opens a new tab.
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }
  const link = event.target instanceof Element ? event.target.closest('a[href*="/projects/"]') : null;
  if (link) {
    nameTape(link.classList.contains('tape') ? link : link.querySelector('.tape'));
  }
});

// Back from a page restored from the back/forward cache, nothing is mid-flight.
window.addEventListener('pageshow', () => nameTape(null));

// Coming back from a project page, its title tape flies back into its card.
// Only that case reads event.viewTransition: Chrome reports a transition it
// skipped as an error once the page has touched it.
window.addEventListener('pagereveal', (event) => {
  const from = window.navigation && window.navigation.activation && window.navigation.activation.from;
  const match = from && from.url && new URL(from.url).pathname.match(/^\/projects\/([^/]+)\/$/);
  const card = match && document.getElementById(`unit-${match[1]}`);
  const transition = card && event.viewTransition;
  if (transition) {
    nameTape(card.querySelector('.project-name .tape'));
    transition.finished.finally(() => nameTape(null));
  }
});

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

  // "Back to projects" is Back when the page before this one was home: home
  // returns as it was left (scroll, the bench) and the title tape flies back
  // into its card, which a fresh load of /#unit-… doesn't do. Otherwise
  // (a direct visit, a new tab) the link goes to the card.
  const backLink = document.querySelector('.back-link');

  const homeBehind = () => {
    const isHome = (url) => {
      const parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin && parsed.pathname === '/';
    };

    if (window.navigation && typeof window.navigation.entries === 'function') {
      const entries = window.navigation.entries();
      // Step over this page's own #section entries from the contents list.
      for (let i = window.navigation.currentEntry.index - 1; i >= 0; i -= 1) {
        if (new URL(entries[i].url).pathname !== window.location.pathname) {
          const key = entries[i].key;
          return isHome(entries[i].url) ? () => window.navigation.traverseTo(key) : null;
        }
      }
      return null;
    }

    // No Navigation API: trust the referrer, unless a #section hop on this
    // page sits between it and here.
    if (document.referrer && isHome(document.referrer) && !window.location.hash && window.history.length > 1) {
      return () => window.history.back();
    }
    return null;
  };

  if (backLink) {
    backLink.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const goBack = homeBehind();
      if (goBack) {
        event.preventDefault();
        goBack();
      }
    });
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

      nameTape(card.querySelector('.project-name .tape'));
      window.location.href = url;
    });
  });
});
