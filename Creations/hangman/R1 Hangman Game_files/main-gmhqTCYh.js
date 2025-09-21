(function () {
  const t = document.createElement("link").relList;
  if (t && t.supports && t.supports("modulepreload")) return;
  for (const o of document.querySelectorAll('link[rel="modulepreload"]')) r(o);
  new MutationObserver((o) => {
    for (const i of o)
      if (i.type === "childList")
        for (const c of i.addedNodes)
          c.tagName === "LINK" && c.rel === "modulepreload" && r(c);
  }).observe(document, { childList: !0, subtree: !0 });
  function n(o) {
    const i = {};
    return (
      o.integrity && (i.integrity = o.integrity),
      o.referrerPolicy && (i.referrerPolicy = o.referrerPolicy),
      o.crossOrigin === "use-credentials"
        ? (i.credentials = "include")
        : o.crossOrigin === "anonymous"
          ? (i.credentials = "omit")
          : (i.credentials = "same-origin"),
      i
    );
  }
  function r(o) {
    if (o.ep) return;
    o.ep = !0;
    const i = n(o);
    fetch(o.href, i);
  }
})();

// Prefer constants from a globally-provided source when available
const k = (globalThis && globalThis.k) ? globalThis.k : [];
let z, P, d, _, b, de, L, Q, T, y, he, v, w, sb;

document.getElementById("single-scores");
document.getElementById("two-player-scores");
const Y = document.getElementById("wins-count"),
  X = document.getElementById("losses-count"),
  le = document.getElementById("player1-score"),
  ce = document.getElementById("player2-score"),
  we = document.getElementById("current-player-indicator"),
  Z = document.getElementById("winner-modal"),
  ge = document.getElementById("winner-title"),
  me = document.getElementById("winner-text"),
  ue = document.querySelector(".new-match-btn");
// sb will be assigned on DOMContentLoaded
let s,
  M,
  h,
  a,
  D,
  m,
  R,
  A = "single",
  g = 1,
  p = 0,
  f = 0,
  x = 0,
  S = 0,
  j = "",
  q = !1;
const C = 6,
  pe = 30,
  U = 20,
  E = "abcdefghijklmnopqrstuvwxyz".split(""),
  B = [
    ".hangman-head",
    ".hangman-body",
    ".hangman-left-arm",
    ".hangman-right-arm",
    ".hangman-left-leg",
    ".hangman-right-leg",
  ];
let fe = !1,
  l = 0;
