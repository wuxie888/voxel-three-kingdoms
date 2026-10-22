// Battles. A stage sets the time of day (sky palette, sun/moon direction, light colours, default post look), the enemy
// army (banner character, name, soldier colours, the four named officers) and its intro banner, plus per-hero opening
// lines, and its script: the chain of goals that ends in 勝利 (stages/campaign.js; goal kinds documented there) with
// the par time / KOs the result rank is measured against. The active stage is picked by ?stage=<id> (the title menu
// reloads with it); the sky and haze are compiled into shaders at boot, which is why a stage change reloads.

export const STAGES = [
  {
    id: 'changban', zh: '長坂坡', en: 'CHANGBAN', seal: '長坂', time: '黃昏', look: 'dusk', set: 'stream',
    intro: ['<em>長坂坡</em>之戰', 'Battle of Changban — break through Cao Cao\'s pursuit'],
    enemy: { ch: '魏', army: '魏軍', en: 'Wei', officers: [['夏侯恩', 'XIAHOU EN'], ['晏明', 'YAN MING'], ['淳于導', 'CHUNYU DAO'], ['張郃', 'ZHANG HE']] },
    ally: { ch: '蜀', label: '蜀' },
    // 單騎救主: Zhao Yun cuts back through Cao Cao's pursuit for Liu Bei's son, then makes for the bridge Zhang Fei holds
    props: [{ kind: 'well', at: [-25, -15] }, { kind: 'bridge', at: [0, -46] }],
    script: [
      { kind: 'officer', slots: [0], hp: 1.6, goal: ['擊破 夏侯恩', 'Defeat Xiahou En'], buff: { atk: 1.2 },
        lines: {
          start: [['off:0', '此乃丞相所賜青釭劍，誰敢擋我！', 'The Chancellor\'s own Qinggang sword — who dares stand in my way?']],
          done: [['hero', { zhaoyun: ['青釭劍，歸我趙雲了！', 'The Qinggang sword is mine now!'], '*': ['奪得青釭劍！', 'The Qinggang sword is ours!'] }]],
        } },
      { kind: 'reach', points: [[-25, -15]], r: 3, hold: 90, label: '阿斗', goal: ['救出 阿斗', 'Rescue Liu Shan'],
        lines: {
          start: [['hero', { zhaoyun: ['少主尚在亂軍之中……子龍必救之！', 'The young lord is lost in this chaos… I will find him!'],
            '*': ['阿斗尚在亂軍之中，速去救援！', 'Liu Shan is lost in the fighting — find him!'] }]],
          done: [['hero', { zhaoyun: ['少主莫怕，子龍來也！', 'Fear not, young lord — Zilong is here!'], '*': ['阿斗救出！', 'Liu Shan is safe!'] }]],
        } },
      { kind: 'officer', slots: [1, 2], goal: ['擊破 晏明・淳于導', 'Defeat Yan Ming and Chunyu Dao'],
        lines: { start: [['off:1', '休走！留下阿斗！', 'Halt! Leave the child!']] } },
      { kind: 'officer', slots: [3], hp: 2.2, commander: true, goal: ['擊破 張郃', 'Defeat Zhang He'],
        lines: { start: [['off:3', '吾乃河北名將張郃！誰敢與我交鋒！', 'I am Zhang He, finest general of Hebei! Who will cross blades with me?']] } },
      { kind: 'reach', points: [[0, -40.5]], r: 4.5, hold: 0, label: '長坂橋', goal: ['突破至 長坂橋', 'Break through to Changban Bridge'],
        ally: { id: 'zhangfei', alt: 'zhaoyun', at: [0, -49.2], yaw: 0 },
        lines: {
          start: [['ally', { zhangfei: ['翼德，長坂橋就在前方！', 'Yide — Changban Bridge is just ahead!'], '*': ['往橋這邊來！後面的交給俺！', 'This way, to the bridge! Leave the rest to me!'] }]],
          done: [['hero', { zhangfei: ['燕人張飛在此！誰敢與我決一死戰！', 'Zhang Fei of Yan stands here! Who dares fight me to the death?!'] }],
            ['ally', { zhangfei: ['好一聲斷喝！', 'What a roar!'], '*': ['燕人張飛在此！誰敢與我決一死戰！', 'Zhang Fei of Yan stands here! Who dares fight me to the death?!'] }]],
        } },
    ],
    clear: ['曹軍 退却', 'Cao Cao\'s pursuit falls back'],
    par: { time: 240, kos: 600 },
    sky: {},   // the defaults in world/sky.js are this golden hour
    light: {},
    lines: {},
  },
  {
    id: 'hulao', zh: '虎牢關', en: 'HULAO GATE', seal: '虎牢', time: '白晝', look: 'bright', set: 'pass',
    intro: ['<em>虎牢關</em>之戰', 'Battle of Hulao Gate — the coalition storms Dong Zhuo\'s pass'],
    enemy: { ch: '董', army: '董卓軍', en: 'Dong Zhuo\'s', band: 0x7a3aa0, cloth: 0x3e2a52,
      officers: [['華雄', 'HUA XIONG'], ['李傕', 'LI JUE'], ['郭汜', 'GUO SI'], ['高順', 'GAO SHUN']] },
    // 三英戰呂布: Lü Bu rides out of the gate as the boss (boss/boss.js); playing Lü Bu, Guan Yu comes for you instead
    boss: { id: 'lubu', intro: ['三英戰呂布', 'THE THREE HEROES AGAINST LÜ BU'], alt: { id: 'guanyu', intro: ['武聖 關雲長', 'GUAN YU RIDES OUT'] } },
    ally: { ch: '漢', label: '聯' },
    script: [
      { kind: 'officer', slots: [0], hp: 1.8, goal: ['斬 華雄', 'Slay Hua Xiong'],
        lines: {
          start: [['off:0', '關東鼠輩，誰敢與我華雄一戰！', 'Rats of the east! Who dares face Hua Xiong?']],
          done: [['hero', { guanyu: ['酒尚溫。', 'The wine is still warm.'], '*': ['華雄已斬！', 'Hua Xiong is slain!'] }]],
        } },
      { kind: 'officer', slots: [1, 2], goal: ['擊破 李傕・郭汜', 'Defeat Li Jue and Guo Si'],
        lines: { start: [['off:1', '董太師麾下，豈容爾等放肆！', 'Under the Grand Tutor\'s banner, none of you will pass!']] } },
      { kind: 'boss', extra: [3], goal: { lubu: ['擊破 關羽', 'Defeat Guan Yu'], '*': ['擊破 呂布', 'Defeat Lü Bu'] },
        lines: { start: [['boss', { lubu: ['呂布！關某在此，休得猖狂！', 'Lü Bu! Guan Yu is here — your arrogance ends now!'],
          '*': ['吾乃呂奉先！天下誰人敢擋！', 'I am Lü Fengxian! Who under heaven dares stand before me?'] }]] } },
    ],
    clear: ['董卓軍 潰走', 'Dong Zhuo\'s army breaks'],
    par: { time: 210, kos: 450 },
    sky: {
      sunElev: 0.62, sunAz: 0.5, haze: 0xa9b6c8, hazeWarm: 0xd6ccb4, glow: 0xfff2d8, skyMid: 0x9ab8dc, skyTop: 0x4c7cc0,
      hznSun: 0xe8e0c8, hznAway: 0xc4d0e0, cloudRose: 0xeef0f6, cloudShade: 0xa4aec4, cloudLit: 0xffffff,
      dustLit: 0xd6c8aa, dustShade: 0x9aa4b6, apCool: 0x98a8cc, sunCore: [3.2, 3.1, 2.8],
    },
    light: { hemi: [0xc8d8ff, 0x9a8a74, 2.5], sun: [0xfff4e4, 4.0], rim: [0xfff2dc, 0.5], fire: 0.6 },
    lines: {
      zhaoyun: ['常山趙子龍在此，董賊休得猖狂！', 'Zhao Zilong of Changshan is here. Dong Zhuo\'s lackeys, stand down!'],
      guanyu: ['溫酒之間，斬汝華雄！', 'I will take Hua Xiong\'s head before the wine grows cold!'],
      zhangfei: ['三姓家奴休走！燕人張飛在此！', 'Stand and fight, servant of three fathers! Zhang Fei of Yan is here!'],
      lubu: ['天下諸侯，無一人是我呂布對手！', 'Of all the lords under heaven, not one can match me!'],
      zhugeliang: ['董卓暴虐，天下共討之！', 'Dong Zhuo\'s tyranny ends here — all under heaven rise against him!'],
    },
  },
  {
    id: 'chibi', zh: '赤壁', en: 'RED CLIFFS', seal: '赤壁', time: '夜戰', look: 'night', set: 'river',
    intro: ['<em>赤壁</em>之戰', 'Battle of Red Cliffs — the fire attack burns through the night'],
    enemy: { ch: '曹', army: '曹軍', en: 'Cao', band: 0x2a5ad0, cloth: 0x22305a,
      officers: [['蔡瑁', 'CAI MAO'], ['張允', 'ZHANG YUN'], ['于禁', 'YU JIN'], ['曹仁', 'CAO REN']] },
    ally: { ch: '吳', label: '吳' },
    props: [{ kind: 'fireboats', at: [[-20, 39.5], [0, 43], [21, 39]] }],
    script: [
      { kind: 'officer', slots: [0, 1], goal: ['擊破 蔡瑁・張允', 'Defeat Cai Mao and Zhang Yun'],
        lines: { start: [['off:0', '水軍都督蔡瑁在此！', 'Cai Mao, admiral of the fleet, is here!']] } },
      { kind: 'reach', points: [[-20, 39.5], [0, 43], [21, 39]], r: 3.2, hold: 150, label: '火船', goal: ['點燃 火船', 'Light the fire ships'],
        lines: {
          start: [['hero', { zhugeliang: ['火船已備，點火！', 'The fire ships are ready — light them!'],
            '*': ['點燃火船，讓東風把火送進連環船！', 'Light the fire ships — let the east wind carry them into the chained fleet!'] }]],
          done: [['hero', ['火勢已成！曹軍大亂！', 'The fire has caught! Cao Cao\'s army is in chaos!']]],
        } },
      { kind: 'officer', slots: [2, 3], hp: 1.8, commander: true, goal: ['擊破 曹仁', 'Defeat Cao Ren'],
        lines: { start: [['off:3', '曹子孝在此，休得猖狂！', 'Cao Ren is here — enough of your arrogance!']] } },
    ],
    clear: ['曹操 敗走華容道', 'Cao Cao flees down the Huarong road'],
    par: { time: 220, kos: 600 },
    sky: {
      sunElev: 0.2, sunAz: -0.5, haze: 0x1e2436, hazeWarm: 0x4a5270, glow: 0x9aaad0, skyMid: 0x1c2238, skyTop: 0x080c1a,
      hznSun: 0x5a5a78, hznAway: 0x8a3a1e, cloudRose: 0x3a2a30, cloudShade: 0x12141e, cloudLit: 0x8a9ab8,
      dustLit: 0x5a3a2a, dustShade: 0x1a1e2c, apCool: 0x3a4a7a, sunCore: [2.4, 2.6, 3.0], dust: 0.1,
    },
    light: { hemi: [0x5a6a9a, 0x6a3418, 1.7], sun: [0xa8bcec, 2.0], rim: [0xff7a3a, 1.6], fire: 1.8, fires: 14 },
    post: { exposure: 1.18, skyGain: 0.3, farGain: 0.42 },
    lines: {
      zhugeliang: ['東風已借，火攻曹賊，正在今夜！', 'The east wind is ours. Tonight we burn Cao Cao\'s fleet!'],
      zhaoyun: ['軍師有令，趁火破敵！', 'The strategist\'s orders — strike while the fire rages!'],
      guanyu: ['曹賊兵敗，關某在此候之！', 'Cao Cao\'s army breaks — and Guan Yu awaits them here!'],
      zhangfei: ['燒得好！燕人張飛來也！', 'What a blaze! Here comes Zhang Fei of Yan!'],
    },
  },
];
const pick = new URLSearchParams(location.search).get('stage');
export const STAGE = STAGES.find((s) => s.id === pick) || STAGES[0];
