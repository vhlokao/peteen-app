const NAVY = "#1D2F6F";

type TutorStepBarProps = {
  total: number;
  current: number;
};

/**
 * Indicador de progresso exclusivo do onboarding de tutor — barras finas.
 * Não compartilha componente com o onboarding de profissional (OnboardingSteps),
 * que mantém o visual de bolinhas numeradas.
 */
export function TutorStepBar({ total, current }: TutorStepBarProps) {
  return (
    <div className="flex flex-1 gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[5px] flex-1 rounded-[4px]"
          style={{ background: i < current ? NAVY : "#DDE3EC" }}
        />
      ))}
    </div>
  );
}