function ye() {
  if (typeof window < "u")
    try {
      (window.addEventListener("scrollUp", () => {
        v.classList.contains("hidden") ? u(-1) : W(-1);
      }),
        window.addEventListener("scrollDown", () => {
          v.classList.contains("hidden") ? u(1) : W(1);
        }),
        window.addEventListener("sideClick", () => {
          v.classList.contains("hidden") ? ie() : ee();
        }),
        (fe = !0),
        console.log("R1 Hardware controls initialized"));
    } catch {
      (console.log("Hardware initialization failed, using fallback controls"),
        V());
    }
  else V();
}
function V() {
  document.addEventListener("keydown", (e) => {
    if (!v.classList.contains("hidden")) {
      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
          (e.preventDefault(), W(e.key === "ArrowUp" ? -1 : 1));
          break;
        case "Enter":
        case " ":
          (e.preventDefault(), ee());
          break;
      }
      return;
    }
    switch (e.key) {
      case "ArrowUp":
        (e.preventDefault(), u(-1));
        break;
      case "ArrowDown":
        (e.preventDefault(), u(1));
        break;
      case "ArrowLeft":
        (e.preventDefault(), u(-6));
        break;
      case "ArrowRight":
        (e.preventDefault(), u(6));
        break;
      case "Enter":
      case " ":
        (e.preventDefault(), ie());
        break;
    }
  });
}
function W(e) {
  (w.forEach((t) => t.classList.remove("selected")),
    (l += e),
    l < 0 && (l = w.length - 1),
    l >= w.length && (l = 0),
    w[l].classList.add("selected"));
}
function ee() {
  const t = w[l].dataset.mode;
  te(t);
}
function H(e) {
  B.forEach((t) => {
    const n = _.querySelector(t);
    n && n.classList.remove("show");
  });
  for (let t = 0; t < e && t < B.length; t++) {
    const n = _.querySelector(B[t]);
    n && n.classList.add("show");
  }
}
function be() {
  v.classList.remove("hidden");
}
function ve() {
  v.classList.add("hidden");
}
function te(e) {
  ((A = e),
    ve(),
    e === "single"
      ? ((document.getElementById("single-header").style.display = "flex"),
        (document.getElementById("two-player-header").style.display = "none"),
        ae())
      : ((document.getElementById("single-header").style.display = "none"),
        (document.getElementById("two-player-header").style.display = "flex"),
        ne()),
    I());
  // Re-apply layout adjustments when switching modes
  if (typeof window !== "undefined") {
    const header = document.querySelector(".compact-header");
    const gc = document.querySelector(".game-controls");
    const headerH = header ? header.offsetHeight : 0;
    if (gc) {
      gc.style.top = (headerH + 6) + "px";
    }
  }
}
function ne() {
  ((p = 0), (f = 0), (g = 1), (j = ""), (q = !1), O());
}
function O() {
  ((le.textContent = p), (ce.textContent = f), (we.textContent = `P${g} Turn`));
}
function Ae() {
  (g === 1 ? ((g = 2), (q = !1)) : ((g = 1), (q = !0)), O());
}
function oe() {
  return p >= U ? (K(1), !0) : f >= U ? (K(2), !0) : !1;
}
function K(e) {
  ((ge.textContent = "Match Winner!"),
    (me.textContent = `Player ${e} wins the match with ${e === 1 ? p : f} wins!`),
    Z.classList.add("show"),
    re());
}
function u(e) {
  if (Array.from(d.querySelectorAll("button:not(:disabled)")).length === 0)
    return;
  (d.querySelectorAll("button").forEach((r) => r.classList.remove("selected")),
    a === void 0 ? (a = 0) : ((a += e), a < 0 && (a = 25), a > 25 && (a = 0)));
  const n = d.querySelector(`[data-letter="${E[a]}"]`);
  if (n && !n.disabled)
    (n.classList.add("selected"),
      sb && (sb.disabled = !1),
      n.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      }));
  else
    for (let r = 1; r <= 13; r++)
      for (let o of [r, -r]) {
        const i = a + o;
        if (i >= 0 && i < E.length) {
          const c = d.querySelector(`[data-letter="${E[i]}"]`);
          if (c && !c.disabled) {
            ((a = i),
              c.classList.add("selected"),
              sb && (sb.disabled = !1),
              c.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
              }));
            return;
          }
        }
      }
}
function ie() {
  const e = d.querySelector(".selected");
  if (e && !e.disabled) {
    const t = e.dataset.letter;
      se(e, t);
  }
}
function $() {
  ((m = pe),
    J(),
    (D = setInterval(() => {
      (m--,
        J(),
        m <= 10 && T.classList.add("timer-warning"),
        m <= 0 && (clearInterval(D), ke()));
    }, 1e3)));
}
function J() {
  ((T.textContent = m),
    m <= 10
      ? (T.classList.add("timer-warning"),
        y && y.classList.add("timer-warning"))
      : (T.classList.remove("timer-warning"),
        y && y.classList.remove("timer-warning")),
    y && (y.textContent = m));
}
function F() {
  (clearInterval(D), T.classList.remove("timer-warning"));
}
function ke() {
  (h++, H(h), (P.textContent = `${h}/${C}`), N(), h === C ? G(!1) : $());
}
function N() {
  try {
    const e = new (window.AudioContext || window.webkitAudioContext)(),
      t = e.createOscillator(),
      n = e.createGain();
    (t.connect(n),
      n.connect(e.destination),
      t.frequency.setValueAtTime(200, e.currentTime),
      n.gain.setValueAtTime(0.3, e.currentTime),
      n.gain.exponentialRampToValueAtTime(0.01, e.currentTime + 0.5),
      t.start(e.currentTime),
      t.stop(e.currentTime + 0.5));
  } catch {
    console.log("Audio not available");
  }
}
function re() {
  try {
    const e = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((n, r) => {
      const o = e.createOscillator(),
        i = e.createGain();
      (o.connect(i),
        i.connect(e.destination),
        o.frequency.setValueAtTime(n, e.currentTime + r * 0.2),
        i.gain.setValueAtTime(0.2, e.currentTime + r * 0.2),
        i.gain.exponentialRampToValueAtTime(
          0.01,
          e.currentTime + r * 0.2 + 0.3,
        ),
        o.start(e.currentTime + r * 0.2),
        o.stop(e.currentTime + r * 0.2 + 0.3));
    });
  } catch {
    console.log("Audio not available");
  }
}
function Te(e) {
  if (A === "single") {
    e ? (x++, (Y.textContent = x)) : (S++, (X.textContent = S));
    try {
      (localStorage.setItem("hangman_wins", x.toString()),
        localStorage.setItem("hangman_losses", S.toString()));
    } catch {
      console.log("Local storage not available");
    }
  } else {
    (e && (g === 1 ? p++ : f++), O(), oe() || Ae());
    try {
      (localStorage.setItem("hangman_player1_wins", p.toString()),
        localStorage.setItem("hangman_player2_wins", f.toString()));
    } catch {
      console.log("Local storage not available");
    }
  }
}
function ae() {
  try {
    ((x = parseInt(localStorage.getItem("hangman_wins")) || 0),
      (S = parseInt(localStorage.getItem("hangman_losses")) || 0),
      (Y.textContent = x),
      (X.textContent = S));
  } catch {
    console.log("Could not load saved scores");
  }
}
function xe() {
  try {
    ((p = parseInt(localStorage.getItem("hangman_player1_wins")) || 0),
      (f = parseInt(localStorage.getItem("hangman_player2_wins")) || 0));
  } catch {
    console.log("Could not load saved scores");
  }
}
const Se = () => {
    ((M = []),
      (h = 0),
      (a = void 0),
      (R = !1),
      H(0),
      (P.textContent = `${h}/${C}`),
      (z.innerHTML = s
        .split("")
        .map(() => '<li class="letter"></li>')
        .join("")),
      d.querySelectorAll("button").forEach((e) => {
        ((e.disabled = !1), e.classList.remove("wrong", "correct", "selected"));
      }),
      (L.disabled = !1),
      (L.textContent = "Hint"),
      (Q.style.display = "none"),
      F(),
      $(),
      b.classList.remove("show"),
      setTimeout(() => u(0), 100));
  },
  I = () => {
    if (A === "two-player")
      if (!j || q) {
        const { word: e, hint: t } = k[Math.floor(Math.random() * k.length)];
        ((s = e.toLowerCase()),
          (j = s),
          (q = !1),
          (document.querySelector(".hint-text b").innerText = t),
          console.log(`New word for round: ${s}, Player ${g}'s turn`));
      } else {
        s = j;
        const e = k.find((t) => t.word.toLowerCase() === s);
        (e && (document.querySelector(".hint-text b").innerText = e.hint),
          console.log(`Same word: ${s}, Player ${g}'s turn`));
      }
    else {
      const { word: e, hint: t } = k[Math.floor(Math.random() * k.length)];
      ((s = e.toLowerCase()),
        (document.querySelector(".hint-text b").innerText = t));
    }
    Se();
    // Recompute scaling after new word set
    setTimeout(() => {
      const evt = new Event("resize");
      window.dispatchEvent(evt);
    }, 0);
  },
  Le = () => {
    R ||
      ((Q.style.display = "block"),
      (L.disabled = !0),
      (L.textContent = "Hint Used"),
      (R = !0));
  },
  G = (e) => {
    if ((F(), Te(e), A === "two-player" && oe())) return;
    const t = e ? "You found the word:" : "The correct word was:";
    let n = "";
    (A === "two-player"
      ? (n = e ? "Correct!" : "Incorrect!")
      : (n = e ? "Congratulations!" : "Game Over!"),
      (he.textContent = e ? "😊" : "😔"),
      (b.querySelector("h4").innerText = n),
      (b.querySelector("p").innerHTML = `${t} <b>${s}</b>`),
      b.classList.add("show"),
      e ? re() : N(),
      A === "two-player" &&
        setTimeout(() => {
          (b.classList.remove("show"), I());
        }, 2500));
  },
  se = (e, t) => {
    if ((F(), s.includes(t))) {
      if (
        (e.classList.add("correct"),
        [...s].forEach((n, r) => {
          n === t &&
            (M.push(n),
            (z.querySelectorAll("li")[r].innerText = n),
            z.querySelectorAll("li")[r].classList.add("guessed"));
        }),
        M.length === s.length)
      ) {
        setTimeout(() => G(!0), 500);
        return;
      }
    } else if ((e.classList.add("wrong"), h++, H(h), N(), h === C)) {
      setTimeout(() => G(!1), 500);
      return;
    }
    ((e.disabled = !0),
      (P.textContent = `${h}/${C}`),
      d
        .querySelectorAll("button")
        .forEach((n) => n.classList.remove("selected")),
      (a = void 0),
      (sb && (sb.disabled = !0)),
      $());
  };
