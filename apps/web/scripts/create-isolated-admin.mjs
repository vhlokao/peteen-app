/**
 * OPERACIONAL — uso manual, único, sob demanda.
 *
 * Cria uma conta administrativa isolada (Supabase Auth + User + AdminProfile),
 * sem nenhuma persona de negócio (sem TutorProfile/ProfessionalProfile/PartnerProfile).
 *
 * NÃO É executado automaticamente por nenhum build, deploy, seed ou CI —
 * requer invocação manual explícita com a variável NEW_ADMIN_EMAIL.
 * NUNCA rodar contra um banco de produção sem revisão e aprovação explícita.
 *
 * Uso:
 *   NEW_ADMIN_EMAIL="admin@dominio.com" node scripts/create-isolated-admin.mjs
 *
 * Requer no ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 *
 * A senha é gerada aleatoriamente em runtime, impressa uma única vez no stdout
 * desta execução, e nunca persistida em arquivo, log de commit ou banco.
 *
 * Nota: o projeto tem um trigger no Postgres que sincroniza auth.users -> public.users
 * automaticamente (linha "bare", sem roles) assim que o Auth user é criado — por isso
 * o User é gravado via upsert por authId em vez de create puro, para não colidir com
 * esse trigger.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Bloqueado: este script não deve rodar em ambiente de produção.");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.NEW_ADMIN_EMAIL;
if (!ADMIN_EMAIL) {
  console.error("Defina NEW_ADMIN_EMAIL antes de rodar.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function generateTempPassword() {
  return crypto.randomBytes(24).toString("base64url");
}

const tempPassword = generateTempPassword();

const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
if (existing) {
  console.error(`Já existe um User com email ${ADMIN_EMAIL} (id=${existing.id}). Abortando sem criar nada.`);
  await prisma.$disconnect();
  process.exit(1);
}

const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
  email: ADMIN_EMAIL,
  password: tempPassword,
  email_confirm: true,
});

if (createErr || !created?.user) {
  console.error("Falha ao criar usuário no Supabase Auth:", createErr?.message);
  await prisma.$disconnect();
  process.exit(1);
}

const authId = created.user.id;
console.info("Supabase Auth user criado. authId:", authId);

try {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { authId },
      create: {
        authId,
        email: ADMIN_EMAIL,
        activePrimaryRole: "ADMIN",
        onboardingCompletedAt: new Date(),
      },
      update: {
        email: ADMIN_EMAIL,
        activePrimaryRole: "ADMIN",
        onboardingCompletedAt: new Date(),
      },
    });

    const adminProfile = await tx.adminProfile.create({
      data: {
        userId: user.id,
        role: "ADMIN",
      },
    });

    return { user, adminProfile };
  });

  console.info("User criado no Prisma. id:", result.user.id);
  console.info("AdminProfile criado. id:", result.adminProfile.id, "role:", result.adminProfile.role);
  console.info("\n=== CREDENCIAIS TEMPORÁRIAS (mostradas uma única vez) ===");
  console.info("Email:", ADMIN_EMAIL);
  console.info("Senha temporária:", tempPassword);
  console.info("=== Troque a senha imediatamente após o primeiro login ou defina uma nova no Supabase Dashboard ===\n");
} catch (txErr) {
  console.error("Falha ao criar User/AdminProfile no Prisma — revertendo o usuário criado no Supabase Auth.", txErr);
  await supabaseAdmin.auth.admin.deleteUser(authId).catch((e) => {
    console.error("Falha ao reverter o usuário do Supabase Auth. Remoção manual necessária. authId:", authId, e);
  });
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$disconnect();
