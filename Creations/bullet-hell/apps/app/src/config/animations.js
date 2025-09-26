// Movement and local FX animation program references

export const animations = {
  popcornDrift: { id: 'popcornDrift', params: { vy: 100, vxJitter: 60, vxChangeEvery: 0.7 } },
  gunshipSweep: { id: 'gunshipSweep', params: { yTopRatio: 0.85, vx: 70 } },
  bursterStopAndBurst: { id: 'bursterStopAndBurst', params: { vy: 60, stopYRatio: 0.3, stopDuration: 2.0, resumeVy: 60 } },
  hoverTopBand: { id: 'hoverTopBand', params: { yRatio: 0.8, sineXAmplitude: 80, sineXFreqHz: 0.25 } },
  onFireWindupShake: { id: 'onFireWindupShake', params: { windupBackPx: 6, windupMs: 120, shakePx: 3, shakeMs: 160 } },
}


