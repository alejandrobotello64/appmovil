"use client";

import { useId } from "react";
import { formatMoney } from "@/lib/expenses/types";
import type { CategoryTotal } from "@/lib/expenses/types";
import type { SpendBucket, SpendSegment } from "@/lib/expenses/summary";

function compactMoney(value: number) {
  if (value >= 1000) {
    const thousands = Math.floor((value / 1000) * 10) / 10;
    return `$${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  return formatMoney(value);
}

function receiptWord(count: number) {
  return count === 1 ? "comprobante" : "comprobantes";
}

function centerMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function stackSegments(bucket: SpendBucket, byKind: boolean): SpendSegment[] {
  if (byKind) {
    return bucket.kinds.map((kind) => ({
      category: kind.kind,
      label: kind.label,
      color: kind.color,
      total: kind.total,
      count: kind.count,
    }));
  }
  return bucket.segments;
}

export function SpendTimeline({
  buckets,
  byKind,
  caption,
}: {
  buckets: SpendBucket[];
  byKind: boolean;
  caption: string;
}) {
  const titleId = useId();
  const spent = buckets.filter((bucket) => bucket.total > 0);
  if (spent.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en el periodo.</p>;
  }

  const max = Math.max(...buckets.map((bucket) => bucket.total), 1);
  const longest = buckets.reduce((size, bucket) => Math.max(size, bucket.label.length), 1);
  const slot = Math.max(32, Math.min(72, Math.ceil(longest * 6.4)));
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 32;
  const height = 196;
  const innerH = height - padT - padB;
  const width = Math.max(buckets.length * slot + padL + padR, 280);
  const barW = 16;
  const legend = new Map<string, SpendSegment>();
  for (const bucket of buckets) {
    for (const segment of stackSegments(bucket, byKind)) {
      if (!legend.has(segment.category)) legend.set(segment.category, segment);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-labelledby={titleId}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-none"
        >
          <title id={titleId}>{caption}</title>
          {[0, 0.5, 1].map((step) => {
            const y = padT + innerH - innerH * step;
            const value = max * step;
            return (
              <g key={step}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.12} />
                <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.55}>
                  {compactMoney(value)}
                </text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const x = padL + index * slot + (slot - barW) / 2;
            let cursor = padT + innerH;
            const parts = stackSegments(bucket, byKind);
            return (
              <g key={bucket.key}>
                {bucket.total <= 0 ? (
                  <line
                    x1={x}
                    x2={x + barW}
                    y1={cursor}
                    y2={cursor}
                    stroke="currentColor"
                    strokeOpacity={0.25}
                  />
                ) : (
                  parts.map((segment) => {
                    const h = Math.max((segment.total / max) * innerH, segment.total > 0 ? 1 : 0);
                    cursor -= h;
                    return (
                      <rect
                        key={segment.category}
                        x={x}
                        y={Number(cursor.toFixed(1))}
                        width={barW}
                        height={Number(h.toFixed(1))}
                        rx={2}
                        fill={segment.color}
                      >
                        <title>{`${bucket.label} · ${segment.label}: ${formatMoney(segment.total)}`}</title>
                      </rect>
                    );
                  })
                )}
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={9}
                  fill="currentColor"
                  opacity={0.7}
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {[...legend.values()].map((segment) => (
          <li key={segment.category} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: segment.color }} />
            {segment.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SpendChronology({ buckets }: { buckets: SpendBucket[] }) {
  const active = buckets.filter((bucket) => bucket.count > 0);
  if (active.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en el periodo.</p>;
  }
  return (
    <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
      {active.map((bucket) => (
        <article key={bucket.key} className="rounded-xl border border-border bg-muted/20 p-3">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium capitalize">{bucket.label}</h4>
            <p className="text-sm tabular-nums">
              <span className="font-semibold">{formatMoney(bucket.total)}</span>
              <span className="text-muted-foreground"> · {bucket.count} {receiptWord(bucket.count)}</span>
            </p>
          </header>
          <ul className="mt-2 space-y-2">
            {bucket.kinds.map((kind) => (
              <li key={kind.kind}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="inline-block size-2.5 rounded-full" style={{ background: kind.color }} />
                    {kind.label}
                    <span className="text-xs font-normal text-muted-foreground">({kind.count})</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(kind.total)}</span>
                </div>
                <ul className="mt-1 space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {kind.categories.map((category) => (
                    <li key={category.category} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: category.color }} />
                        <span className="truncate">{category.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(category.total)} · {category.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function CategoryShare({ rows }: { rows: CategoryTotal[] }) {
  const titleId = useId();
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en el periodo.</p>;
  }
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg role="img" aria-labelledby={titleId} viewBox="0 0 120 120" className="size-32 shrink-0">
        <title id={titleId}>Participación del gasto por categoría</title>
        <g transform="rotate(-90 60 60)">
          {rows.map((row) => {
            const len = total > 0 ? (row.total / total) * c : 0;
            const dash = `${len.toFixed(2)} ${(c - len).toFixed(2)}`;
            const circle = (
              <circle
                key={row.category}
                cx={60}
                cy={60}
                r={r}
                fill="none"
                stroke={row.color}
                strokeWidth={16}
                strokeDasharray={dash}
                strokeDashoffset={(-offset).toFixed(2)}
              >
                <title>{`${row.label}: ${formatMoney(row.total)} (${(row.share * 100).toFixed(0)}%)`}</title>
              </circle>
            );
            offset += len;
            return circle;
          })}
        </g>
        <text x={60} y={58} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.6}>
          Total
        </text>
        <text x={60} y={72} textAnchor="middle" fontSize={7} fontWeight={600} fill="currentColor">
          {centerMoney(total)}
        </text>
      </svg>
      <ul className="w-full space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.category} className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="mt-1 inline-block size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="min-w-0">
                <span className="block truncate">{row.label}</span>
                <span className="text-xs text-muted-foreground">
                  {row.count} {receiptWord(row.count)} · prom. {formatMoney(row.count > 0 ? row.total / row.count : 0)}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right font-medium tabular-nums">
              {formatMoney(row.total)}
              <span className="block text-xs font-normal text-muted-foreground">{(row.share * 100).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
