// Home hero bench: the unit tapes fall onto it in build order and can be
// grabbed and thrown. Matter.js 0.20.0 (assets/js/matter.min.js) runs the
// physics; the tapes stay real links, moved with CSS transforms.
(() => {
  const el = document.querySelector('[data-bench]');
  if (!el || !window.Matter) {
    return;
  }

  const { Engine, Bodies, Body, Composite, Constraint, Sleeping, Events } = window.Matter;
  const readout = document.querySelector('[data-bench-readout]');
  const countEl = document.querySelector('[data-count]');
  const liveEl = document.querySelector('[data-live]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STEP = 1000 / 60;
  const WALL = 400;
  // Open-topped as far as the eye can see: a tape thrown up comes back down.
  const CEILING = -2400;
  // Faster than this and a thrown tape can pass through a thin one.
  const MAX_SPEED = 42;

  const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  engine.gravity.y = 1.1;

  const items = Array.from(el.querySelectorAll('.bench-tape'), (a) => ({
    a,
    no: Number(a.dataset.no),
    title: a.textContent.trim(),
    live: Boolean(a.querySelector('.tape-live')),
    w: 0,
    h: 0,
    body: null,
  }));

  let W = 0;
  let H = 0;
  let walls = [];
  let dropped = 0;
  let drag = null;
  let justDragged = null;
  let visible = true;
  let raf = 0;
  let last = 0;
  let acc = 0;

  el.hidden = false;
  readout.hidden = false;
  const defaultReadout = readout.textContent.trim();

  // Tape widths depend on the condensed web font, so measure after it loads.
  document.fonts.ready.then(start);

  function start() {
    measure();

    if (reduceMotion) {
      items.forEach((_, i) => drop(i));
      for (let i = 0; i < 900; i += 1) {
        Engine.update(engine, STEP);
      }
      render();
    } else {
      countEl.textContent = '0';
      liveEl.textContent = '0';
      items.forEach((_, i) => {
        window.setTimeout(() => {
          drop(i);
          kick();
        }, 300 + i * 90);
      });
    }

    Events.on(engine, 'beforeUpdate', limitSpeed);
    el.addEventListener('pointerdown', grab);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('click', click);
    el.addEventListener('pointerover', hover);
    el.addEventListener('pointerout', unhover);

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        kick();
      }
    }, { rootMargin: '400px 0px' }).observe(el);

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relayout, 120);
    });
  }

  function measure() {
    items.forEach((it) => {
      it.w = it.a.offsetWidth;
      it.h = it.a.offsetHeight;
    });
    W = el.clientWidth;
    // Sized to a typical settled pile, so a phone doesn't get a tall empty
    // bench. A tape left standing on end may poke above it; nothing clips.
    const area = items.reduce((sum, it) => sum + it.w * it.h, 0);
    H = Math.round(Math.min(400, Math.max(180, (area / W) * 1.6 + 40)));
    el.style.height = `${H}px`;
    buildWalls();
  }

  function buildWalls() {
    Composite.remove(engine.world, walls);
    const wallH = H - CEILING + 2 * WALL;
    const wallY = (H + CEILING) / 2;
    const opts = { isStatic: true, friction: 0.6 };
    walls = [
      Bodies.rectangle(W / 2, H + WALL / 2, W + 2 * WALL, WALL, opts),
      Bodies.rectangle(-WALL / 2, wallY, WALL, wallH, opts),
      Bodies.rectangle(W + WALL / 2, wallY, WALL, wallH, opts),
      Bodies.rectangle(W / 2, CEILING - WALL / 2, W + 2 * WALL, WALL, opts),
    ];
    Composite.add(engine.world, walls);
  }

  function makeBody(it, x, y, angle) {
    return Bodies.rectangle(x, y, it.w, it.h, {
      angle,
      chamfer: { radius: 2 },
      friction: 0.5,
      frictionStatic: 0.9,
      restitution: 0.12,
      density: 0.0016,
    });
  }

  // Drops from just above the viewport, so the tape falls past the headline.
  // A small tilt keeps most tapes landing the right way up.
  function drop(i) {
    const it = items[i];
    const top = Math.max(el.getBoundingClientRect().top, 0);
    const x = it.w / 2 + Math.random() * Math.max(W - it.w, 1);
    const y = Math.max(-top - it.h - 20 - Math.random() * 100, CEILING + it.h);
    it.body = makeBody(it, x, y, (Math.random() - 0.5) * 0.5);
    Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.02);
    Composite.add(engine.world, it.body);
    it.a.classList.add('is-dropped');
    dropped = i + 1;
    countEl.textContent = String(dropped);
    liveEl.textContent = String(items.slice(0, dropped).filter((unit) => unit.live).length);
  }

  function relayout() {
    const before = items.map((it) => `${it.w}x${it.h}`).join();
    measure();
    const resized = items.map((it) => `${it.w}x${it.h}`).join() !== before;

    items.forEach((it) => {
      if (!it.body) {
        return;
      }
      const x = Math.min(Math.max(it.body.position.x, it.w / 2), W - it.w / 2);
      const y = Math.min(it.body.position.y, H - it.h / 2);
      if (resized) {
        Composite.remove(engine.world, it.body);
        it.body = makeBody(it, x, y, it.body.angle);
        Composite.add(engine.world, it.body);
      } else {
        Body.setPosition(it.body, { x, y });
        Sleeping.set(it.body, false);
      }
    });

    render();
    kick();
  }

  function limitSpeed() {
    items.forEach(({ body }) => {
      if (!body) {
        return;
      }
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > MAX_SPEED) {
        Body.setVelocity(body, {
          x: (body.velocity.x / speed) * MAX_SPEED,
          y: (body.velocity.y / speed) * MAX_SPEED,
        });
      }
    });
  }

  function render() {
    items.forEach(({ a, body, w, h }) => {
      if (!body) {
        return;
      }
      const x = (body.position.x - w / 2).toFixed(2);
      const y = (body.position.y - h / 2).toFixed(2);
      a.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle.toFixed(4)}rad)`;
    });
  }

  function settled() {
    return !drag && dropped === items.length && items.every(({ body }) => body.isSleeping);
  }

  // Fixed 60 Hz steps, so a 120 Hz screen doesn't run the pile at double speed.
  function frame(t) {
    raf = 0;
    if (!last) {
      last = t;
    }
    acc += Math.min(t - last, 100);
    last = t;
    while (acc >= STEP) {
      Engine.update(engine, STEP);
      acc -= STEP;
    }
    render();

    // Stops once the pile is asleep or off screen; a grab or a click wakes it.
    if (visible && !settled()) {
      raf = window.requestAnimationFrame(frame);
    } else {
      last = 0;
      acc = 0;
    }
  }

  function kick() {
    if (!raf && visible) {
      raf = window.requestAnimationFrame(frame);
    }
  }

  function local(event) {
    const rect = el.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function itemFor(target) {
    const a = target instanceof Element ? target.closest('.bench-tape') : null;
    return a ? items.find((it) => it.a === a) : null;
  }

  function grab(event) {
    if (event.button !== 0 || drag) {
      return;
    }
    const it = itemFor(event.target);
    if (!it || !it.body) {
      return;
    }

    event.preventDefault();
    const p = local(event);
    Sleeping.set(it.body, false);
    const constraint = Constraint.create({
      pointA: p,
      bodyB: it.body,
      pointB: { x: p.x - it.body.position.x, y: p.y - it.body.position.y },
      stiffness: 0.2,
      damping: 0.08,
      length: 0,
    });
    Composite.add(engine.world, constraint);
    drag = { it, constraint, start: p, moved: false, id: event.pointerId };
    it.a.setPointerCapture(event.pointerId);
    it.a.classList.add('is-held');
    show(it);
    kick();
  }

  function move(event) {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }
    const p = local(event);
    // Keep the pull inside the walls, or a hard drag shoves the tape through.
    drag.constraint.pointA = {
      x: Math.min(Math.max(p.x, 0), W),
      y: Math.min(Math.max(p.y, CEILING + 200), H),
    };
    if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 5) {
      drag.moved = true;
    }
    kick();
  }

  function release(event) {
    if (!drag || event.pointerId !== drag.id) {
      return;
    }
    Composite.remove(engine.world, drag.constraint);
    drag.it.a.classList.remove('is-held');
    justDragged = drag.moved ? drag.it : null;
    drag = null;
    kick();
  }

  // A throw ends in a click on the tape; only a press that stayed put opens it.
  function click(event) {
    const it = itemFor(event.target);
    if (it) {
      if (it === justDragged) {
        event.preventDefault();
      }
      justDragged = null;
      return;
    }
    burst(local(event));
  }

  // Clicking the bare bench jolts the tapes near the click.
  function burst(p) {
    const RADIUS = 260;
    items.forEach(({ body }) => {
      if (!body) {
        return;
      }
      const dx = body.position.x - p.x;
      const dy = body.position.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > RADIUS) {
        return;
      }
      const k = 1 - dist / RADIUS;
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: body.velocity.x + (dx / dist) * 9 * k,
        y: body.velocity.y - 14 * k - Math.random() * 4,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3 * k);
    });
    kick();
  }

  function show(it) {
    const name = document.createElement('b');
    name.textContent = it.title;
    readout.replaceChildren(name, `, unit ${it.no}.${it.live ? ' Live demo.' : ''}`);
  }

  function hover(event) {
    const it = itemFor(event.target);
    if (it && !drag) {
      show(it);
    }
  }

  function unhover(event) {
    if (itemFor(event.target) && !drag) {
      readout.textContent = defaultReadout;
    }
  }
})();
