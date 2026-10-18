// 日本語フォーク: 日本円(JPY)の表示通貨・カスタム見積もり・過去金額の凍結。
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ledger, sanitizeConfig, applyJapaneseDefaults, defaultConfig } from '../lib/store.js'
import { createExchangeRateRefresh, parseExchangeRates, EXCHANGE_RATE_URL } from '../lib/exchange-rate-refresh.js'
import { fxRatesOf, fxRateFor, frozenAmounts, freezeLegacyAmounts, displayUsd, DEFAULT_JPY_RATE } from '../lib/exchange-rates.js'
import { usdFromCost, normalizeCustomPrice } from '../lib/pricing.js'
import { currencyLedger } from '../lib/currency-view.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

// レートが分かるまで JPY は fxRates に入らず、凍結もしない。
assert.equal(fxRatesOf({}).JPY, undefined)
assert.equal(fxRateFor({}, 'JPY'), DEFAULT_JPY_RATE)
assert.equal(fxRatesOf({ fxRates: { JPY: 158 } }).JPY, 158)
assert.equal(fxRatesOf({ currency: 'JPY', exchangeRate: 160 }).JPY, undefined, '自動更新中の表示レート(既定 150 など)では凍結しない')
assert.equal(fxRatesOf({ currency: 'JPY', exchangeRate: 160, exchangeRateAuto: false }).JPY, 160, '手入力レートは実レート')
assert.equal(frozenAmounts(1, 1, {}).costJpy, undefined)
near(frozenAmounts(2, 1, { fxRates: { JPY: 158 } }).costJpy, 316)
near(frozenAmounts(2, 1, { fxRates: { JPY: 158 } }).apiCostJpy, 158)

// 過去の記録: JPY が分かった時点のレートで埋め、CNY/EUR の凍結値は変えない。
const days = { '2026-10-01': { date: '2026-10-01', cost: 2, apiCost: 1, costCny: 14, apiCostCny: 7, costEur: 1.8, apiCostEur: .9, sessions: [], byProviderModel: {} } }
freezeLegacyAmounts(days, { exchangeRate: 7 })
assert.equal(days['2026-10-01'].costJpy, undefined, 'レート未取得なら円額を作らない')
freezeLegacyAmounts(days, { exchangeRate: 7, fxRates: { CNY: 6.5, EUR: .8, JPY: 158 } })
near(days['2026-10-01'].costJpy, 316); near(days['2026-10-01'].apiCostJpy, 158); near(days['2026-10-01'].costCny, 14)
near(displayUsd(days['2026-10-01'], { currency: 'JPY', exchangeRate: 160 }) * 160, 316, '凍結した円額をそのまま表示')

// 既定: 言語は日本語、通貨は日本円。上流の既定のままの項目だけを切り替える。
const ja = applyJapaneseDefaults(defaultConfig())
assert.equal(ja.locale, 'ja'); assert.equal(ja.currency, 'JPY'); assert.equal(ja.symbol, '¥'); assert.equal(ja.exchangeRate, DEFAULT_JPY_RATE)
assert.equal(applyJapaneseDefaults({ locale: 'auto', currency: 'CNY', fxRates: { JPY: 158 } }).exchangeRate, 158)
const chosen = applyJapaneseDefaults({ locale: 'en', currency: 'EUR', symbol: '€' })
assert.equal(chosen.locale, 'en'); assert.equal(chosen.currency, 'EUR', '明示的に選んだ言語・通貨は変えない')

// 取得: JPY は任意(なくても CNY/EUR は更新する)。
const at = Date.parse('2026-10-16T12:00:00Z')
assert.ok(EXCHANGE_RATE_URL.includes('JPY'))
const rows = [{ base: 'USD', quote: 'CNY', date: '2026-10-16', rate: 6.5 }, { base: 'USD', quote: 'EUR', date: '2026-10-16', rate: .8 }]
assert.equal(parseExchangeRates(rows, at).rates.JPY, undefined)
assert.equal(parseExchangeRates([...rows, { base: 'USD', quote: 'JPY', date: '2026-10-16', rate: 158 }], at).rates.JPY, 158)

// カスタム見積もり: JPY を受け付け、1 USD あたりの円で割ってドルに戻す。
assert.equal(normalizeCustomPrice({ currency: 'JPY', cacheMiss: 100, cacheHit: 10, output: 400 })?.currency, 'JPY')
near(usdFromCost(1580, 'JPY', 7, 158), 10)
near(usdFromCost(150, 'JPY', 7), 1, '円のレートが渡らなければ既定値')
near(usdFromCost(70, 'CNY', 7, 158), 10, 'CNY の換算は変わらない')

// 台帳: 初回の JPY 取得で過去の記録に円額を付け、以降の記録は記録時のレートで凍結する。
const root = mkdtempSync(join(tmpdir(), 'cm-jpy-'))
let ledger
try {
  ledger = new Ledger(sanitizeConfig({ exchangeRate: 7 }), { '2026-10-01': { date: '2026-10-01', cost: 2, apiCost: 2, sessions: [], byProviderModel: {} } }, join(root, 'ledger.json'))
  assert.equal(ledger.sumDays().costJpy, undefined)
  const response = [...rows, { base: 'USD', quote: 'JPY', date: '2026-10-16', rate: 158 }]
  const refresh = createExchangeRateRefresh(ledger, { now: () => at, request: async () => ({ ok: true, text: async () => JSON.stringify(response) }) })
  assert.equal(await refresh.refresh(), true)
  assert.equal(ledger.config.fxRates.JPY, 158)
  near(ledger.sumDays().costJpy, 316)
  near(ledger.sumDays().costCny, 14, '既存の人民元額は保持')
  refresh.dispose()
  ledger.config = { ...ledger.config, currency: 'JPY', exchangeRate: 158 }
  const view = currencyLedger(ledger, 'JPY')
  near(view.days['2026-10-01'].cost * view.config.exchangeRate, 316)
  console.log('[ok] JPY: rates only when known, legacy rows filled on first quote, custom JPY quotes, JPY view')
} finally { ledger?.close(); rmSync(root, { recursive: true, force: true }) }

// 整形処理は locale 'ja' を保持する(以前は auto に戻していた)。
{
  const { sanitizeConfig: sanitize } = await import('../lib/store.js')
  assert.equal(sanitize({ locale: 'ja' }).locale, 'ja')
}
