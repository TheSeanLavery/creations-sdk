// Levels: stages → phases (parallel). Use sleeps to sequence within phases.

export const levels = [
  {
    id: 'L1', seed: 12345,
    stages: [
      {
        id: 'S1',
        phases: [
          { id: 'P-popcorn-streams', actions: [
            { type: 'spawn', enemy: 'popcorn', pattern: 'streamLinear', duration: 8, rate: 6, lane: 'topRandom' },
            { type: 'sleep', duration: 2 },
            { type: 'spawn', enemy: 'gunship', pattern: 'burst', count: 2, positions: 'topLeftRightOffscreen' },
          ]},
          { id: 'P-bursters', actions: [
            { type: 'sleep', duration: 4 },
            { type: 'spawn', enemy: 'burster', pattern: 'streamRamping', duration: 6, rate: { base: 1.5, slope: 0.5 } },
          ]},
        ],
        miniboss: { id: 'minibossA' },
      },
      {
        id: 'S2',
        phases: [
          { id: 'P-popcorn-dense', actions: [
            { type: 'spawn', enemy: 'popcorn', pattern: 'streamLinear', duration: 10, rate: 10 },
          ]},
        ],
        boss: { id: 'bossA' },
      },
    ],
  },
  {
    id: 'L2', seed: 54321,
    stages: [
      {
        id: 'S1',
        phases: [
          { id: 'P-gunships', actions: [
            { type: 'spawn', enemy: 'gunship', pattern: 'streamLinear', duration: 8, rate: 3, lane: 'topLeftRightOffscreen' },
          ]},
          { id: 'P-bursters-more', actions: [
            { type: 'sleep', duration: 2 },
            { type: 'spawn', enemy: 'burster', pattern: 'streamRamping', duration: 10, rate: { base: 0.8, slope: 0.6 } },
          ]},
        ],
        boss: { id: 'bossA' },
      },
    ],
  },
]


