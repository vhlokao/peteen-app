import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Fix workspace root when multiple lockfiles exist in parent dirs.
  // Ensures CSS/Tailwind tracing resolves from apps/web, not the monorepo root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    serverActions: {
      // Default do Next.js é 1MB — abaixo do limite de 5MB que a própria
      // aplicação já valida e anuncia para foto de pet (ver
      // lib/storage/pet-photo-signature.ts). Fotos reais de celular entre
      // 1MB e 5MB eram rejeitadas pelo framework antes mesmo de
      // uploadPetPhotoAction rodar — 6MB dá folga para o overhead do
      // multipart/form-data acima do próprio arquivo de 5MB.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
