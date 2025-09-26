// Reusable and nestable shot patterns. Use `{ use, override }` to deep-merge.

export const shots = {
  aimedSingle: {
    id: 'aimedSingle',
    emit: 'bullet', // 'bullet' | 'sequence' | 'group'
    params: { speed: 180, size: { w: 6, h: 10 }, color: [1, 0.9, 0.4], aimAtPlayer: true },
  },
  spread5: {
    id: 'spread5',
    emit: 'group',
    params: { count: 5, angleCenter: -90, angleSpreadDeg: 40, speed: 200, size: { w: 6, h: 10 } },
  },
  sineStream: {
    id: 'sineStream',
    emit: 'sequence',
    params: { duration: 2.0, rate: 8, speed: 180, sine: { amplitude: 36, frequencyHz: 2.2 }, size: { w: 6, h: 10 } },
  },
  bursterVolley: {
    id: 'bursterVolley',
    emit: 'group',
    params: { count: 15, angleCenter: -90, angleSpreadDeg: 80, speed: 160, sine: { amplitude: 30, frequencyHz: 3 }, size: { w: 6, h: 10 } },
  },
  spread5FastWide: { use: 'spread5', override: { params: { speed: 240, angleSpreadDeg: 60 } } },
}


