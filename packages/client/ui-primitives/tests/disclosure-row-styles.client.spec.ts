/**
 * Disclosure header keyboard chrome: hover chevron also shows on focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/DisclosureRow.module.css', import.meta.url)), 'utf8')

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

describe('disclosure header keyboard chrome', () => {
  it('shows the hover chevron on keyboard focus of the row and leading control', () => {
    expect(declarationsFrom(css, '.row:focus-visible .chevronHover')?.get('opacity')).toBe('1')
    expect(declarationsFrom(css, 'button.leading:focus-visible .chevronHover')?.get('opacity')).toBe('1')
    expect(declarationsFrom(css, '.row:focus-visible')?.get('box-shadow')).toBe('var(--dsw-shadow-focus-ring)')
  })
})
