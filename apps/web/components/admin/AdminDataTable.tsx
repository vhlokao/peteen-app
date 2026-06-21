import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type AdminDataTableColumn<T> = {
  key: string
  header: string
  className?: string
  render: (row: T) => ReactNode
}

type AdminDataTableProps<T> = {
  columns: AdminDataTableColumn<T>[]
  rows: T[]
  emptyMessage?: string
  className?: string
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function AdminDataTable<T>({
  columns,
  rows,
  emptyMessage = "Nenhum registro encontrado.",
  className,
}: AdminDataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b px-4 py-3 text-left text-xs font-medium text-muted-foreground",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-muted/20"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
