/**
 * DirectoryBrowser keyboard chrome: crumbs, Miller rows, and the show-hidden
 * toggle use the product focus ring.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/DirectoryBrowser.module.css', import.meta.url)), 'utf8')

function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

describe('DirectoryBrowser.module.css keyboard chrome', () => {
  it('uses the product focus ring on crumbs, rows, and show-hidden', () => {
    const ring = 'var(--dsw-shadow-focus-ring)'
    expect(declarations('.crumb:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarations('.row:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarations('.showHiddenToggle:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarations('.createInput:focus-visible')?.get('box-shadow')).toBe(ring)
  })
})
