"use client"

/**
 * Módulo: notifications
 * Camada: components — a SUPERFÍCIE de notificações em Minha conta, sem estado
 * próprio (GATE-10-NOTIFICATIONS-UX-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE SEPARADO DO PushOptIn
 *
 * `PushOptIn` observa o ambiente real: ele só consegue mostrar o estado em que
 * ESTE navegador está agora. Isso torna metade da matriz invisível em revisão —
 * "bloqueado" e "sem suporte" não são estados que dá para visitar à vontade, e
 * um `denied` é permanente no browser que o produzir.
 *
 * Separando a decisão (lá) da pintura (aqui), a superfície inteira passa a ser
 * inspecionável com um `SaudePush` injetado: os cinco estados, nas três
 * plataformas, nas duas personas. Foi assim que o QA visual deste gate foi
 * feito — sem sessão, sem forçar permissão e sem queimar nenhum navegador.
 *
 * Nenhum hook, nenhum efeito, nenhuma chamada de push. Recebe o estado, devolve
 * a tela.
 */

import { BellRing, Check, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { resolvePushHealthCopy, type SaudePush } from "../domain/push-health"
import {
  beneficiosDeNotificacao,
  deveListarBeneficios,
  podeAtivarAgora,
  resolveOrientacaoDeDesbloqueio,
  resolveRotuloDeEstado,
  TITULO_DOS_BENEFICIOS,
  type PlataformaNotificacao,
  type TomDoEstado,
} from "../domain/notification-settings"
import type { PushInvitePersona } from "../domain/contextual-push-invite"

/** Cores do rótulo de estado. Mapeamento único — a UI não reabre o switch. */
const CLASSE_DO_TOM: Record<TomDoEstado, string> = {
  ativo: "bg-success/10 text-success",
  atencao: "bg-warning/15 text-warning-foreground",
  neutro: "bg-muted text-muted-foreground",
  bloqueado: "bg-destructive/10 text-destructive",
  indisponivel: "bg-muted text-muted-foreground",
}

export function NotificationSettingsView({
  saude,
  plataforma,
  persona,
  aoAtivar,
  aoDesativar,
}: {
  saude: SaudePush
  /** `null` no primeiro frame — a orientação aparece junto com o estado. */
  plataforma: PlataformaNotificacao | null
  persona: PushInvitePersona
  aoAtivar: () => void
  aoDesativar: () => void
}) {
  const copy = resolvePushHealthCopy(saude)
  const rotulo = resolveRotuloDeEstado(saude)
  const orientacao = plataforma ? resolveOrientacaoDeDesbloqueio(saude, plataforma) : null
  const ativacaoPossivel = podeAtivarAgora(saude)
  const reparando = saude.state === "NEEDS_REPAIR"

  /**
   * O detalhe do estado some quando existe passo a passo.
   *
   * As duas frases dizem a mesma coisa, uma vaga e outra concreta: em
   * bloqueado, "Libere as notificações para este site nas configurações do
   * navegador" seguido de "Como liberar no navegador → 1, 2, 3"; no iPhone,
   * "só funcionam com o app instalado" seguido de "só funcionam com o Peteen
   * aberto pelo ícone". Repetir em duas alturas diferentes é exatamente o
   * defeito que esta tela veio corrigir — o detalhe cede lugar à instrução.
   *
   * A variante `inline` (Request) não tem passos e por isso mantém o detalhe.
   */
  const detalhe = orientacao ? null : copy.detalhe

  // A ordem é a das perguntas que a pessoa faz: "está ligado?" (rótulo) → "o
  // que eu ganho?" (benefícios) → "como saio daqui?" (passos) → ação. Estados
  // sem saída não ganham botão nenhum: um CTA em bloqueado só produziria uma
  // recusa instantânea do navegador.
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{copy.titulo}</p>
          {detalhe ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detalhe}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${CLASSE_DO_TOM[rotulo.tom]}`}
        >
          {rotulo.texto}
        </span>
      </div>

      {/* O que a pessoa realmente recebe — e a lista é diferente por persona,
          porque os eventos enviados são diferentes. Ausente em bloqueado e em
          indisponível: ali seria uma promessa que o aparelho não pode cumprir. */}
      {deveListarBeneficios(saude) ? (
        <div>
          <p className="text-xs font-medium text-foreground">{TITULO_DOS_BENEFICIOS}</p>
          <ul className="mt-1.5 space-y-1">
            {beneficiosDeNotificacao(persona).map((beneficio) => (
              <li
                key={beneficio}
                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
              >
                <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{beneficio}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {orientacao ? (
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-medium text-foreground">{orientacao.titulo}</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            {orientacao.passos.map((passo) => (
              <li key={passo} className="text-xs leading-relaxed text-muted-foreground">
                {passo}
              </li>
            ))}
          </ol>
          {orientacao.nota ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {orientacao.nota}
            </p>
          ) : null}
        </div>
      ) : null}

      {saude.state === "ACTIVE" ? (
        <Button type="button" variant="outline" size="sm" onClick={aoDesativar}>
          Desativar neste aparelho
        </Button>
      ) : null}

      {ativacaoPossivel ? (
        <Button type="button" onClick={aoAtivar} className="gap-2">
          {reparando ? <RefreshCw className="size-4" /> : <BellRing className="size-4" />}
          {reparando ? "Reativar notificações" : "Ativar notificações"}
        </Button>
      ) : null}
    </div>
  )
}
