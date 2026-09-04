/**
 * Módulo: notifications
 * Camada: domain — decisão pura de estratégia de reparo (GATE-2-PUSH-FIX-002).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O GAP QUE ISTO FECHA (achado por código em GATE-2-PUSH-DIAG-001A)
 *
 * `assinar()` (lib/push/client.ts) reaproveita a subscription que o browser já
 * segura sempre que a chave VAPID bate contra `applicationServerKey` —
 * comportamento correto no caso comum (permissão concedida, subscription
 * saudável, nada mudou). O problema é que essa mesma lógica também reaproveita
 * um endpoint que o SERVIDOR já comprovou morto: quando o push service
 * responde 404/410, `revokeGoneSubscription` zera `endpoint/p256dh/auth` e
 * marca `revokedReason: "gone"` — mas o browser não fica sabendo disso sozinho
 * e continua devolvendo o MESMO endpoint morto em `pushManager.getSubscription()`.
 *
 * Sem esta distinção, `repararPush` "conserta com sucesso" um endpoint que o
 * push service já rejeitou, criando uma linha nova no banco a cada ciclo
 * (nunca um refresh, porque o endpoint morto nunca é encontrado ativo) até
 * `MAX_CREATES_PER_WINDOW` estourar — e o usuário fica sem push algum, com a
 * UI tendo dito "reparado" o tempo todo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A ÚNICA DECISÃO NOVA, ISOLADA AQUI
 *
 * Dado o que se sabe agora — há uma subscription local, e o servidor confirma
 * que ESTE MESMO endpoint já foi revogado como "gone" no passado — o reparo
 * deve DESCARTAR o que o browser tem (unsubscribe + subscribe novo, via
 * `renegociarSubscription`) em vez de REAPROVEITAR (via `assinar`, que decide
 * sozinho por `mesmaChaveVapid` e não distingue "chave OK" de "endpoint morto,
 * chave OK"). Essa distinção é justamente o que faltava.
 *
 * Não é usada quando não há endpoint local (nada a descartar — `assinar` já
 * cria um novo do zero) nem quando o endpoint nunca foi marcado "gone"
 * (revogação por logout/opt-out deixa o endpoint vivo no push service — ali
 * reaproveitar continua sendo a estratégia correta, exatamente como hoje).
 */
export function deveRenegociarAoReparar(params: {
  /** Endpoint que `pushManager.getSubscription()` devolve agora, ou `null`. */
  endpointAtual: string | null
  /**
   * O SERVIDOR já revogou ESTE MESMO endpoint com `revokedReason: "gone"`
   * (404/410 real do push service) em algum momento anterior?
   */
  revogadoComoGone: boolean
}): boolean {
  return params.endpointAtual !== null && params.revogadoComoGone
}
