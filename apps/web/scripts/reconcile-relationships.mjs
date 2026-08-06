/**
 * OPERACIONAL — reconciliação de TutorProfessionalRelationship.
 *
 * Compara os campos materializados do relacionamento com suas fontes de
 * verdade (ServiceRequest e Review) e reporta — ou corrige — divergências.
 *
 * Uso:
 *   node --experimental-strip-types scripts/reconcile-relationships.mjs
 *   node --experimental-strip-types scripts/reconcile-relationships.mjs --json
 *   node --experimental-strip-types scripts/reconcile-relationships.mjs --apply --yes
 *
 * Segurança:
 *   - Sem flags = DRY RUN. Nunca escreve.
 *   - `--apply` exige TAMBÉM `--yes` (autorização explícita); só uma das duas
 *     não escreve nada.
 *   - Nunca toca em Trust, TrustEvent, Review, ServiceRequest ou FraudSignal.
 *   - Não corrige firstServiceAt nem os contadores de cancelamento/disputa
 *     (ver reconcile-relationships.ts para o porquê).
 *
 * Exit codes:
 *   0 = nenhuma divergência pendente e nenhuma falha
 *   1 = há divergências (em dry run) ou ocorreram falhas
 *
 * Idempotente: rodar de novo logo após um `--apply` bem-sucedido sai com 0.
 */

import "dotenv/config"
import { createJiti } from "jiti"

const jiti = createJiti(import.meta.url, { alias: { "@": process.cwd() } })
const { reconcileRelationships } = await jiti.import(
  "@/modules/relationship/application/reconcile-relationships.ts"
)

const args = process.argv.slice(2)
const asJson = args.includes("--json")
const pediuApply = args.includes("--apply")
const confirmou = args.includes("--yes")
const apply = pediuApply && confirmou

if (pediuApply && !confirmou) {
  console.error("Recusado: --apply exige --yes para confirmar a escrita. Nada foi alterado.")
  process.exit(1)
}

const report = await reconcileRelationships({ apply })

if (asJson) {
  console.info(JSON.stringify(report, null, 2))
} else {
  console.info(`=== RECONCILIACAO DE RELACIONAMENTOS (${report.modo}) ===\n`)
  console.info(
    `modo=${report.modo} auditados=${report.auditados} divergentes=${report.divergentes} ` +
      `corrigidos=${report.corrigidos} falhas=${report.falhas}`
  )

  if (report.divergencias.length) {
    console.info("\n=== DIVERGENCIAS ===")
    for (const d of report.divergencias) {
      console.info(
        `- ${d.relationshipId.slice(0, 12)}… ${d.campo}: ${d.atual} -> ${d.correto}`
      )
    }
  } else {
    console.info("\nnenhuma divergencia encontrada")
  }

  if (report.observacoes.length) {
    console.info("\n=== OBSERVACOES (nao corrigidas por contrato) ===")
    for (const o of report.observacoes) {
      console.info(`- ${o.relationshipId.slice(0, 12)}…: ${o.nota}`)
    }
  }

  if (report.erros.length) {
    console.info("\n=== FALHAS ===")
    for (const e of report.erros) {
      console.info(`- ${e.relationshipId.slice(0, 12)}…: ${e.erro}`)
    }
  }
}

// Em apply, divergências já corrigidas não são pendência.
const pendentes = apply ? report.divergentes - report.corrigidos : report.divergentes
const exitCode = pendentes > 0 || report.falhas > 0 ? 1 : 0
if (!asJson) console.info(`\nexit code: ${exitCode}`)
process.exit(exitCode)
