import { useState } from 'react';
import {
  formatEth,
  formatInt,
  formatRelativeTime,
  shortAddr,
} from '../../lib/format';
import type { PoolsResponse } from '../../types/dashboard';
import { poolLabel } from './poolMeta';
import { DisclosureChevron } from '../DisclosureChevron';

const PAGE_SIZE = 8;

interface RecentSalesLedgerProps {
  sales: PoolsResponse['recentSales'];
}

export function RecentSalesLedger({ sales }: RecentSalesLedgerProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sales.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            All Recent Buyback Sales ({formatInt(sales.length)})
          </h2>
          <p className="text-xs text-ink-muted">
            Realized net ETH payouts and post-sale spot prices across all 10 pools
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/60"
        >
          <span>{open ? 'Hide Sales' : 'Show Sales'}</span>
          <DisclosureChevron open={open} className="text-accent" />
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {totalPages > 1 && (
            <div className="num flex items-center justify-end gap-1.5 text-xs">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md border border-border bg-bg px-2 py-1 text-ink disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-1 text-ink-muted">
                {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-md border border-border bg-bg px-2 py-1 text-ink disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {visible.length === 0 ? (
            <p className="text-xs text-ink-faint">No buyback sales recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-medium">Pool</th>
                    <th className="py-2 px-3 text-right font-medium">Qty</th>
                    <th className="py-2 px-3 text-right font-medium">Net Payout</th>
                    <th className="py-2 px-3 text-right font-medium">Post Spot</th>
                    <th className="py-2 px-3 text-right font-medium">When</th>
                    <th className="py-2 pl-3 text-right font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 num">
                  {visible.map((s) => (
                    <tr key={`${s.txHash}-${s.poolAddress}`}>
                      <td className="py-2.5 pr-3 font-medium text-ink">
                        {poolLabel(s)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted">
                        {formatInt(s.nftCount)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-state-sold-pf">
                        {formatEth(s.amountWei, 5)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-muted">
                        {formatEth(s.spotPriceWei, 5)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-ink-faint">
                        {formatRelativeTime(s.ts)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <a
                          href={`https://starkscan.co/tx/${s.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-accent hover:underline"
                        >
                          {shortAddr(s.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}