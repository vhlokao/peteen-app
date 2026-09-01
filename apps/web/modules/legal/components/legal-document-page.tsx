import Link from "next/link"
import { ArrowLeft, FileWarning } from "lucide-react"

import {
  documentoVigente,
  LEGAL_LINK_LABELS,
  legalHref,
  type LegalDocument,
} from "../domain/legal-documents"

/**
 * Superfície pública compartilhada por /termos e /privacidade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O AVISO DE PENDÊNCIA NÃO É DECORATIVO
 *
 * Enquanto o texto jurídico real não existir, esta página precisa deixar isso
 * INEQUÍVOCO para qualquer pessoa que chegar por um link do login. Um
 * documento legal com aparência de definitivo e conteúdo inventado é pior que
 * um 404: o 404 não engana ninguém, o placeholder engana.
 *
 * Por isso o aviso é a primeira coisa depois do título, tem cor de alerta e
 * texto direto — e some sozinho quando `documentoVigente` passar a ser
 * verdadeiro, sem depender de alguém lembrar de removê-lo.
 *
 * O SUMÁRIO EXISTE MESMO PENDENTE, e é deliberado: mostra ao jurídico (e a
 * quem for revisar) exatamente qual pauta a estrutura já espera, e dá âncoras
 * estáveis que poderão ser linkadas de fora assim que o conteúdo entrar.
 */
export function LegalDocumentPage({ doc }: { doc: LegalDocument }) {
  const vigente = documentoVigente(doc)
  const outro = doc.slug === "termos" ? "privacidade" : "termos"

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-6 py-10 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao início
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
          {doc.titulo}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{doc.descricao}</p>
        {vigente && doc.ultimaAtualizacao ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Última atualização: {doc.ultimaAtualizacao}
          </p>
        ) : null}

        {!vigente ? (
          <div
            role="status"
            className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/15"
          >
            <FileWarning
              className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Documento em elaboração
              </p>
              <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                O texto definitivo ainda está sendo preparado e será publicado
                aqui antes da abertura ao público. A estrutura abaixo indica os
                temas que o documento vai cobrir — nenhum deles vale como termo
                vigente até que o conteúdo seja publicado.
              </p>
            </div>
          </div>
        ) : null}

        {/* Sumário — âncoras estáveis desde já. */}
        <nav aria-label="Seções deste documento" className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Nesta página
          </h2>
          <ol className="mt-3 space-y-1.5">
            {doc.secoes.map((secao, i) => (
              <li key={secao.id} className="text-sm">
                <a
                  href={`#${secao.id}`}
                  className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  <span className="tabular-nums">{i + 1}.</span> {secao.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-8">
          {doc.secoes.map((secao, i) => (
            <section key={secao.id} aria-labelledby={secao.id}>
              <h2
                id={secao.id}
                className="scroll-mt-6 text-base font-semibold text-foreground"
              >
                <span className="tabular-nums text-muted-foreground">{i + 1}.</span>{" "}
                {secao.titulo}
              </h2>
              {secao.pendente ? (
                // Nunca lorem ipsum, nunca um rascunho com cara de definitivo:
                // a ausência é declarada, em itálico e em cor secundária.
                <p className="mt-1.5 text-sm italic leading-relaxed text-muted-foreground">
                  Conteúdo em elaboração.
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  {secao.blocos.map((bloco, blocoIndex) =>
                    bloco.tipo === "paragrafo" ? (
                      <p
                        key={blocoIndex}
                        className="text-sm leading-relaxed text-muted-foreground"
                      >
                        {bloco.texto}
                      </p>
                    ) : (
                      <ul
                        key={blocoIndex}
                        className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground"
                      >
                        {bloco.itens.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-border pt-6">
          <Link
            href={legalHref(outro)}
            className="text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {LEGAL_LINK_LABELS[outro]}
          </Link>
        </footer>
      </div>
    </main>
  )
}
