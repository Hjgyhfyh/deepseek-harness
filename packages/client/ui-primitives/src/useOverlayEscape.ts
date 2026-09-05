/**
 * While `active`, this overlay owns the top Escape frame (see overlay-escape).
 * `onClose` is read from a ref so a parent re-render does not reshuffle the
 * stack and steal Escape from a later, still-open overlay.
 */
import { useEffect, useRef } from 'react'
import { subscribeOverlayEscape } from './overlay-escape.ts'

/**
 * Register `onClose` as the current top overlay while `active` is true.
 * @param active - whether this overlay is showing.
 * @param onClose - Escape handler; identity may change without re-stacking.
 */
export function useOverlayEscape(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!active) return
    return subscribeOverlayEscape(() => { onCloseRef.current() })
  }, [active])
}
