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
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  }
}

const uiDesign = new UIDesign();
export default uiDesign;


