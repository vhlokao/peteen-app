/**
 * Módulo: notifications
 * Camada: domain — como o ESTADO de push vira uma superfície compreensível
 * (GATE-10-NOTIFICATIONS-UX-001).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE ARQUIVO **NÃO** FAZ
 *
 * Ele não avalia estado. Quem decide se push funciona neste aparelho continua
 * sendo `avaliarSaudePush` (push-health.ts), e quem produz a frase-título
 * continua sendo `resolvePushHealthCopy`. Duplicar qualquer um dos dois criaria
 * uma segunda opinião sobre o mesmo fato — exatamente o defeito que o
 * push-health foi escrito para eliminar.
 *
 * O que faltava, e é só isso que mora aqui:
 *
 *   1. um RÓTULO curto de estado, para a pessoa responder "está ligado?" sem
 *      ler um parágrafo;
 *   2. a lista do que ela realmente vai receber — que é diferente por persona;
 *   3. a orientação REAL de desbloqueio, que depende da plataforma;
 *   4. as duas travas de honestidade: quando existe ação possível e quando é
 *      permitido prometer aviso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REGRA QUE GOVERNA TUDO AQUI: NÃO PROMETER O QUE NÃO CHEGA
 *
 * Duas promessas falsas eram possíveis antes deste gate, e as duas estão
 * fechadas por função pura + teste:
 *
 *   - prometer aviso para quem está BLOQUEADO ou sem suporte. O texto de valor
 *     ("você recebe um aviso quando…") só existe onde a entrega é possível —
 *     ver `deveListarBeneficios`;
 *
 *   - prometer ao PROFISSIONAL os eventos do tutor. O dispatcher
 *     (push-service-request-events.ts) envia início, Diário e conclusão SÓ
 *     para o tutor: são atos do próprio profissional. A tela de Conta mostrava
 *     a mesma frase genérica para os dois — ver `beneficiosDeNotificacao`.
 */

import type { PushInvitePersona } from "./contextual-push-invite"
import type { SaudePush } from "./push-health"

// ─────────────────────────────────────────────────────────────────────────────
// O que cada persona REALMENTE recebe
//
// Espelho literal de push-service-request-events.ts. Cada item abaixo tem uma
// chamada `notify*` correspondente com aquele destinatário — nada é aspiracional.
// ─────────────────────────────────────────────────────────────────────────────

const BENEFICIOS_TUTOR = [
  "Quando um profissional aceitar sua solicitação",
  "Quando o atendimento começar",
  "Quando houver uma novidade no Diário de cuidado",
  "Quando o atendimento for concluído",
] as const

const BENEFICIOS_PROFISSIONAL = [
  "Quando chegar uma nova solicitação de atendimento",
  "Se o cliente cancelar um atendimento",
] as const

/** O que a pessoa passa a receber ao ativar. Só eventos que o produto envia. */
export function beneficiosDeNotificacao(persona: PushInvitePersona): readonly string[] {
  return persona === "tutor" ? BENEFICIOS_TUTOR : BENEFICIOS_PROFISSIONAL
}

// ─────────────────────────────────────────────────────────────────────────────
// Rótulo curto de estado
//
// `tom` existe para a UI não precisar reabrir o `switch` do estado só para
// escolher uma cor — e para o teste conseguir afirmar que nenhum estado além de
// ACTIVE usa o tom de "está funcionando".
// ─────────────────────────────────────────────────────────────────────────────

export type TomDoEstado = "ativo" | "neutro" | "atencao" | "bloqueado" | "indisponivel"

export type RotuloDeEstado = { texto: string; tom: TomDoEstado }

