const { execFileSync } = require('node:child_process')

const WINDOWS_PRODUCT_KEY = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'

function classifyWindowsProductName(value) {
  const productName = String(value || '').trim()
  if (!productName) return 'unsupported'
  if (/Windows Server\b/i.test(productName) || /\bIoT\b/i.test(productName)) return 'server'
  if (/\bWindows (?:10|11)\b/i.test(productName)) return 'client'
  return 'unsupported'
}

function detectCylinderHost({ platform = process.platform, query = execFileSync } = {}) {
  if (platform !== 'win32') return { variant: 'unsupported', productName: '', reason: 'unsupported-platform' }

  try {
    const output = query('reg.exe', ['query', WINDOWS_PRODUCT_KEY, '/v', 'ProductName'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 16384,
    })
    const productName = String(output || '').match(/ProductName\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim() || String(output || '').trim()
    const variant = classifyWindowsProductName(productName)
    return { variant, productName, reason: variant === 'unsupported' ? 'unsupported-edition' : '' }
  } catch {
    return { variant: 'unsupported', productName: '', reason: 'edition-check-failed' }
  }
}

module.exports = { classifyWindowsProductName, detectCylinderHost }
