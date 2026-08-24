/** Compact employee avatar from a deterministic hue of the seed. */

import css from './EmployeeAvatar.module.css'

/**
 * Render initials on a hue derived from `seed`.
 * @param props.name - accessible name and initials source.
 * @param props.seed - hue seed (usually the employee id).
 * @param props.size - pixel width and height; defaults to 36.
 * @returns the avatar.
 */
export function EmployeeAvatar(props: { name: string; seed: string; size?: number }): React.ReactNode {
  const size = props.size ?? 36
  let hash = 0
  for (let i = 0; i < props.seed.length; i++) hash = (hash * 31 + props.seed.charCodeAt(i)) >>> 0
  const hue = String(hash % 360)
  const initials = props.name.trim().split(/\s+/).slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '•'
  return (
    <span
      role="img"
      aria-label={props.name}
      className={css.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34), ['--employee-hue' as string]: hue }}
    >
      {initials}
    </span>
  )
}
