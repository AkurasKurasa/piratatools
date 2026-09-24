/** Pirata mark: a pennant on a pole, drawn in ink with a highlighter fill. */
export default function Logo({ size = 34 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect x="1" y="1" width="32" height="32" rx="9" fill="var(--ink)" />
      <path d="M11 8v19" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12.2 8.6c3.2-1.3 5.4 1.3 8.6 0 1.4-.6 2.6-.9 3.9-.6l-2.6 5.1 2.6 5.1c-1.3-.3-2.5 0-3.9.6-3.2 1.3-5.4-1.3-8.6 0z" fill="var(--hl)" stroke="var(--hl)" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}
