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

export function ThreadsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="12" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <path d="M8.2 6h2.8a4 4 0 0 1 4 4v0M8.2 18h2.8a4 4 0 0 0 4-4v0" />
    </Svg>
  )
}

export function TrashIcon(props: IconProps) {
  return <Svg {...props}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5" /></Svg>
}

export function SearchIcon(props: IconProps) {
  return <Svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>
}

/**
 * The icons a project can wear (Claude lets a project pick one). Ids are stored on the project;
 * an unknown id falls back to the folder.
 */
const PROJECT_ICON_PATHS: Record<string, string> = {
  folder: 'M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
  scale: 'M12 4.5v15M8 19.5h8M5 7.5h14M5 7.5l-2.5 5.5a2.5 2.5 0 0 0 5 0zM19 7.5l-2.5 5.5a2.5 2.5 0 0 0 5 0zM12 4.5v.01',
  code: 'm9 7.5-4.5 4.5 4.5 4.5M15 7.5l4.5 4.5-4.5 4.5',
  terminal: 'M4 5.5h16v13H4zM7.5 10l2.5 2-2.5 2M12.5 14.5h4',
  rocket: 'M12 3c3 2.2 4.8 5.7 4.8 9.6L15 16H9l-1.8-3.4C7.2 8.7 9 5.2 12 3zM12 9.3v.01M9 16l-2.2 4M15 16l2.2 4M12 16v3.5',
  book: 'M6.5 4H18v14H7a2 2 0 0 0-2 2V5.5A1.5 1.5 0 0 1 6.5 4zM5 20a2 2 0 0 1 2-2h11v2.5H7a2 2 0 0 1-2-2',
  flask: 'M9.5 3.5h5M10.5 3.5v5.7L5.4 18.1a1.6 1.6 0 0 0 1.4 2.4h10.4a1.6 1.6 0 0 0 1.4-2.4l-5.1-8.9V3.5M7.6 14.5h8.8',
  globe: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.6 2.8 2.6 14.2 0 17M12 3.5c-2.6 2.8-2.6 14.2 0 17',
  palette: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2l-.4-1a2 2 0 0 1 1.9-2.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.4-3.8-7.9-8.5-7.9zM7.8 11.5v.01M10 7.6v.01M14.6 7.6v.01',
  star: 'm12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.6-5.1 2.6 1-5.6-4-3.9 5.6-.8z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  chart: 'M4 20h16M7 16.5v-5M12 16.5V8M17 16.5V5',
  shield: 'M12 3.5 5 6.2v5.6c0 4.1 2.9 7.5 7 8.7 4.1-1.2 7-4.6 7-8.7V6.2z',
  cube: 'm12 3.5 8 4.5v8l-8 4.5-8-4.5V8zM4 8l8 4.5L20 8M12 12.5v8',
  layers: 'm12 4 8.5 4.5L12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  leaf: 'M5 19c0-8.6 5.2-14 14-14 0 8.8-5.4 14-14 14zM5 19l8-8',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z',
  music: 'M9 17.5v-12l10-2v12M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  camera: 'M4 8.5h3.5L9 6h6l1.5 2.5H20v10H4zM12 10.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  gamepad: 'M7 8h10a4 4 0 0 1 4 4v1.6a2.9 2.9 0 0 1-5.2 1.7L14.6 14H9.4l-1.2 1.3A2.9 2.9 0 0 1 3 13.6V12a4 4 0 0 1 4-4zM7.5 10.3v3M6 11.8h3M15.6 11.2v.01M17.4 12.8v.01',
  briefcase: 'M4 8h16v11H4zM9 8V5.5h6V8M4 13h16',
  bulb: 'M9.5 18h5M10.5 21h3M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.2v.3h4v-.3c0-.9.5-1.7 1.2-2.2A5.5 5.5 0 0 0 12 3.5z',
  compass: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5z',
  target: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 11.5v1',
}

export const PROJECT_ICON_IDS = Object.keys(PROJECT_ICON_PATHS)

export function ProjectIcon({ id, ...props }: IconProps & { id: string }) {
  return <Svg {...props}><path d={PROJECT_ICON_PATHS[id] ?? PROJECT_ICON_PATHS.folder} /></Svg>
}

export function BellIcon(props: IconProps) {
  return <Svg {...props}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></Svg>
}
