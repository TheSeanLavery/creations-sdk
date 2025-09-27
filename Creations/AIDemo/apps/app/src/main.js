import deviceControls from './lib/device-controls.js'
import uiDesign from './lib/ui-design.js'

// Init utilities
uiDesign.setupViewport()
deviceControls.init()

const statusEl = document.getElementById('status')
const emailInput = document.getElementById('email')
const goBtn = document.getElementById('go')
const canvas = document.getElementById('art')
const ctx = canvas.getContext('2d')

function setStatus(text) {
  if (statusEl) statusEl.textContent = text
}

function resizeCanvasForDPR() {
  const dpr = window.devicePixelRatio || 1
  const cssW = 220 // keep some margin to fit 240x320
  const cssH = 220
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

resizeCanvasForDPR()
window.addEventListener('resize', resizeCanvasForDPR)

const EMOJI = ['😀','😎','🤖','✨','🔥','🌈','🎉','🚀','🧠','🪄','💡','⭐','🍀','🌸','🎈','💎','⚡','🎮','🛰️','🧩']

function rand(min, max) { return Math.random() * (max - min) + min }
function choice(arr) { return arr[(Math.random() * arr.length) | 0] }

function generateEmojiArt() {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 1000; i++) {
    const e = choice(EMOJI)
    const size = rand(8, 24)
    ctx.font = `${size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji`
    ctx.globalAlpha = rand(0.6, 1)
    const x = rand(-8, w + 8)
    const y = rand(8, h + 8)
    ctx.fillText(e, x, y)
  }

  ctx.globalAlpha = 1
}

function sendToAIWithEmbeddedDataUrl(toEmail, dataUrl) {
  const prompt = `You are an assistant. Please email the attached image to the recipient. Return ONLY valid JSON in this exact format: {"action":"email","to":"${toEmail}","subject":"Emoji Art","body":"Here is your procedurally generated emoji art.","attachments":[{"dataUrl":"<dataurl>"}]}`
  const payload = {
    useLLM: true,
    message: prompt,
    imageDataUrl: dataUrl // included explicitly for server/tooling, no link
  }
  if (typeof PluginMessageHandler !== 'undefined') {
    PluginMessageHandler.postMessage(JSON.stringify(payload))
    setStatus('Sent to AI...')
  } else {
    setStatus('Plugin API not available')
    console.log('Payload:', payload)
  }
}

goBtn?.addEventListener('click', () => {
  const to = (emailInput?.value || '').trim()
  if (!to) { setStatus('Enter an email'); return }
  setStatus('Generating...')
  generateEmojiArt()
  // Use JPEG to reduce size; quality ~0.7
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
  setStatus('Preparing email...')
  sendToAIWithEmbeddedDataUrl(to, dataUrl)
})

console.log('AI Demo Ready!')

