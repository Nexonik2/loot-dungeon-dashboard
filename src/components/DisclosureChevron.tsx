interface DisclosureChevronProps {
  open: boolean;
  className?: string;
}

export function DisclosureChevron({
  open,
  className = 'text-ink-muted',
}: DisclosureChevronProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
        open ? 'rotate-180' : ''
      } ${className}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}