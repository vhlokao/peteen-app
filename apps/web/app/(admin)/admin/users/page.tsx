import type { Metadata } from "next"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { getAdminUsersAction } from "@/modules/backoffice/application/actions"
import { AdminDataTable } from "@/components/admin/AdminDataTable"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge"
import type { AdminUserRow } from "@/modules/backoffice/domain/types"

export const metadata: Metadata = { title: "Admin — Usuários" }

type UsersPageProps = {
  searchParams: Promise<{ role?: string; email?: string }>
}

const COLUMNS = [
  {
    key: "email",
    header: "Email",
    render: (row: AdminUserRow) => (
      <span className="font-mono text-xs">{row.email}</span>
    ),
  },
  {
    key: "roles",
    header: "Personas",
    render: (row: AdminUserRow) => (
      <div className="flex flex-wrap gap-1">
        {row.roles.length > 0
          ? row.roles.map((r) => (
              <AdminStatusBadge key={r} type="role" value={r} />
            ))
          : <span className="text-xs text-muted-foreground">—</span>}
      </div>
    ),
  },
  {
    key: "primaryRole",
    header: "Primária",
    render: (row: AdminUserRow) =>
      row.activePrimaryRole ? (
        <AdminStatusBadge type="role" value={row.activePrimaryRole} />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "onboarding",
    header: "Onboarding",
    render: (row: AdminUserRow) =>
      row.onboardingCompletedAt ? (
        <span className="text-xs text-emerald-600">Concluído</span>
      ) : (
        <span className="text-xs text-amber-600">Pendente</span>
      ),
  },
  {
    key: "lastSeen",
    header: "Último acesso",
    render: (row: AdminUserRow) =>
      row.lastSeenAt ? (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.lastSeenAt), "dd/MM/yy HH:mm", { locale: ptBR })}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "createdAt",
    header: "Cadastrado em",
    render: (row: AdminUserRow) => (
      <span className="text-xs text-muted-foreground">
        {format(new Date(row.createdAt), "dd/MM/yyyy", { locale: ptBR })}
      </span>
    ),
  },
]

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const { role, email } = await searchParams
  const users = await getAdminUsersAction({ role, email })

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        description="Todos os usuários cadastrados no Peteen."
        count={users.length}
      />

      {/* Filtros via GET */}
      <form method="GET" className="mb-4 flex flex-wrap gap-3">
        <input
          name="email"
          defaultValue={email}
          placeholder="Filtrar por email…"
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          name="role"
          defaultValue={role ?? ""}
          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas as personas</option>
          <option value="TUTOR">Tutor</option>
          <option value="PROFESSIONAL">Profissional</option>
          <option value="ADMIN">Admin</option>
          <option value="PARTNER">Parceiro</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrar
        </button>
        {(role || email) && (
          <a href="/admin/users" className="py-1.5 text-sm text-muted-foreground underline">
            Limpar
          </a>
        )}
      </form>

      <AdminDataTable
        columns={COLUMNS}
        rows={users}
        emptyMessage="Nenhum usuário encontrado."
      />
    </div>
  )
}
