/** Inline SVG icons. Stroke-based, inherit currentColor, 1.6px for optical
 *  weight matching Inter at these sizes. */

type Props = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconHome = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </svg>
)

export const IconReels = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M3 8h18M8.5 3l3 5M15 3l3 5" />
    <path d="m11 12.5 4 2.2-4 2.3z" />
  </svg>
)

export const IconUser = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </svg>
)

export const IconPlus = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconClose = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconTrash = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

export const IconImage = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L16 17" />
  </svg>
)

export const IconPlay = ({ size = 26 }: Props) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)

export const IconSoundOn = ({ size = 19 }: Props) => (
  <svg {...base(size)}>
    <path d="M11 5 6.5 8.5H3v7h3.5L11 19z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)

export const IconSoundOff = ({ size = 19 }: Props) => (
  <svg {...base(size)}>
    <path d="M11 5 6.5 8.5H3v7h3.5L11 19z" />
    <path d="m16 9.5 4 5M20 9.5l-4 5" />
  </svg>
)

export const IconAlert = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
)

export const IconInbox = ({ size = 20 }: Props) => (
  <svg {...base(size)}>
    <path d="M3 13h4l1.5 3h7L17 13h4" />
    <path d="M5.5 5h13l2.5 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
  </svg>
)
