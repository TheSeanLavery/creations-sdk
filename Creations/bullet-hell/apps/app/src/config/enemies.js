// Enemy archetypes: compose animations + fire schedules + shots

export const enemies = {
  popcorn: {
    id: 'popcorn', size: { w: 16, h: 16 }, hp: 1, score: 10,
    movement: { use: 'popcornDrift' },
    fire: { rate: 1.0, shot: { use: 'aimedSingle' } },
    onFireFx: { use: 'onFireWindupShake' },
  },
  gunship: {
    id: 'gunship', size: { w: 22, h: 20 }, hp: 3, score: 25,
    movement: { use: 'gunshipSweep' },
    spawn: { side: 'leftOrRightTop' },
    fire: null,
  },
  burster: {
    id: 'burster', size: { w: 20, h: 20 }, hp: 5, score: 50,
    movement: { use: 'bursterStopAndBurst' },
    fire: { onPauseOnly: true, shot: { use: 'bursterVolley' } },
    onFireFx: { use: 'onFireWindupShake' },
  },
  minibossA: {
    id: 'minibossA', size: { w: 60, h: 44 }, hp: 100, boss: true, score: 500,
    movement: { use: 'hoverTopBand', override: { params: { yRatio: 0.85, sineXAmplitude: 60 } } },
    firePhases: [
      { duration: 6, shot: { use: 'spread5' } },
      { duration: 8, shot: { use: 'sineStream' } },
    ],
  },
  bossA: {
    id: 'bossA', size: { w: 80, h: 64 }, hp: 1200, boss: true, score: 2000,
    movement: { use: 'hoverTopBand', override: { params: { yRatio: 0.88, sineXAmplitude: 100 } } },
    firePhases: [
      { untilHpRatio: 0.66, shot: { use: 'spread5FastWide' } },
      { untilHpRatio: 0.33, shot: { use: 'sineStream', override: { params: { rate: 12 } } } },
      { untilHpRatio: 0.0, shot: { use: 'bursterVolley' } },
    ],
  },
}


