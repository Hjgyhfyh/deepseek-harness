/**
 * LIFO Escape for layered overlays (modal, menu, settings, lightbox).
 * Each subscriber is a stack frame; only the top frame handles Escape.
 * Mount order is the stack order, so a menu opened inside settings wins the
 * first Escape and the settings panel stays put.
 */
const stack: Array<{ id: object; onClose: () => void }> = []
let bound = false

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const top = stack[stack.length - 1]
  /* v8 ignore next -- the listener is detached whenever the stack is empty */
  if (top === undefined) return
  event.preventDefault()
  top.onClose()
}

/** Subscribe an overlay close handler. The returned function pops this frame. */
export function subscribeOverlayEscape(onClose: () => void): () => void {
  const id = {}
  stack.push({ id, onClose })
  if (!bound) {
    document.addEventListener('keydown', onKeyDown)
    bound = true
  }
  let released = false
  return () => {
    if (released) return
    released = true
    const index = stack.findIndex(entry => entry.id === id)
    /* v8 ignore next -- the token is unique to this subscribe */
    if (index < 0) return
    stack.splice(index, 1)
    if (stack.length === 0 && bound) {
      document.removeEventListener('keydown', onKeyDown)
      bound = false
    }
  }
}
