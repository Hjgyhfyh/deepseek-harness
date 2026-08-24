import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject, name } from '../src/invariant.ts'

describe('botforge invariant', () => {
  it('registers an empty installer under the package name', async () => {
    const ctx = new Context()
    const register = vi.fn(() => () => undefined)
    ctx.provide('invariants', { register } as never)
    expect(name).toBe('botforge-invariant')
    expect(inject).toEqual(['invariants'])
    await apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-botforge', expect.any(Function))
    const install = register.mock.calls[0]![1] as () => void
    install()
  })
})
