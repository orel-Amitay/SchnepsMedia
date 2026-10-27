import type { ReactNode } from 'react'

type IconProps = {
  size?: number
  className?: string
}

function base({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconHelp(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.2a2.4 2.4 0 1 1 3.5 2.1c-.7.4-1.1.8-1.1 1.7" />
        <circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" />
      </>
    ),
  })
}

export function IconTrophy(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
        <path d="M8 5H5.5A2.5 2.5 0 0 0 8 9.5" />
        <path d="M16 5h2.5A2.5 2.5 0 0 1 16 9.5" />
        <path d="M12 11v3.5" />
        <path d="M9 20h6" />
        <path d="M10 14.5h4L13.2 20h-2.4L10 14.5Z" />
      </>
    ),
  })
}

export function IconStats(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M5 19V10" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </>
    ),
  })
}

export function IconSettings(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
      </>
    ),
  })
}

export function IconReset(props: IconProps) {
  return base({
    ...props,
    children: (
      <>
        <path d="M4.5 12a7.5 7.5 0 1 0 2.1-5.2" />
        <path d="M4.5 4.5v4.2H8.7" />
      </>
    ),
  })
}
