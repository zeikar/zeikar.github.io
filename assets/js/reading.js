// Post and project pages: a copy button on code blocks, a # link on each
// section heading, and click-to-enlarge images. Styles in _sass/_reading.scss.
(() => {
  const body = document.querySelector('.post-content, .project-content');
  if (!body) {
    return;
  }

  const ko = document.documentElement.lang === 'ko';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Copy buttons. The button sits on the block's wrapper, not the <pre>,
  // so it stays put while a long line scrolls sideways.
  const label = { copy: ko ? '복사' : 'Copy', done: ko ? '복사됨' : 'Copied', select: ko ? '선택됨' : 'Selected' };

  body.querySelectorAll('pre').forEach((pre) => {
    const host = pre.closest('.highlight') || pre;
    const code = pre.querySelector('code') || pre;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = label.copy;
    button.setAttribute('aria-live', 'polite');
    host.classList.add('has-copy');
    host.append(button);

    let reset = 0;
    const show = (text) => {
      button.textContent = text;
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        button.textContent = label.copy;
      }, 1600);
    };

    button.addEventListener('click', () => {
      navigator.clipboard.writeText(code.innerText.replace(/\n$/, '')).then(
        () => show(label.done),
        // No clipboard access (an insecure origin, a denied permission):
        // select the code instead, so a ⌘C / Ctrl+C finishes the job.
        () => {
          window.getSelection().selectAllChildren(code);
          show(label.select);
        },
      );
    });
  });

  // A "#" after each section heading, linking to it.
  body.querySelectorAll('h2[id], h3[id]').forEach((heading) => {
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${heading.id}`;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', ko ? `이 섹션 링크: ${heading.textContent}` : `Link to this section: ${heading.textContent}`);
    heading.append(anchor);
  });

  // Enlarge an image shown smaller than it is. The picture grows out of its
  // place in the page (a view transition) where the browser can.
  const images = Array.from(document.querySelectorAll('.project-image img, .post-content img, .project-content img'))
    .filter((img) => !img.closest('a'));
  if (images.length === 0) {
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'zoom';
  dialog.setAttribute('aria-label', ko ? '확대한 이미지' : 'Enlarged image');
  const big = document.createElement('img');
  big.alt = '';
  dialog.append(big);
  document.body.append(dialog);

  let opener = null;

  // Runs `change` inside a view transition when there is one; returns the
  // transition, or null when the change just happened.
  const transition = (change) => {
    if (reduceMotion || !document.startViewTransition) {
      change();
      return null;
    }
    return document.startViewTransition(change);
  };

  const open = (img) => {
    opener = img;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    img.style.viewTransitionName = 'zoom';
    transition(async () => {
      img.style.viewTransitionName = '';
      big.style.viewTransitionName = 'zoom';
      dialog.showModal();
      // The new frame is captured once this resolves; decode first, or the
      // big copy flies in blank.
      await big.decode();
    });
  };

  const close = () => {
    if (!dialog.open) {
      return;
    }
    const landed = () => {
      opener.style.viewTransitionName = '';
      opener.focus();
    };
    const flight = transition(() => {
      big.style.viewTransitionName = '';
      opener.style.viewTransitionName = 'zoom';
      dialog.close();
    });
    if (flight) {
      flight.finished.then(landed);
    } else {
      landed();
    }
  };

  dialog.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  images.forEach((img) => {
    const enlargeable = () => img.naturalWidth > img.clientWidth * 1.15;
    const arm = () => {
      if (!enlargeable()) {
        return;
      }
      img.classList.add('is-zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `${ko ? '크게 보기' : 'Enlarge'}: ${img.alt}`);
    };
    if (img.complete) {
      arm();
    } else {
      img.addEventListener('load', arm, { once: true });
    }

    img.addEventListener('click', () => {
      if (img.classList.contains('is-zoomable')) {
        open(img);
      }
    });
    img.addEventListener('keydown', (event) => {
      if (img.classList.contains('is-zoomable') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        open(img);
      }
    });
  });
})();
