/** Compatibility is decided by the metering contract, not a release allowlist. */
export const BILLION_MIN_VERSION = '0.1.181'
// kinocode-jp fork: feedback goes to this repository (src/statistics/index.js uses the same links).
export const BILLION_FEEDBACK_GROUP = 'https://github.com/kinocode-jp/dsh-cost-meter-ja/blob/main/README.md#community'
export const BILLION_FEEDBACK_ISSUE = 'https://github.com/kinocode-jp/dsh-cost-meter-ja/issues/new?template=bug_report.yml'
export function billionVersionSupported(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)(?:[-+][\w.+-]+)?$/.exec(version ?? '')
  if (!parts) return null
  const [major, minor, patch] = parts.slice(1).map(Number)
  return major > 0 || minor > 1 || minor === 1 && patch >= 181
}
export function billionCompatibilityError(reason) {
  const message = reason === 'version_too_old' ? 'Update billion-context to ' + BILLION_MIN_VERSION + ' or later.' : 'The billion-context metering interface changed (' + reason + '). Report this so the integration can be updated.'
  const error = new Error(message + '\nFeedback: ' + BILLION_FEEDBACK_GROUP + '\nIssue: ' + BILLION_FEEDBACK_ISSUE)
  error.code = reason === 'version_too_old' ? 'BILLION_VERSION_TOO_OLD' : 'BILLION_LOGIC_CHANGED'
  return error
}
