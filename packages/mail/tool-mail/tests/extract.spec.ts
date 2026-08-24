/**
 * Unit coverage for verification-code extraction: keyword adjacency, years,
 * calendar dates, six-digit OTPs, mixed tokens, and de-duplication.
 */

import { describe, expect, it } from 'vitest'
import { extractVerificationCodes } from '@deepseek-ai/dsh-tool-mail'

describe('extractVerificationCodes', () => {
  it('picks a six-digit OTP without requiring a keyword', () => {
    expect(extractVerificationCodes('Your session key is 551203.')).toEqual(['551203'])
  })

  it('picks keyword-adjacent 4–8 digit runs including Russian маркеры', () => {
    expect(extractVerificationCodes('Код: 4412')).toEqual(['4412'])
    expect(extractVerificationCodes('PIN 99887766')).toEqual(['99887766'])
    expect(extractVerificationCodes('пароль 7788')).toEqual(['7788'])
  })

  it('skips 4-digit years and YYYYMMDD dates', () => {
    expect(extractVerificationCodes('Mailed 2026-08-22 about invoice 20260822')).toEqual([])
    expect(extractVerificationCodes('archive 1999')).toEqual([])
  })

  it('skips digit runs longer than 8 and shorter than 4', () => {
    expect(extractVerificationCodes('tracking 123456789 and ref 12')).toEqual([])
  })

  it('skips 4–5 and 7–8 digit runs that are not next to a keyword', () => {
    expect(extractVerificationCodes('order 12345 shipped from dock 7')).toEqual([])
    expect(extractVerificationCodes('building 7700123')).toEqual([])
  })

  it('accepts mixed alphanumeric tokens only next to a keyword', () => {
    expect(extractVerificationCodes('code AB12CD')).toEqual(['AB12CD'])
    expect(extractVerificationCodes('filename AB12CD.bin')).toEqual([])
  })

  it('does not treat encode as the code keyword', () => {
    expect(extractVerificationCodes('please encode 4412 before sending')).toEqual([])
  })

  it('preserves first-seen order and drops duplicates', () => {
    expect(extractVerificationCodes('code 111111 then again 111111 and 222222')).toEqual(['111111', '222222'])
  })

  it('returns no codes for empty text', () => {
    expect(extractVerificationCodes('')).toEqual([])
  })
})
