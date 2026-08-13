# Care Media — contrato de órfãos

Status: **proposta registrada, NÃO é contrato fechado. Limpeza não
implementada.** Nenhum cron existe para isto. Documento escrito em R1 para que
R2/R3 não improvisem a regra — mas o prazo abaixo ainda precisa ser
re-derivado antes de virar decisão.

## O que é um órfão

Um objeto em `care-media` que **não** tem linha `CareMedia` correspondente no
banco.

## Por que órfãos são inevitáveis nesta arquitetura

O upload é direto ao Storage, e não pela Server Action, por uma razão dura: o
contrato V0 permite 3 fotos de até 5 MB, e `bodySizeLimit` está em `6mb`
(`next.config.ts`). 15 MB não passam por Server Action.

Isso força a ordem **upload primeiro, banco depois**:

1. servidor autoriza e emite URL assinada de escrita
2. cliente envia o arquivo direto ao Storage
3. servidor cria `CareUpdate` + `CareMedia` numa transação

Entre (2) e (3) existe uma janela real. Se o profissional fechar a tela,
perder a rede ou desistir, o arquivo fica sem dono no banco.

### Por que esta ordem, e não a inversa

A ordem inversa (linha primeiro, arquivo depois) produziria o pior dos dois
defeitos: uma `CareMedia` apontando para um arquivo que não existe — imagem
quebrada visível ao tutor, dentro de um produto cujo propósito é transmitir
tranquilidade.

O órfão é a falha aceita porque é **invisível ao usuário** e **limpável em
lote**. A escolha é deliberada: entre um custo silencioso de armazenamento e um
dano visível na experiência, ficamos com o primeiro.

## Regra de limpeza — PROPOSTA, a validar e fechar em R3

Um objeto seria elegível a remoção quando **todas** forem verdadeiras:

1. está no bucket `care-media`;
2. não existe `CareMedia.storagePath` igual ao seu path;
3. `created_at` do objeto é anterior a **24 horas**.

> **Isto é uma PROPOSTA, não uma decisão fechada.** Três coisas precisam ser
> resolvidas antes de virar regra operacional:
>
> 1. **A condição (2) é inexecutável e inverificável hoje.** Ela referencia
>    `CareMedia.storagePath`, e o model `CareMedia` **não existe** — chega só em
>    R2. Uma regra cuja condição principal aponta para uma coluna inexistente
>    não pode ser testada nem executada.
>
> 2. **O teto real da janela de escrita é de 2 h, não "segundos".** A URL
>    assinada de upload vive **2 horas fixas**, definidas pelo serviço e não
>    configuráveis pelo SDK instalado (ver `lib/storage/care-media.ts`,
>    `CARE_MEDIA_UPLOAD_TTL_SECONDS_FIXO_PELO_SERVICO`). Qualquer janela de
>    limpeza precisa ser derivada A PARTIR desse teto — 24 h por acaso o
>    respeita, mas a justificativa original ("a janela real é de segundos")
>    estava errada, e uma regra certa por acidente não é uma regra.
>
> 3. **A política de retenção ainda está aberta.** A frente Legal/Privacidade
>    ainda não definiu por quanto tempo mídia de atendimento deve ser
>    preservada. Se houver retenção mínima, qualquer prazo curto aqui é
>    inválido. Regra de apagamento não pode fechar antes da regra de guarda.
>
> Risco de tratar isto como fechado: R3 implementa sem re-derivar, e o erro
> apaga evidência de atendimento — irreversível e potencialmente material em
> disputa.

Sobre a folga: a margem de horas existe para garantir que a limpeza nunca corra
atrás de um fluxo ainda em andamento. Apagar um arquivo que o profissional está
prestes a publicar seria muito pior do que guardá-lo um dia a mais.

## O que a limpeza NUNCA pode fazer

- **Nunca** apagar objeto que tenha `CareMedia` correspondente, mesmo que a
  `CareUpdate` esteja soft-deletada. Evidência de atendimento é preservada para
  auditoria/disputa; ver o contrato de retenção em aberto na frente
  Legal/Privacidade.
- **Nunca** apagar por idade isoladamente. A ausência de linha no banco é a
  condição principal; idade é apenas a margem de segurança.
- **Nunca** rodar sem `dry-run` revisado na primeira execução em cada ambiente.

## Já disponível hoje

`deleteCareMediaObject()` em `lib/storage/care-media.ts` — remoção best-effort,
com validação de que o path pertence à request informada. É a peça que a
limpeza e a rejeição por magic bytes vão usar; falta apenas quem a chame.
