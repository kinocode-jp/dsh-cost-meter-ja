import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { Ledger, sanitizeConfig, localDayKey } from '../lib/store.js'
import { applyAccount, mergeLedger } from '../lib/ledger-persistence.js'
import { frozenAmounts, freezeLegacyAmounts, fxRateFor } from '../lib/exchange-rates.js'
import { createExchangeRateRefresh } from '../lib/exchange-rate-refresh.js'
import { parse } from 'acorn'

const root = mkdtempSync(join(tmpdir(), 'cm-jpy-first-quote-'))
const at = Date.now(), date = localDayKey(at)
const config = sanitizeConfig({ currency: 'JPY', exchangeRate: 150, exchangeRateAuto: true,
  prices: { providers: { fixture: { models: { model: { input: 1, output: 1, billingMode: 'flat' }, other: { input: 1, output: 1, billingMode: 'flat' } } } } } })
const quote = { ...config, exchangeRate: 160, fxRates: { ...config.fxRates, JPY: 160 } }
const rows = day => [day, ...Object.values(day.byProviderModel), ...day.sessions.flatMap(s => [s, ...Object.values(s.byProviderModel)])]
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const check = ledger => {
  for (const row of rows(ledger.days[date])) { near(row.costJpy, row.cost * 160); near(row.apiCostJpy, row.apiCost * 160) }
  near(ledger.sumDays().costJpy, ledger.sumDays().cost * 160)
}
try {
  for (const persistFirst of [false, true]) {
    let ledger = new Ledger(config, {}, join(root, `ledger-${persistFirst}.json`))
    const call = (model = 'model', session = 'existing') => ledger.account({ input: 1e6 }, model, session, at, 'fixture')
    try {
      call()
      for (const row of rows(ledger.days[date])) {
        assert.equal(Object.hasOwn(row, 'costJpy'), false)
        assert.equal(Object.hasOwn(row, 'apiCostJpy'), false)
      }
      if (persistFirst) { ledger.close(); ledger = Ledger.load(ledger.path) }
      const refresh = createExchangeRateRefresh(ledger, { request: async () => ({ ok: true, text: async () => JSON.stringify([
        { base: 'USD', quote: 'CNY', date: new Date(at).toISOString().slice(0, 10), rate: 7.2 },
        { base: 'USD', quote: 'EUR', date: new Date(at).toISOString().slice(0, 10), rate: .92 },
        { base: 'USD', quote: 'JPY', date: new Date(at).toISOString().slice(0, 10), rate: 160 },
      ]) }) })
      assert.equal(await refresh.refresh(), true); refresh.dispose()
      check(ledger) // first quote, BEFORE subsequent accumulation
      call(); check(ledger) // existing day/session/model
      call('other'); call('model', 'new'); check(ledger)
      ledger.flush(); check(ledger)
      ledger.close(); ledger = Ledger.load(ledger.path); check(ledger)
      const sibling = Ledger.load(ledger.path)
      call(); sibling.account({ input: 1e6 }, 'model', 'sibling', at, 'fixture')
      ledger.flush(); sibling.close(); ledger.refresh(); check(ledger)
      near(ledger.days[date].cost, 6)
    } finally { ledger.close() }
  }
  // Force the concurrent merge path before any quote: absent is not numeric zero.
  const state = () => ({ version: 1, config, days: {}, planSamples: {}, planHourBuckets: {} })
  const entry = id => ({ date, sessionId: id, atMs: at, providerKey: 'fixture:model', planId: null,
    values: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, calls: 1, cost: 1, apiCost: 1, ...frozenAmounts(1, 1, config) } })
  const direct = state()
  applyAccount(direct, entry('existing'))
  direct.config = quote // exercise pre-add backfill without the Ledger setter
  applyAccount(direct, { ...entry('existing'), values: { ...entry('existing').values, ...frozenAmounts(1, 1, quote) } })
  for (const row of rows(direct.days[date])) { near(row.costJpy, 320); near(row.apiCostJpy, 320) }
  const base = state(), local = state(), disk = state()
  applyAccount(local, entry('local')); applyAccount(disk, entry('disk'))
  const merged = mergeLedger(base, local, disk, [])
  for (const row of rows(merged.days[date])) assert.equal(Object.hasOwn(row, 'costJpy'), false)
  freezeLegacyAmounts(merged.days, quote)
  for (const row of rows(merged.days[date])) near(row.costJpy, row.cost * 160)
  // Legitimate zero and frozen historical rates are never blanket-repaired.
  const old = { cost: 1, apiCost: 0, costJpy: 0, apiCostJpy: 0, sessions: [], byProviderModel: {} }
  const frozen = { ...old, costJpy: 123 }
  freezeLegacyAmounts({ old, frozen }, quote)
  assert.equal(old.costJpy, 0); assert.equal(old.apiCostJpy, 0); assert.equal(frozen.costJpy, 123)
  for (const historicalRate of [0, 123]) {
    const history = new Ledger(quote, {}, join(root, `frozen-${historicalRate}.json`))
    try {
      history.account({ input: 1e6 }, 'model', 'frozen', at, 'fixture')
      for (const row of rows(history.days[date])) { row.costJpy = historicalRate; row.apiCostJpy = 0 }
      history.flush()
      history.account({ input: 1e6 }, 'model', 'frozen', Date.now() + 1, 'fixture')
      history.flush()
      for (const row of rows(history.days[date])) { near(row.costJpy, historicalRate + 160); near(row.apiCostJpy, 160) }
    } finally { history.close() }
  }
  // Persisted parent FX is authoritative even when child FX was never saved.
  // Inferred child amounts at the first quote must not silently repair the parent.
  for (const savedJpy of [0, 123]) {
    const partial = state()
    applyAccount(partial, entry('partial'))
    partial.days[date].costJpy = savedJpy
    partial.days[date].apiCostJpy = savedJpy
    partial.days[date].byProviderModel['fixture:model'].costJpy = savedJpy
    partial.days[date].byProviderModel['fixture:model'].apiCostJpy = savedJpy
    const local = structuredClone(partial); local.config = quote
    const result = mergeLedger(partial, local, structuredClone(partial), [])
    near(result.days[date].costJpy, savedJpy); near(result.days[date].apiCostJpy, savedJpy)
    near(result.days[date].byProviderModel['fixture:model'].costJpy, savedJpy)
    near(result.days[date].sessions[0].costJpy, 160)
    const path = join(root, `partial-${savedJpy}.json`)
    writeFileSync(path, JSON.stringify({ ...partial, config: quote }))
    const loaded = Ledger.load(path)
    try {
      near(loaded.days[date].costJpy, savedJpy)
      loaded.account({ input: 1e6 }, 'model', 'partial', Date.now() + 1, 'fixture')
      loaded.flush()
      near(loaded.days[date].costJpy, savedJpy + 160)
      near(loaded.days[date].apiCostJpy, savedJpy + 160)
      near(loaded.days[date].byProviderModel['fixture:model'].costJpy, savedJpy + 160)
      near(loaded.days[date].byProviderModel['fixture:model'].apiCostJpy, savedJpy + 160)
    } finally { loaded.close() }
  }
  const manual = new Ledger(config, {}, join(root, 'manual.json'))
  try {
    manual.account({ input: 1e6 }, 'model', 'manual', at, 'fixture')
    manual.config = { ...manual.config, exchangeRateAuto: false, exchangeRate: 200, fxRates: { ...manual.config.fxRates, JPY: 150 } }
    near(manual.days[date].costJpy, 200)
    manual.account({ input: 1e6 }, 'model', 'manual', Date.now() + 1, 'fixture')
    near(manual.days[date].costJpy, 400)
    manual.flush(); near(manual.days[date].costJpy, 400)
  } finally { manual.close() }
  console.log('[ok] JPY first quote: absent/add/merge, existing buckets, pending replay, refresh, restart, manual and frozen zeros')
} finally {
  assert.equal(dirname(root), tmpdir())
  rmSync(root, { recursive: true, force: true })
}

