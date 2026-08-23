# Care Timeline — QA Físico Final

Deploy: **`3cd5ffb`** — *fix: publish care diary photos and keep the open diary in sync*

Aguarde a Vercel concluir o build antes de começar. Confirme que está na versão
nova pelo sintoma mais visível: **o formulário de nova atualização não mostra
mais o campo de data/hora** — no lugar dele há o link "Aconteceu em outro
horário?".

## Baseline registrado antes do teste (23:53 UTC)

| | |
|---|---|
| Request IN_PROGRESS | `cmsxud70y000604jl0w0234or` (iniciada 23:06:44 UTC) |
| CareUpdate visíveis | **17** |
| **CareMedia** | **0** ← nunca funcionou; qualquer valor > 0 já é a prova |
| Objetos no bucket | **9** (todos órfãos) |

O número que importa é `CareMedia = 0`. Se depois do teste ele for maior que
zero, a correção da foto funcionou de fato.

---

## PROFISSIONAL

Abrir a Request IN_PROGRESS → Diário.

- [ ] **1. Texto sem foto** — publicar
  - [ ] não pediu data/hora em momento algum
  - [ ] publicou sem erro
  - [ ] o horário exibido bate com o momento do envio (não com a hora que a tela abriu)
- [ ] **2. Texto + 1 foto**
  - [ ] preview apareceu **e permaneceu** (era aqui que sumia)
  - [ ] publicou sem erro
  - [ ] a foto aparece na timeline
- [ ] **3. Texto + 3 fotos**
  - [ ] as 3 previews permanecem
  - [ ] contador mostra 3/3
  - [ ] as 3 aparecem publicadas
- [ ] **4. "Aconteceu em outro horário?"**
  - [ ] link abre o controle já preenchido com o horário atual
  - [ ] escolher um horário anterior ao agora e **posterior ao startedAt** (23:06:44 UTC / 20:06 BRT)
  - [ ] publicou sem erro
  - [ ] a timeline mostra o horário **escolhido**, não o do envio
  - [ ] "Usar o horário atual" volta ao padrão

Anote o horário de cada publicação — vou correlacionar com o banco.

## TUTOR

Abrir `/tutor/requests/<id>/diario` e **não atualizar manualmente em nenhum momento**.

- [ ] novo texto aparece sozinho (até ~20s)
- [ ] nova foto aparece sozinha
- [ ] as 3 fotos aparecem corretamente
- [ ] horário exibido correto
- [ ] lightbox abre ao tocar na foto
- [ ] nenhuma atualização anterior sumiu

## PROFISSIONAL — DIRTY STATE

- [ ] começar a digitar uma atualização e **não publicar**
- [ ] com o texto na tela, provocar mudança remota (publicar algo por outro device/aba, ou pedir que eu crie um evento)
- [ ] esperar mais de 20s
- [ ] **o texto digitado continua lá**
- [ ] publicar depois funciona normalmente

O mesmo vale com foto selecionada e com o modo "outro horário" ativado — os
três suspendem o auto-sync.

## MOBILE (celular real)

- [ ] picker de foto abre
- [ ] teclado não cobre o botão publicar
- [ ] "Aconteceu em outro horário?" é tocável (44px)
- [ ] publicação funciona
- [ ] galeria/lightbox funciona
- [ ] auto-sync não dá salto destrutivo na tela

---

## Resultado

- [ ] **PASSOU**
- [ ] **FALHOU** — etapa exata: ______________________

Ao terminar (ou se falhar em qualquer ponto), me avise: eu consulto
`CareUpdate`, `CareMedia`, `AuditLog` e o bucket para confirmar o que aconteceu
do lado do servidor e apontar a etapa da cadeia.
