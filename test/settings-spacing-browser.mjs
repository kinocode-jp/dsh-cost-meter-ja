// Real React settings and lazy chunks; synthetic, offline data only.
// node test/settings-spacing-browser.mjs [path/to/react/node_modules]
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { sanitizeConfig, zeroDay } from '../lib/store.js'
import { javascriptLiteral as literal } from '../scripts/javascript-literal.mjs'

const root = resolve(import.meta.dirname, '..'), modules = resolve(process.argv[2] ?? '.tmp-pr240-host/node_modules')
const req = createRequire(join(modules, '__settings_spacing.cjs'))
const config = sanitizeConfig({ locale: 'zh', hideOfficialBalance: true, goQuota: { enabled: false } })
const day = { ...zeroDay('2026-10-18'), cost: 13.2637, apiCost: 13.2637, calls: 1393, input: 4300000, cacheRead: 138000000, output: 1500000 }
const month = { ...day, cost: 140.8907, apiCost: 140.8907, calls: 13384, input: 31400000, cacheRead: 2534000000, output: 16700000 }
const state = { config, today: day, month, total: { ...month, calls: 21623, cost: 254.8243, apiCost: 254.8243 }, history: [], codingPlans: {},
  meta: { dayKey: '2026-10-18', now: 1 }, billionContext: { connected: false },
  codexCompat: { installed: true, version: '3.0.0', planClass: 'plan', promptDue: false, historyAppliedAt: 0, promptDismissed: true,
    usage: { calls: 22, tokens: 15000, cost: 2, days: 2, providers: ['openai-codex'] } } }
