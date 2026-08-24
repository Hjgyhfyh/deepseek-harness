// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmployeeAvatar } from '../src/client/EmployeeAvatar.tsx'

describe('EmployeeAvatar', () => {
  it('renders initials from the name and a fallback glyph when the name is empty', () => {
    const named = render(<EmployeeAvatar name="Roblox Scripter" seed="roblox" size={40} />)
    expect(named.getByRole('img', { name: 'Roblox Scripter' }).textContent).toBe('RS')
    named.unmount()
    const empty = render(<EmployeeAvatar name="   " seed="x" />)
    expect(empty.getByRole('img').textContent).toBe('•')
  })
})