// Execute the actual helpers from BOTH readable source and shipped minified bundle.
for (const file of ['../src/client/02-validators-helpers-sidebar.js', '../lib/client.js']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  // The readable fragment is inside a factory body and is not a standalone module.
  const wrapped = file.includes('/src/') ? `function fixture(){${source}}` : source
  const ast = parse(wrapped, { ecmaVersion: 'latest' }), functions = []
  const walk = (node, visit) => {
    if (!node || typeof node !== 'object') return
    visit(node)
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(n => walk(n, visit)); else if (value && typeof value === 'object') walk(value, visit)
  }
  walk(ast, n => { if (n.type === 'FunctionDeclaration') functions.push(n) })
  const text = node => wrapped.slice(node.start, node.end)
  const rateNode = functions.find(n => text(n).length < 1000 && text(n).includes('fxRates?.[') && /['"]JPY['"]/.test(text(n)))
  const balanceNode = functions.find(n => text(n).length < 1200 && /['"]CREDITS['"]/.test(text(n)) && /['"]official['"]/.test(text(n)) && /['"]custom['"]/.test(text(n)))
  assert.ok(rateNode, `${file}: rate helper`); assert.ok(balanceNode, `${file}: balance helper`)
  const rate = new Function(`${text(rateNode)};return ${rateNode.id.name}`)()
  const calls = new Set()
  walk(balanceNode.body, n => { if (n.type === 'CallExpression' && n.callee.type === 'Identifier') calls.add(n.callee.name) })
  const deps = [...calls].filter(name => name !== rateNode.id.name && name !== 'Number')
  // Conditional helpers: official USD attribution and custom account unit.
  const officialCall = balanceNode.body.body.find(n => n.type === 'VariableDeclaration' && n.declarations.some(d => d.init?.type === 'ConditionalExpression' && d.init.consequent.type === 'CallExpression'))
  const officialName = officialCall.declarations.find(d => d.init?.type === 'ConditionalExpression').init.consequent.callee.name
  const balance = new Function(...deps, `${text(rateNode)};${text(balanceNode)};return ${balanceNode.id.name}`)(...deps.map(name => name === officialName ? s => s.today.official : (_c, custom) => custom.unit))
  const displayNode = functions.find(n => text(n).length < 1200 && /toUpperCase\(/.test(text(n)) && /['"]USD['"]/.test(text(n)) && /['"]EUR['"]/.test(text(n)) && /['"]JPY['"]/.test(text(n)) && text(n).includes(rateNode.id.name + '('))
  assert.ok(displayNode, `${file}: balance display helper`)
  const displayCalls = new Set()
  walk(displayNode.body, n => { if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && ![rateNode.id.name, 'Number'].includes(n.callee.name)) displayCalls.add(n.callee.name) })
  const inDisplay = new Function(...displayCalls, `${text(rateNode)};${text(displayNode)};return ${displayNode.id.name}`)(...Array.from(displayCalls, () => usd => usd))
  for (const display of ['USD', 'CNY', 'EUR', 'JPY']) for (const auto of [true, false, undefined]) {
    const cfg = { currency: display, exchangeRateAuto: auto, exchangeRate: { USD: 1, CNY: 8, EUR: .8, JPY: 200 }[display], fxRates: { CNY: 7.2, EUR: .92, JPY: 150 } }
    for (const currency of ['USD', 'CNY', 'EUR', 'JPY']) {
      near(rate(cfg, currency), fxRateFor(cfg, currency))
      const state = { today: { cost: 2, official: 1 }, balance: { currency } }
      near(balance(state, cfg, 'official'), fxRateFor(cfg, currency))
      near(balance(state, cfg, 'custom', { unit: currency }), 2 * fxRateFor(cfg, currency))
      if (display === 'JPY' && currency !== 'JPY') near(inDisplay(10, cfg, currency.toLowerCase()), 10 / fxRateFor(cfg, currency))
      else assert.equal(inDisplay(10, cfg, currency), null)
    }
    assert.equal(balance({ today: { cost: 2 } }, cfg, 'custom', { unit: 'CREDITS' }), 0)
  }
  for (const invalid of [undefined, 0, -1, NaN, Infinity, 1e6, '200']) {
    const cfg = { currency: 'JPY', exchangeRateAuto: false, exchangeRate: invalid, fxRates: { JPY: 160 } }
    near(rate(cfg, 'JPY'), fxRateFor(cfg, 'JPY'))
  }
  near(rate({ currency: 'JPY', exchangeRateAuto: true, exchangeRate: 999 }, 'JPY'), 150)
  console.log(`[ok] FX display/balance cross-product, manual priority and invalid quotes: ${file}`)
}
