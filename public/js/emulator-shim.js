(function () {
  // State
  let currentFrame = null;
  let targetWin = null; // iframe contentWindow
  let emulatorEnabled = true;
  let nativeDetected = false;

  // Accelerometer state and timers
  const accelState = { x: 0, y: 0, z: 1 };
  let accelIntervals = [];
  let accelDefaultFreqHz = 60;

  // Long-press state
  let lpTimer = null;
  let lpActive = false;
  let lpKeyIsDown = false;

  // DOM helpers (host page controls)
  function $id(id) { return document.getElementById(id); }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function dispatchIntoIframe(name, detail) {
    if (!targetWin || !emulatorEnabled) return;
    try { targetWin.dispatchEvent(new CustomEvent(name, { detail })); } catch (_) {}
  }

  function scrollIframeBy(amount) {
    if (!targetWin || !emulatorEnabled) return;
    try { targetWin.scrollBy({ top: amount, behavior: 'smooth' }); } catch (_) {}
  }

  function handleScroll(direction) {
    if (!emulatorEnabled) return;
    if (direction === 'up') {
      scrollIframeBy(-80);
      dispatchIntoIframe('scrollUp', { source: 'emulator' });
    } else {
      scrollIframeBy(80);
      dispatchIntoIframe('scrollDown', { source: 'emulator' });
    }
  }

  function stopAllAccelIntervals() {
    try { accelIntervals.forEach(clearInterval); } catch (_) {}
    accelIntervals = [];
  }

  function injectAccelerometerShim() {
    if (!targetWin) return;
    try {
      // Auto-disable if native creationSensors already present on device
      nativeDetected = !!(targetWin.creationSensors && targetWin.creationSensors.accelerometer && typeof targetWin.creationSensors.accelerometer.start === 'function');
      updateStatusLabel();
      if (nativeDetected) return; // Do not override on device

      if (!targetWin.creationSensors) targetWin.creationSensors = {};
      const acc = {
        isAvailable: async () => true,
        start: (cb, options) => {
          if (typeof cb !== 'function') return null;
          const freq = clamp((options && options.frequency) || accelDefaultFreqHz, 1, 120);
          const interval = Math.round(1000 / freq);
          const id = setInterval(() => {
            if (!emulatorEnabled) return;
            // Provide both normalized tilt and raw values to satisfy different demo expectations
            const payload = {
              x: accelState.x,
              y: accelState.y,
              z: accelState.z,
              tiltX: accelState.x,
              tiltY: accelState.y,
              tiltZ: accelState.z,
              rawX: accelState.x * 9.81,
              rawY: accelState.y * 9.81,
              rawZ: accelState.z * 9.81,
            };
            cb(payload);
          }, interval);
          accelIntervals.push(id);
          return id;
        },
        stop: () => { stopAllAccelIntervals(); }
      };
      targetWin.creationSensors.accelerometer = acc;
    } catch (_) {}
  }

  function attachToIframe(frame) {
    currentFrame = frame;
    targetWin = frame?.contentWindow || null;
    stopAllAccelIntervals();
    injectAccelerometerShim();
  }

  function updateStatusLabel() {
    const el = $id('emu-status');
    if (!el) return;
    if (nativeDetected) {
      el.textContent = 'Native (shim off)';
    } else {
      el.textContent = emulatorEnabled ? 'Active' : 'Disabled';
    }
  }

  function syncTiltUIFromState() {
    const x = accelState.x, y = accelState.y, z = accelState.z;
    const pairs = [
      ['emu-tilt-x','emu-tilt-x-num', x],
      ['emu-tilt-y','emu-tilt-y-num', y],
      ['emu-tilt-z','emu-tilt-z-num', z],
    ];
    for (const [rId, nId, v] of pairs) {
      const r = $id(rId); const n = $id(nId);
      if (r) r.value = String(v);
      if (n) n.value = String(v);
    }
  }

  function bindUIControls(viewport) {
    // Enable toggle
    const enabledEl = $id('emu-enabled');
    if (enabledEl) {
      enabledEl.checked = true;
      enabledEl.addEventListener('change', () => {
        emulatorEnabled = !!enabledEl.checked;
        updateStatusLabel();
      });
    }

    // Frequency
    const freqEl = $id('emu-freq');
    if (freqEl) {
      freqEl.value = String(accelDefaultFreqHz);
      freqEl.addEventListener('input', () => {
        const v = parseInt(freqEl.value || '60', 10);
        accelDefaultFreqHz = clamp(isNaN(v) ? 60 : v, 1, 120);
      });
    }

    // Tilt sliders and numbers
    const bindPair = (rangeId, numId, key) => {
      const r = $id(rangeId);
      const n = $id(numId);
      const onChange = (val) => {
        const num = clamp(parseFloat(val), -1, 1);
        accelState[key] = isNaN(num) ? accelState[key] : num;
        syncTiltUIFromState();
      };
      if (r) r.addEventListener('input', () => onChange(r.value));
      if (n) n.addEventListener('input', () => onChange(n.value));
    };
    bindPair('emu-tilt-x','emu-tilt-x-num','x');
    bindPair('emu-tilt-y','emu-tilt-y-num','y');
    bindPair('emu-tilt-z','emu-tilt-z-num','z');

    // Reset
    const resetBtn = $id('emu-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      accelState.x = 0; accelState.y = 0; accelState.z = 1;
      syncTiltUIFromState();
    });

    // Buttons
    const btnSide = $id('emu-sideclick');
    if (btnSide) btnSide.addEventListener('click', () => dispatchIntoIframe('sideClick', { source: 'emulator' }));

    const btnLP = $id('emu-longpress');
    if (btnLP) btnLP.addEventListener('mousedown', () => dispatchIntoIframe('longPressStart', { source: 'emulator' }));
    if (btnLP) btnLP.addEventListener('mouseup', () => dispatchIntoIframe('longPressEnd', { source: 'emulator' }));

    const btnUp = $id('emu-scroll-up');
    const btnDown = $id('emu-scroll-down');
    if (btnUp) btnUp.addEventListener('click', () => handleScroll('up'));
    if (btnDown) btnDown.addEventListener('click', () => handleScroll('down'));

    // Wheel mapping on viewport
    viewport?.addEventListener('wheel', (e) => {
      if (!targetWin) return;
      e.preventDefault(); e.stopPropagation();
      const dir = (e.deltaY || 0) > 0 ? 'down' : 'up';
      handleScroll(dir);
    }, { passive: false });

    // Keyboard mappings (window-level)
    window.addEventListener('keydown', (e) => {
      if (!targetWin) return;
      // Prevent page interactions for our keys
      const prevent = () => { e.preventDefault(); e.stopPropagation(); };
      switch (e.code) {
        case 'Space': {
          if (lpKeyIsDown) return; // ignore repeats
          lpKeyIsDown = true;
          prevent();
          lpTimer = setTimeout(() => {
            lpActive = true;
            dispatchIntoIframe('longPressStart', { source: 'emulator' });
          }, 500);
          break;
        }
        case 'ArrowUp': prevent(); handleScroll('up'); break;
        case 'ArrowDown': prevent(); handleScroll('down'); break;
        case 'KeyA': accelState.x = clamp(accelState.x - 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyD': accelState.x = clamp(accelState.x + 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyW': accelState.y = clamp(accelState.y + 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyS': accelState.y = clamp(accelState.y - 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyQ': accelState.z = clamp(accelState.z - 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyE': accelState.z = clamp(accelState.z + 0.05, -1, 1); syncTiltUIFromState(); break;
        case 'KeyR': accelState.x = 0; accelState.y = 0; accelState.z = 1; syncTiltUIFromState(); break;
        default: break;
      }
    }, { capture: true });

    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault(); e.stopPropagation();
      const hadTimer = !!lpTimer;
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      if (lpActive) {
        dispatchIntoIframe('longPressEnd', { source: 'emulator' });
      } else if (hadTimer) {
        dispatchIntoIframe('sideClick', { source: 'emulator' });
      }
      lpActive = false; lpKeyIsDown = false;
    }, { capture: true });

    // Initialize UI from default state
    syncTiltUIFromState();
    updateStatusLabel();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const viewport = document.querySelector('.viewport');
    const frame = viewport?.querySelector('iframe');

    // Bind host controls
    bindUIControls(viewport);

    // Attach now and on navigation
    if (frame) {
      if (frame.contentDocument && frame.contentDocument.readyState !== 'loading') {
        attachToIframe(frame);
      }
      frame.addEventListener('load', () => attachToIframe(frame));
    }

    // Observe iframe replacement
    const mo = new MutationObserver(() => {
      const nf = document.querySelector('.viewport iframe');
      if (nf && nf !== currentFrame) {
        attachToIframe(nf);
        nf.addEventListener('load', () => attachToIframe(nf));
      }
    });
    if (viewport) mo.observe(viewport, { childList: true, subtree: true });
  });
})();


