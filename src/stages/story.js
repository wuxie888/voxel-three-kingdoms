// Story mode (蜀漢演義): the battles in the order of the history, each with its officer, the scene before it and the
// scene after. A chapter unlocks when the one before it is won (progress/profile.js story). Speakers: 'narr' (the
// narrator), a hero id (pixel portrait), or a name without a portrait (a seal: 劉備, 呂布 as the enemy, …).
// Lines are [who, zh, en].
export const STORY = {
  title: '蜀漢演義', en: 'THE ROMANCE OF SHU',
  chapters: [
    {
      id: 'c1', n: '第一章', title: '桃園初陣', en: 'THE PEACH GARDEN', year: '中平元年 · 184', stage: 'huangjin', hero: 'guanyu',
      blurb: '黃巾作亂，桃園三兄弟初出茅廬。', view: [-46, 26, -40, 0, 1, 20],
      pre: [
        ['narr', '東漢末年，朝政腐敗，天災連年。鉅鹿人張角以「太平道」聚眾數十萬，頭裹黃巾，號「蒼天已死，黃天當立」。',
          'In the last years of the Han the court rotted and famine stalked the land. Zhang Jiao gathered hundreds of thousands under the Way of Great Peace, yellow scarves on their heads: "The blue sky is dead; the yellow sky shall rise."'],
        ['narr', '涿郡桃園，劉備、關羽、張飛焚香結義，誓同生死，共扶漢室。', 'In a peach garden in Zhuo, Liu Bei, Guan Yu and Zhang Fei swore brotherhood — to live and die together, and to uphold the Han.'],
        ['劉備', '黃巾作亂，百姓倒懸。二弟、三弟，今日便隨我初陣破賊！', 'The Yellow Turbans have hung the people upside down. Brothers — today we ride to our first battle!'],
        ['guanyu', '大哥放心，關某手中青龍刀，正要飲賊人之血。', 'Rest easy, elder brother. My Green Dragon blade thirsts for rebel blood.'],
        ['zhangfei', '哈哈！俺老張早就等不及了！', 'Ha! Zhang Fei has waited long enough!'],
      ],
      post: [
        ['narr', '張角伏誅，黃巾之亂漸平。桃園三傑之名，自此傳遍天下。', 'Zhang Jiao fell and the rebellion guttered out. From that day the brothers of the peach garden were known across the realm.'],
        ['劉備', '天下雖得一時安寧，然董卓擁兵入京……亂世，才剛剛開始。', 'The realm is calm for a moment — but Dong Zhuo marches on the capital. The age of chaos has only begun.'],
      ],
    },
    {
      id: 'c2', n: '第二章', title: '三英戰呂布', en: 'THREE HEROES AGAINST LÜ BU', year: '初平元年 · 190', stage: 'hulao', hero: 'zhangfei',
      blurb: '十八路諸侯討董，虎牢關前會飛將。', view: [40, 24, -30, -4, 2, 40],
      pre: [
        ['narr', '董卓廢帝專權，殘暴無道。十八路諸侯會盟討董，兵臨汜水、虎牢。', 'Dong Zhuo deposed the emperor and ruled by terror. Eighteen lords allied against him and marched on Sishui and Hulao.'],
        ['narr', '董卓帳下猛將華雄連斬聯軍數將；而虎牢關中，更有天下無雙的飛將呂布。', 'His champion Hua Xiong had cut down general after general — and behind Hulao Gate waited Lü Bu, peerless under heaven.'],
        ['zhangfei', '呂布那三姓家奴，俺老張今日便要會會他！', 'That servant of three fathers — today Zhang Fei will meet him!'],
        ['guanyu', '三弟莫急。先斬華雄，再取呂布。', 'Patience, brother. First Hua Xiong — then Lü Bu.'],
      ],
      post: [
        ['narr', '劉關張三人合戰呂布，呂布不敵，退入關中。「三英戰呂布」，名震諸侯。', 'The three brothers fought Lü Bu together until he gave way. "The three heroes against Lü Bu" became the talk of every lord.'],
        ['呂布', '……今日之辱，呂布記下了。', '…Lü Bu will remember this day.'],
      ],
    },
    {
      id: 'c3', n: '第三章', title: '單騎救主', en: 'ALONE FOR HIS LORD', year: '建安十三年 · 208', stage: 'changban', hero: 'zhaoyun',
      blurb: '曹軍追至長坂，趙雲懷抱阿斗七進七出。', view: [44, 22, -50, -10, 1, 0],
      pre: [
        ['narr', '曹操統一北方，親率大軍南下。劉備攜十萬百姓撤往江陵，於當陽長坂被曹軍追上。', 'With the north in his hands Cao Cao marched south. Liu Bei fled toward Jiangling with a hundred thousand refugees — and at Changban the Wei cavalry caught them.'],
        ['劉備', '亂軍之中……糜夫人與阿斗失散了！', 'In the chaos… Lady Mi and A Dou are lost!'],
        ['zhaoyun', '主公勿憂！縱有百萬曹軍，子龍也必救回少主！', 'Fear not, my lord! Let Cao Cao field a million men — I will bring the young lord home!'],
        ['zhangfei', '子龍放心去！長坂橋有俺張飛守著！', 'Go, Zilong! Zhang Fei will hold Changban Bridge!'],
      ],
      post: [
        ['narr', '趙雲懷抱阿斗，於曹軍陣中七進七出；張飛據水斷橋，一聲斷喝，曹軍無人敢前。', 'Zhao Yun cut through the Wei lines seven times with A Dou in his arms; Zhang Fei held the bridge, and at his roar no Wei soldier dared come on.'],
        ['劉備', '為此孺子，幾損我一員大將！', 'For this child, I nearly lost one of my finest generals!'],
      ],
    },
    {
      id: 'c4', n: '第四章', title: '火燒赤壁', en: 'FIRE AT RED CLIFFS', year: '建安十三年 · 208', stage: 'chibi', hero: 'zhugeliang',
      blurb: '萬事俱備，只欠東風。', view: [-50, 20, 20, 0, 3, 70],
      pre: [
        ['narr', '曹操號稱八十萬大軍，水陸並進，直逼江東。孫權、劉備結盟，共抗曹軍。', 'Cao Cao came down the river with a host he called eight hundred thousand. Sun Quan and Liu Bei joined hands against him.'],
        ['narr', '曹軍不習水戰，以鐵索連船。周瑜、諸葛亮定下火攻之計——萬事俱備，只欠東風。', 'The northerners could not stand the rivers, so they chained their ships together. Zhou Yu and Zhuge Liang planned a fire attack — all it lacked was an east wind.'],
        ['zhugeliang', '東風已借。今夜，便是火燒曹營之時。', 'The east wind is ours. Tonight the Wei fleet burns.'],
      ],
      post: [
        ['narr', '東風驟起，火船衝入連環船陣，曹軍大敗。曹操自華容道狼狽而逃。', 'The east wind rose, the fire ships drove into the chained fleet, and Wei was routed. Cao Cao fled down the Huarong road.'],
        ['zhugeliang', '天下三分之勢，自此而定。', 'From tonight, the realm is split in three.'],
      ],
    },
    {
      id: 'c5', n: '第五章', title: '水淹七軍', en: 'THE FLOOD OF THE HAN', year: '建安二十四年 · 219', stage: 'fancheng', hero: 'guanyu',
      blurb: '秋雨連綿，漢水暴漲，關羽威震華夏。', view: [46, 22, -10, 0, 2, 50],
      pre: [
        ['narr', '劉備取得漢中，進位漢中王。關羽自荊州北伐，圍攻曹仁據守的樊城。', 'Liu Bei took Hanzhong and was proclaimed its king. Guan Yu struck north from Jing Province and laid siege to Fancheng, held by Cao Ren.'],
        ['narr', '曹操遣于禁、龐德率七軍救援。時值秋雨連綿，漢水暴漲。', 'Cao Cao sent Yu Jin and Pang De with seven armies to relieve the city. It was autumn; the rains did not stop, and the Han rose.'],
        ['guanyu', '于禁七軍屯於低地……天時在我。掘開堤壩，以水代兵！', 'Yu Jin\'s armies camp on low ground… heaven is with us. Breach the dams — let the river fight for us!'],
      ],
      post: [
        ['narr', '漢水決堤，七軍盡沒。于禁乞降，龐德不屈而死。關羽威震華夏。', 'The Han burst its banks and the seven armies drowned. Yu Jin begged for his life; Pang De died unbowed. Guan Yu\'s might shook all of China.'],
        ['guanyu', '大哥，關某不負桃園之誓。', 'Elder brother — I have kept the oath of the peach garden.'],
        ['narr', '然而江東孫權，已在暗中窺伺荊州……（待續）', 'Yet in the east, Sun Quan was already watching Jing Province… (to be continued)'],
      ],
    },
  ],
};
export const chapterById = (id) => STORY.chapters.find((c) => c.id === id) || null;
export const nextChapter = (c) => STORY.chapters[STORY.chapters.indexOf(c) + 1] || null;
