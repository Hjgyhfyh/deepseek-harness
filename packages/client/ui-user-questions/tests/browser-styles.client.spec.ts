/**
 * Question takeover keyboard chrome: header/pager icon buttons and the
 * plan-review scroll body use the product focus ring.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const questionCss = readFileSync(fileURLToPath(new URL('../src/client/QuestionComposer.module.css', import.meta.url)), 'utf8')
const planCss = readFileSync(fileURLToPath(new URL('../src/client/PlanReviewPanel.module.css', import.meta.url)), 'utf8')

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

describe('question takeover keyboard chrome', () => {
  it('uses the product focus ring on header icons and the plan body', () => {
    const ring = 'var(--dsw-shadow-focus-ring)'
    expect(declarationsFrom(questionCss, '.iconButton:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarationsFrom(questionCss, '.option:focus-visible')?.get('box-shadow')).toBe(ring)
    expect(declarationsFrom(planCss, '.body:focus-visible')?.get('box-shadow')).toBe(ring)
  })
})
