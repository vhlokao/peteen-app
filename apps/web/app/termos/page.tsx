import type { Metadata } from "next"

import { LegalDocumentPage } from "@/modules/legal/components/legal-document-page"
import { documentoVigente, TERMOS_DE_USO } from "@/modules/legal/domain/legal-documents"

/**
 * /termos — rota linkada pelo login desde sempre, que devolvia 404.
 *
 * `robots` acompanha o estado do documento: enquanto o texto não é o vigente,
 * a página não deve ser indexada — um Termo de Uso incompleto no índice do
 * Google é pior que ausente. Quando `documentoVigente` virar `true`, a página
 * passa a ser indexável sozinha, sem ninguém precisar lembrar.
 */
export const metadata: Metadata = {
  title: TERMOS_DE_USO.titulo,
  description: TERMOS_DE_USO.descricao,
  robots: documentoVigente(TERMOS_DE_USO)
    ? { index: true, follow: true }
    : { index: false, follow: true },
  alternates: { canonical: "/termos" },
}

export default function TermosPage() {
  return <LegalDocumentPage doc={TERMOS_DE_USO} />
}