const makeBundle = async baseline => {
  const read = path => baseline ? execFileSync('git', ['show', 'HEAD:' + path], { cwd: root, encoding: 'utf8' }) : readFileSync(join(root, path), 'utf8')
  const client = readdirSync(join(root, 'src/client')).filter(name => name.endsWith('.js')).sort().map(name => read('src/client/' + name)).join('')
    .replace('exports.apply = apply', 'exports.fixture = { CostSection, makeT }; exports.apply = apply')
  const code = `import React from ${literal(req.resolve('react'))};import{createRoot}from ${literal(req.resolve('react-dom/client'))};
const el=React.createElement, chunks={},factories={};window.fixtureErrors=[];window.fixtureWrites=0;
window.addEventListener('error',e=>window.fixtureErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.fixtureErrors.push(String(e.reason)));
window.__ModuleLoader__={load:m=>{factories[m.chunk??'main']=m.factory;chunks[m.chunk??'main']=m.factory(name=>name==='react'?React:{Tooltip:({children})=>children})}};
${client}
${read('src/codex/index.js')}
${read('src/statistics/index.js')}
let state=${literal(state)},listeners=new Set(),failures=0;
if(new URLSearchParams(location.search).get('locale')==='en')state.config={...state.config,locale:'en'};
window.__BILI__={origin:'http://127.0.0.1:18787'};
const totals=${literal(day)},statistics={from:'2026-10-12',to:'2026-10-18',retainedFrom:'2026-08-14',retainedTo:'2026-10-18',totals,days:[],models:[],sessions:[],providers:[],modelOptions:[],sessionCount:0,offset:0,unassignedCost:0,unmodeledCost:0};
const integration={available:true,enabled:false,saving:false,error:'',peer:{version:'0.66.0',compatible:true}};
const manager={subscribe:()=>()=>{},getSnapshot:()=>integration,preview:()=>{},refresh:()=>{},choose:()=>{}};
const stats=chunks['client.statistics.js'],codex=chunks['client.codex.js'].mount();
const loadCodex=async()=>{if(window.fixtureFailCodex&&failures++===0)throw Error('Synthetic chunk load failure');if(window.fixtureDelayCodex)await new Promise(r=>window.fixtureResolveCodex=r);return codex};
const api={loadCommunity:async()=>()=>null,loadCodex,
loadStatistics:async()=>props=>el(stats.Statistics,{...props,api,contextIntegration:{manager,getLocale:()=>state.config.locale}}),
getBillingStatistics:async()=>statistics,updateConfig:async patch=>{window.fixtureWrites++;state={...state,config:{...state.config,...patch}};listeners.forEach(fn=>fn(state));return state},
applyCodexCompatHistory:async()=>{},dismissCodexCompat:async()=>{},getContextCosts:async()=>null};
function useCost(){const[value,setValue]=React.useState(state);React.useEffect(()=>{listeners.add(setValue);return()=>listeners.delete(setValue)},[]);return{status:'ready',state:value}}
const mount=createRoot(document.getElementById('root'));let generation=0;
window.fixtureReset=(fail=false,delay=false)=>{window.fixtureFailCodex=fail;window.fixtureDelayCodex=delay;failures=0;api.loadCodex=()=>loadCodex();mount.render(el(chunks.main.fixture.CostSection,{key:++generation,useCost,api}))};window.fixtureReset();
const settle=()=>new Promise(r=>setTimeout(r,60)),check=(v,message)=>{if(!v)throw Error(message)};
window.runSpacingChecks=async()=>{const result=document.getElementById('result');result.textContent='Running';const measurements=[];try{
for(const width of [840,560,360]){document.getElementById('root').style.width=width+'px';window.fixtureReset();await settle();
const cards=[...document.querySelectorAll('.cm-overview-grid .cm-card')];check(cards.length===3,'three overview cards');
const cardHeight=Math.round(cards[0].getBoundingClientRect().height);
for(const card of cards){const sub=card.querySelector('.cm-card-sub'),s=getComputedStyle(sub);check(parseFloat(s.marginBottom)===0,'card subtitle has no empty bottom margin')}
const tabs=document.querySelector('.cm-tabs-row').getBoundingClientRect(),overview=document.querySelector('.cm-overview-grid').getBoundingClientRect();
check(overview.top-tabs.bottom<=22,'overview follows toolbar without an empty row');
document.querySelector('[role=tab][aria-selected=true]').focus();document.querySelectorAll('[role=tab]')[1].click();await settle();
const options=document.querySelector('.cm-stat-options'),heading=document.querySelector('.cm-stat-head');check(!!options,'billing options present');check(!options.open,'billing options start collapsed');
const optionsHeight=Math.round(options.getBoundingClientRect().height);check(optionsHeight<36,'collapsed billing options occupy one line');check(heading.getBoundingClientRect().top<options.getBoundingClientRect().top,'statistics heading comes before optional notices');
const section=document.querySelector('.cm-stat').getBoundingClientRect();check(section.top-tabs.bottom<=22,'statistics follows toolbar without an empty row');
options.open=true;check(!!options.querySelector('[data-billing-coverage]'),'billing coverage retained');check(!!options.querySelector('.cm-context-setting input'),'integration switch retained');options.open=false;
document.querySelectorAll('[role=tab]')[5].click();await settle();check(document.querySelector('.cm-codex-compat')?.textContent.includes('3.0.0'),'actual lazy Codex panel renders');
measurements.push({width,cardHeight,gap:Math.round(overview.top-tabs.bottom),optionsHeight});
}
window.fixtureReset(true);await settle();document.querySelectorAll('[role=tab]')[5].click();await settle();const alert=document.querySelector('[role=alert]');check(alert?.textContent.includes('Synthetic chunk load failure'),'chunk failure is visible');alert.querySelector('button').click();await settle();check(!!document.querySelector('.cm-codex-compat'),'chunk failure can be retried');
window.fixtureReset(false,true);await settle();document.querySelectorAll('[role=tab]')[5].click();await settle();check(!!document.querySelector('.cm-section [role=status].cm-loading'),'pending chunk has a visible loading state');window.fixtureResolveCodex();await settle();check(!!document.querySelector('.cm-codex-compat'),'pending load renders after completion');
for(const mode of ['close','escape','keep']){localStorage.removeItem('dsh-cost-meter:codex-compat-prompt-dismissed');const container=document.createElement('div');document.body.append(container);const root=createRoot(container),Page=factories['client.codex.js'](()=>React).mount();let finish,applied=0,dismissed=0;
const props={view:'prompt',locale:'zh',state:{codexCompat:{...state.codexCompat,promptDue:true}},api:{applyCodexCompatHistory:()=>{applied++;return new Promise(r=>finish=r)},dismissCodexCompat:()=>{dismissed++;return Promise.reject(Error('HTTP 404'))}}};root.render(el(Page,props));await settle();
let dialog=container.querySelector('dialog');check(dialog?.open,'native compatibility dialog opens');dialog.querySelector('.primary').click();await settle();check(dialog.querySelector('.primary').disabled,'pending reclassification is disabled');check(!dialog.querySelector('button[aria-label]').disabled,'close stays enabled during request');
if(mode==='escape')dialog.dispatchEvent(new Event('cancel',{cancelable:true}));else dialog.querySelectorAll('button')[mode==='close'?0:1].click();check(!dialog.open,'native dialog closes before network completion');await settle();check(!container.querySelector('dialog'),'closed dialog removed despite HTTP 404');check(applied===1&&dismissed===1,'closing only saves dismissal');finish();await settle();root.unmount();
const again=createRoot(container);again.render(el(Page,props));await settle();check(!container.querySelector('dialog'),'reopening does not repeat prompt');again.unmount();container.remove();localStorage.removeItem('dsh-cost-meter:codex-compat-prompt-dismissed');}
check(window.fixtureWrites===0,'navigation and layout do not save settings or reprice history');check(window.fixtureErrors.length===0,window.fixtureErrors.join(';'));
document.getElementById('root').style.width='';window.fixtureReset();result.textContent='PASS '+JSON.stringify(measurements);
}catch(error){result.textContent='FAIL '+error.message;throw error}};
document.getElementById('run').onclick=()=>window.runSpacingChecks().catch(()=>{});
`
  return (await build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } })).outputFiles[0].text
}
const bundles = { current: await makeBundle(false), baseline: await makeBundle(true) }
const html = baseline => `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>费用设置布局预览 · 合成数据</title><style>
:root{--dsw-alias-label-primary:#17181b;--dsw-alias-label-secondary:#666b75;--dsw-alias-label-tertiary:#858a94;--dsw-alias-label-primary-inverted:#fff;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#fff;--dsw-alias-bg-layer-3:#edf0f4;--dsw-alias-border-l1:#e7e8eb;--dsw-alias-border-l3:#e7e8eb;--dsw-alias-state-business-primary:#4174ed;--dsw-alias-interactive-bg-hover:#eff0f3;--ds-font-family-sans:system-ui}
html[data-theme=dark]{color-scheme:dark;--dsw-alias-label-primary:#ececee;--dsw-alias-label-secondary:#a6a6ad;--dsw-alias-label-tertiary:#92929c;--dsw-alias-bg-base:#202022;--dsw-alias-bg-layer-1:#29292c;--dsw-alias-bg-layer-2:#29292c;--dsw-alias-border-l1:#38383c;--dsw-alias-border-l3:#38383c;--dsw-alias-interactive-bg-hover:#38383c}
body{margin:0;background:#eee;color:var(--dsw-alias-label-primary);font:14px/1.6 system-ui}p{margin:1em 0}button{font:inherit;cursor:pointer}.test-toolbar{padding:8px 20px;font-size:12px;background:var(--dsw-alias-bg-base)}.test-toolbar span{margin-left:12px}#result{display:block;overflow-wrap:anywhere}.shell{margin:16px auto;background:var(--dsw-alias-bg-base);border:1px solid #ccc;border-radius:22px;max-width:1160px;min-height:800px;padding:28px;box-sizing:border-box}.shell>header{font-size:20px;margin-bottom:16px}#root{max-width:100%;margin-left:auto;width:840px;box-sizing:border-box}.cm-btn{cursor:pointer}@media(max-width:700px){.shell{margin:8px;padding:14px}#root{width:auto}}
</style><div class="test-toolbar"><button id="run">检查布局与 Codex</button><span>本地合成数据 · ${baseline ? '修改前' : '修改后'}</span><span id="result" role="status">Ready</span></div><main class="shell"><header>设置 / 费用</header><div id="root"></div></main><script src="/${baseline ? 'baseline' : 'current'}.js"></script><script>if(new URLSearchParams(location.search).get('theme')==='dark')document.documentElement.dataset.theme='dark'</script></html>`
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (/^\/(current|baseline)\.js$/.test(url.pathname)) { response.setHeader('content-type', 'text/javascript; charset=utf-8'); response.end(bundles[url.pathname.slice(1, -3)]); return }
  response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(html(url.searchParams.has('baseline')))
})
server.listen(0, '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/`))
