/**
 * Trajectory toolbar: keyboard focus matches hover color; fold glyphs follow.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/TrajectoryToolbar.module.css', import.meta.url)), 'utf8')

describe('trajectory toolbar keyboard chrome', () => {
  it('paints Duration primary with the hover fill on keyboard focus', () => {
    expect(css).toMatch(
      /\.toggle:hover,\s*\.toggle:focus-visible\s*\{[^}]*color: var\(--dsw-alias-label-primary\)/,
    )
    expect(css).toMatch(
      /\.toggle:hover,\s*\.toggle:focus-visible\s*\{[^}]*background: var\(--dsw-alias-interactive-bg-hover\)/,
    )
  })

  it('paints Turns and Calls primary with the hover fill on keyboard focus', () => {
    expect(css).toMatch(
      /\.action:hover,\s*\.action:focus-visible\s*\{[^}]*color: var\(--dsw-alias-label-primary\)/,
    )
    expect(css).toMatch(
      /\.action:hover,\s*\.action:focus-visible\s*\{[^}]*background: var\(--dsw-alias-interactive-bg-hover\)/,
    )
  })

  it('paints the fold glyphs with the label on hover and keyboard focus', () => {
    expect(css).toMatch(
      /\.action:hover \.actionIcon,\s*\.action:focus-visible \.actionIcon\s*\{[^}]*color: inherit/,
    )
  })

  it('keeps the product ring on keyboard focus', () => {
    expect(css).toMatch(
      /\.toggle:focus-visible\s*\{\s*outline: none;\s*box-shadow: var\(--dsw-shadow-focus-ring\)/,
    )
    expect(css).toMatch(
      /\.action:focus-visible\s*\{\s*outline: none;\s*box-shadow: var\(--dsw-shadow-focus-ring\)/,
    )
  })
})
