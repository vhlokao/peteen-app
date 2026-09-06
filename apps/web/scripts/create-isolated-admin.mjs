/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Cria uma conta administrativa isolada (Supabase Auth + User + AdminProfile),
 * sem nenhuma persona de negócio (sem TutorProfile/ProfessionalProfile/PartnerProfile).
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita com a variável NEW_ADMIN_EMAIL.
 *
 * Uso:
 *   # 1. SEMPRE primeiro: mostra o destino e o plano, sem escrever nada.
 *   NEW_ADMIN_EMAIL="admin@dominio.com" node scripts/create-isolated-admin.mjs --dry-run
 *
 *   # 2. Só então, confirmando explicitamente o banco de destino:
 *   NEW_ADMIN_EMAIL="admin@dominio.com" node scripts/create-isolated-admin.mjs --target=<ref>
 *
 * Sem `--dry-run` e sem `--target`, a execução é BLOQUEADA — ver
 * scripts/lib/target-db-guard.mjs.
 *
 * Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 *
 * A senha temporária é gerada aleatoriamente em runtime, impressa uma única vez
 * no stdout desta execução, e nunca persistida em arquivo, log de commit ou
 * banco. Em `--dry-run` ela NÃO é sequer gerada: não há conta para acessar, e
 * imprimir segredo que ninguém vai usar só cria material para vazar.
 *
 * Nota: o projeto tem um trigger no Postgres que sincroniza auth.users -> public.users
 * automaticamente (linha "bare", sem roles) assim que o Auth user é criado — por isso
 * o User é gravado via upsert por authId em vez de create puro, para não colidir com
 * esse trigger.
 */
import crypto from "node:crypto";
import { EscritaEmDryRunError } from "./lib/dry-run-clients.mjs";

export function gerarSenhaTemporaria() {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Orquestração, com dependências injetadas para ser testável sem Supabase nem
 * banco real — é assim que o contrato de dry-run passou a ser PROVADO, e não
 * apenas afirmado.
 *
 * Em `dryRun`, nenhuma escrita é tentada: a função consulta o estado atual
 * (leitura), imprime o plano e retorna. Os clientes recebidos aqui já vêm
 * protegidos por `protegerPrisma`/`protegerSupabaseAdmin`, então uma escrita
 * esquecida em manutenção futura lança em vez de gravar.
 */
export async function criarAdminIsolado({
  prisma,
  supabaseAdmin,
  email,
  dryRun,
  log = console,
  gerarSenha = gerarSenhaTemporaria,
}) {
  const existente = await prisma.user.findUnique({ where: { email } });

  if (existente) {
    log.error(
      `Já existe um User com email ${email} (id=${existente.id}). Abortando sem criar nada.`
    );
    return { status: "ja-existe", userId: existente.id };
  }

  if (dryRun) {
    log.info("\n=== PLANO (dry-run — nada foi escrito) ===");
    log.info(`  1. Supabase Auth: criar usuário ${email} (email_confirm: true)`);
    log.info("  2. Prisma: upsert User por authId, activePrimaryRole=ADMIN");
    log.info("  3. Prisma: criar AdminProfile role=ADMIN vinculado a esse User");
    log.info("  Senha temporária: NÃO gerada em dry-run.");
    log.info("=== Para executar: rode sem --dry-run e com --target=<ref> ===\n");
    return { status: "plano", userId: null };
  }

  const senhaTemporaria = gerarSenha();

  const { data: criado, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senhaTemporaria,
    email_confirm: true,
  });

  if (erroCriacao || !criado?.user) {
    log.error("Falha ao criar usuário no Supabase Auth:", erroCriacao?.message);
    return { status: "falha-auth", userId: null };
  }

  const authId = criado.user.id;
  log.info("Supabase Auth user criado. authId:", authId);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { authId },
        create: {
          authId,
          email,
          activePrimaryRole: "ADMIN",
          onboardingCompletedAt: new Date(),
        },
        update: {
          email,
          activePrimaryRole: "ADMIN",
          onboardingCompletedAt: new Date(),
        },
      });

      const adminProfile = await tx.adminProfile.create({
        data: { userId: user.id, role: "ADMIN" },
      });

      return { user, adminProfile };
    });

    log.info("User criado no Prisma. id:", resultado.user.id);
    log.info(
      "AdminProfile criado. id:",
      resultado.adminProfile.id,
      "role:",
      resultado.adminProfile.role
    );
    log.info("\n=== CREDENCIAIS TEMPORÁRIAS (mostradas uma única vez) ===");
    log.info("Email:", email);
    log.info("Senha temporária:", senhaTemporaria);
    log.info(
      "=== Troque a senha imediatamente após o primeiro login ou defina uma nova no Supabase Dashboard ===\n"
    );
    return { status: "criado", userId: resultado.user.id };
  } catch (erroTx) {
    log.error(
      "Falha ao criar User/AdminProfile no Prisma — revertendo o usuário criado no Supabase Auth.",
      erroTx
    );
    // Rollback é escrita: se algum dia esta linha for alcançada em dry-run, o
    // cliente protegido lança em vez de apagar alguém.
    await supabaseAdmin.auth.admin.deleteUser(authId).catch((e) => {
      if (e instanceof EscritaEmDryRunError) throw e;
      log.error(
        "Falha ao reverter o usuário do Supabase Auth. Remoção manual necessária. authId:",
        authId,
        e
      );
    });
    return { status: "falha-prisma", userId: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Execução como script. Nada abaixo roda quando o módulo é importado por teste.
// ─────────────────────────────────────────────────────────────────────────────

const executadoDiretamente =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (executadoDiretamente) {
  const dotenv = (await import("dotenv")).default;
  dotenv.config({ path: ".env" });
  dotenv.config({ path: ".env.local", override: true });

  const { createClient } = await import("@supabase/supabase-js");
  const { Pool } = await import("pg");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@prisma/client");
  const { exigirDestinoConfirmado } = await import("./lib/target-db-guard.mjs");
  const { protegerPrisma, protegerSupabaseAdmin } = await import("./lib/dry-run-clients.mjs");

  // O guard decide o MODO; daqui para baixo ninguém reinterpreta a flag.
  let modo;
  try {
    modo = exigirDestinoConfirmado({
      databaseUrl: process.env.DATABASE_URL,
      argv: process.argv,
    });
    console.info(
      `[destino] ${modo.alvo.host} (ref: ${modo.alvo.ref})${
        modo.dryRun ? " — DRY RUN, nada será escrito" : " — CONFIRMADO para escrita"
      }`
    );
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const email = process.env.NEW_ADMIN_EMAIL;
  if (!email) {
    console.error("Defina NEW_ADMIN_EMAIL antes de rodar.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prismaReal = new PrismaClient({ adapter: new PrismaPg(pool) });
  const supabaseReal = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const resultado = await criarAdminIsolado({
      // Em dry-run o script NÃO recebe cliente capaz de escrever.
      prisma: protegerPrisma(prismaReal, { dryRun: modo.dryRun }),
      supabaseAdmin: protegerSupabaseAdmin(supabaseReal, { dryRun: modo.dryRun }),
      email,
      dryRun: modo.dryRun,
    });
    if (resultado.status === "ja-existe" || resultado.status.startsWith("falha")) {
      process.exitCode = 1;
    }
  } finally {
    await prismaReal.$disconnect();
  }
}
