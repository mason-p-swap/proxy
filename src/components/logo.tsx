

export function Logo({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="25 22.5 50 50"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M30,26 H55 A17.75 17.75 0 1 1 49,61.3 L58.55,51.75 A8.75 8.75 0 0 0 55,35 H40 Z" />
      <path d="M40.4,46.5 H56.5 L46.5,56.5 L30.3,67.15 Q27.5,69 28.77,66.3 L37.2,48.2 Q37.9,46.5 40.4,46.5 Z" />
    </svg>
  )
}
