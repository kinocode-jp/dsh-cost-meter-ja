/** Historical display amounts are additive; USD remains the canonical billing unit. */
export const FX_FIELDS = ['costCny', 'apiCostCny', 'costEur', 'apiCostEur', 'costJpy', 'apiCostJpy']
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e6
// 日本語フォーク: JPY は実際のレート(自動取得、または表示通貨 JPY の手入力レート)が分かるまで
// fxRates に入れない。仮のレートで過去の円額を凍結しないため。換算が必要な場面だけ既定値を使う。
export const DEFAULT_JPY_RATE = 150
export function fxRatesOf(config = {}) {
  const rates = { USD: 1, CNY: 7.2, EUR: 0.92 }
  for (const key of ['CNY', 'EUR', 'JPY']) if (positive(config.fxRates?.[key])) rates[key] = config.fxRates[key]
  if (['CNY', 'EUR', 'JPY'].includes(config.currency) && positive(config.exchangeRate)) rates[config.currency] = config.exchangeRate
  return rates
}
/** Rate for one display currency, falling back to the JPY default before a quote is known. */
export function fxRateFor(config, currency) {
  return fxRatesOf(config)[currency] ?? (currency === 'JPY' ? DEFAULT_JPY_RATE : 1)
}
export function frozenAmounts(cost, apiCost, config) {
  const rates = fxRatesOf(config)
  return { costCny: cost * rates.CNY, apiCostCny: apiCost * rates.CNY, costEur: cost * rates.EUR, apiCostEur: apiCost * rates.EUR,
    ...(rates.JPY ? { costJpy: cost * rates.JPY, apiCostJpy: apiCost * rates.JPY } : {}) }
}
export function frozenFields(row) {
  return Object.fromEntries(FX_FIELDS.filter(key => Number.isFinite(row?.[key])).map(key => [key, row[key]]))
}
export function addFrozen(target, source, sign = 1) {
  for (const key of FX_FIELDS) if (Number.isFinite(source?.[key])) target[key] = (target[key] ?? 0) + sign * source[key]
  return target
}
/** Old aggregated records lack a recoverable daily quote: preserve their pre-upgrade display. */
export function freezeLegacyAmounts(days, config) {
  const visit = row => {
    const baseline = frozenAmounts(Number(row.cost) || 0, Number(row.apiCost ?? row.cost) || 0, config)
    for (const key of FX_FIELDS) if ((!Number.isFinite(row[key]) || row[key] < 0) && baseline[key] !== undefined) row[key] = baseline[key]
    for (const bucket of Object.values(row.byProviderModel ?? {})) if (bucket && typeof bucket === 'object') visit(bucket)
    for (const session of row.sessions ?? []) visit(session)
  }
  for (const row of Object.values(days ?? {})) visit(row)
}
export function displayUsd(row, config, api = false) {
  const suffix = { CNY: 'Cny', EUR: 'Eur', JPY: 'Jpy' }[config.currency]
  const saved = suffix ? row?.[(api ? 'apiCost' : 'cost') + suffix] : undefined
  return Number.isFinite(saved) ? saved / (config.exchangeRate || 1) : Number(row?.[api ? 'apiCost' : 'cost'] ?? row?.cost) || 0
}
