import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * GATE-11 — volta para telas EMPURRADAS que usam este cabeçalho.
   *
   * Opcional porque a maioria das telas com `PageHeader` é destino de aba: ali
   * um botão de voltar seria ruído, e o BottomNav já diz onde a pessoa está.
   * Quando presente, o círculo aparece à esquerda do título — mesma linguagem
   * visual do cabeçalho compacto usado no detalhe da solicitação e no Diário,
   * para que a volta seja reconhecível no mesmo lugar em toda tela empurrada.
   *
   * É um `Link` de verdade, com href resolvido no servidor: funciona em
   * entrada fria (atalho da Tela de Início, link direto, redirect de
   * pós-login), onde `router.back()` tiraria a pessoa do app.
   */
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = "Voltar",
}: PageHeaderProps) {
  const heading = (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );

  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {backHref ? (
        // `items-start` + `mt-0.5`: alinhado à primeira LINHA do título, não ao
        // centro do bloco — com descrição, centralizar deixaria o círculo
        // flutuando no meio do parágrafo.
        <div className="flex min-w-0 items-start gap-3">
          {/*
           * Alvo de toque de 44px com círculo visual de 36px.
           *
           * O círculo tem que continuar idêntico ao das outras telas
           * empurradas (detalhe da solicitação, Diário) — mas 36px fica abaixo
           * do `--touch-target-min` (44px) que o próprio design system define,
           * e este é o ÚNICO caminho de volta de uma tela cheia no mobile.
           *
           * O link é 44×44 de verdade (`size-11`) e o `-m-1` devolve os 4px de
           * cada lado ao layout, então a posição e o alinhamento não mudam um
           * pixel. Geometria real, não pseudo-elemento: é o que o dedo e o
           * teste conseguem alcançar.
           */}
          <Link
            href={backHref}
            aria-label={backLabel}
            className="group -m-1 mt-[-0.125rem] grid size-11 shrink-0 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="grid size-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-colors group-hover:bg-muted/40 group-hover:text-foreground">
              <ChevronLeft className="size-5" />
            </span>
          </Link>
          {heading}
        </div>
      ) : (
        heading
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
