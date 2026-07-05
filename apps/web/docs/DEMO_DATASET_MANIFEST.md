# Manifesto do dataset demo — Peteen

Documento vivo que descreve quais contas e registros compõem o cenário
oficial de demonstração, quais são material de QA, e as regras para não
misturar os dois. Atualizado a cada lote do Demo Data Cleanup. Nenhuma
credencial, telefone pessoal ou e-mail pessoal desnecessário está listado
aqui.

## Contas

| Papel | Conta | Observação |
|---|---|---|
| Tutor demo | `testetutor@gmail.com` (Camila Ferreira) | única persona TUTOR, dados higienizados nos Lotes B/D |
| Profissional demo | `testeprofissional@gmail.com` (Maria Eduarda) | única persona PROFESSIONAL desde o Lote A (antes tinha ADMIN embutido) |
| Parceiro demo | `testeparceiro@gmail.com` (Love Pet) | higienizado no Lote E — Partner renomeado para "Love Pet Shop", descrição reescrita, cidade acentuada |
| Admin demo | `admin.demo@peteen.app` | criado no Lote A, isolado, sem nenhuma persona de negócio |
| Contas QA | `testeprofissional2/3`, `testeprofessional4`, `indicaipro@gmail.com` | mantidas para exercitar cenários variados; **nunca usar em demo** |
| Conta pessoal | e-mail do fundador (não listado aqui) | TUTOR + ADMIN; nunca usar em demo, screenshot ou apresentação |

## IDs de demonstração

**Perfil profissional demo:** `cmqishhuf0001t4sckixc5mdg` (Maria Eduarda)

**Pets principais do tutor demo** (`TutorProfile cmqism4el0004t4scd0tnxnmm`):
- `cmqnv1d4k0005wcscgolmtqof` — Celeste (gato, SRD, ativo)
- `cmqnuznad0003wcsc8kf8qf5s` — Sabath (roedor, ativo)
- *(arquivados, não usar em demo, mas preservados por histórico: `cmqisnb370005t4scuz9gjbdf` Charlotte Junior, `cmqnuq2tw0000wcscdytlro8e` Luna)*

**Serviços ativos** (higienizados no Lote C):
- `cmqisifem0002t4scxb897j3e` — Passeio individual (DOG_WALK, R$35–60)
- `cmqrgfvix0000okscpnx2l6f1` — Cuidados em casa (HOME_CARE, R$40–80)
- `cmr6zkxuc0000pkscvnkx40kk` — Hospedagem familiar (BOARDING, R$80–160)

**Solicitações escolhidas para o roteiro oficial de demo** (Lote D, no máximo 1 PENDING + 1 ACCEPTED + 2 COMPLETED + 1 CANCELLED opcional):

| ID | Status | Profissional | Pet |
|---|---|---|---|
| `cmr5occmz000154sczrah1uzw` | PENDING | MARIA LUIZA oliveria | Celeste |
| `cmr5whrip0002lwscz9mnmz18` | ACCEPTED | Maria Eduarda | Sabath |
| `cmqiu2dpd00026oscpvfjd0lb` | COMPLETED | Maria Eduarda | Charlotte Junior |
| `cmr5vo8nf0002xgsch9v91mxu` | COMPLETED | Maria Eduarda | Celeste |
| `cmqwr5d290000gssciobkpzrm` | CANCELLED_BY_TUTOR (opcional) | Maria Eduarda | Sabath |

**Reviews escolhidas para o roteiro oficial de demo** (linguagem natural, nota preservada, Lote D):
- `cmqitg0o600006osc8iddbdzn` — 5 estrelas, "Ela cuidou muito bem do meu pet e manteve tudo organizado."
- `cmqiy08zj000214schum0nj44` — 5 estrelas, "pontual"
- `cmqnwpp5700013cscj112l7q4` — 3 estrelas, "Gostei, mas precisa melhorar um pouco."

**Parceiro demo** (higienizado nos Lotes E e E.1):
- `Partner cmqmmphxj0000kcscahv2xx5h` — "Love Pet Shop" (slug `love-pet`), Carapicuíba, verificado, ativo, vinculado a `PartnerProfile pp_test_love_pet`.
- **Contatos:** telefone fictício de demonstração (padrão `(11) 90000-000X`, distinto dos usados para Tutor e Profissional demo); `website` e `instagram` deixados `null` — nenhum dado de terceiros ou branding pessoal.
- **Recomendação coerente para o roteiro:** `TrustConnection cmqmmrcwg0005kcscu9xk4x18` — Love Pet Shop → Maria Eduarda (profissional demo, verificada, 3 serviços ativos). É a única recomendação do parceiro demo que aponta para um profissional totalmente higienizado; as demais (MARIA LUIZA, Vitor hugo oliveira, Carlos delarosa, VAMOS LÁ GAROTAO) apontam para profissionais ainda não higienizados ou incompletos — ver "Registros QA" abaixo.

## Registros QA (preservados, fora do roteiro principal)

