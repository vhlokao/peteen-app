/**
 * Skeleton compartilhado por todas as telas de /admin.
 *
 * Antes desta missão o backoffice inteiro não tinha NENHUM `loading.tsx`: como
 * todas as páginas são Server Components que consultam o banco, a navegação
 * ficava congelada na tela anterior até a query terminar — sem nada indicando
 * que algo estava acontecendo. Em telas pesadas (auditoria, push) isso lê como
 * clique perdido, e a reação natural é clicar de novo.
 *
 * Um único arquivo no nível de `/admin` cobre todas as rotas filhas. As formas
 * são genéricas de propósito — header + cartões + tabela é o esqueleto comum a
 * praticamente toda tela daqui, e um skeleton por página seria manutenção sem
 * retorno.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      {/* Cabeçalho */}
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-3.5 w-72 rounded bg-muted/60" />
      </div>

      {/* Faixa de métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="h-7 w-12 rounded bg-muted" />
            <div className="mt-2 h-3 w-24 rounded bg-muted/60" />
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border">
        <div className="h-10 border-b bg-muted/40" />
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="h-3.5 w-20 rounded bg-muted/60" />
              <div className="h-3.5 w-32 rounded bg-muted/60" />
              <div className="h-3.5 w-24 rounded bg-muted/60" />
              <div className="ml-auto h-5 w-16 rounded-full bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