function qe() {
  ((d.innerHTML = ""),
    E.forEach((e, t) => {
      const n = document.createElement("button");
      ((n.innerText = e.toUpperCase()),
        (n.dataset.letter = e),
        d.appendChild(n),
        n.addEventListener("click", (r) => {
          if (n.disabled) return;
          d
            .querySelectorAll("button")
            .forEach((o) => o.classList.remove("selected"));
          n.classList.add("selected");
          a = t;
          sb && (sb.disabled = !1);
        }));
    }));
}
function Ce() {
  // Resolve DOM references now that the DOM is ready
  z = document.querySelector(".word-display");
  P = document.getElementById("guess-count");
  d = document.getElementById("keyboard-container");
  _ = document.getElementById("hangman-drawing");
  b = document.querySelector(".game-modal");
  de = b ? b.querySelector("button") : null;
  L = document.getElementById("hint-btn");
  Q = document.getElementById("hint-display");
  // Overlay elements for hint popup
  const hintOverlay = document.getElementById("hint-overlay");
  const hintBoxText = document.getElementById("hint-box-text");
  T = document.getElementById("timer-display");
  y = document.getElementById("timer-display-2");
  he = document.getElementById("game-result-emoji");
  v = document.getElementById("mode-menu");
  w = document.querySelectorAll(".mode-button");
  sb = document.getElementById("submit-letter-btn");

  (ae(), xe(), qe(), ye(), be(), w[0].classList.add("selected"), (l = 0));

  const adjustLayout = () => {
    const header = document.querySelector(".compact-header");
    const gc = document.querySelector(".game-controls");
    const headerH = header ? header.offsetHeight : 0;
    if (gc) {
      gc.style.top = (headerH + 6) + "px";
    }
    const kb = document.querySelector(".keyboard");
    // submit button is snapped to bottom; no extra keyboard margin needed
    if (kb) {
      kb.style.marginBottom = "0px";
    }
    // Scale word letters down to keep on one line
    if (z) {
      const container = z.parentElement; // ul wrapped by container
      if (container) {
        let scale = 1;
        z.style.transformOrigin = "center center";
        z.style.transform = "scale(1)";
        const maxWidth = container.clientWidth - 12;
        const naturalWidth = z.scrollWidth;
        if (naturalWidth > maxWidth && naturalWidth > 0) {
          scale = Math.max(0.5, maxWidth / naturalWidth);
          z.style.transform = `scale(${scale})`;
        }
      }
    }
  };
  adjustLayout();
  window.addEventListener("resize", adjustLayout);
  window.addEventListener("orientationchange", adjustLayout);
  if (sb) {
    sb.disabled = !0;
    sb.addEventListener("click", () => {
      const e = d.querySelector(".selected");
      if (!e || e.disabled) return;
      const t = e.dataset.letter;
      se(e, t);
    });
  }
  if (L) {
    // Replace default Le with overlay popup
    L.addEventListener("click", () => {
      if (!hintOverlay || !hintBoxText) return;
      const bEl = document.querySelector(".hint-text b");
      hintBoxText.textContent = bEl ? bEl.textContent : "";
      hintOverlay.style.display = "flex";
    });
  }
  if (hintOverlay) {
    hintOverlay.addEventListener("click", () => {
      hintOverlay.style.display = "none";
    });
  }
  const deNow = ((document.querySelector(".game-modal")) || b) ? (document.querySelector(".game-modal") || b).querySelector("button") : null;
  if (deNow) {
    deNow.addEventListener("click", I);
  }
  const ueNow = document.querySelector(".new-match-btn") || ue;
  if (ueNow) {
    ueNow.addEventListener("click", () => {
      (Z.classList.remove("show"), ne(), I());
    });
  }
  const wNow = document.querySelectorAll(".mode-button");
  wNow.forEach((e, t) => {
    (e.addEventListener("click", () => {
      const n = e.dataset.mode;
      te(n);
    }),
      e.addEventListener("mouseenter", () => {
        (wNow.forEach((n) => n.classList.remove("selected")),
          e.classList.add("selected"),
          (l = t));
      }));
  });
}
document.addEventListener("DOMContentLoaded", Ce);
