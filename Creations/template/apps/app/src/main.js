import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Init utilities
uiDesign.setupViewport()
deviceControls.init()

const statusEl = document.getElementById('status')
const actionBtn = document.getElementById('action')

function setStatus(text) {
  if (statusEl) statusEl.textContent = text
}

actionBtn?.addEventListener('click', () => {
  setStatus('Button clicked')
})

deviceControls.on('sideButton', () => {
  setStatus('Side button pressed')
})

deviceControls.on('scrollWheel', ({ direction }) => {
  setStatus(`Scrolled ${direction}`)
})

console.log('Template Hello World Ready!')

