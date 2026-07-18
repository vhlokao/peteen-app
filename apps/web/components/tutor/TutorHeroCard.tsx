type TutorHeroCardProps = {
  firstName: string
  greeting: string
}

/**
 * Saudação da home do tutor.
 *
 * O CTA de busca vive no rodapé da página (bloco "Encontrar ajuda") — este
 * componente é só a saudação, para não duplicar sino/avatar já existentes
 * na TopBar real (AppShell).
 */
export function TutorHeroCard({ firstName, greeting }: TutorHeroCardProps) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted-foreground">{greeting},</p>
      <p className="text-[22px] font-extrabold tracking-[-0.02em] text-foreground">
        {firstName}
      </p>
    </div>
  )
}