export function resolveRotuloDeEstado(saude: SaudePush): RotuloDeEstado {
  switch (saude.state) {
    case "ACTIVE":
      return { texto: "Ativadas", tom: "ativo" }
    case "NEEDS_REPAIR":
      // "Restabelecendo" e não "com problema": o reparo é automático e quase
      // sempre termina antes de a pessoa terminar de ler. Alarmar aqui ensina
      // a ignorar o aviso no dia em que ele for verdadeiro.
      return { texto: "Restabelecendo", tom: "atencao" }
    case "DISABLED":
      return { texto: "Desativadas", tom: "neutro" }
    case "DENIED":
      return { texto: "Bloqueadas", tom: "bloqueado" }
    case "UNSUPPORTED":
      return { texto: "Indisponíveis", tom: "indisponivel" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// As duas travas de honestidade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Existe uma ativação que pode REALMENTE funcionar se a pessoa tocar agora?
 *
 * Só DISABLED e NEEDS_REPAIR. DENIED não: o browser recusa na hora e chamadas
 * repetidas reforçam a marcação de abuso da origem. UNSUPPORTED não: não há API.
 * ACTIVE não: não há o que ativar.
 */
export function podeAtivarAgora(saude: SaudePush): boolean {
  return saude.state === "DISABLED" || saude.state === "NEEDS_REPAIR"
}

/**
 * É permitido dizer "você recebe um aviso quando…"?
 *
 * Não em DENIED nem em UNSUPPORTED: ali a frase seria uma promessa que o
 * aparelho não tem como cumprir.
 */
export function deveListarBeneficios(saude: SaudePush): boolean {
  return saude.state !== "DENIED" && saude.state !== "UNSUPPORTED"
}

/**
 * Cabeçalho da lista de benefícios.
 *
 * ACTIVE confirma um fato ("você recebe"); os demais descrevem o que a ativação
 * entrega — e o verbo é o mesmo de propósito, porque a lista é a mesma e mudar
 * o tempo verbal só faria a pessoa reler para descobrir que nada mudou.
 */
export const TITULO_DOS_BENEFICIOS = "Você recebe um aviso:"

// ─────────────────────────────────────────────────────────────────────────────
// Orientação de desbloqueio — depende da PLATAFORMA, não só do estado
//
// "Libere as notificações para este site nas configurações do navegador" era a
// frase anterior. Ela é verdadeira e inútil: não diz onde. No iPhone nem sequer
// é o navegador — é Ajustes do sistema. Sem passo a passo, DENIED é um beco sem
// saída dentro de uma tela que existe justamente para resolver o assunto.
// ─────────────────────────────────────────────────────────────────────────────

export type PlataformaNotificacao = "ios" | "android" | "desktop"

/**
 * Plataforma para fins de ORIENTAÇÃO. Puro de propósito: recebe o que o browser
 * observou, não lê `navigator` — é isso que torna a matriz testável sem jsdom.
 *
 * iPadOS 13+ se anuncia como "Macintosh" e só se distingue de um Mac de verdade
 * pelos pontos de toque — mesmo sinal usado em `iosForaDaTelaDeInicio`.
 */
export function detectarPlataforma(
  userAgent: string,
  maxTouchPoints: number
): PlataformaNotificacao {
  if (/iPad|iPhone|iPod/.test(userAgent)) return "ios"
  if (userAgent.includes("Macintosh") && maxTouchPoints > 1) return "ios"
  if (/Android/.test(userAgent)) return "android"
  return "desktop"
}

export type OrientacaoDeDesbloqueio = {
  titulo: string
  passos: readonly string[]
  /** Fecha o texto sem prometer aviso — só descreve o que acontece depois. */
  nota: string | null
}

const VOLTA_SOZINHA = "Depois volte a esta tela — ela se atualiza sozinha."

/**
 * O caminho concreto para sair do estado atual, ou `null` quando não há um.
 *
 * `null` em ACTIVE/DISABLED/NEEDS_REPAIR (não há nada a desbloquear) e nos dois
 * UNSUPPORTED que não têm saída pelo lado do usuário — navegador sem a API e
 * ambiente sem VAPID, que é problema NOSSO. Inventar passos ali mandaria a
 * pessoa mexer em ajustes que não mudariam nada.
 */
export function resolveOrientacaoDeDesbloqueio(
  saude: SaudePush,
  plataforma: PlataformaNotificacao
): OrientacaoDeDesbloqueio | null {
  if (saude.state === "UNSUPPORTED") {
    // iOS fora da Tela de Início é o único UNSUPPORTED com ação real: o
    // navegador SUPORTA push, só não neste modo de execução.
    if (saude.reason !== "ios_fora_da_tela_inicio") return null
    return {
      titulo: "Como receber avisos no iPhone",
      passos: [
        "Toque no ícone de compartilhar na barra do Safari",
        "Escolha “Adicionar à Tela de Início”",
        "Abra o Peteen pelo ícone criado e ative as notificações por lá",
      ],
      nota: "No iPhone, os avisos só funcionam com o Peteen aberto pelo ícone.",
    }
  }

  if (saude.state !== "DENIED") return null

  if (plataforma === "ios") {
    return {
      titulo: "Como liberar no iPhone",
      passos: [
        "Abra os Ajustes do iPhone",
        "Toque em “Notificações” e procure o Peteen",
        "Ative “Permitir notificações”",
      ],
      nota: VOLTA_SOZINHA,
    }
  }

  if (plataforma === "android") {
    return {
      titulo: "Como liberar no Android",
      passos: [
        "Toque no ícone à esquerda do endereço do site",
        "Abra “Permissões” e encontre “Notificações”",
        "Mude para “Permitir”",
      ],
      nota: VOLTA_SOZINHA,
    }
  }

  return {
    titulo: "Como liberar no navegador",
    passos: [
      "Clique no ícone à esquerda do endereço do site",
      "Encontre “Notificações” e mude para “Permitir”",
      "Recarregue esta página",
    ],
    nota: VOLTA_SOZINHA,
  }
}

/**
 * Trava de contrato para o teste: nenhuma orientação pode PROMETER aviso.
 *
 * Orientar é "faça X para liberar". Prometer é "você recebe um aviso quando Y".
 * A segunda forma, num estado bloqueado, é exatamente a mentira que este gate
 * fecha — e é fácil de reintroduzir por alguém tentando "deixar o texto mais
 * simpático".
 */
export function textoPrometeAviso(texto: string): boolean {
  return /\bvocê receb\w+|\bvocê (vai|irá) receb\w+|\bvocê será avisad\w*/i.test(texto)
}
