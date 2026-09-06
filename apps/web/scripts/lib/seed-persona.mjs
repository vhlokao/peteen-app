/**
 * Criação de uma persona de semente — GATE-16-DEMO-STABILITY-FIX-002.
 *
 * Extraído de `create-seed-users.mjs` por um motivo específico: aquele script
 * é um módulo com efeitos no topo (dotenv, guard, Prisma, jiti), então não dava
 * para importá-lo num teste sem disparar tudo isso. E sem importar, não havia
 * como PROVAR que `--dry-run` não escreve — que é exatamente a afirmação que o
 * gate anterior fez sem verificar.
 *
 * Aqui as dependências entram por parâmetro. O teste passa espiões e falha se
 * qualquer método de escrita for chamado em dry-run.
 *
 * TODA escrita do seed passa por esta função: o Auth user é criado aqui, e os
 * registros de persona nascem dentro da transação que esta função abre. Se ela
 * retorna antes, nada foi escrito.
 */

/**
 * Cria Auth user + User (upsert por authId) + persona de negócio dentro de uma
 * única transação Prisma. Em caso de falha na transação depois de o Auth user
 * já existir, reverte deletando o Auth user.
 *
 * Em `dryRun`: consulta se já existe (leitura), imprime o plano e retorna —
 * sem tocar em Auth nem em Prisma. Os clientes recebidos já vêm protegidos por
 * `protegerPrisma`/`protegerSupabaseAdmin`, então uma escrita acrescentada por
 * engano no futuro lança em vez de gravar.
 */
export async function criarPersonaSemente({
  prisma,
  supabaseAdmin,
  label,
  email,
  senha,
  activePrimaryRole,
  criarRegistrosDaPersona,
  dryRun,
  log = console,
}) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    log.info(`[${label}] já existe (User id=${existente.id}, email=${email}) — pulando.`);
    return { status: "ja-existe" };
  }

  if (dryRun) {
    log.info(
      `[${label}] PLANO: criar Auth user (${email}), User com activePrimaryRole=${activePrimaryRole} e os registros da persona. Nada foi escrito.`
    );
    return { status: "plano" };
  }

  const { data: criado, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (erroCriacao || !criado?.user) {
    log.error(`[${label}] Falha ao criar usuário no Supabase Auth:`, erroCriacao?.message);
    return { status: "falha-auth" };
  }

  const authId = criado.user.id;
  log.info(`[${label}] Supabase Auth user criado. authId:`, authId);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { authId },
        create: {
          authId,
          email,
          activePrimaryRole,
          onboardingCompletedAt: new Date(),
        },
        update: {
          email,
          activePrimaryRole,
          onboardingCompletedAt: new Date(),
        },
      });

      await criarRegistrosDaPersona(tx, user);
    });

    log.info(`[${label}] User + persona criados com sucesso. email:`, email);
    return { status: "criado" };
  } catch (erroTx) {
    log.error(
      `[${label}] Falha ao criar registros no Prisma — revertendo o usuário criado no Supabase Auth.`,
      erroTx
    );
    await supabaseAdmin.auth.admin.deleteUser(authId).catch((e) => {
      log.error(
        `[${label}] Falha ao reverter o usuário do Supabase Auth. Remoção manual necessária. authId:`,
        authId,
        e
      );
    });
    return { status: "falha-prisma" };
  }
}
