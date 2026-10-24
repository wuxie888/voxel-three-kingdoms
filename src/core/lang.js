// Script: 繁體 / 简体. The text is written in 繁體; with 简体 on (the default — 繁體 for Taiwan, Hong Kong and Macau
// browsers — or as chosen on the title screen) what the page shows goes through a character map (core/hans-map.js,
// built by tools/hans.mjs): the document at boot, every node the UI adds or changes afterwards (a MutationObserver),
// and the few labels drawn on canvases (t()). The brush face follows: Yuji Boku has no simplified forms, so 简体
// loads a Ma Shan Zheng cut (src/ui/brush-sc.woff2, OFL) under the same family name.
import { T2S } from './hans-map.js';
import { settings, saveSettings } from './settings.js';

const MAP = new Map();
for (let i = 0; i < T2S.length; i += 2) MAP.set(T2S[i], T2S[i + 1]);
const hantLocale = () => (navigator.languages || [navigator.language || '']).some((l) => /^zh-(tw|hk|mo)\b|hant/i.test(l));
export const LANG = settings.lang === 'hans' || settings.lang === 'hant' ? settings.lang : hantLocale() ? 'hant' : 'hans';
export const HANS = LANG === 'hans';
const CJK = /[㐀-鿿豈-﫿]/g;
/** A string as shown (简体 when that is on). */
export const t = (s) => (HANS && s ? String(s).replace(CJK, (c) => MAP.get(c) || c) : s);
/** Switch and reload (text and fonts are set up at boot). */
export function setLang(l) { saveSettings({ lang: l }); location.reload(); }

const ATTRS = ['title', 'alt', 'aria-label', 'placeholder'];
function attrs(el) {
  for (const a of ATTRS) if (el.hasAttribute(a)) { const v0 = el.getAttribute(a), v = t(v0); if (v !== v0) el.setAttribute(a, v); }
}
function convert(node) {
  if (node.nodeType === 3) { const v = t(node.data); if (v !== node.data) node.data = v; return; }
  if (node.nodeType !== 1 || node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE') return;
  attrs(node);
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const v = t(n.data); if (v !== n.data) n.data = v; }
  for (const el of node.querySelectorAll('[title],[alt],[aria-label],[placeholder]')) attrs(el);
}
/** At boot: the page in the chosen script, now and as the UI changes it. */
export function applyLang(root = document.body) {
  document.documentElement.lang = HANS ? 'zh-Hans' : 'zh-Hant';
  if (!HANS) return;
  document.title = t(document.title);
  const st = document.createElement('style');
  st.textContent = '@font-face { font-family: "HudBrush"; src: url(./src/ui/brush-sc.woff2) format("woff2"); font-display: swap; }';
  document.head.appendChild(st);
  convert(root);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') convert(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else for (const n of m.addedNodes) convert(n);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
