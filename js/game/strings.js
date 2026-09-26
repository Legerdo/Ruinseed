// All player-facing text (Korean). Internal identifiers stay English; nothing here is shown in English
// except the proper game title.
(function () {
  'use strict';
  const T = {
    gameTitle: 'Ruinseed',
    gameSub: 'The Shattered World',
    gameSubKo: '부서진 세계',
    currency: '불씨',
    title: {
      pressAny: '아무 키나 눌러 시작',
      audioHint: '소리는 첫 입력 뒤에 켜집니다',
      continue: '계속하기',
      newWorld: '새 세계',
      retry: '같은 세계 재도전',
      enterSeed: '시드 입력',
      settings: '설정',
      controls: '조작법',
      credits: '만든 이들',
      seed: '세계 시드',
      best: '최고 기록',
      noRecord: '없음',
      wins: '승리',
      runs: '도전',
      seedPrompt: '세계 시드 입력 (숫자 1~6자리)',
      seedHelp: '숫자를 입력하고 Enter · 취소는 Esc',
      continueInfo: '진행 중인 모험: 시드 {seed} · 인장 {sig}/3'
    },
    credits: [
      'Ruinseed: The Shattered World',
      '원본 기획 프롬프트: FrostSource의 8-Bit AI Arena (github.com/FrostSource/8bit-ai-arena)',
      '그림 · 소리 · 코드: 모두 이 게임을 위해 절차적으로 만들어졌습니다.',
      '글꼴: 갈무리(Galmuri) — 이민서, SIL 오픈 폰트 라이선스 1.1',
      '모든 지형, 캐릭터, 음악, 효과음은 실행할 때 직접 생성됩니다.'
    ],
    loading: ['땅을 빚는 중...', '물길을 여는 중...', '숲을 심는 중...', '폐허를 세우는 중...', '길을 검증하는 중...', '풍경을 칠하는 중...'],
    loadingTitle: '세계를 빚는 중',
    loadingError: '세계를 만드는 중 문제가 생겼습니다. 아무 키나 눌러 타이틀로 돌아가 다른 시드로 시도해 주세요.',
    camp: {
      title: '잔불 캠프',
      shop: '캠프 상점',
      shopDesc: '모은 불씨로 영구적인 힘을 얻습니다. 쓰러져도 사라지지 않습니다.',
      owned: '보유 불씨',
      buy: '구매',
      maxed: '최대 단계',
      level: '{a}/{b}단계',
      price: '불씨 {n}',
      notEnough: '불씨가 부족합니다',
      bought: '{name} 강화 완료!',
      depart: '모험 떠나기',
      departSame: '같은 세계로 출발',
      departSeed: '시드 {seed} · {n}번째 도전',
      departNew: '새 세계로 출발',
      toTitle: '타이틀로',
      keeperLine: '불씨는 네가 쌓은 발자취란다. 필요한 힘을 골라 보렴.',
      attemptInfo: '{n}번째 도전'
    },
    upgrades: {
      hp: { name: '생명의 매듭', desc: '최대 체력이 하트 한 칸 늘어납니다.' },
      blade: { name: '유물 검 벼리기', desc: '검의 공격력이 1 오릅니다.' },
      speed: { name: '바람 신발', desc: '이동 속도가 8% 빨라집니다.' },
      dodgeDist: { name: '구르기 수련', desc: '회피 거리가 18% 늘어납니다.' },
      dodgeCd: { name: '가벼운 숨', desc: '회피 대기 시간이 15% 줄어듭니다.' },
      potion: { name: '약초 주머니', desc: '모험을 시작할 때 회복약을 1개 더 가져갑니다.' },
      magnet: { name: '불씨 인력', desc: '불씨를 끌어당기는 범위가 넓어집니다.' }
    },
    hud: {
      objective: '목표',
      sigils: '인장',
      potion: '회복약',
      attack: '공격',
      dodge: '회피',
      ready: '준비',
      noPotion: '회복약이 없다',
      fullHp: '체력이 가득하다',
      map: '지도',
      here: '현재 위치',
      unknown: '미탐험 지역',
      gotFruit: '생명 열매',
      gotPotion: '회복약을 얻었다',
      discovered: '새로운 지역',
      godMode: '무적 모드',
      saved: '진행 상황을 저장했습니다',
      saveFail: '저장소를 사용할 수 없어 진행 상황이 저장되지 않습니다',
      saveCorrupt: '저장 데이터가 손상되어 새로 시작합니다'
    },
    prompt: {
      read: '읽기', talk: '대화', enter: '들어가기', open: '열기', light: '점화', pull: '당기기',
      take: '얻기', exit: '나가기', inspect: '살펴보기', sealed: '봉인됨', walkIn: '안으로 걸어가기'
    },
    obj: {
      talkKeeper: '캠프지기 마루와 이야기하기',
      findSigil: '{dungeon}에서 {sigil} 찾기',
      goDir: '{dir} {region}',
      sealMoss: '봉인 해제: 고대 화로에 불 밝히기 ({n}/{m})',
      sealTide: '봉인 해제: 수문 레버 당기기 ({n}/{m})',
      sealEmber: '봉인 해제: 시련의 방의 적 쓰러뜨리기 ({n}/{m})',
      takeSigil: '제단에서 {sigil} 얻기',
      leaveDungeon: '인장을 얻었다! 던전 밖으로 나가기',
      toLair: '{region}의 봉인된 문으로 가기',
      enterLair: '봉인된 문 안으로 들어가기',
      fight: '폐허의 수호자 쓰러뜨리기',
      remain: '남은 인장 {n}개'
    },
    dungeons: {
      moss: { name: '푸른 이끼 동굴', sigil: '뿌리의 인장', mech: '고대 화로 두 개에 불을 밝혀야 한다' },
      tide: { name: '가라앉은 성소', sigil: '물결의 인장', mech: '수문 레버 두 개를 당겨야 한다' },
      ember: { name: '잿불 심연', sigil: '잉걸의 인장', mech: '시련의 방에서 모든 적을 쓰러뜨려야 한다' }
    },
    dungeonState: { cleared: '이미 인장을 얻은 던전', open: '인장이 잠들어 있다' },
    guardian: '폐허의 수호자',
    lairName: '수호자의 은신처',
    toast: {
      sigil: '{sigil}을 얻었다!',
      sigilCount: '인장 {n}/3',
      sealOpen: '봉인이 풀렸다!',
      brazier: '화로에 불이 붙었다 ({n}/{m})',
      lever: '레버가 움직였다 ({n}/{m})',
      trial: '시련이 시작되었다!',
      trialDone: '시련을 이겨냈다!',
      chest: '보물 상자: 불씨 +{n}',
      chestFruit: '보물 상자: 생명 열매',
      chestPotion: '보물 상자: 회복약',
      gateOpen: '세 인장이 빛나며 봉인된 문이 열린다!',
      gateSealed: '문에 새겨진 세 개의 홈이 비어 있다. 인장 {n}/3',
      arenaSealed: '뒤편의 문이 굳게 닫혔다!',
      exitHint: '빛이 드는 계단으로 언제든 밖으로 나갈 수 있습니다',
      cheatGod: '무적 모드: {v}',
      cheatEmbers: '불씨 100개를 받았다',
      noCheatHere: '모험 중에만 사용할 수 있습니다'
    },
    hint: {
      move: '{keys} 이동',
      talk: '{key} 대화하기',
      attack: '{key} 공격 — 다가오는 적을 베어 보세요',
      dodge: '{key} 회피 — 구르는 동안에는 피해를 받지 않습니다',
      cut: '수풀과 덤불은 검으로 벨 수 있습니다',
      potion: '{key} 회복약 마시기',
      map: '{key} 지도 · 금빛 화살표가 목표를 가리킵니다',
      entrance: '입구 안으로 걸어 들어가면 던전에 들어갑니다',
      exit: '빛이 드는 계단으로 걸어가면 밖으로 나갑니다',
      interact: '{key} 상호작용'
    },
    pause: {
      title: '일시정지',
      resume: '계속하기',
      map: '지도 보기',
      settings: '설정',
      controls: '조작법',
      exitDungeon: '던전 입구로 돌아가기',
      abandon: '모험 포기하고 캠프로',
      toTitle: '타이틀로',
      confirmAbandon: '정말 모험을 포기할까요?',
      confirmAbandonSub: '모은 불씨와 구매한 강화는 그대로 남습니다.',
      confirmTitle: '타이틀로 돌아갈까요?',
      confirmTitleSub: '진행 중인 모험은 캠프 체크포인트에서 이어 할 수 있습니다.',
      yes: '예',
      no: '아니요',
      info: '시드 {seed} · {time} · 인장 {sig}/3'
    },
    settings: {
      title: '설정',
      music: '음악',
      musicVol: '음악 음량',
      sfx: '효과음',
      sfxVol: '효과음 음량',
      ambient: '환경음',
      shake: '화면 흔들림',
      hints: '도움말 표시',
      on: '켜짐',
      off: '꺼짐',
      audio: '오디오 상태',
      audioOn: '재생 중',
      audioWait: '대기 중 · 아무 키나 누르면 시작',
      audioNone: '이 브라우저에서 지원되지 않음',
      audioMusicOff: '음악 꺼짐 · 효과음은 켜짐',
      cheats: '치트 (디버그)',
      god: '무적 모드',
      addEmbers: '불씨 100개 받기',
      toBoss: '수호자에게 바로 가기',
      reset: '저장 데이터 초기화',
      resetConfirm: '저장 데이터를 초기화할까요?',
      resetSub: '불씨, 강화, 기록이 모두 지워집니다. 설정은 유지됩니다.',
      resetDone: '저장 데이터를 초기화했습니다',
      back: '뒤로',
      navHelp: '↑↓ 선택 · ←→ 값 변경 · Enter 확인 · Esc 뒤로'
    },
    controls: {
      title: '조작법',
      rows: [
        ['이동', 'WASD / 방향키'],
        ['공격', 'J / Z / 마우스 왼쪽'],
        ['회피 (무적 구르기)', 'K / X / Shift / 마우스 오른쪽'],
        ['상호작용 · 대화 넘기기', 'E / 스페이스 / Enter'],
        ['회복약 마시기', 'Q / R'],
        ['지도', 'M / Tab'],
        ['일시정지', 'Esc / P'],
        ['게임패드', '스틱 이동 · A 상호작용 · X 공격 · B 회피 · Y 회복약']
      ],
      tip: '적의 공격 직전에는 빛나거나 붉은 경고가 나타납니다. 그때 굴러서 피하세요.'
    },
    defeat: {
      title: '패배',
      sub: '불씨는 꺼지지 않았다. 모닥불 곁에서 다시 일어나자.',
      time: '버틴 시간',
      sigils: '모은 인장',
      earned: '이번에 모은 불씨',
      total: '보유 불씨',
      toCamp: '캠프로 돌아가기',
      retry: '같은 세계 재도전',
      toTitle: '타이틀로'
    },
    victory: {
      title: '승리',
      sub: '폐허의 수호자가 쓰러지고, 부서진 세계에 다시 빛이 스며든다.',
      seed: '세계 시드',
      time: '클리어 시간',
      total: '보유 불씨',
      earned: '이번에 모은 불씨',
      upgrades: '수집한 강화',
      none: '아직 없음',
      record: '신기록!',
      best: '최고 기록',
      toCamp: '캠프로 돌아가기',
      toTitle: '타이틀로'
    },
    map: {
      title: '세계 지도',
      legendCamp: '캠프',
      legendDungeon: '던전',
      legendDone: '인장 획득',
      legendLair: '봉인된 문',
      legendGoal: '목표',
      legendYou: '현재 위치',
      close: '{key} 닫기'
    },
    boss: {
      intro: '폐허의 수호자',
      introSub: '부서진 세계를 지키는 마지막 파수꾼',
      phase2: '수호자가 분노한다!',
      phase3: '수호자의 핵이 불타오른다!',
      exposed: '핵이 드러났다! 지금 공격하세요!',
      armored: '단단한 돌갑옷에 막혔다',
      defeated: '수호자가 무너진다...'
    },
    keeper: {
      name: '캠프지기 마루',
      first: [
        '깨어났구나, 씨앗지기. 이 모닥불이 타는 동안 여기는 안전하단다.',
        '세계가 부서진 뒤로, 폐허의 수호자가 봉인된 문 너머를 지키고 있지. 그 문을 열려면 고대 인장 세 개가 필요해.',
        '인장은 이 땅 곳곳의 던전 깊은 곳에 잠들어 있단다. 가장 가까운 곳은 {dir}의 {region}에 있는 {dungeon}이야.',
        '화면 왼쪽 위의 목표를 보렴. 금빛 화살표가 다음 목적지를 가리키고, {map} 키를 누르면 지도를 볼 수 있어.',
        '괴물은 {atk} 키로 베고, 위험하다 싶으면 {dodge} 키로 굴러 피하렴. 구르는 동안에는 다치지 않는단다.'
      ],
      tips: [
        '덤불과 수풀을 베면 불씨나 생명 열매가 나오기도 하지.',
        '모은 불씨는 쓰러져도 사라지지 않아. 모험 사이에 캠프 상점에서 힘을 키우렴.',
        '던전 입구 옆의 석판을 읽어 보렴. 안에서 무엇을 해야 하는지 적혀 있단다.',
        '{potion} 키로 회복약을 마실 수 있어. 위급할 때를 위해 아껴 두렴.',
        '적이 공격하기 직전에는 몸이 빛나거나 땅에 붉은 표시가 생긴단다. 그 순간 구르렴.',
        '지도는 가 본 곳만 그려진다. 낯선 길에는 숨겨진 샛길도 있지.'
      ],
      afterOne: '인장의 빛이 느껴지는구나! 남은 인장은 {n}개. 다음은 {dir}의 {dungeon}이 가깝겠다.',
      afterAll: '세 인장이 모두 모였어. 이제 {region}의 봉인된 문으로 가거라. 수호자는 큰 공격 뒤에 잠시 멈춘단다. 그 틈을 노리렴.'
    },
    tablet: {
      tutorialTitle: '낡은 석판',
      tutorial: [
        '여행자를 위한 가르침이 새겨져 있다.',
        '이동: WASD 또는 방향키 · 공격: J · 회피: K (구르는 동안 무적)',
        '상호작용: E · 회복약: Q · 지도: M · 일시정지: Esc'
      ],
      dungeonTitle: '던전 석판',
      dungeon: '이 아래 {dungeon}에 {sigil}이 잠들어 있다. 제단을 가로막은 봉인을 풀려면 {mech}.',
      dungeonExit: '안에서 길을 잃거든 빛이 새어 드는 계단으로 돌아오라.',
      dungeonDone: '제단은 비어 있다. {sigil}은 이미 네 손에 있다.',
      loreTitle: '이끼 낀 석판',
      lore: {
        forest: ['뿌리는 기억한다. 세계가 갈라지던 밤, 가장 먼저 불씨를 품은 것은 나무들이었다.', '오래된 숲은 길을 숨긴다. 덤불 너머를 살펴라.'],
        meadow: ['바람이 풀을 눕히는 곳마다 옛 순례자의 발자국이 남아 있다.', '선돌은 별의 자리를 가리킨다. 이제는 아무도 그 뜻을 모른다.'],
        coast: ['등대의 불이 꺼진 뒤로 배들은 돌아오지 않았다.', '절벽 아래 파도는 부서진 세계의 조각을 삼킨다.'],
        shore: ['난파선의 선원들은 불씨 한 줌을 쥐고 바다를 건넜다고 한다.', '조개껍데기 속에서 옛 노래가 들린다.'],
        swamp: ['늪은 무엇이든 삼키지만, 불씨만은 삼키지 못한다.', '갈대 사이로 도깨비불이 길을 흐린다. 따라가지 마라.'],
        marsh: ['안개가 짙은 날에는 가라앉은 종소리가 들린다.', '늪 아래에는 한때 마을이 있었다.'],
        canyon: ['땅이 갈라진 자리에는 아직도 잉걸불이 숨 쉰다.', '협곡의 메아리는 수호자의 발소리를 닮았다.'],
        mountain: ['돌탑을 쌓은 이들은 산 너머의 문을 두려워했다.', '높은 길일수록 바람이 거칠다. 발밑을 조심하라.'],
        ruins: ['이 마을은 씨앗을 지키던 이들의 마지막 거처였다.', '무너진 종탑은 더 이상 울리지 않는다. 하지만 누군가는 아직 기다린다.'],
        sunken: ['물에 잠긴 사원은 물결의 인장을 품고 잠들었다.', '거인의 석상은 눈을 감은 채 수면 아래를 지켜본다.'],
        valley: ['골짜기의 물은 산의 눈물이라 불렸다.', '가장 푸른 곳에서 가장 오래된 씨앗이 자란다.'],
        bridge: ['다리가 무너진 날, 두 마을은 서로를 잊었다.', '돌아가는 길이 언제나 가장 빠른 길은 아니다.'],
        sanctum: ['수호자는 세계를 지키려 했다. 그 방식이 틀렸을 뿐.', '세 개의 인장이 모이면 문은 기억을 되찾는다.'],
        camp: ['모닥불은 길 잃은 이들을 부른다.']
      }
    },
    sign: { title: '표지판', here: '여기: {name}', toward: '{dir} · {name}', dungeon: '{dir} · {name} (던전)' },
    dirs: { '동쪽': '→', '서쪽': '←', '남쪽': '↓', '북쪽': '↑', '남동쪽': '↘', '남서쪽': '↙', '북서쪽': '↖', '북동쪽': '↗' },
    exitStairs: '바깥으로 나가는 계단',
    enemyNames: { slime: '이끼 슬라임', beetle: '가시 딱정벌레', spitter: '씨앗 뱉는 꽃', bat: '동굴 박쥐', sentry: '폐허 파수병', wisp: '도깨비불' },
    misc: { yes: '예', no: '아니요', close: '닫기', confirm: '확인', back: '뒤로', continueKey: '{key} 계속', page: '{a}/{b}' }
  };

  // simple template fill: fmt('{a}개', {a: 3})
  T.fmt = function (s, o) {
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined ? o[k] : m));
  };
  // Korean object particle helper: 을/를, 이/가, 은/는, 과/와 based on final consonant
  T.josa = function (word, pair) {
    const ch = String(word).charCodeAt(String(word).length - 1);
    let has = false;
    if (ch >= 0xac00 && ch <= 0xd7a3) has = (ch - 0xac00) % 28 !== 0;
    else if (/[0-9]$/.test(word)) has = '013678'.includes(String(word).slice(-1));
    const [a, b] = pair.split('/');
    return word + (has ? a : b);
  };

  RS.T = T;

  RS.Upgrades = {
    list: [
      { id: 'hp', max: 3, price: [40, 85, 150] },
      { id: 'blade', max: 3, price: [55, 110, 180] },
      { id: 'speed', max: 3, price: [30, 65, 110] },
      { id: 'dodgeDist', max: 2, price: [35, 80] },
      { id: 'dodgeCd', max: 2, price: [40, 90] },
      { id: 'potion', max: 2, price: [45, 95] },
      { id: 'magnet', max: 2, price: [25, 60] }
    ],
    byId: {}
  };
  for (const u of RS.Upgrades.list) RS.Upgrades.byId[u.id] = u;
})();
