/**
 * Best-effort verification-code extraction from decoded mailbox text.
 * This is a consumer projection over list+read, not a second mailbox backend:
 * a miss must still send the model to `mail_list_recent` / `mail_read`.
 * @module @deepseek-ai/dsh-tool-mail/extract
 */

/**
 * Tokens that mark a nearby digit or mixed run as a verification code.
 * Anchored off Latin/Cyrillic letters so `encode` does not count as `code`.
 */
const KEYWORD =
  /(?:^|[^A-Za-zА-Яа-яЁё])(?:verification|confirmation|confirm|passcode|password|verify|codes?|token|auth|otp|pin|код(?:а|у|ом|е)?|парол[ьяеюи]?)(?:[^A-Za-zА-Яа-яЁё]|$)/iu

/** 4–8 digit runs that are not a longer number. */
const DIGIT_RUN = /(?<!\d)(\d{4,8})(?!\d)/g

/**
 * Mixed alphanumeric tokens (at least one letter and one digit), 6–8 chars.
 * Accepted only next to a keyword so random filenames do not qualify.
 */
const ALNUM_RUN = /(?<![A-Za-z0-9])(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,8}(?![A-Za-z0-9])/g

const KEYWORD_WINDOW = 48

/** True when `value` is a 19xx/20xx calendar year. */
function isYear(value: string): boolean {
  return value.length === 4 && /^(?:19|20)\d{2}$/.test(value)
}

/** True when `value` looks like YYYYMMDD with a 19xx/20xx year. */
function isCalendarDate(value: string): boolean {
  if (value.length !== 8 || !/^(?:19|20)\d{2}/.test(value)) return false
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** True when a keyword sits within {@link KEYWORD_WINDOW} characters of the run. */
function nearKeyword(text: string, index: number, length: number): boolean {
  const start = Math.max(0, index - KEYWORD_WINDOW)
  const end = Math.min(text.length, index + length + KEYWORD_WINDOW)
  return KEYWORD.test(text.slice(start, end))
}

/**
 * Collect verification codes from decoded subject+body text, newest-run first
 * in encounter order, without duplicates.
 *
 * Digit runs of length 6 are accepted without a nearby keyword (the common OTP
 * width). 4–5 and 7–8 digit runs, and mixed alphanumeric runs, require a nearby
 * keyword. Years and YYYYMMDD dates are never codes.
 *
 * @param text - decoded subject and body, concatenated in any order.
 * @returns distinct code strings in the order they appear.
 */
export function extractVerificationCodes(text: string): string[] {
  const seen = new Set<string>()
  const codes: string[] = []

  const add = (code: string): void => {
    if (seen.has(code)) return
    seen.add(code)
    codes.push(code)
  }

  for (const match of text.matchAll(DIGIT_RUN)) {
    const code = match[1]!
    if (isYear(code) || isCalendarDate(code)) continue
    const index = match.index!
    if (code.length === 6 || nearKeyword(text, index, code.length)) add(code)
  }

  for (const match of text.matchAll(ALNUM_RUN)) {
    const code = match[0]
    const index = match.index!
    if (nearKeyword(text, index, code.length)) add(code)
  }

  return codes
}
