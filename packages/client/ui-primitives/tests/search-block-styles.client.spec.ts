/**
 * SearchBlock expand keyboard chrome: hover color also shows on focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/SearchBlock.module.css', import.meta.url)), 'utf8')

function declarationsFrom(source: string, selector: string): Map<string, string> | undefined {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
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

describe('SearchBlock expand keyboard chrome', () => {
  it('paints the expand control secondary on keyboard focus, matching hover', () => {
    expect(declarationsFrom(css, '.expand:hover')?.get('color')).toBe('var(--dsw-alias-label-secondary)')
    expect(declarationsFrom(css, '.expand:focus-visible')?.get('color')).toBe('var(--dsw-alias-label-secondary)')
    expect(declarationsFrom(css, '.expand:focus-visible')?.get('box-shadow')).toBe('var(--dsw-shadow-focus-ring)')
  })
})
