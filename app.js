/* =========================================================================
   Joyus — thinking out loud
   Fetches ./data/snippets.json, renders approved snippets newest-first.
   Vanilla JS, no dependencies.
   ========================================================================= */
(function () {
  "use strict";

  var SPEAKERS = { K: "Kahran", D: "Divya" };

  /* ---- Theme toggle: stamp data-theme on :root, persist the choice ------ */
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");

  function effectiveTheme() {
    var forced = root.getAttribute("data-theme");
    if (forced === "light" || forced === "dark") return forced;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function reflectToggle() {
    var isDark = effectiveTheme() === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    var label = toggle.querySelector(".theme-toggle__label");
    if (label) label.textContent = isDark ? "Dark" : "Light";
  }

  toggle.addEventListener("click", function () {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("joyus-theme", next);
    } catch (e) {}
    reflectToggle();
  });

  // Keep the label honest if the OS theme changes while no manual choice is set.
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", reflectToggle);

  reflectToggle();

  /* ---- Formatting ------------------------------------------------------- */
  var MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  function formatDate(iso) {
    // iso: "YYYY-MM-DD" -> "09 JUL 2026" (parsed as plain parts, no TZ drift)
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return iso || "";
    var day = m[3];
    var month = MONTHS[parseInt(m[2], 10) - 1] || "";
    return day + " " + month + " " + m[1];
  }

  /* ---- Rendering -------------------------------------------------------- */
  var tpl = document.getElementById("card-template");

  function buildCard(item) {
    var node = tpl.content.firstElementChild.cloneNode(true);

    node.querySelector(".card__theme").textContent = item.theme || "";

    var time = node.querySelector(".card__date");
    time.textContent = formatDate(item.date);
    if (item.date) time.setAttribute("datetime", item.date);

    var wrap = node.querySelector(".card__exchange");
    var prev = null;
    (item.exchange || []).forEach(function (turn) {
      var speaker = turn && turn.speaker === "K" ? "K" : "D";
      var row = document.createElement("div");
      row.className = "turn";
      row.setAttribute("data-speaker", speaker);
      if (speaker === prev) row.setAttribute("data-repeat", "true");
      prev = speaker;

      var glyph = document.createElement("span");
      glyph.className = "turn__glyph";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = speaker;

      var p = document.createElement("p");
      p.className = "turn__text";
      // Name the speaker as visually-hidden text so screen readers announce
      // "Kahran said." AND then the snippet. (An aria-label would REPLACE the
      // snippet text entirely — making the whole feed unreadable to AT.)
      var sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = (SPEAKERS[speaker] || speaker) + " said. ";
      p.appendChild(sr);
      p.appendChild(document.createTextNode((turn && turn.text) || ""));

      row.appendChild(glyph);
      row.appendChild(p);
      wrap.appendChild(row);
    });

    return node;
  }

  function render(items) {
    var feed = document.getElementById("feed");
    var status = document.getElementById("feed-status");

    var approved = items
      .filter(function (it) { return it && it.status === "approved"; })
      .sort(function (a, b) {
        // newest date first; stable-ish tiebreak on id
        if (a.date === b.date) return (b.id || "").localeCompare(a.id || "");
        return (b.date || "").localeCompare(a.date || "");
      });

    feed.setAttribute("aria-busy", "false");

    if (!approved.length) {
      status.textContent = "The thread is quiet for now. Come back soon.";
      return;
    }
    status.hidden = true;

    var frag = document.createDocumentFragment();
    approved.forEach(function (item) { frag.appendChild(buildCard(item)); });
    feed.appendChild(frag);

    revealCards(feed.querySelectorAll(".card"));
  }

  /* ---- Load-in: staggered reveal (respects reduced motion) -------------- */
  function revealCards(cards) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      cards.forEach(function (c) { c.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Stagger only the first screen's worth for a gentle cascade.
        var i = Number(el.getAttribute("data-i")) || 0;
        el.style.setProperty("--stagger", Math.min(i, 6) * 70 + "ms");
        el.classList.add("is-in");
        obs.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    cards.forEach(function (c, i) {
      c.setAttribute("data-i", i);
      io.observe(c);
    });
  }

  /* ---- Boot ------------------------------------------------------------- */
  fetch("./data/snippets.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      render(Array.isArray(data) ? data : []);
    })
    .catch(function (err) {
      var feed = document.getElementById("feed");
      var status = document.getElementById("feed-status");
      feed.setAttribute("aria-busy", "false");
      status.hidden = false;
      status.textContent = "Couldn't load the feed just now.";
      if (window.console) console.error("Joyus feed:", err);
    });
})();
