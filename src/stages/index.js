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
  {
    id: 'huangjin', zh: '黃巾之亂', en: 'YELLOW TURBANS', seal: '黃巾', time: '清晨', look: 'dusk', set: 'altars',
    intro: ['<em>黃巾之亂</em>', 'The Yellow Turban Rebellion — the sorcerer Zhang Jiao rises at Guangzong'],
    enemy: { ch: '黃', army: '黃巾軍', en: 'Yellow Turban', band: 0xe0b020, cloth: 0x7a6430,
      officers: [['程遠志', 'CHENG YUANZHI'], ['鄧茂', 'DENG MAO'], ['張寶', 'ZHANG BAO'], ['張梁', 'ZHANG LIANG']] },
    ally: { ch: '漢', label: '漢' },
    // the three altars of the Way of Great Peace: break them and the sorcery breaks with them
    props: [{ kind: 'altars', at: [[-22, 18], [24, 12], [2, 34]] }],
    script: [
      { kind: 'officer', slots: [0, 1], goal: ['擊破 程遠志・鄧茂', 'Defeat Cheng Yuanzhi and Deng Mao'],
        lines: { start: [['off:0', '蒼天已死，黃天當立！誰敢擋我黃巾大軍！', 'The blue sky is dead, the yellow sky shall rise! Who dares stand before us?'],
          ['hero', { guanyu: ['初陣在此，正好拿你祭刀！', 'My first battle — your head will christen my blade!'], zhangfei: ['好！俺老張正手癢！', 'Ha! My spear has been itching for this!'],
            '*': ['黃巾賊寇，速速受死！', 'Yellow Turban bandits — your end is here!'] }]] } },
      { kind: 'destroy', points: [[-22, 18], [24, 12], [2, 34]], hp: 900, r: 2.3, label: '祭壇', goal: ['破壞 黃巾祭壇', 'Destroy the Yellow Turban altars'],
        lines: { start: [['off:2', '天公將軍法力無邊，祭壇在此，汝等休想近前！', 'The General of Heaven\'s sorcery knows no bounds — none shall reach the altars!']],
          done: [['hero', ['妖壇已破，妖術不攻自破！', 'The altars are broken — and their sorcery with them!']]] } },
      { kind: 'officer', slots: [2, 3], goal: ['擊破 張寶・張梁', 'Defeat Zhang Bao and Zhang Liang'],
        lines: { start: [['off:3', '大哥的大業，豈容爾等破壞！', 'You will not ruin our brother\'s great cause!']] } },
      { kind: 'officer', slots: [0], names: [['張角', 'ZHANG JIAO']], hp: 2.4, commander: true, goal: ['擊破 張角', 'Defeat Zhang Jiao'],
        lines: { start: [['off:0', '吾乃天公將軍張角！黃天之下，眾生皆吾信徒！', 'I am Zhang Jiao, General of Heaven! Under the yellow sky all are my faithful!']] } },
    ],
    clear: ['黃巾之亂 平定', 'The Yellow Turban rebellion is crushed'],
    par: { time: 230, kos: 550 },
    sky: {
      sunElev: 0.32, sunAz: -0.7, haze: 0xc2ad80, hazeWarm: 0xe6c690, glow: 0xfff0c8, skyMid: 0xd4bd88, skyTop: 0x88a0bc,
      hznSun: 0xffdc98, hznAway: 0xcdb486, cloudRose: 0xf0deb4, cloudShade: 0xa89670, cloudLit: 0xfff4d8,
      dustLit: 0xe2c88e, dustShade: 0x9a8a66, apCool: 0xa8a07e, sunCore: [3.0, 2.8, 2.2], dust: 0.2,
    },
    light: { hemi: [0xe8dcc0, 0x8a7a5a, 2.2], sun: [0xfff0d0, 3.3], rim: [0xffe0a0, 0.7], fire: 0.8 },
    post: { exposure: 1.1, sat: 1.1 },
    lines: {
      guanyu: ['桃園結義，誓同生死——今日便是初陣！', 'Sworn brothers in the peach garden — today is our first battle!'],
      zhangfei: ['大哥二哥，看俺張飛殺他個痛快！', 'Brothers, watch Zhang Fei cut them down!'],
      zhaoyun: ['亂世之中，當以長槍護佑蒼生！', 'In a world in chaos, my spear shall guard the people!'],
      zhugeliang: ['黃巾雖眾，不過烏合之眾耳。', 'The Yellow Turbans are many — but a rabble all the same.'],
      lubu: ['區區黃巾，也配與我呂布交手？', 'Yellow Turban rabble — fit to cross blades with Lü Bu?'],
    },
  },
  {
    id: 'fancheng', zh: '樊城', en: 'FANCHENG', seal: '樊城', time: '秋雨', look: 'storm', set: 'flood', weather: 'rain',
    intro: ['<em>樊城</em>之戰', 'Battle of Fancheng — the autumn rains swell the Han river'],
    enemy: { ch: '魏', army: '魏軍', en: 'Wei', band: 0x3a5ad0, cloth: 0x2a3050,
      officers: [['董衡', 'DONG HENG'], ['董超', 'DONG CHAO'], ['于禁', 'YU JIN'], ['龐德', 'PANG DE']] },
    ally: { ch: '蜀', label: '蜀' },
    // 水淹七軍: the levee dams along the swollen Han; breach them and the river takes Yu Jin's seven armies
    props: [{ kind: 'dams', at: [[-24, 40], [0, 43], [24, 40]] }],
    script: [
      { kind: 'officer', slots: [0, 1], goal: ['擊破 董衡・董超', 'Defeat Dong Heng and Dong Chao'],
        lines: { start: [['off:0', '七軍在此，關羽安敢來犯！', 'The seven armies stand here — how dare Guan Yu attack!']] } },
      { kind: 'destroy', points: [[-24, 40], [0, 43], [24, 40]], hp: 1000, r: 2.8, label: '堤壩', flood: true, goal: ['掘開 漢水堤壩', 'Breach the Han river dams'],
        lines: { start: [['hero', { guanyu: ['秋雨連綿，漢水暴漲——掘開堤壩，水淹七軍！', 'The rains have swollen the Han — breach the dams and drown the seven armies!'],
            '*': ['漢水暴漲，掘開堤壩，以水代兵！', 'The Han is in flood — breach the dams and let the river fight for us!'] }]],
          done: [['hero', ['大水來了！', 'Here comes the water!']]] } },
      { kind: 'officer', slots: [2], goal: ['擊破 于禁', 'Defeat Yu Jin'],
        lines: { start: [['off:2', '大水……七軍盡沒……吾當如何是好！', 'The water... the seven armies are lost... what am I to do!']] } },
      { kind: 'officer', slots: [3], hp: 2.6, commander: true, goal: ['擊破 龐德', 'Defeat Pang De'],
        lines: { start: [['off:3', '吾寧為國家鬼，不為賊將也！', 'I would rather die a ghost of my state than live as a rebel\'s general!']] } },
    ],
    clear: ['威震華夏', 'His might shakes the whole realm'],
    par: { time: 240, kos: 650 },
    sky: {
      sunElev: 0.3, sunAz: 0.2, haze: 0x6e7884, hazeWarm: 0x848c96, glow: 0xb8c2cc, skyMid: 0x5e6874, skyTop: 0x343c48,
      hznSun: 0x8e98a2, hznAway: 0x646e78, cloudRose: 0x6e747c, cloudShade: 0x30363e, cloudLit: 0xa2aab2,
      dustLit: 0x80888e, dustShade: 0x444c56, apCool: 0x627288, sunCore: [1.4, 1.5, 1.6], dust: 0.1,
    },
    light: { hemi: [0x9aa8bc, 0x4a4a48, 2.1], sun: [0xc8d4e0, 2.3], rim: [0x9ab0c8, 0.6], fire: 0.35 },
    lines: {
      guanyu: ['關某在此，曹賊七軍，今日皆休！', 'Guan Yu is here — today Cao Cao\'s seven armies end!'],
      zhangfei: ['二哥用水，俺用矛！', 'Second brother brings the river — I bring my spear!'],
    },
  },
];
// in the order of the history on the title screen; a first visit opens on 長坂坡
const ORDER = ['huangjin', 'hulao', 'changban', 'chibi', 'fancheng'];
STAGES.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
const pick = new URLSearchParams(location.search).get('stage');
export const STAGE = STAGES.find((s) => s.id === pick) || STAGES.find((s) => s.id === 'changban');
