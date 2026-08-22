import type { Metadata } from "next"

import { LegalDocumentPage } from "@/modules/legal/components/legal-document-page"
import {
  documentoVigente,
  POLITICA_DE_PRIVACIDADE,
} from "@/modules/legal/domain/legal-documents"

/**
 * /privacidade — rota linkada pelo login desde sempre, que devolvia 404.
 *
 * Mesma regra de indexação de /termos: enquanto o texto não é o vigente, a
 * página não entra no índice. Ver o comentário lá.
 */
export const metadata: Metadata = {
  title: POLITICA_DE_PRIVACIDADE.titulo,
  description: POLITICA_DE_PRIVACIDADE.descricao,
  robots: documentoVigente(POLITICA_DE_PRIVACIDADE)
    ? { index: true, follow: true }
    : { index: false, follow: true },
  alternates: { canonical: "/privacidade" },
}

export default function PrivacidadePage() {
  return <LegalDocumentPage doc={POLITICA_DE_PRIVACIDADE} />
}
