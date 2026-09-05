/**
 * Trajectory inspector Thinking control: keyboard focus matches hover color.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/TrajectoryTable.module.css', import.meta.url)), 'utf8')

describe('trajectory thinking keyboard chrome', () => {
  it('paints the Thinking control secondary on keyboard focus, matching hover', () => {
    expect(css).toMatch(
      /\.thinkingToggle:hover,\s*\.thinkingToggle:focus-visible\s*\{[^}]*color: var\(--dsw-alias-label-secondary\)/,
    )
  })
})
