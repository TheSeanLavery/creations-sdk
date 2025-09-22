class UIDesign {
  constructor() {
    this.screenWidth = 240;
  }

  setupViewport() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    // Use fixed device logical size to match R1 (UI 28px + content 254px)
    viewport.content = 'width=240, height=320, initial-scale=1, maximum-scale=1, user-scalable=no';
  }
}

const uiDesign = new UIDesign();
export default uiDesign;


