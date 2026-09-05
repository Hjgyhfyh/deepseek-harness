/**
 * Composer-dock header chevrons: keyboard focus matches hover color.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const todo = readFileSync(fileURLToPath(new URL('../src/client/skeleton/TodoPanel.module.css', import.meta.url)), 'utf8')
const queue = readFileSync(fileURLToPath(new URL('../src/client/queue/QueueDock.module.css', import.meta.url)), 'utf8')

describe('composer dock chevron keyboard chrome', () => {
  it('paints the todo chevron primary on keyboard focus, matching hover', () => {
    expect(todo).toMatch(
      /\.header:hover \.chevron,\s*\.header:focus-visible \.chevron\s*\{[^}]*color: var\(--dsw-alias-label-primary\)/,
    )
  })

  it('paints the queue chevron primary on keyboard focus, matching hover', () => {
    expect(queue).toMatch(
      /\.header:hover:not\(:disabled\) \.chevron,\s*\.header:focus-visible:not\(:disabled\) \.chevron\s*\{[^}]*color: var\(--dsw-alias-label-primary\)/,
    )
  })

  it('paints queue row actions secondary on keyboard focus, matching hover', () => {
    expect(queue).toMatch(
      /\.action:hover:not\(:disabled\),\s*\.action:focus-visible:not\(:disabled\)\s*\{[^}]*background: var\(--dsw-alias-interactive-bg-hover\)/,
    )
    expect(queue).toMatch(
      /\.action:hover:not\(:disabled\),\s*\.action:focus-visible:not\(:disabled\)\s*\{[^}]*color: var\(--dsw-alias-label-secondary\)/,
    )
  })
})
