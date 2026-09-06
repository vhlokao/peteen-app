/**
 * Guard de DESTINO para scripts operacionais — GATE-16-DEMO-STABILITY-001.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTAVA ERRADO
 *
 * Os oito scripts de demo/seed/cleanup compartilhavam este guard:
 *
 *   if (process.env.NODE_ENV === "production" ||
 *       process.env.VERCEL_ENV === "production") { bloqueia }
 *
 * Ele checa o EIXO ERRADO. Responde "este build é de produção?", quando a
 * pergunta que importa é "para qual BANCO eu vou escrever?".
 *
 * Verificado empiricamente: rodando localmente — que é o único jeito de rodar
 * estes scripts — `NODE_ENV` e `VERCEL_ENV` são ambos `undefined`, então o
 * guard NUNCA dispara. Ele dá falsa segurança: parece proteção de produção e
 * não protege destino nenhum.
 *
 * O destino real vem de `DATABASE_URL`, montada a partir de `.env` +
 * `.env.local`. Basta alguém colar a string de produção no `.env.local` — que é
 * exatamente para isso que existe `.env.prod-cutover.local` no repositório — e
 * um cleanup histórico escreve em produção sem uma única reclamação.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REGRA AGORA
 *
 *   --dry-run              → sempre permitido (não escreve nada)
 *   --target=<ref>         → escreve, SE `<ref>` bater com o banco real
 *   sem nenhum dos dois    → BLOQUEADO
 *
 * Fail-closed nos três jeitos de dar errado: sem `DATABASE_URL`, sem conseguir
 * identificar o destino, ou sem confirmação explícita, a resposta é recusa.
 *
 * Por que confirmação por REFERÊNCIA e não uma allowlist no repositório: assim
 * o repo não precisa saber qual é o projeto de produção, e ninguém apaga
 * produção por acidente — teria que digitar a identidade de produção à mão.
 * A referência do projeto não é segredo (ela aparece em
 * `NEXT_PUBLIC_SUPABASE_URL`, que é público por construção), mas também não
 * precisa estar aqui.
 */

/** Erro de destino. Nunca vira "seguiu assim mesmo". */
export class DestinoNaoConfirmadoError extends Error {
  constructor(mensagem) {
    super(mensagem)
    this.name = "DestinoNaoConfirmadoError"
  }
}

/**
 * Identifica o banco a partir da connection string, sem expor credencial.
 *
 * Devolve `null` quando não consegue — e quem chama trata isso como recusa,
 * nunca como "provavelmente é seguro".
 */
export function identificarAlvo(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") return null

  let host
  try {
    host = new URL(databaseUrl).hostname
  } catch {
    return null
  }
  if (!host) return null

  // Supabase: `db.<ref>.supabase.co` (direta) ou `<região>.pooler.supabase.com`
  // com o ref dentro do usuário. Só o host é suficiente para distinguir
  // projetos na forma direta; no pooler, o ref vem do usuário.
  const direto = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  if (direto) return { host, ref: direto[1] }

  const usuario = (() => {
    try {
      return decodeURIComponent(new URL(databaseUrl).username || "")
    } catch {
      return ""
    }
  })()
  const noUsuario = usuario.match(/\.([a-z0-9]{16,})$/i)
  if (noUsuario) return { host, ref: noUsuario[1] }

  // Host reconhecível mas sem ref extraível: identifica pelo host, que já é
  // suficiente para o operador confirmar conscientemente.
  return { host, ref: host }
}

/**
 * Exige confirmação explícita do destino antes de qualquer escrita.
 *
 * Devolve `{ alvo, dryRun }` quando pode prosseguir; lança quando não.
 */
export function exigirDestinoConfirmado({ databaseUrl, argv = [] }) {
  const dryRun = argv.includes("--dry-run")
  const alvo = identificarAlvo(databaseUrl)

  if (!alvo) {
    throw new DestinoNaoConfirmadoError(
      "DATABASE_URL ausente ou irreconhecível — não dá para saber em qual banco este script escreveria. Recusando por segurança."
    )
  }

  // Dry-run não escreve: pode rodar sem confirmação, e é justamente assim que
  // o operador descobre qual `--target` usar.
  if (dryRun) return { alvo, dryRun: true }

  const flag = argv.find((a) => a.startsWith("--target="))
  const informado = flag ? flag.slice("--target=".length).trim() : ""

  if (!informado) {
    throw new DestinoNaoConfirmadoError(
      [
        "Escrita bloqueada: destino não confirmado.",
        `Este script escreveria em: ${alvo.host} (ref: ${alvo.ref})`,
        "",
        "Rode primeiro com --dry-run. Para escrever de verdade, confirme o destino:",
        `  --target=${alvo.ref}`,
      ].join("\n")
    )
  }

  if (informado !== alvo.ref && informado !== alvo.host) {
    throw new DestinoNaoConfirmadoError(
      [
        "Escrita bloqueada: o destino confirmado NÃO é o banco configurado.",
        `  confirmado : ${informado}`,
        `  configurado: ${alvo.ref} (${alvo.host})`,
        "",
        "Isto costuma significar que o .env.local aponta para outro ambiente.",
      ].join("\n")
    )
  }

  return { alvo, dryRun: false }
}
