import "server-only"

/**
 * Módulo: notifications
 * Camada: infrastructure — configuração VAPID.
 *
 * `import "server-only"` no topo: se este módulo for alcançado por um bundle de
 * client, o BUILD QUEBRA. É a diferença entre depender de revisão humana e ter
 * garantia mecânica de que VAPID_PRIVATE_KEY nunca vai para o browser.
 *
 * Não usa lib/env.ts de propósito: aquele schema é parseado no load do módulo e
 * hoje não é importado por ninguém. Se algum dia for consumido por um Client
 * Component, uma chave server-only obrigatória no schema quebraria no browser.
 * A validação da chave privada vive AQUI, dentro do módulo server-only.
 *
 * VARIÁVEIS:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — pública por design (é o applicationServerKey
 *                                  que o browser precisa). Prefixo correto.
 *   VAPID_PRIVATE_KEY            — SERVER-ONLY. Vazou = terceiro assina push
 *                                  como Peteen.
 *   VAPID_SUBJECT                — mailto:/https: do remetente. Não é segredo,
 *                                  mas não há motivo para expor.
 *
 * DEGRADAÇÃO: sem configuração completa, push fica DESABILITADO e a aplicação
 * segue 100% funcional. Nenhuma operação de domínio pode falhar por causa de
 * push — por isso este módulo nunca lança em caminho normal (diferente do cron,
 * onde a rotina de segurança É a função da rota).
 */

/**
 * Guard explícito contra o erro exato que se teme: alguém prefixar a chave
 * privada com NEXT_PUBLIC_, tornando-a pública no bundle. Roda no load do
 * módulo, no servidor. Lança de propósito — é erro de CONFIGURAÇÃO, não de
 * runtime de domínio, e falhar cedo e alto é o comportamento correto.
 */
if (process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY) {
  throw new Error(
    "[push-config] ERRO DE CONFIGURAÇÃO: NEXT_PUBLIC_VAPID_PRIVATE_KEY está definida. " +
      "A chave privada VAPID nunca pode ter o prefixo NEXT_PUBLIC_ — isso a publica " +
      "no bundle do browser. Renomeie para VAPID_PRIVATE_KEY e rotacione o par de chaves."
  )
}

export type VapidConfig = {
  publicKey: string
  privateKey: string
  subject: string
}

/**
 * Retorna a config completa ou `null` quando push está desabilitado.
 *
 * Nunca loga o valor de nenhuma variável — só a AUSÊNCIA, e por nome. Saber
 * que VAPID_PRIVATE_KEY não está setada não vaza nada; logar seu conteúdo
 * vazaria tudo.
 */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export function isPushEnabled(): boolean {
  return getVapidConfig() !== null
}

/** Log de diagnóstico sem segredo — só nomes de variáveis ausentes. */
export function describeMissingVapidConfig(): string[] {
  const faltando: string[] = []
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) faltando.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY")
  if (!process.env.VAPID_PRIVATE_KEY) faltando.push("VAPID_PRIVATE_KEY")
  if (!process.env.VAPID_SUBJECT) faltando.push("VAPID_SUBJECT")
  return faltando
}
