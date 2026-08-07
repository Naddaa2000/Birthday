(() => {
  "use strict";

  const CANDLE_COUNT = 6;
  const MAX_BALLOONS = 12;

  // UI chrome only — party content (name, wishes, cake line) comes from .env via /api/config
  const THEME_META = {
    batman: {
      mark: "🦇",
      tag: "GOTHAM EDITION",
      footer: "Batman · Gotham",
      intro: "GOTHAM LOADING",
    },
    spiderman: {
      mark: "🕷️",
      tag: "QUEENS EDITION",
      footer: "Spider-Man · Queens",
      intro: "QUEENS LOADING",
    },
    wonder: {
      mark: "⚔️",
      tag: "THEMYSCIRA EDITION",
      footer: "Wonder · Themyscira",
      intro: "THEMYSCIRA LOADING",
    },
    catwoman: {
      mark: "🐈‍⬛",
      tag: "EAST END EDITION",
      footer: "Catwoman · East End",
      intro: "EAST END LOADING",
    },
  };

  const ACHIEVE_LABELS = {
    photo: "Face locked on skin",
    candles: "All candles out",
    balloons: "Every balloon burst",
    seal: "Night sealed & emailed",
  };

  const BALLOON_COLORS = [
    "var(--b1)",
    "var(--b2)",
    "var(--b3)",
    "var(--b4)",
    "var(--b5)",
    "var(--b6)",
  ];

  const state = {
    theme: "batman",
    candlesOut: 0,
    balloonsLeft: 0,
    wishes: [],
    collectedBalloonWishes: [],
    candleWishes: Array(CANDLE_COUNT).fill(""),
    customCakeWish: "",
    achievements: new Set(),
    name: "",
    age: null,
    from: "",
    wishesCount: 0,
    pendingCandle: null,
    sealed: false,
    pendingSeal: false,
    awaitingSealAfterWish: false,
  };

  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const body = document.body;
  const heroName = document.getElementById("heroName");
  const heroSub = document.getElementById("heroSub");
  const introTitle = document.getElementById("introTitle");
  const introTag = document.getElementById("introTag");
  const brandMark = document.getElementById("brandMark");
  const brandTag = document.getElementById("brandTag");
  const candlesEl = document.getElementById("candles");
  const cakeEl = document.getElementById("cake");
  const cakeStatus = document.getElementById("cakeStatus");
  const candleBar = document.getElementById("candleBar");
  const cakeWish = document.getElementById("cakeWish");
  const btnRelight = document.getElementById("btnRelight");
  const balloonSky = document.getElementById("balloonSky");
  const balloonStat = document.getElementById("balloonStat");
  const balloonBar = document.getElementById("balloonBar");
  const wishToast = document.getElementById("wishToast");
  const wishToastText = document.getElementById("wishToastText");
  const btnRefill = document.getElementById("btnRefill");
  const photoInput = document.getElementById("photoInput");
  const photoSlot = document.getElementById("photoSlot");
  const photoPlaceholder = document.getElementById("photoPlaceholder");
  const mcHead = document.getElementById("mcHead");
  const nameInput = document.getElementById("nameInput");
  const ageInput = document.getElementById("ageInput");
  const fromInput = document.getElementById("fromInput");
  const xpLine = document.getElementById("xpLine");
  const toastText = document.getElementById("toastText");
  const footerTheme = document.getElementById("footerTheme");
  const achievePop = document.getElementById("achievePop");
  const achieveText = document.getElementById("achieveText");
  const fxLayer = document.getElementById("fxLayer");
  const intro = document.getElementById("intro");
  const candleModal = document.getElementById("candleModal");
  const candleWishForm = document.getElementById("candleWishForm");
  const candleWishInput = document.getElementById("candleWishInput");
  const candleNum = document.getElementById("candleNum");
  const candleWishList = document.getElementById("candleWishList");
  const sealModal = document.getElementById("sealModal");
  const sealForm = document.getElementById("sealForm");
  const sealStatus = document.getElementById("sealStatus");

  function normalizeTheme(raw) {
    const t = String(raw || "")
      .toLowerCase()
      .trim();
    if (t === "spiderman" || t === "spider-man" || t === "spider")
      return "spiderman";
    if (
      t === "wonder" ||
      t === "wonderwoman" ||
      t === "wonder-woman" ||
      t === "ww"
    )
      return "wonder";
    if (
      t === "catwoman" ||
      t === "cat-woman" ||
      t === "cat" ||
      t === "selina"
    )
      return "catwoman";
    if (t === "batman" || t === "bat") return "batman";
    return "batman";
  }

  function applyConfig(cfg) {
    const theme = normalizeTheme(cfg.theme);
    const fromEnv = Array.isArray(cfg.wishes)
      ? cfg.wishes.map((w) => String(w).trim()).filter(Boolean)
      : [];

    let wishesCount = Number(cfg.wishesCount);
    if (!Number.isFinite(wishesCount) || wishesCount < 1) {
      wishesCount = fromEnv.length;
    }
    wishesCount = Math.min(MAX_BALLOONS, Math.max(0, wishesCount));

    const wishes = [];
    if (fromEnv.length) {
      for (let i = 0; i < wishesCount; i++) {
        wishes.push(fromEnv[i % fromEnv.length]);
      }
    }

    state.theme = theme;
    state.name = (cfg.name || "").trim();
    state.from = (cfg.from || "").trim();
    state.age =
      cfg.age != null && Number.isFinite(Number(cfg.age))
        ? Number(cfg.age)
        : null;
    state.wishesCount = wishes.length;
    state.wishes = wishes;
    state.balloonsLeft = wishes.length;
    state.customCakeWish = (cfg.cakeWish || "").trim();

    nameInput.value = state.name;
    fromInput.value = state.from;
    ageInput.value = state.age != null ? String(state.age) : "";

    setTheme(theme);
    updateHero();
    updateXp();
    buildCandles(true);
    buildBalloons();
    renderCandleLog();

    document.title = state.name
      ? `Origin Night — ${state.name}`
      : "Origin Night — Happy Birthday";
  }

  function setTheme(theme) {
    state.theme = theme;
    body.classList.remove(
      "theme-batman",
      "theme-spiderman",
      "theme-wonder",
      "theme-catwoman",
    );
    body.classList.add(`theme-${theme}`);
    body.dataset.theme = theme;
    const meta = THEME_META[theme] || THEME_META.batman;
    brandMark.textContent = meta.mark;
    brandTag.textContent = meta.tag;
    footerTheme.textContent = meta.footer;
    introTag.textContent = meta.intro;
    spawnSkyLife(theme);
  }

  const BAT_SVG = `<svg viewBox="0 0 64 28" fill="currentColor" aria-hidden="true"><path d="M32 16c-2-6-4-10-6-12 1 4 1 8 0 11-4-3-9-6-14-7 5 3 8 7 9 12-5-1-10-1-15 1 6 1 11 4 14 8 2-3 4-5 6-5s4 2 6 5c3-4 8-7 14-8-5-2-10-2-15-1 1-5 4-9 9-12-5 1-10 4-14 7-1-3-1-7 0-11-2 2-4 6-6 12z"/></svg>`;

  const CAT_SVG = `<svg viewBox="0 0 64 28" fill="currentColor" aria-hidden="true"><path d="M8 18c2-6 6-10 10-11 1 3 1 6 0 8 3-2 7-3 11-3s8 1 11 3c-1-2-1-5 0-8 4 1 8 5 10 11-3-1-6 0-8 2-2-2-5-3-8-3h-10c-3 0-6 1-8 3-2-2-5-3-8-2zm6-8 3-6 2 5m26 1 2-5 3 6"/></svg>`;

  function spawnSkyLife(theme) {
    const layer = document.getElementById("skyLife");
    if (!layer) return;
    layer.innerHTML = "";

    if (theme === "batman") {
      const count = 7;
      for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = "sky-bat";
        el.innerHTML = BAT_SVG;
        const top = 8 + Math.random() * 32;
        const dur = 9 + Math.random() * 10;
        const delay = -Math.random() * dur;
        const scale = 0.75 + Math.random() * 0.85;
        el.style.top = `${top}%`;
        el.style.left = "0";
        el.style.setProperty("--s", String(scale));
        el.style.setProperty("--o", String(0.55 + Math.random() * 0.35));
        el.style.setProperty("--bob", `${(Math.random() - 0.5) * 20}px`);
        el.style.setProperty("--arc", `${-12 - Math.random() * 30}px`);
        el.style.animationDuration = `${dur}s`;
        el.style.animationDelay = `${delay}s`;
        const svg = el.querySelector("svg");
        if (svg) {
          svg.style.animationDuration = `${0.2 + Math.random() * 0.14}s`;
        }
        layer.appendChild(el);
      }
      return;
    }

    if (theme === "wonder") {
      for (let i = 0; i < 6; i++) {
        const line = document.createElement("div");
        line.className = "sky-lasso";
        line.style.top = `${10 + Math.random() * 42}%`;
        line.style.left = `${4 + Math.random() * 40}%`;
        line.style.width = `${120 + Math.random() * 180}px`;
        line.style.setProperty("--ang", `${-24 + Math.random() * 40}deg`);
        line.style.animationDuration = `${6 + Math.random() * 7}s`;
        line.style.animationDelay = `${-Math.random() * 9}s`;
        layer.appendChild(line);
      }
      for (let i = 0; i < 10; i++) {
        const star = document.createElement("div");
        star.className = "sky-star";
        star.style.top = `${5 + Math.random() * 40}%`;
        star.style.left = `${10 + Math.random() * 70}%`;
        star.style.animationDuration = `${8 + Math.random() * 10}s`;
        star.style.animationDelay = `${-Math.random() * 12}s`;
        layer.appendChild(star);
      }
      return;
    }

    if (theme === "catwoman") {
      for (let i = 0; i < 6; i++) {
        const el = document.createElement("div");
        el.className = "sky-cat";
        el.innerHTML = CAT_SVG;
        el.style.top = `${8 + Math.random() * 34}%`;
        el.style.left = "0";
        el.style.setProperty("--s", String(0.7 + Math.random() * 0.9));
        el.style.setProperty("--o", String(0.5 + Math.random() * 0.35));
        el.style.setProperty("--bob", `${(Math.random() - 0.5) * 18}px`);
        el.style.setProperty("--arc", `${8 + Math.random() * 24}px`);
        const dur = 11 + Math.random() * 12;
        el.style.animationDuration = `${dur}s`;
        el.style.animationDelay = `${-Math.random() * dur}s`;
        layer.appendChild(el);
      }
      return;
    }

    // Spider-Man — web casts + swing trails
    for (let i = 0; i < 8; i++) {
      const line = document.createElement("div");
      line.className = "sky-web-line";
      line.style.top = `${8 + Math.random() * 45}%`;
      line.style.left = `${2 + Math.random() * 50}%`;
      line.style.width = `${140 + Math.random() * 200}px`;
      line.style.setProperty("--ang", `${-30 + Math.random() * 48}deg`);
      line.style.animationDuration = `${5 + Math.random() * 6}s`;
      line.style.animationDelay = `${-Math.random() * 8}s`;
      layer.appendChild(line);
    }
    for (let i = 0; i < 4; i++) {
      const swing = document.createElement("div");
      swing.className = "sky-swing";
      swing.style.top = `${8 + i * 14}%`;
      swing.style.setProperty("--dip", `${40 + Math.random() * 55}px`);
      swing.style.animationDuration = `${8 + Math.random() * 7}s`;
      swing.style.animationDelay = `${-Math.random() * 10}s`;
      layer.appendChild(swing);
    }
  }

  function updateHero() {
    const n = state.name.trim();
    const title = n ? `Happy Birthday, ${n}` : "Happy Birthday";
    heroName.textContent = title;
    if (introTitle) introTitle.textContent = title;
    const from = state.from.trim();
    heroSub.textContent = from
      ? `From ${from} · Blow out · Wish · Burst · Seal`
      : "Blow out · Wish · Burst · Seal";
  }

  function updateXp() {
    xpLine.textContent =
      state.age && state.age >= 18 ? String(state.age) : "—";
  }

  function updateBars() {
    const lit = CANDLE_COUNT - state.candlesOut;
    cakeStatus.textContent = `${lit}/${CANDLE_COUNT}`;
    candleBar.style.transform = `scaleX(${lit / CANDLE_COUNT})`;
    balloonStat.textContent = String(state.balloonsLeft);
    balloonBar.style.transform = `scaleX(${
      state.balloonsLeft / Math.max(state.wishesCount, 1)
    })`;
  }

  function renderCandleLog() {
    candleWishList.innerHTML = "";
    state.candleWishes.forEach((w, i) => {
      if (!w && i >= state.candlesOut) return;
      const li = document.createElement("li");
      li.textContent = w || "(silent)";
      candleWishList.appendChild(li);
    });
  }

  function buildCandles(lit = true) {
    candlesEl.innerHTML = "";
    state.candlesOut = lit ? 0 : CANDLE_COUNT;
    if (lit) state.candleWishes = Array(CANDLE_COUNT).fill("");

    for (let i = 0; i < CANDLE_COUNT; i++) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = lit ? "candle" : "candle out";
      c.dataset.index = String(i);
      c.setAttribute("aria-label", `Candle ${i + 1}`);
      if (lit) {
        const flame = document.createElement("span");
        flame.className = "flame";
        c.appendChild(flame);
      }
      c.addEventListener("click", () => openCandleWish(c));
      candlesEl.appendChild(c);
    }

    updateBars();
    cakeWish.hidden = true;
    btnRelight.hidden = lit;
    renderCandleLog();
  }

  function openCandleWish(candle) {
    if (candle.classList.contains("out")) return;
    state.pendingCandle = candle;
    candleNum.textContent = String(Number(candle.dataset.index) + 1);
    candleWishInput.value = "";
    candleModal.showModal();
    setTimeout(() => candleWishInput.focus(), 50);
  }

  function extinguishCandle(wishText) {
    const candle = state.pendingCandle;
    if (!candle || candle.classList.contains("out")) return;

    const idx = Number(candle.dataset.index);
    state.candleWishes[idx] = wishText;
    state.pendingCandle = null;

    candle.classList.add("out");
    const flame = candle.querySelector(".flame");
    if (flame) {
      flame.addEventListener(
        "animationend",
        () => {
          flame.remove();
          const smoke = document.createElement("span");
          smoke.className = "smoke";
          candle.appendChild(smoke);
          setTimeout(() => smoke.remove(), 1000);
        },
        { once: true }
      );
    }

    state.candlesOut += 1;
    updateBars();
    renderCandleLog();
    playWhoosh();

    if (state.candlesOut >= CANDLE_COUNT) onAllCandlesOut();
  }

  candleWishForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = candleWishInput.value.trim();
    if (!text) return;
    candleModal.close();
    extinguishCandle(text);
  });

  document.getElementById("btnSkipCandle").addEventListener("click", () => {
    candleModal.close();
    extinguishCandle("");
  });

  function onAllCandlesOut() {
    cakeWish.textContent =
      state.customCakeWish.trim() || "Wish sealed.";
    cakeWish.hidden = false;
    cakeEl.classList.add("celebrate");
    setTimeout(() => cakeEl.classList.remove("celebrate"), 600);
    btnRelight.hidden = false;
    spawnConfetti(48);
    unlock("candles");
    if (state.balloonsLeft <= 0) {
      toastText.innerHTML = "All done. Seal the night when you’re ready.";
      queueSealIfReady();
    } else {
      toastText.innerHTML =
        "Candles done. Burst every balloon — then seal the night.";
    }
  }

  function allCandlesOut() {
    return state.candlesOut >= CANDLE_COUNT;
  }

  function allBalloonsBurst() {
    return state.balloonsLeft <= 0;
  }

  function partyComplete() {
    return allCandlesOut() && allBalloonsBurst();
  }

  /** Seal only after every candle is out AND every balloon is burst */
  function queueSealIfReady() {
    if (state.sealed || !partyComplete()) return;
    state.pendingSeal = true;
    // If no wish toast is open, open seal shortly; otherwise wait for dismiss/7s
    if (wishToast.hidden) {
      state.pendingSeal = false;
      setTimeout(() => openSealModal(), 400);
    }
  }

  function balloonPositions(count) {
    const zones = [
      { x: [4, 18], y: [12, 42] },
      { x: [78, 94], y: [12, 42] },
      { x: [8, 22], y: [48, 72] },
      { x: [76, 92], y: [48, 72] },
      { x: [22, 38], y: [8, 22] },
      { x: [60, 78], y: [8, 22] },
      { x: [40, 58], y: [6, 16] },
      { x: [5, 16], y: [28, 55] },
      { x: [82, 95], y: [28, 55] },
      { x: [28, 42], y: [68, 78] },
      { x: [55, 72], y: [68, 78] },
      { x: [45, 55], y: [72, 82] },
    ];
    const spots = [];
    for (let i = 0; i < count; i++) {
      const z = zones[i % zones.length];
      spots.push({
        left: `${z.x[0] + Math.random() * (z.x[1] - z.x[0])}%`,
        top: `${z.y[0] + Math.random() * (z.y[1] - z.y[0])}%`,
      });
    }
    return spots;
  }

  function buildBalloons() {
    balloonSky.innerHTML = "";
    state.balloonsLeft = state.wishesCount;
    state.collectedBalloonWishes = [];
    state.sealed = false;
    state.pendingSeal = false;
    state.awaitingSealAfterWish = false;
    btnRefill.hidden = true;
    updateBars();
    const positions = balloonPositions(state.wishesCount);

    for (let i = 0; i < state.wishesCount; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "balloon";
      const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
      b.style.background = color;
      b.style.setProperty("--tip", color);
      b.style.left = positions[i].left;
      b.style.top = positions[i].top;
      b.style.animationDelay = `${i * 0.28}s`;
      b.setAttribute("aria-label", `Balloon ${i + 1}`);
      b.dataset.index = String(i);
      const string = document.createElement("span");
      string.className = "string";
      b.appendChild(string);
      b.addEventListener("click", () => blastBalloon(b));
      balloonSky.appendChild(b);
    }
  }

  function blastBalloon(balloon) {
    if (balloon.classList.contains("blasting") || balloon.classList.contains("burst")) {
      return;
    }

    const idx = Number(balloon.dataset.index);
    const message =
      state.wishes[idx] ||
      state.wishes[idx % Math.max(state.wishes.length, 1)] ||
      "…";

    state.collectedBalloonWishes.push(message);

    const color = getComputedStyle(balloon).backgroundColor;
    const rect = balloon.getBoundingClientRect();
    const skyRect = balloonSky.getBoundingClientRect();
    const cx = rect.left - skyRect.left + rect.width / 2;
    const cy = rect.top - skyRect.top + rect.height / 2;

    // Do not seal yet — wait until pop finishes + wish closes, and candles are done
    // 1) Balloon inflates first
    balloon.classList.add("blasting");

    // 2) At pop moment: hide balloon, shreds + confetti, then wish
    setTimeout(() => {
      const flash = document.createElement("span");
      flash.className = "pop-flash";
      flash.style.left = `${cx}px`;
      flash.style.top = `${cy}px`;
      balloonSky.appendChild(flash);
      setTimeout(() => flash.remove(), 400);

      balloon.classList.remove("blasting");
      balloon.classList.add("burst");

      spawnBalloonShreds(cx, cy, color);
      spawnBalloonConfetti(cx, cy, color);
      playPop();
      showWish(message);

      setTimeout(() => {
        balloon.remove();
        state.balloonsLeft -= 1;
        updateBars();
        if (state.balloonsLeft <= 0) {
          btnRefill.hidden = false;
          unlock("balloons");
          if (allCandlesOut()) {
            toastText.innerHTML =
              "All candles & balloons done. Seal the night.";
          } else {
            toastText.innerHTML =
              "Balloons done. Blow out every candle — then seal the night.";
          }
          // Mark ready after this wish is dismissed (hideWish → queueSealIfReady)
          state.awaitingSealAfterWish = true;
        }
      }, 80);
    }, 280);
  }

  function spawnBalloonShreds(cx, cy, color) {
    for (let i = 0; i < 16; i++) {
      const bit = document.createElement("span");
      bit.className = "blast-bit";
      bit.style.background = color;
      bit.style.left = `${cx}px`;
      bit.style.top = `${cy}px`;
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.35;
      const dist = 45 + Math.random() * 85;
      bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      bit.style.setProperty("--rot", `${140 + Math.random() * 260}deg`);
      bit.style.width = `${7 + Math.random() * 10}px`;
      bit.style.height = `${9 + Math.random() * 14}px`;
      balloonSky.appendChild(bit);
      setTimeout(() => bit.remove(), 750);
    }
  }

  function spawnBalloonConfetti(cx, cy, balloonColor) {
    const colors = [
      balloonColor,
      "var(--accent)",
      "var(--accent-2)",
      "var(--danger)",
      "var(--b1)",
      "var(--b2)",
      "#fff",
    ];
    for (let i = 0; i < 30; i++) {
      const el = document.createElement("span");
      el.className = "pop-confetti";
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.style.background = colors[i % colors.length];
      const angle = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 130;
      el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      el.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      el.style.setProperty("--rot", `${180 + Math.random() * 540}deg`);
      el.style.width = `${4 + Math.random() * 7}px`;
      el.style.height = `${7 + Math.random() * 10}px`;
      el.style.animationDuration = `${0.8 + Math.random() * 0.5}s`;
      balloonSky.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }
  }

  function openSealModal() {
    if (state.sealed || !partyComplete()) return;
    sealStatus.hidden = true;
    setDevNoteChoice(false);
    sealModal.showModal();
  }

  function setDevNoteChoice(yes) {
    const share = document.getElementById("shareWithCreator");
    const field = document.getElementById("devNoteField");
    const yesBtn = document.getElementById("devNoteYes");
    const noBtn = document.getElementById("devNoteNo");
    const area = document.getElementById("devNote");

    share.checked = yes;
    field.hidden = !yes;
    yesBtn.classList.toggle("active", yes);
    noBtn.classList.toggle("active", !yes);
    yesBtn.setAttribute("aria-pressed", yes ? "true" : "false");
    noBtn.setAttribute("aria-pressed", yes ? "false" : "true");

    if (!yes) {
      area.value = "";
    } else {
      setTimeout(() => area.focus(), 40);
    }
  }

  document.getElementById("devNoteYes")?.addEventListener("click", () => {
    setDevNoteChoice(true);
  });
  document.getElementById("devNoteNo")?.addEventListener("click", () => {
    setDevNoteChoice(false);
  });

  let toastTimer;

  function hideWish() {
    if (wishToast.hidden) return;
    wishToast.hidden = true;
    clearTimeout(toastTimer);
    if (state.awaitingSealAfterWish) {
      state.awaitingSealAfterWish = false;
      queueSealIfReady();
    } else if (state.pendingSeal) {
      state.pendingSeal = false;
      setTimeout(() => openSealModal(), 350);
    }
  }

  function showWish(msg) {
    wishToastText.textContent = msg;
    wishToast.hidden = false;

    const bar = document.getElementById("wishTimer");
    if (bar) {
      const next = bar.cloneNode(true);
      bar.replaceWith(next);
    }

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideWish, 7000);
  }

  document.getElementById("wishClose").addEventListener("click", hideWish);

  sealForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("sealEmail").value.trim();
    const personalNote = document.getElementById("sealNote").value.trim();
    const noteToDeveloper = document.getElementById("devNote").value.trim();
    const shareWithCreator = document.getElementById("shareWithCreator").checked;
    const btn = document.getElementById("btnSealSend");

    btn.disabled = true;
    sealStatus.hidden = false;
    sealStatus.textContent = "Sending your wishes…";

    try {
      const res = await fetch("/api/send-wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          personalNote,
          noteToDeveloper,
          shareWithCreator,
          candleWishes: state.candleWishes,
          balloonWishes: state.collectedBalloonWishes,
          name: state.name,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Send failed");
      }
      state.sealed = true;
      sealStatus.textContent = "Sealed. Check your inbox.";
      unlock("seal");
      toastText.textContent = "Night sealed. Your wishes are in your inbox.";
      setTimeout(() => sealModal.close(), 1400);
    } catch (err) {
      sealStatus.textContent = err.message || "Could not send. Try again.";
    } finally {
      btn.disabled = false;
    }
  });

  function unlock(id) {
    if (state.achievements.has(id)) return;
    state.achievements.add(id);
    document
      .querySelector(`.achievements li[data-id="${id}"]`)
      ?.classList.add("done");
    achieveText.textContent = ACHIEVE_LABELS[id] || id;
    achievePop.hidden = false;
    setTimeout(() => {
      achievePop.hidden = true;
    }, 2600);
  }

  function spawnConfetti(n) {
    const colors = [
      "var(--accent)",
      "var(--accent-2)",
      "var(--danger)",
      "var(--b1)",
      "var(--b2)",
    ];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("span");
      el.className = "confetti";
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${-8 - Math.random() * 12}%`;
      el.style.background = colors[i % colors.length];
      el.style.animationDelay = `${Math.random() * 0.35}s`;
      fxLayer.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }
  }

  function applyFaceToSkin(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      const tiny = document.createElement("canvas");
      tiny.width = 16;
      tiny.height = 16;
      const tctx = tiny.getContext("2d");
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(canvas, 0, 0, 16, 16);
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tiny, 0, 0, size, size);
      mcHead.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
      mcHead.classList.add("has-face");
      photoPlaceholder.textContent = "Face equipped";
      photoSlot.classList.add("has-photo");
      unlock("photo");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function initFxCanvas() {
    const canvas = document.getElementById("fxCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let raf = 0;

    function resize() {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      spawn();
    }

    function spawn() {
      const n = Math.min(36, Math.floor(window.innerWidth / 34));
      const theme = state.theme;
      const batman = theme === "batman";
      const wonder = theme === "wonder";
      const cat = theme === "catwoman";
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        s: batman || cat ? 1.2 + Math.random() * 2.2 : 1.5 + Math.random() * 3,
        vy: batman || cat
          ? -0.12 - Math.random() * 0.35
          : -0.18 - Math.random() * 0.45,
        vx: (Math.random() - 0.5) * (batman || cat ? 0.45 : 0.55),
        a: batman || cat
          ? 0.08 + Math.random() * 0.2
          : 0.12 + Math.random() * 0.28,
        kind:
          wonder || theme === "spiderman"
            ? Math.random() > 0.5
              ? "spark"
              : "ember"
            : "ember",
      }));
    }

    function tick() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const accent = getComputedStyle(document.body)
        .getPropertyValue("--accent")
        .trim();
      const accent2 = getComputedStyle(document.body)
        .getPropertyValue("--accent-2")
        .trim();
      const drift = state.theme === "batman" || state.theme === "catwoman";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (drift) p.x += Math.sin(p.y * 0.02) * 0.15;
        if (p.y < -10) {
          p.y = window.innerHeight + 10;
          p.x = Math.random() * window.innerWidth;
        }
        if (p.x < -20) p.x = window.innerWidth + 20;
        if (p.x > window.innerWidth + 20) p.x = -20;

        ctx.globalAlpha = p.a;
        if (p.kind === "spark") {
          ctx.fillStyle = accent2;
          ctx.fillRect(p.x, p.y, p.s * 0.6, p.s * 2.2);
        } else {
          ctx.fillStyle = accent;
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", () => {
      cancelAnimationFrame(raf);
      resize();
      tick();
    });
  }

  let audioCtx;
  let musicGain = null;
  let musicPlaying = false;
  let musicMuted = false;
  let musicTimer = null;

  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (!musicGain) {
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.045;
      musicGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  /** Soft piano-like tone */
  function playPianoNote(freq, start, dur) {
    const ctx = getAudio();
    const now = start;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.value = 0.7;

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.12, now + Math.min(0.2, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(filter);
    osc2.connect(g);
    filter.connect(g);
    g.connect(musicGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
  }

  // Happy Birthday (C major), gentle tempo — [freqHz, beats]
  const HAPPY_BIRTHDAY = [
    [261.63, 0.75],
    [261.63, 0.25],
    [293.66, 1],
    [261.63, 1],
    [349.23, 1],
    [329.63, 2],
    [261.63, 0.75],
    [261.63, 0.25],
    [293.66, 1],
    [261.63, 1],
    [392.0, 1],
    [349.23, 2],
    [261.63, 0.75],
    [261.63, 0.25],
    [523.25, 1],
    [440.0, 1],
    [349.23, 1],
    [329.63, 1],
    [293.66, 2],
    [466.16, 0.75],
    [466.16, 0.25],
    [440.0, 1],
    [349.23, 1],
    [392.0, 1],
    [349.23, 2.5],
  ];

  function scheduleHappyBirthday() {
    if (!musicPlaying) return;
    const ctx = getAudio();
    const beat = 0.42;
    let t = ctx.currentTime + 0.05;
    let total = 0.05;

    for (const [freq, beats] of HAPPY_BIRTHDAY) {
      const dur = beats * beat;
      playPianoNote(freq, t, dur * 0.92);
      t += dur;
      total += dur;
    }

    total += 1.2; // pause before loop
    clearTimeout(musicTimer);
    musicTimer = setTimeout(scheduleHappyBirthday, total * 1000);
  }

  function startMusic() {
    if (musicPlaying) return;
    try {
      getAudio();
      musicPlaying = true;
      musicGain.gain.setTargetAtTime(
        musicMuted ? 0.0001 : 0.045,
        audioCtx.currentTime,
        0.05
      );
      scheduleHappyBirthday();
      syncMusicBtn();
    } catch (_) {}
  }

  function setMusicMuted(muted) {
    musicMuted = muted;
    try {
      getAudio();
      // Only change volume — do not reschedule (avoids overlapping melodies)
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.setTargetAtTime(
        muted ? 0.0001 : 0.045,
        audioCtx.currentTime,
        0.05
      );
    } catch (_) {}
    syncMusicBtn();
  }

  function syncMusicBtn() {
    const btn = document.getElementById("btnMusic");
    if (!btn) return;
    btn.setAttribute("aria-pressed", musicMuted ? "false" : "true");
    btn.textContent = musicMuted ? "♪ Muted" : "♪ Piano";
    btn.title = musicMuted ? "Unmute piano" : "Mute piano";
  }

  function playPop() {
    try {
      const ctx = getAudio();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(220, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.11);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.12);
    } catch (_) {}
  }

  function playWhoosh() {
    try {
      const ctx = getAudio();
      const bufferSize = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900;
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      noise.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      noise.start();
    } catch (_) {}
  }

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    applyFaceToSkin(file);
  });

  btnRelight.addEventListener("click", () => buildCandles(true));
  btnRefill.addEventListener("click", () => buildBalloons());

  document.getElementById("btnMusic")?.addEventListener("click", () => {
    if (!musicPlaying) startMusic();
    else setMusicMuted(!musicMuted);
  });

  document.getElementById("btnEnter").addEventListener("click", () => {
    try {
      getAudio();
      startMusic();
    } catch (_) {}
    intro.classList.add("gone");
  });

  /* ── Time gate ─────────────────────────────────────────── */
  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return {
      d: String(d).padStart(2, "0"),
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
    };
  }

  function showGate(data) {
    gate.hidden = false;
    app.hidden = true;
    const title = document.querySelector(".gate-title");
    const tag = document.querySelector(".gate-tag");
    const countdown = document.getElementById("countdown");
    if (tag) tag.textContent = "LOCKED BIOME";
    if (title) title.textContent = "Not yet.";
    if (countdown) countdown.hidden = false;
    document.getElementById("gateSub").textContent =
      `Opens when it’s time in ${data.cityLabel || data.timezone}`;
    document.getElementById("gateMeta").textContent = data.unlockAt
      ? `Unlocks ${data.unlockAt.replace("T", " ")} · ${data.timezone}`
      : "";
    const err = document.getElementById("gateError");
    if (data.error) {
      err.hidden = false;
      err.textContent = data.error;
    } else {
      err.hidden = true;
    }
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    spawnSkyLife(state.theme);
  }

  let countdownTimer = null;
  let remainingMs = 0;

  function tickCountdown() {
    const parts = formatCountdown(remainingMs);
    document.getElementById("cdD").textContent = parts.d;
    document.getElementById("cdH").textContent = parts.h;
    document.getElementById("cdM").textContent = parts.m;
    document.getElementById("cdS").textContent = parts.s;
    remainingMs -= 1000;
    if (remainingMs <= 0) {
      clearInterval(countdownTimer);
      bootstrap(true);
    }
  }

  async function checkTimeGate() {
    const res = await fetch("/api/time-gate");
    const data = await res.json();
    if (data.unlocked) return { ok: true, data };
    return { ok: false, data };
  }

  async function bootstrap(fromCountdown) {
    try {
      const gateResult = await checkTimeGate();
      if (!gateResult.ok) {
        showGate(gateResult.data);
        if (
          gateResult.data.msRemaining != null &&
          Number.isFinite(gateResult.data.msRemaining)
        ) {
          remainingMs = gateResult.data.msRemaining;
          clearInterval(countdownTimer);
          tickCountdown();
          countdownTimer = setInterval(tickCountdown, 1000);
        }
        return;
      }

      if (fromCountdown) {
        // soft unlock flash
      }

      const cfgRes = await fetch("/api/config");
      const cfg = await cfgRes.json();
      applyConfig(cfg);
      showApp();
      initFxCanvas();
    } catch (err) {
      showGate({
        cityLabel: "server",
        timezone: "",
        unlockAt: null,
        error:
          "Could not reach the party server. Run npm start and open the local URL.",
        msRemaining: null,
      });
    }
  }

  bootstrap(false);
})();
