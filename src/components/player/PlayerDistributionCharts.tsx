import { GradeBadge } from '../BeastBadges';
import { formatInt, formatPct } from '../../lib/format';

interface PlayerDistributionChartsProps {
  tierCounts: Record<string, number>;
  gradeCounts: Record<string, number>;
  totalBeasts: number;
}

const TIERS = [5, 4, 3, 2, 1] as const;
const GRADES = [5, 6, 7, 8, 9, 10] as const;
const MAX_BAR_PX = 104;

function gradeBarClass(grade: number): string {
  if (grade >= 10) return 'bg-grade-10/80 group-hover:bg-grade-10';
  if (grade === 9) return 'bg-grade-9/75 group-hover:bg-grade-9';
  if (grade === 8) return 'bg-grade-8/75 group-hover:bg-grade-8';
  return 'bg-owner-player/65 group-hover:bg-owner-player/90';
}

export function PlayerDistributionCharts({
  tierCounts,
  gradeCounts,
  totalBeasts,
}: PlayerDistributionChartsProps) {
  const tierItems = TIERS.map((tier) => ({
    tier,
    count: tierCounts[String(tier)] ?? 0,
  }));
  const maxTierCount = Math.max(1, ...tierItems.map((item) => item.count));

  const gradeItems = GRADES.map((grade) => ({
    grade,
    count: gradeCounts[String(grade)] ?? 0,
  }));
  const maxGradeCount = Math.max(1, ...gradeItems.map((item) => item.count));

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Beasts by Tier Histogram (T5 -> T1) */}
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-ink">Beasts by Tier</h3>
          <p className="text-xs text-ink-muted">
            Rarity spread from T5 (most common) to T1 (rarest)
          </p>
        </div>

        <div className="flex h-40 items-end gap-2.5 border-b border-border/80 px-1 pb-1 sm:gap-3">
          {tierItems.map(({ tier, count }) => {
            const barHeightPx =
              count > 0
                ? Math.max(8, Math.round((count / maxTierCount) * MAX_BAR_PX))
                : 0;
            const shareText = formatPct(count, Math.max(totalBeasts, 1));

            return (
              <div
                key={tier}
                title={`Tier ${tier}: ${formatInt(count)} (${shareText})`}
                className="group flex h-full flex-1 flex-col items-center justify-end"
              >
                {count > 0 && (
                  <span className="num pointer-events-none mb-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] leading-none text-ink-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {shareText}
                  </span>
                )}

                <span
                  className={`num mb-1.5 text-xs leading-none ${
                    count > 0 ? 'font-semibold text-ink' : 'text-ink-faint'
                  }`}
                >
                  {formatInt(count)}
                </span>

                {count > 0 ? (
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className="w-full max-w-11 rounded-t-md bg-owner-player/75 transition-colors duration-200 group-hover:bg-accent/85"
                  />
                ) : (
                  <div className="h-0.5 w-full max-w-11 rounded-full bg-border/60" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-2.5 px-1 sm:gap-3">
          {tierItems.map(({ tier, count }) => (
            <div key={tier} className="flex flex-1 justify-center">
              <span
                className={`num rounded border px-2 py-0.5 text-[11px] font-semibold leading-none ${
                  count > 0
                    ? 'border-owner-player/35 bg-owner-player/10 text-accent'
                    : 'border-border bg-bg text-ink-faint'
                }`}
              >
                T{tier}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Beasts by Card Grade Histogram (5 -> 10) */}
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-ink">Beasts by Card Grade</h3>
          <p className="text-xs text-ink-muted">
            Condition distribution across grades 5 to 10
          </p>
        </div>

        <div className="flex h-40 items-end gap-2 border-b border-border/80 px-1 pb-1 sm:gap-2.5">
          {gradeItems.map(({ grade, count }) => {
            const barHeightPx =
              count > 0
                ? Math.max(8, Math.round((count / maxGradeCount) * MAX_BAR_PX))
                : 0;
            const shareText = formatPct(count, Math.max(totalBeasts, 1));

            return (
              <div
                key={grade}
                title={`Grade ${grade}: ${formatInt(count)} (${shareText})`}
                className="group flex h-full flex-1 flex-col items-center justify-end"
              >
                {count > 0 && (
                  <span className="num pointer-events-none mb-1 whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] leading-none text-ink-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {shareText}
                  </span>
                )}

                <span
                  className={`num mb-1.5 text-xs leading-none ${
                    count > 0 ? 'font-semibold text-ink' : 'text-ink-faint'
                  }`}
                >
                  {formatInt(count)}
                </span>

                {count > 0 ? (
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className={`w-full max-w-10 rounded-t-md transition-colors duration-200 ${gradeBarClass(grade)}`}
                  />
                ) : (
                  <div className="h-0.5 w-full max-w-10 rounded-full bg-border/60" />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-2 px-1 sm:gap-2.5">
          {gradeItems.map(({ grade, count }) => (
            <div
              key={grade}
              className={`flex flex-1 justify-center ${count === 0 ? 'opacity-45' : ''}`}
            >
              <GradeBadge grade={grade} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}