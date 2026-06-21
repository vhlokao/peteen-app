import { prisma } from "@/lib/prisma/client";

/**
 * syncSupabaseUser — cria ou atualiza o User no Prisma a partir do authId Supabase.
 *
 * Chamado:
 *   - no callback de login (primeira autenticação)
 *   - no onboarding de nova persona
 *
 * Idempotente: se o User já existir, apenas atualiza o email.
 * O authId nunca muda — é a âncora de identidade.
 */
export async function syncSupabaseUser({
  authId,
  email,
}: {
  authId: string;
  email: string;
}) {
  const user = await prisma.user.upsert({
    where: { authId },
    create: { authId, email },
    update: { email },
    select: {
      id: true,
      authId: true,
      email: true,
    },
  });

  return user;
}

/**
 * getUserByAuthId — busca o User no Prisma pelo authId Supabase.
 * Retorna null se o usuário ainda não foi sincronizado.
 */
export async function getUserByAuthId(authId: string) {
  return prisma.user.findUnique({
    where: { authId },
    include: {
      tutorProfile: { select: { id: true, displayName: true, city: true } },
      professionalProfile: { select: { id: true, displayName: true, city: true, trustScore: true } },
      partnerProfile: { select: { id: true, displayName: true, type: true } },
      adminProfile: { select: { id: true, role: true } },
    },
  });
}
