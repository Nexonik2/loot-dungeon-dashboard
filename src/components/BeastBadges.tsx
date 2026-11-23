import { useState } from 'react';

export function speciesSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatBeastDisplayName(
  prefixName: string | null,
  suffixName: string | null,
  speciesName: string,
): string {
  const affix = [prefixName, suffixName]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  return affix ? `"${affix}" ${speciesName}` : speciesName;
}

export function BeastSprite({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'full';
}) {
  const src = `/sprites/${speciesSlug(name)}.gif`;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return null;

  const sizeClass =
    size === 'full'
      ? 'h-full min-h-14 w-14 sm:w-16'
      : size === 'sm'
        ? 'h-6 w-6'
        : 'h-8 w-8';

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`${sizeClass} shrink-0 rounded bg-surface object-contain`}
    />
  );
}

export function TierBadge({ tier }: { tier: number }) {
  if (tier <= 0) return null;
  return (
    <span className="num rounded bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
      T{tier}
    </span>
  );
}

export function BeastTypeBadge({
  type,
  count,
}: {
  type: string;
  count?: number;
}) {
  const normalized = type.trim().toLowerCase();
  const toneClass =
    normalized === 'hunter'
      ? 'border-type-hunter/35 bg-type-hunter/10 text-type-hunter'
      : normalized === 'brute'
        ? 'border-type-brute/35 bg-type-brute/10 text-type-brute'
        : normalized === 'magic'
          ? 'border-type-magic/35 bg-type-magic/10 text-type-magic'
          : 'border-border bg-surface-elevated text-ink-muted';

  return (
    <span
      className={`num inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${toneClass}`}
    >
      <span>{type}</span>
      {count !== undefined && <span className="font-semibold">{count}</span>}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: number | null }) {
  if (grade === null || grade === undefined) {
    return <span className="num text-xs text-ink-faint">-</span>;
  }

  const toneClass =
    grade >= 10
      ? 'border-grade-10/50 bg-grade-10/15 text-grade-10 font-semibold'
      : grade === 9
        ? 'border-grade-9/45 bg-grade-9/15 text-grade-9 font-semibold'
        : grade === 8
          ? 'border-grade-8/45 bg-grade-8/15 text-grade-8 font-semibold'
          : 'border-border bg-bg text-ink-muted font-medium';

  return (
    <span
      className={`num inline-flex min-w-6 items-center justify-center rounded border px-1.5 py-0.5 text-[11px] leading-none ${toneClass}`}
    >
      {grade}
    </span>
  );
}

export function MidiBadge({ count }: { count?: number }) {
  return (
    <span className="num inline-flex items-center gap-1 rounded border border-midi/40 bg-midi/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-midi">
      {count !== undefined ? `${count} MIDI` : 'MIDI'}
    </span>
  );
}

export function OwnerBadge({ soldToBuyback }: { soldToBuyback: boolean }) {
  if (soldToBuyback) {
    return (
      <span className="inline-flex rounded border border-owner-buyback/40 bg-owner-buyback/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-owner-buyback">
        Buyback Pool
      </span>
    );
  }
  return (
    <span className="inline-flex rounded border border-owner-player/40 bg-owner-player/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-owner-player">
      Player
    </span>
  );
}