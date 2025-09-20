/**
 * Device Controls Library
 * Mirror of bouncing_ball_game libs for compatibility
 */

class DeviceControls {
  constructor() {
    this.sideButtonEnabled = true;
    this.scrollWheelEnabled = true;
    this.eventListeners = new Map();
  }

  init(options = {}) {
    this.sideButtonEnabled = options.sideButtonEnabled ?? true;
    this.scrollWheelEnabled = options.scrollWheelEnabled ?? true;
    if (this.sideButtonEnabled) this.setupSideButtonListener();
    if (this.scrollWheelEnabled) this.setupScrollWheelListener();
    if (options.keyboardFallback !== false) this.setupKeyboardFallback();
  }

  setupSideButtonListener() {
    window.addEventListener('sideClick', (event) => {
      if (!this.sideButtonEnabled) return;
      this.handleSideButtonClick(event);
    });
  }

  setupScrollWheelListener() {
    window.addEventListener('scrollUp', (event) => {
      if (!this.scrollWheelEnabled) return;
      this.handleScrollWheel({ direction: 'up', event });
    });
    window.addEventListener('scrollDown', (event) => {
      if (!this.scrollWheelEnabled) return;
      this.handleScrollWheel({ direction: 'down', event });
    });
  }

  setupKeyboardFallback() {
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        const sideClickEvent = new CustomEvent('sideClick', {
          detail: { source: 'keyboard' }
        });
        window.dispatchEvent(sideClickEvent);
      }
    });
  }

  handleSideButtonClick(event) {
    const handlers = this.eventListeners.get('sideButton') || [];
    handlers.forEach(handler => handler(event));
  }

  handleScrollWheel(data) {
    const handlers = this.eventListeners.get('scrollWheel') || [];
    handlers.forEach(handler => handler({ direction: data.direction, event: data.event }));
  }

  on(eventType, handler) {
    if (!this.eventListeners.has(eventType)) this.eventListeners.set(eventType, []);
    this.eventListeners.get(eventType).push(handler);
  }

  off(eventType, handler) {
    const handlers = this.eventListeners.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }
}

const deviceControls = new DeviceControls();
export default deviceControls;


