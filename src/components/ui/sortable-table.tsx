"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortState = { column: number; direction: "asc" | "desc" } | null;

type AnyProps = Record<string, unknown> & { children?: ReactNode };
type AnyElement = ReactElement<AnyProps>;

const IGNORED_PROP_KEYS = new Set(["className", "style", "id", "href", "src", "type", "role"]);
const INTERACTIVE_TAGS = new Set(["input", "button", "select", "textarea"]);
const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/** Keys from `Children.toArray` depend on source position, so reordering keeps them stable. */
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children);
}

function isElement(node: ReactNode, type?: string): node is AnyElement {
  return isValidElement<AnyProps>(node) && (type === undefined || node.type === type);
}

/** Best-effort text of a React subtree; `data-sort` on any element overrides it. */
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (!isValidElement<AnyProps>(node)) return "";
  const props = node.props;
  if (props["data-sort"] != null) return String(props["data-sort"]);
  if (typeof node.type === "string" && INTERACTIVE_TAGS.has(node.type)) {
    return String(props.value ?? props.defaultValue ?? "");
  }
  if (props.children != null) return nodeText(props.children);
  if (typeof node.type !== "string") {
    return Object.entries(props)
      .filter(
        ([key, value]) =>
          !IGNORED_PROP_KEYS.has(key) && (typeof value === "string" || typeof value === "number")
      )
      .map(([, value]) => String(value))
      .join(" ");
  }
  return "";
}

function hasInteractive(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasInteractive);
  if (!isValidElement<AnyProps>(node)) return false;
  if (typeof node.type === "string" && INTERACTIVE_TAGS.has(node.type)) return true;
  return hasInteractive(node.props.children);
}

/** Cells of a row indexed by visual column (respects colSpan). */
function rowCells(row: AnyElement): Map<number, AnyElement> {
  const cells = new Map<number, AnyElement>();
  let column = 0;
  for (const cell of flatten(row.props.children)) {
    if (!isElement(cell)) continue;
    cells.set(column, cell);
    column += Number(cell.props.colSpan ?? 1) || 1;
  }
  return cells;
}

function firstRow(unit: ReactNode): AnyElement | null {
  if (isElement(unit, "tr")) return unit;
  if (isElement(unit) && unit.type === Fragment) {
    return (flatten(unit.props.children).find((child) => isElement(child, "tr")) as AnyElement) ?? null;
  }
  return null;
}

type SortValue =
  | { kind: "empty" }
  | { kind: "number"; value: number; text: string }
  | { kind: "text"; text: string };

function parseSortValue(raw: string): SortValue {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || /^[—–-]+$/.test(text) || /^sin\s/i.test(text)) return { kind: "empty" };

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const [, d, m, y, hh = "0", mm = "0"] = match;
    return { kind: "number", value: Date.UTC(+y, +m - 1, +d, +hh, +mm), text };
  }
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (match) {
    const [, y, m, d, hh = "0", mm = "0"] = match;
    return { kind: "number", value: Date.UTC(+y, +m - 1, +d, +hh, +mm), text };
  }
  match = text.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3})[a-záéíóú.]*\s+(?:de\s+)?(\d{4})/i);
  if (match && MONTHS[match[2].toLowerCase()] !== undefined) {
    return {
      kind: "number",
      value: Date.UTC(+match[3], MONTHS[match[2].toLowerCase()], +match[1]),
      text,
    };
  }

  match = text.match(/^([-−+]?)\s*(?:MXN|USD)?\s*\$?\s*([-−]?)(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([kKmM](?![a-záéíóú]))?/);
  if (match) {
    const negative = match[1] === "-" || match[1] === "−" || match[2] !== "";
    let value = Number(match[3].replace(/,/g, ""));
    const suffix = match[4]?.toLowerCase();
    if (suffix === "k") value *= 1_000;
    if (suffix === "m") value *= 1_000_000;
    return { kind: "number", value: negative ? -value : value, text };
  }

  return { kind: "text", text };
}

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function compareValues(a: SortValue, b: SortValue) {
  if (a.kind === "number" && b.kind === "number") {
    return a.value - b.value || collator.compare(a.text, b.text);
  }
  const textA = a.kind === "empty" ? "" : a.text;
  const textB = b.kind === "empty" ? "" : b.text;
  return collator.compare(textA, textB);
}

