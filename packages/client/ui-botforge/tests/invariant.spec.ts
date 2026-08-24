import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject, name } from '../src/invariant.ts'

describe('ui-botforge invariant', () => {
  it('registers an empty installer under the package name', async () => {
    const ctx = new Context()
    const register = vi.fn((_name: string, _installer: () => void) => () => undefined)
    ctx.provide('invariants', { register } as never)
    expect(name).toBe('client-ui-botforge-invariant')
    expect(inject).toEqual(['invariants'])
    await apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-botforge', expect.any(Function))
    const install = register.mock.calls[0]![1]
    install()
  })
})
