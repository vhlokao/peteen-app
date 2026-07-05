/**
 * OPERACIONAL — auditoria local, sob demanda. Não roda em CI/build.
 *
 * Varre os arquivos rastreados pelo Git em busca de padrões de dados
 * sensíveis (segredos, tokens, telefones suspeitos, e-mails/domínios
 * pessoais proibidos) antes de um commit. Não imprime o valor completo
 * encontrado — só o arquivo, a linha e um trecho mascarado.
 *
 * Não usa nenhuma dependência nova — só `child_process` (git) e `node:fs`.
 *
 * Uso:
 *   node --experimental-strip-types scripts/check-sensitive-data.ts
 *
 * Saída: lista de achados (se houver) e código de saída 1 se algo crítico
 * for encontrado; 0 se limpo. Não bloqueia nada automaticamente — é uma
 * ferramenta manual de conferência, não um hook de commit instalado.
 */
import { execSync } from "node:child_process";

type Severity = "CRITICAL" | "SUSPICIOUS";

type Rule = {
  name: string;
  severity: Severity;
  pattern: RegExp;
};

// Domínios/handles pessoais conhecidos (adicionar aqui se surgir outro caso).
// Mantidos como fragmentos genéricos, não o valor completo de nenhum
// registro específico do banco.
const KNOWN_PERSONAL_DOMAINS = ["mourawdesign"];
const KNOWN_PERSONAL_HANDLES = ["vtomoura"];

const RULES: Rule[] = [
  { name: "Chave de service role Supabase (padrão sb_/sbp_)", severity: "CRITICAL", pattern: /\bsbp_[a-f0-9]{20,}\b/gi },
  { name: "JWT (token com 3 partes base64 separadas por ponto)", severity: "CRITICAL", pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g },
  { name: "Connection string Postgres com credencial embutida", severity: "CRITICAL", pattern: /postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@[^\s'"]+/gi },
  { name: "Atribuição de SUPABASE_SERVICE_ROLE_KEY com valor não-placeholder", severity: "CRITICAL", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-service-role-key|\s*$)\S+/g },
  { name: "Telefone brasileiro (11 dígitos, DDD válido)", severity: "SUSPICIOUS", pattern: /\b(?:\(?\d{2}\)?[\s-]?)?9\d{4}[\s-]?\d{4}\b/g },
  { name: "Domínio pessoal conhecido", severity: "CRITICAL", pattern: new RegExp(KNOWN_PERSONAL_DOMAINS.join("|"), "gi") },
  { name: "Handle pessoal conhecido", severity: "CRITICAL", pattern: new RegExp(KNOWN_PERSONAL_HANDLES.join("|"), "gi") },
];

function maskMatch(value: string): string {
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 3)}${"*".repeat(Math.max(value.length - 6, 3))}${value.slice(-3)}`;
}

function listTrackedFiles(): string[] {
  const out = execSync("git ls-files", { encoding: "utf-8", cwd: process.cwd() });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // Ignora arquivos binários óbvios e este próprio script (contém os padrões de propósito).
    .filter((f) => !/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|pdf)$/i.test(f))
    .filter((f) => !f.endsWith("scripts/check-sensitive-data.ts"));
}

async function main() {
  const files = listTrackedFiles();
  let criticalCount = 0;
  let suspiciousCount = 0;

  for (const file of files) {
    let content: string;
    try {
      const fs = await import("node:fs");
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue; // arquivo binário ou ilegível como texto — pula
    }

    const lines = content.split("\n");
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(content)) !== null) {
        const upToMatch = content.slice(0, match.index);
        const lineNumber = upToMatch.split("\n").length;
        const lineText = lines[lineNumber - 1] ?? "";
        // Evita ruído: placeholders explícitos do .env.example nunca contam.
        if (/\[project-ref\]|\[password\]|\[region\]|your-service-role-key|your-anon-key|your-project\.supabase/i.test(lineText)) {
          continue;
        }
        const masked = maskMatch(match[0]);
        console.info(`[${rule.severity}] ${rule.name}`);
        console.info(`  arquivo: ${file}:${lineNumber}`);
        console.info(`  trecho mascarado: ${masked}\n`);
        if (rule.severity === "CRITICAL") criticalCount++;
        else suspiciousCount++;
      }
    }
  }

  console.info(`\n=== Resumo: ${criticalCount} crítico(s), ${suspiciousCount} suspeito(s) em ${files.length} arquivos rastreados ===`);

  if (criticalCount > 0) {
    console.error("\nAchados CRÍTICOS encontrados. Revise antes de commitar/push.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Falha ao executar a varredura:", err);
  process.exitCode = 1;
});