function sortBody(body: AnyElement, sort: SortState): AnyElement {
  const units = flatten(body.props.children);
  if (!sort) return cloneElement(body, undefined, units);
  const sortable: { unit: ReactNode; value: SortValue; index: number }[] = [];
  const rest: ReactNode[] = [];

  units.forEach((unit, index) => {
    const row = firstRow(unit);
    const cells = row ? rowCells(row) : null;
    const cell = cells?.get(sort.column);
    const spansAll = cells?.size === 1 && Number(cell?.props.colSpan ?? 1) > 1;
    if (!row || !cell || spansAll || row.props["data-sort"] === "off") {
      rest.push(unit);
      return;
    }
    sortable.push({ unit, value: parseSortValue(nodeText(cell)), index });
  });

  if (sortable.length < 2) return cloneElement(body, undefined, units);

  const factor = sort.direction === "asc" ? 1 : -1;
  sortable.sort((a, b) => {
    const emptyA = a.value.kind === "empty";
    const emptyB = b.value.kind === "empty";
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    return compareValues(a.value, b.value) * factor || a.index - b.index;
  });

  return cloneElement(body, undefined, [...sortable.map((item) => item.unit), ...rest]);
}

function headerLabel(cell: AnyElement) {
  return nodeText(cell.props.children).replace(/\s+/g, " ").trim();
}

function isSortableHeader(cell: AnyElement) {
  if (cell.props["data-sort"] === "off") return false;
  const label = headerLabel(cell);
  if (!label || /^acci[oó]n(es)?$/i.test(label)) return false;
  return !hasInteractive(cell.props.children);
}

function enhanceHead(
  head: AnyElement,
  sort: SortState,
  onSort: (column: number) => void
): AnyElement {
  const rows = flatten(head.props.children);
  const lastRowIndex = rows.reduce<number>(
    (last, row, index) => (isElement(row, "tr") ? index : last),
    -1
  );
  if (lastRowIndex < 0) return head;

  const row = rows[lastRowIndex] as AnyElement;
  let column = 0;
  const cells = flatten(row.props.children).map((cell) => {
    if (!isElement(cell)) return cell;
    const current = column;
    column += Number(cell.props.colSpan ?? 1) || 1;
    if (!isSortableHeader(cell)) return cell;

    const active = sort?.column === current ? sort.direction : null;
    const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
    return cloneElement(
      cell,
      {
        "aria-sort": active === "asc" ? "ascending" : active === "desc" ? "descending" : "none",
      },
      <button
        type="button"
        onClick={() => onSort(current)}
        title="Ordenar"
        className={cn(
          "group/sort inline-flex items-center gap-1 rounded text-inherit transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00BFFF]",
          active ? "text-foreground" : ""
        )}
      >
        <span>{cell.props.children}</span>
        <Icon
          aria-hidden
          className={cn(
            "size-3 shrink-0 transition-opacity",
            active ? "opacity-100" : "opacity-35 group-hover/sort:opacity-80"
          )}
        />
      </button>
    );
  });

  const newRows = rows.map((item, index) =>
    index === lastRowIndex ? cloneElement(row, undefined, cells) : item
  );
  return cloneElement(head, undefined, newRows);
}

/**
 * Drop-in replacement for `<table>`: clicking a header cycles ascending →
 * descending → original order. Values are read from the rendered cells
 * (numbers, money, dates and text are detected); put `data-sort` on a cell to
 * override its value, or `data-sort="off"` on a `<th>`/`<tr>` to exclude it.
 */
export function SortableTable({ children, ...props }: ComponentPropsWithoutRef<"table">) {
  const [sort, setSort] = useState<SortState>(null);

  function handleSort(column: number) {
    setSort((current) => {
      if (current?.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  }

  const content = flatten(children).map((child) => {
    if (isElement(child, "thead")) return enhanceHead(child, sort, handleSort);
    if (isElement(child, "tbody")) return sortBody(child, sort);
    return child;
  });

  return <table {...props}>{content}</table>;
}
