// Marca da Salinha.
import { Icon, type IconProps } from './Icon'

/** Marca da Salinha (luminária sobre o monitor), em uma cor. */
export function SalinhaMarkIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path
        d="M5.25 7.78 16.88 5.25Q18.94 4.83 19.13 6.94L19.69 17.25Q19.78 18.84 18.19 18.84H5.81Q4.5 18.84 4.5 17.53V9Q4.5 7.97 5.25 7.78Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity=".6"
      />
      <path d="M14.9 5.25 18.1 8.34 16.2 11.8H7.78Z" opacity=".35" />
      <path
        d="M18.19 4.59C18.47 2.81 21 2.81 20.53 4.88Q20.25 6 19.22 6.56"
        fill="none"
        stroke="currentColor"
        strokeWidth=".75"
        strokeLinecap="round"
      />
      <g transform="translate(16.5 6.8) rotate(45)">
        <path d="M-2.34 0A2.34 2.34 0 0 1 2.34 0Z" />
        <circle cy="-2.72" r=".56" />
      </g>
      <rect
        x="7.5"
        y="11.6"
        width="9"
        height="6.1"
        rx=".8"
        fillOpacity=".45"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect x="10.97" y="18.19" width="2.06" height="1.31" />
      <rect x="8.53" y="19.22" width="6.94" height="1.13" rx=".56" />
    </Icon>
  )
}
