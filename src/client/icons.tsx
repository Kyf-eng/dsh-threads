// Small stroke icons in the sidebar's style (currentColor, 1.6 stroke).
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  )
}

export function ProjectsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M8 13h8M8 16h5" />
    </Svg>
  )
}

export function FolderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </Svg>
  )
}

export function PinIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M14.5 3.5 20.5 9.5 17 11l-3.5 3.5.5 4-1.5 1.5-4-4-4.5 4.5M8.5 11.5 4 7l1.5-1.5 4 .5L13 2.5z" fill={filled ? 'currentColor' : 'none'} />
    </Svg>
  )
}

export function PlusIcon(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>
}

export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return <Svg {...props}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5" /></Svg>
}

export function SearchIcon(props: IconProps) {
  return <Svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>
}
