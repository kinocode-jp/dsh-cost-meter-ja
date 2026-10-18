/** Public daily ECB reference rates via Frankfurter. No account or inference request. */
import { freezeLegacyAmounts } from './exchange-rates.js'
export const EXCHANGE_RATE_URL = 'https://api.frankfurter.dev/v2/providers/ecb/rates?base=USD&quotes=CNY,EUR,JPY'
export function parseExchangeRates(rows, now = Date.now()) {
  if (!Array.isArray(rows) || rows.length > 16) throw Error('Invalid exchange rates')
  const result = { USD: 1 }, dates = new Set()
  for (const row of rows) {
    if (row?.base !== 'USD' || !['CNY', 'EUR', 'JPY'].includes(row.quote)) continue
    const at = Date.parse(row.date + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(at) || at > now + 86400000 || at < now - 14 * 86400000 || !Number.isFinite(row.rate) || row.rate <= 0 || row.rate > 1e6 || result[row.quote] !== undefined) throw Error('Invalid exchange rate quote')
    result[row.quote] = row.rate; dates.add(row.date)
  }
  if (!result.CNY || !result.EUR || dates.size !== 1) throw Error('Incomplete exchange rates')
  return { rates: result, date: [...dates][0] }
}
export function createExchangeRateRefresh(ledger, { request = fetch, now = Date.now } = {}) {
  let pending = null, controller = null, disposed = false, lastAttempt = 0
  return {
    refresh() {
      const current = now(), config = ledger.config
      // 日本語フォーク: JPY のレートをまだ持っていなければ、当日確認済みでも取りに行く。
      const checkedToday = new Date(config.exchangeRateCheckedAt || 0).toISOString().slice(0, 10) === new Date(current).toISOString().slice(0, 10)
      if (disposed || ledger.closed || config.exchangeRateAuto === false || (checkedToday && config.fxRates?.JPY > 0)) return Promise.resolve(false)
      if (pending) return pending
      if (lastAttempt && current - lastAttempt < 3600000) return Promise.resolve(false)
      lastAttempt = current; controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 10000); timeout.unref?.()
      pending = (async () => {
        const response = await request(EXCHANGE_RATE_URL, { signal: controller.signal, credentials: 'omit', redirect: 'error' })
        if (!response.ok) throw Error('Exchange rate service unavailable')
        const text = await response.text()
        if (text.length > 16384) throw Error('Exchange rate response too large')
        const { rates, date } = parseExchangeRates(JSON.parse(text), current)
        if (disposed || ledger.closed || ledger.config.exchangeRateAuto === false) return false
        const firstJpy = !(ledger.config.fxRates?.JPY > 0) && rates.JPY > 0
        ledger.config = { ...ledger.config, fxRates: { ...(ledger.config.fxRates?.JPY > 0 ? { JPY: ledger.config.fxRates.JPY } : {}), ...rates }, exchangeRate: rates[ledger.config.currency] ?? ledger.config.exchangeRate,
          exchangeRateDate: date, exchangeRateCheckedAt: current }
        // 初めて JPY のレートが分かったとき、円額を持たない記録をそのレートで埋める(CNY/EUR は既存値を保持)。
        if (firstJpy && ledger.days) freezeLegacyAmounts(ledger.days, ledger.config)
        ledger.scheduleWrite()
        return true
      })().finally(() => { clearTimeout(timeout); pending = null; controller = null })
      return pending
    },
    dispose() { disposed = true; controller?.abort() },
  }
}
