// Biome definitions (materials, vegetation, hazards) and Korean region naming.
(function () {
  'use strict';
  const MAT = RS.MAT, FS = RS.FACE_STYLE;
  const B = {
    camp: {
      label: '모닥불이 지키는 안전한 곳', ground: MAT.GRASS, alt: MAT.MEADOW, path: MAT.DIRT, face: FS.EARTH,
      trees: { oak: 3, birch: 2 }, treeDensity: 0.05, bushes: 0.03, rocks: 0.01, flowers: 0.1, tall: 0.05,
      enemies: [], height: [1, 2], barrier: 'forest', color: '#6b9e52'
    },
    forest: {
      label: '고대 숲', ground: MAT.FOREST, alt: MAT.GRASS, path: MAT.DIRT, face: FS.MOSSY,
      trees: { oak: 5, pine: 2, birch: 1 }, treeDensity: 0.3, deepDensity: 0.3, bushes: 0.07, rocks: 0.02, flowers: 0.04, tall: 0.05,
      logs: 0.012, mushrooms: 0.03, enemies: ['slime', 'beetle', 'spitter'], height: [1, 2], barrier: 'forest', color: '#2e5333'
    },
    meadow: {
      label: '넓은 초원', ground: MAT.MEADOW, alt: MAT.GRASS, path: MAT.DIRT, face: FS.EARTH,
      trees: { oak: 3, birch: 2 }, treeDensity: 0.035, bushes: 0.035, rocks: 0.015, flowers: 0.16, tall: 0.14,
      enemies: ['slime', 'beetle'], height: [1, 2], barrier: 'hedge', color: '#8fb863'
    },
    coast: {
      label: '해안 절벽', ground: MAT.GRASS, alt: MAT.ROCK, path: MAT.GRAVEL, face: FS.ROCK,
      trees: { pine: 4, windswept: 2 }, treeDensity: 0.04, bushes: 0.03, rocks: 0.04, flowers: 0.06, tall: 0.08,
      enemies: ['beetle', 'bat', 'spitter'], height: [2, 2], barrier: 'rock', color: '#79b3b5'
    },
    shore: {
      label: '바위 해안', ground: MAT.SAND, alt: MAT.GRAVEL, path: MAT.SAND, face: FS.ROCK,
      trees: { palm: 3, windswept: 1 }, treeDensity: 0.02, bushes: 0.015, rocks: 0.07, flowers: 0.0, tall: 0.02,
      driftwood: 0.01, shells: 0.05, enemies: ['slime', 'beetle'], height: [1, 1], barrier: 'rock', color: '#d2bd8f'
    },
    swamp: {
      label: '습지', ground: MAT.SWAMP, alt: MAT.MUD, path: MAT.PLANK, face: FS.EARTH,
      trees: { willow: 3, dead: 2 }, treeDensity: 0.05, bushes: 0.03, rocks: 0.01, flowers: 0.02, tall: 0.06,
      reeds: 0.12, pools: 0.28, mushrooms: 0.03, enemies: ['slime', 'wisp', 'spitter'], height: [1, 1], barrier: 'marsh', color: '#566236'
    },
    marsh: {
      label: '안개 늪', ground: MAT.MUD, alt: MAT.SWAMP, path: MAT.PLANK, face: FS.EARTH,
      trees: { dead: 3, willow: 2 }, treeDensity: 0.04, bushes: 0.02, rocks: 0.01, flowers: 0.0, tall: 0.03,
      reeds: 0.14, pools: 0.34, mushrooms: 0.04, mist: true, enemies: ['wisp', 'slime', 'bat'], height: [1, 1], barrier: 'marsh', color: '#414c2d'
    },
    canyon: {
      label: '협곡', ground: MAT.CANYON, alt: MAT.GRAVEL, path: MAT.GRAVEL, face: FS.SANDSTONE,
      trees: { dead: 2, pine: 1 }, treeDensity: 0.015, bushes: 0.015, rocks: 0.07, flowers: 0.0, tall: 0.02,
      bones: 0.02, chasms: true, enemies: ['beetle', 'bat', 'sentry'], height: [2, 2], barrier: 'rock', color: '#9c5c3e'
    },
    mountain: {
      label: '산길', ground: MAT.ROCK, alt: MAT.GRAVEL, path: MAT.GRAVEL, face: FS.ROCK,
      trees: { pine: 5 }, treeDensity: 0.06, bushes: 0.015, rocks: 0.08, flowers: 0.02, tall: 0.03,
      enemies: ['beetle', 'bat', 'sentry'], height: [2, 3], barrier: 'rock', color: '#6c717d'
    },
    ruins: {
      label: '폐허가 된 정착지', ground: MAT.GRASS, alt: MAT.RUIN, path: MAT.COBBLE, face: FS.ROCK,
      trees: { oak: 3, dead: 1 }, treeDensity: 0.04, bushes: 0.05, rocks: 0.02, flowers: 0.05, tall: 0.07,
      ruinsDensity: 1, enemies: ['sentry', 'slime', 'spitter'], height: [1, 2], barrier: 'ruinwall', color: '#bdb4a0'
    },
    sunken: {
      label: '가라앉은 사원 터', ground: MAT.GRASS, alt: MAT.RUIN, path: MAT.COBBLE, face: FS.MOSSY,
      trees: { willow: 2, oak: 1 }, treeDensity: 0.03, bushes: 0.04, rocks: 0.02, flowers: 0.03, tall: 0.05,
      pools: 0.18, ruinsDensity: 0.8, reeds: 0.05, enemies: ['sentry', 'wisp', 'slime'], height: [1, 1], barrier: 'ruinwall', color: '#4f90a2'
    },
    valley: {
      label: '초록 골짜기', ground: MAT.GRASS, alt: MAT.FOREST, path: MAT.DIRT, face: FS.MOSSY,
      trees: { oak: 3, willow: 1, birch: 1 }, treeDensity: 0.1, bushes: 0.06, rocks: 0.02, flowers: 0.1, tall: 0.1,
      ferns: 0.05, mushrooms: 0.02, enemies: ['slime', 'spitter', 'beetle'], height: [1, 1], barrier: 'forest', color: '#4f8446'
    },
    bridge: {
      label: '무너진 다리 지대', ground: MAT.GRASS, alt: MAT.GRAVEL, path: MAT.DIRT, face: FS.SANDSTONE,
      trees: { pine: 2, oak: 1 }, treeDensity: 0.04, bushes: 0.03, rocks: 0.04, flowers: 0.04, tall: 0.05,
      chasms: true, enemies: ['beetle', 'bat', 'spitter'], height: [1, 2], barrier: 'rock', color: '#a3814f'
    },
    sanctum: {
      label: '성소로 가는 길', ground: MAT.ROCK, alt: MAT.GRASS, path: MAT.SANCTUM, face: FS.DARK,
      trees: { dead: 2, pine: 1 }, treeDensity: 0.02, bushes: 0.02, rocks: 0.04, flowers: 0.0, tall: 0.02,
      enemies: ['sentry', 'wisp', 'bat'], height: [3, 3], barrier: 'rock', color: '#34416b'
    }
  };

  const NAMES = {
    camp: ['잔불 캠프 들판', '모닥불 들판', '출발의 풀밭'],
    forest: ['속삭이는 숲', '고목의 숲', '이끼뿌리 숲', '달그늘 숲', '엉킨 가지 숲', '오래된 참나무 숲', '새벽 안개 숲'],
    meadow: ['바람 들판', '은빛 초원', '노을 들녘', '들꽃 초원', '종달새 언덕', '황금 억새밭'],
    coast: ['갈매기 절벽', '파도 절벽', '소금바람 벼랑', '등대 절벽', '물보라 절벽'],
    shore: ['조약돌 해안', '난파선 해변', '검은 바위 해안', '물새 여울', '조개껍데기 해변'],
    swamp: ['개구리 습지', '갈대 습지', '썩은 뿌리 습지', '물풀 습지'],
    marsh: ['안개 늪', '잿빛 늪', '가라앉은 늪', '도깨비불 늪'],
    canyon: ['붉은 협곡', '메아리 협곡', '갈라진 골짜기', '바람 협곡'],
    mountain: ['잿빛 산길', '매 둥지 고개', '돌비늘 산길', '구름 고개'],
    ruins: ['무너진 마을', '잊힌 정착지', '재의 마을 터', '빈 종탑 마을'],
    sunken: ['가라앉은 사원 터', '물에 잠긴 신전 뜰', '침묵의 사원 터'],
    valley: ['초록 골짜기', '폭포 골짜기', '고사리 계곡', '숨은 골짜기'],
    bridge: ['무너진 다리 터', '끊어진 다리 협곡', '옛 다리 나루'],
    sanctum: ['성소로 가는 길', '수호자의 참배로', '잊힌 순례길']
  };

  RS.BIOMES = B;
  RS.BIOME_NAMES = NAMES;
})();
