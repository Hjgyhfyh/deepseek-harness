/**
 * No-workspace composer card: hover, keyboard focus, and an open picker
 * share the business-blue dash.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/skeleton/InputBar.module.css', import.meta.url)), 'utf8')

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

describe('no-workspace composer card', () => {
  it('paints the dash blue on hover, keyboard focus, and an open picker', () => {
    const blue = 'var(--dsw-alias-state-business-primary)'
    expect(declarationsFrom(css, '.cardWorkspaceTrigger:hover::after')?.get('background')).toBe(blue)
    expect(declarationsFrom(css, '.cardWorkspaceTrigger:focus-within::after')?.get('background')).toBe(blue)
    expect(declarationsFrom(css, '.cardWorkspaceTrigger:has(textarea[aria-expanded=\'true\'])::after')?.get('background')).toBe(blue)
  })
})
