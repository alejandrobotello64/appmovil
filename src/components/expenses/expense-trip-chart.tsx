"use client";

import { useMemo, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  categoryColor,
  categoryLabel,
  formatMoney,
  type ExpenseItem,
} from "@/lib/expenses/types";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ""}`;
}

function compactMoney(value: number) {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `$${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

type DayPoint = {
  date: string;
  total: number;
  accumulated: number;
  parts: { category: string; label: string; color: string; amount: number }[];
};

function buildSeries(items: ExpenseItem[]) {
  const dates = [...new Set(items.map((item) => item.expenseDate))].sort();
  const used = EXPENSE_CATEGORIES.filter((category) => items.some((item) => item.category === category.id));
  let accumulated = 0;
  const days: DayPoint[] = dates.map((date) => {
    const parts = used
      .map((category) => ({
        category: category.id,
        label: category.label,
        color: category.color,
        amount: items
          .filter((item) => item.expenseDate === date && item.category === category.id)
          .reduce((sum, item) => sum + item.total, 0),
      }))
      .filter((part) => part.amount > 0);
    const total = parts.reduce((sum, part) => sum + part.amount, 0);
    accumulated += total;
    return { date, total, accumulated, parts };
  });
  return {
    days,
    categories: used.map((category) => ({
      id: category.id,
      label: category.label,
      color: category.color,
      total: items.filter((item) => item.category === category.id).reduce((sum, item) => sum + item.total, 0),
    })),
    maxDay: Math.max(...days.map((day) => day.total), 1),
    maxAcc: Math.max(accumulated, 1),
  };
}

export function ExpenseTripChart({
  items,
  startDate,
  endDate,
}: {
  items: ExpenseItem[];
  startDate: string;
  endDate: string;
}) {
  const series = useMemo(() => buildSeries(items), [items]);
  const [active, setActive] = useState<number | null>(null);
  if (series.days.length === 0) return null;

  const width = 640;
  const height = 210;
  const padL = 42;
  const padR = 46;
  const padT = 14;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const slot = plotW / series.days.length;
  const barW = Math.min(28, slot * 0.62);
  const labelStep = Math.ceil(series.days.length / 8);
  const selected = active == null ? null : series.days[active];
  const outside = items.filter((item) => item.expenseDate < startDate || item.expenseDate > endDate).length;

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="font-semibold">Gasto en el tiempo</h4>
          <p className="text-xs text-muted-foreground">
            Barras: gasto del día por tipo. Línea: acumulado del viaje.
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{formatMoney(series.maxAcc)}</p>
      </div>

      <div className="mt-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Gasto diario por tipo y acumulado del viaje">
          {[0, 0.5, 1].map((step) => {
            const y = padT + plotH * (1 - step);
            return (
              <g key={step}>
                <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
                <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
                  {compactMoney(series.maxDay * step)}
                </text>
                <text x={width - padR + 6} y={y + 3} className="fill-[#3B46A5]" fontSize="10">
                  {compactMoney(series.maxAcc * step)}
                </text>
              </g>
            );
          })}

          {series.days.map((day, index) => {
            const x = padL + index * slot + (slot - barW) / 2;
            let cursor = padT + plotH;
            const outsideDay = day.date < startDate || day.date > endDate;
            return (
              <g key={day.date} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
                <rect
                  x={padL + index * slot}
                  y={padT}
                  width={slot}
                  height={plotH}
                  fill={active === index ? "currentColor" : "transparent"}
                  className="text-muted/40"
                />
                {day.parts.map((part) => {
                  const h = (part.amount / series.maxDay) * plotH;
                  cursor -= h;
                  return <rect key={part.category} x={x} y={cursor} width={barW} height={Math.max(h, 0.8)} fill={part.color} opacity={outsideDay ? 0.45 : 1} rx="1" />;
                })}
                {index % labelStep === 0 || index === series.days.length - 1 ? (
                  <text x={padL + index * slot + slot / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                    {shortDate(day.date)}
                  </text>
                ) : null}
              </g>
            );
          })}

          <polyline
            fill="none"
            stroke="#3B46A5"
            strokeWidth="2"
            points={series.days
              .map((day, index) => {
                const x = padL + index * slot + slot / 2;
                const y = padT + plotH - (day.accumulated / series.maxAcc) * plotH;
                return `${x},${y}`;
              })
              .join(" ")}
          />
          {series.days.map((day, index) => {
            const x = padL + index * slot + slot / 2;
            const y = padT + plotH - (day.accumulated / series.maxAcc) * plotH;
            return <circle key={day.date} cx={x} cy={y} r={active === index ? 4 : 2.5} fill="#3B46A5" />;
          })}
        </svg>
      </div>

      <p className="mt-1 min-h-5 text-xs text-muted-foreground">
        {selected
          ? `${shortDate(selected.date)} · día ${formatMoney(selected.total)} · acumulado ${formatMoney(selected.accumulated)}${selected.parts.map((part) => ` · ${part.label} ${formatMoney(part.amount)}`).join("")}`
          : "Pasa el cursor sobre un día para ver el desglose."}
      </p>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {series.categories.map((category) => (
          <li key={category.id} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: categoryColor(category.id) }} />
            <span>{categoryLabel(category.id)}</span>
            <span className="text-muted-foreground tabular-nums">{formatMoney(category.total)}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#3B46A5]" />
          <span>Acumulado</span>
        </li>
      </ul>
      {outside > 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {outside === 1 ? "1 ticket está" : `${outside} tickets están`} fuera de las fechas del viaje. Las barras se ven más claras; ajusta la fecha en la lista.
        </p>
      ) : null}
    </section>
  );
}
