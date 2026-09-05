/**
 * Bash tool-row keyboard chrome: expandable header and Inspect use the
 * product focus ring, and the hover chevron shows on keyboard focus.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/tool/toolviews/bash-sample.module.css', import.meta.url)), 'utf8')

describe('bash tool-row keyboard chrome', () => {
  it('uses the product focus ring on the expandable header and Inspect', () => {
    expect(css).toMatch(
      /\.root\[data-expandable\]:focus-visible\s*\{[^}]*box-shadow: var\(--dsw-shadow-focus-ring\)/,
    )
    expect(css).toMatch(
      /\.inspectButton:focus-visible\s*\{[^}]*box-shadow: var\(--dsw-shadow-focus-ring\)/,
    )
  })

  it('shows the hover chevron on keyboard focus', () => {
    expect(css).toMatch(
      /\.root:hover \.chevronHover,\s*\.root:focus-visible \.chevronHover\s*\{[^}]*opacity: 1/,
    )
  })
})
