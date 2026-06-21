import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Fix workspace root when multiple lockfiles exist in parent dirs.
  // Ensures CSS/Tailwind tracing resolves from apps/web, not the monorepo root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
