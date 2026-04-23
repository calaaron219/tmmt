"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { bulkCreateTransactions, type ImportRowInput } from "../actions";

type ParsedRow = Record<string, string>;

type ColumnMap = {
  date: string | null;
  amount: string | null;
  description: string | null;
};

type ParseResult = {
  headers: string[];
  rows: ParsedRow[];
  autoMap: ColumnMap;
};

const DATE_HINTS = ["date", "posted", "transaction date"];
const AMOUNT_HINTS = ["amount", "debit", "credit"];
const DESCRIPTION_HINTS = ["description", "memo", "payee", "name"];

function autoDetectColumns(headers: string[]): ColumnMap {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (hints: string[]) => {
    for (const hint of hints) {
      const idx = lower.findIndex((h) => h.includes(hint));
      if (idx >= 0) return headers[idx];
    }
    return null;
  };
  return {
    date: find(DATE_HINTS),
    amount: find(AMOUNT_HINTS),
    description: find(DESCRIPTION_HINTS),
  };
}

function parseAmount(raw: string): number | null {
  // Strip currency symbols, commas, and whitespace
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  // Handle parentheses like (12.34) for negatives
  const withSign = /^\(.*\)$/.test(cleaned)
    ? `-${cleaned.slice(1, -1)}`
    : cleaned;
  const num = parseFloat(withSign);
  return Number.isFinite(num) ? num : null;
}

function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ImportWizard() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({
    date: null,
    amount: null,
    description: null,
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    autoCategorized: number;
    uncategorized: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    setFileName(file.name);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (parsed.errors.length > 0) {
          setError(`Parse error: ${parsed.errors[0].message}`);
          return;
        }
        if (!parsed.data.length) {
          setError("CSV has no rows");
          return;
        }
        const headers = parsed.meta.fields ?? [];
        const autoMap = autoDetectColumns(headers);
        setParseResult({ headers, rows: parsed.data, autoMap });
        setColumnMap(autoMap);
      },
      error: (err) => {
        setError(`Parse error: ${err.message}`);
      },
    });
  }

  async function handleImport() {
    if (!parseResult) return;
    setError(null);

    const { date, amount, description } = columnMap;
    if (!date || !amount || !description) {
      setError("Map all three columns before importing");
      return;
    }

    const rows: ImportRowInput[] = [];
    const skipped: number[] = [];

    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i];
      const d = parseDate(row[date]);
      const a = parseAmount(row[amount]);
      const desc = row[description]?.trim();

      if (!d || a === null || !desc) {
        skipped.push(i + 2); // +2: header + 1-indexed
        continue;
      }

      rows.push({
        occurredAt: d,
        amountCents: Math.round(Math.abs(a) * 100),
        type: a < 0 ? "EXPENSE" : "INCOME",
        rawDescription: desc,
        merchant: null,
      });
    }

    if (rows.length === 0) {
      setError("No valid rows found — check your column mapping");
      return;
    }

    startTransition(async () => {
      try {
        const summary = await bulkCreateTransactions(rows);
        setResult({
          ...summary,
          uncategorized: summary.uncategorized + skipped.length,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  // ─── Success state ───
  if (result) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-green-900">
          Imported {result.imported} transaction
          {result.imported === 1 ? "" : "s"}
        </h2>
        <ul className="text-sm text-green-800 space-y-1">
          <li>
            ✓ {result.autoCategorized} auto-categorized by rules
          </li>
          <li>
            {result.uncategorized} uncategorized (tag them manually from the
            list)
          </li>
        </ul>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push("/app/money")}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Go to transactions
          </button>
          <button
            type="button"
            onClick={() => {
              setParseResult(null);
              setColumnMap({ date: null, amount: null, description: null });
              setFileName(null);
              setResult(null);
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Import another
          </button>
        </div>
      </div>
    );
  }

  // ─── Preview + mapping state ───
  if (parseResult) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-500">
                {" "}
                · {parseResult.rows.length} rows detected
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setParseResult(null);
                setColumnMap({ date: null, amount: null, description: null });
                setFileName(null);
              }}
              className="text-xs text-gray-500 hover:text-gray-900 transition"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-medium">Column mapping</h3>
          <p className="text-xs text-gray-500">
            Pick which CSV column maps to each field. Negative amounts become
            expenses, positive become income.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColumnSelect
              label="Date"
              value={columnMap.date}
              headers={parseResult.headers}
              onChange={(v) =>
                setColumnMap({ ...columnMap, date: v })
              }
            />
            <ColumnSelect
              label="Amount"
              value={columnMap.amount}
              headers={parseResult.headers}
              onChange={(v) =>
                setColumnMap({ ...columnMap, amount: v })
              }
            />
            <ColumnSelect
              label="Description"
              value={columnMap.description}
              headers={parseResult.headers}
              onChange={(v) =>
                setColumnMap({ ...columnMap, description: v })
              }
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="text-sm font-medium">
              Preview (first {Math.min(10, parseResult.rows.length)} rows)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {parseResult.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                      {columnMap.date === h && " 📅"}
                      {columnMap.amount === h && " 💵"}
                      {columnMap.description === h && " 📝"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parseResult.rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {parseResult.headers.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-2 text-gray-700 truncate max-w-[200px]"
                      >
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={
            isPending ||
            !columnMap.date ||
            !columnMap.amount ||
            !columnMap.description
          }
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending
            ? "Importing…"
            : `Import ${parseResult.rows.length} transaction${
                parseResult.rows.length === 1 ? "" : "s"
              }`}
        </button>
      </div>
    );
  }

  // ─── Empty / upload state ───
  return (
    <div className="space-y-3">
      <DropZone onFile={handleFile} />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`block rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition ${
        dragging
          ? "border-gray-900 bg-gray-50"
          : "border-gray-300 bg-white hover:border-gray-400"
      }`}
    >
      <div className="text-3xl mb-2">📄</div>
      <p className="text-sm font-medium">
        Drop a CSV here or click to pick
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Max 1000 rows per import
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function ColumnSelect({
  label,
  value,
  headers,
  onChange,
}: {
  label: string;
  value: string | null;
  headers: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">— choose —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}
