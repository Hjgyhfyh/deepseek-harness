/**
 * JsonBlock toggle keyboard chrome: hover fill also shows on focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/markdown/JsonBlock.module.css', import.meta.url)), 'utf8')

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

describe('JsonBlock keyboard chrome', () => {
  it('fills on keyboard focus matching hover, and uses the product ring', () => {
    expect(declarationsFrom(css, '.toggle:hover')?.get('background')).toBe(
      'var(--dsw-alias-interactive-bg-hover)',
    )
    expect(declarationsFrom(css, '.toggle:focus-visible')?.get('background')).toBe(
      'var(--dsw-alias-interactive-bg-hover)',
    )
    expect(declarationsFrom(css, '.toggle:focus-visible')?.get('box-shadow')).toBe(
      'var(--dsw-shadow-focus-ring)',
    )
  })
})