- **Disputa `cmqvpqkx50001essci8c10o2y`** (request `cmqmifo940001l8sc3zjh9cry`, profissional MARIA LUIZA, status **OPEN**): criada organicamente pelo tutor em 26/06, testada pelo `admin.demo` durante a validação do Lote A.1 (`OPEN → UNDER_REVIEW`). A reversão de volta para `OPEN` foi feita via script direto de QA (não pela Server Action), então **não existe `AuditLog` registrando essa reversão** — o único `AuditLog` de `admin.demo` sobre esta disputa mostra `OPEN → UNDER_REVIEW`, e o estado atual no banco é `OPEN` novamente. Essa é uma inconsistência conhecida e documentada, não um bug de produto: serve para testar Admin/Tutor/Profissional, mas **não deve aparecer no roteiro de demonstração comum**.
- **Disputa `cmqvpudx20003esscrsc69ehj`** (request `cmqisoyyh0006t4scv5r5azwa`, profissional Maria Eduarda, status **RESOLVED**): ciclo completo orgânico `OPEN → UNDER_REVIEW → RESOLVED`, conduzido pela própria Maria Eduarda em 27/06 (antes de perder o ADMIN no Lote A). É evidência real de moderação bem-sucedida — mantida como QA/HISTÓRICO, disponível para quem quiser mostrar o fluxo de disputa, mas fora do roteiro principal de 5 solicitações acima.
- **Solicitações canceladas fora do roteiro:** `cmqwq8baw0000wosce989nm2e` (CANCELLED_BY_TUTOR, profissional Vitor hugo oliveira), `cmqwqgqat0007wosc62vkjymm` (CANCELLED_BY_PROFESSIONAL, Maria Eduarda).
- **Solicitações PENDING extra:** `cmr5s53ue000194scq22ugs8t` (com Vitor hugo oliveira) — redundante com a PENDING já escolhida para o roteiro.
- **Solicitações HISTÓRICO** (textos corrigidos no Lote D, mas fora do roteiro principal): `cmqisoyyh0006t4scv5r5azwa` (tem a disputa RESOLVED), `cmqmifo940001l8sc3zjh9cry` (tem a disputa OPEN), `cmqivx7fd000364scmt4vo4oz`, `cmqixy09z000014scabtjm6x7`, `cmqkv09ud0003dgsc68izfkun`, `cmqwqeaes0004woscd3uo2ryw`.
- **Conta multirole:** não existe hoje nenhuma conta TUTOR+PROFESSIONAL de fato; a única conta multirole real do ambiente é a conta pessoal do fundador (TUTOR+ADMIN), que nunca deve ser usada como referência de teste multirole de personas de negócio.
- **Partner `cmqlyxkpf0000wosc2iqgecy9`** ("Pet Shop central carapicuiba", slug `petshopmoura`) — **QA/LEGADO**, ativo mas sem `PartnerProfile`/login (órfão), sem verificação. Cidade acentuada no Lote E. No Lote E.1, `phone`/`website`/`instagram` foram limpos (continham branding e contato pessoal de um membro da equipe) — todos os três campos agora `null`. Continua fora do roteiro de demonstração.
- **Partner `cmqmo00cm0002pkscua4mqzgs`** — **QA/LEGADO**, renomeado no Lote E.1 para **"Parceiro legado de QA"** (o nome anterior era o nome próprio de um membro da equipe). Onboarding abandonado (`IN_PROGRESS`), `isActive: false` (não aparece em nenhuma consulta pública, que sempre filtra `isActive: true`). Cidade corrigida de `"teste"` para `"Não informado"`. `phone`/`website`/`instagram` limpos (`null`) — o telefone removido correspondia ao número pessoal real de um membro da equipe. Slug (`vitor-moura`) e ID preservados para rastreabilidade; nada foi excluído.
- **TrustConnections órfãs** (`sourcePartnerId: null`) — `cmqlxhqnn...` ("Pet Shop Moura", inativa) e `cmqlxk0s7...` ("Veterinário Vertigem", ativa, aponta para Maria Eduarda): são recomendações denormalizadas de uma época anterior ao modelo `Partner` real, sem nenhum parceiro de fato por trás. Não podem ser excluídas (regra da missão) nem viram `sourcePartnerId` nesta missão (mudar isso seria alterar mais do que o texto de exibição). Só o texto (`sourceName`) foi normalizado. Ambas ficam classificadas **QA/HISTÓRICO** — a ativa continua contribuindo para o badge "Recomendado" de Maria Eduarda mesmo sem um Partner real por trás, o que é uma fragilidade de modelagem pré-existente, não uma decisão desta missão.
- **Recomendação para perfil incompleto:** `TrustConnection cmr5z2bs20001xosc5zb4tsdc` (Love Pet Shop → VAMOS LÁ GAROTAO) aponta para um profissional **sem nenhum serviço ativo**. Preservada (regra: não excluir TrustConnection), mas sinalizada — não deve aparecer em nenhum roteiro de demonstração do parceiro até o profissional ter ao menos 1 serviço ativo.

## Regras

1. Não usar dados marcados como QA em screenshots, gravações ou apresentações.
2. Não apagar evidências (disputas, AuditLogs, reviews) só porque o texto está feio — corrigir texto, nunca excluir o registro.
3. Não alterar `trustScore`, `trustLevel` ou qualquer campo derivado durante limpeza de dados de demonstração.
4. Sempre repetir o procedimento de snapshot lógico (ver `docs/` e relatórios de missão) antes de qualquer nova mutação de dados demo/QA.
5. Ao adicionar um novo lote de limpeza, atualizar este manifesto com os novos IDs e classificações.
6. Nenhum dado pessoal real de um membro da equipe (telefone, e-mail, domínio, rede social, endereço) pode permanecer em nenhum registro de Partner, PartnerProfile ou qualquer outra entidade usada em ambiente de demonstração ou QA — ver também `docs/DEMO_AND_QA_ACCOUNTS_POLICY.md`.
