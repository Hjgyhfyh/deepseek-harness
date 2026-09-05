/**
 * GoalBar icon actions: keyboard focus matches hover color and fill.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/GoalBar.module.css', import.meta.url)), 'utf8')

describe('goal bar icon keyboard chrome', () => {
  it('paints the icon actions secondary on keyboard focus, matching hover', () => {
    expect(css).toMatch(
      /\.iconBtn:hover,\s*\.iconBtn:focus-visible\s*\{[^}]*background: var\(--dsw-alias-interactive-bg-hover\)/,
    )
    expect(css).toMatch(
      /\.iconBtn:hover,\s*\.iconBtn:focus-visible\s*\{[^}]*color: var\(--dsw-alias-label-secondary\)/,
    )
  })

  it('keeps the product ring on keyboard focus', () => {
    expect(css).toMatch(
      /\.iconBtn:focus-visible\s*\{[^}]*box-shadow: var\(--dsw-shadow-focus-ring\)/,
    )
  })
})
