# DESIGN_SYSTEM — Identidade visual e padrões de interface

> Base: Tailwind CSS v4 + shadcn/ui + Lucide. Idioma: pt-BR.
> Objetivo: produto **operacional**, sóbrio e rápido de usar — não uma landing page.

## 1. Direção visual

| Área | Direção | Referência fornecida |
|---|---|---|
| Painel do Super Admin | Sidebar escura e estreita + área de conteúdo clara; tabelas densas com busca, filtros por status, badges de status coloridos e menu de ações por linha. | Painel administrativo de "Companies" (tabela de empresas com status Active/Trial/Suspended) |
| Painel do estabelecimento | **Agenda visual em colunas por profissional** (avatar no topo de cada coluna, eixo de horas à esquerda, blocos de atendimento coloridos com horário, cliente e serviço); seletores de data e de equipe no topo; botão "Novo agendamento" em destaque. No celular, uma coluna por vez com troca de profissional. | Agenda de salão com colunas por profissional + versão mobile |
| Página pública | Mobile-first, visual de "vitrine": capa em destaque, tipografia marcante, fundo escuro opcional e **cor de destaque do estabelecimento** (ex.: dourado em fundo preto). Calendário compacto, horários agrupados por período (Manhã / Tarde / Noite) e CTA fixo no rodapé. | Telas mobile escuras com destaque dourado |

As referências orientam layout e hierarquia; **não** copiamos marcas, logotipos, imagens ou textos delas.

Princípios: pouca decoração; sem gradientes chamativos; sombras mínimas (bordas finas fazem a separação); cor usada para **significado** (status, destaque, ação primária), não para enfeite; densidade adequada à operação diária.

## 2. Cores

### 2.1. Tokens semânticos (CSS variables, padrão shadcn)

Paleta neutra baseada em **zinc**. Valores em OKLCH definidos em `src/app/globals.css`.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` | zinc-50 | zinc-950 | fundo da página |
| `--card` / `--popover` | white | zinc-900 | superfícies |
| `--foreground` | zinc-950 | zinc-50 | texto principal |
| `--muted` / `--muted-foreground` | zinc-100 / zinc-500 | zinc-800 / zinc-400 | textos secundários, fundos sutis |
| `--border` / `--input` | zinc-200 | zinc-800 | bordas |
| `--primary` / `--primary-foreground` | zinc-900 / white | zinc-50 / zinc-900 | ação primária no painel |
| `--sidebar` | zinc-950 | zinc-950 | sidebar dos painéis (escura nos dois temas) |
| `--ring` | zinc-400 | zinc-600 | foco |
| `--destructive` | red-600 | red-500 | ações destrutivas |
| `--success` / `--warning` / `--info` | green-600 / amber-500 / blue-600 | variantes 400/500 | feedback |

### 2.2. Cores de status do agendamento

Cada status tem fundo suave + borda/barra lateral forte + texto legível, nos dois temas.

| Status | Cor | Ícone |
|---|---|---|
| Pendente | amber | `Clock` |
| Confirmado | blue | `CalendarCheck` |
| Em atendimento | violet | `Scissors` |
| Concluído | green | `CheckCircle2` |
| Cancelado | zinc (riscado) | `XCircle` |
| Não compareceu | red | `UserX` |

Na agenda, o bloco usa a **cor da categoria do serviço** (paleta fixa de 8 tons suaves) com indicador de status na lateral; o usuário pode alternar "colorir por status".

### 2.3. Status de estabelecimento

Ativo (green) · Suspenso (amber) · Desativado (zinc).

### 2.3.1. Status financeiros

Assinatura: Aguardando ativação (zinc) · Em teste (blue) · Ativa (green) · Em atraso (amber) · Suspensa (red) · Cancelada (zinc, riscado).
Fatura: Rascunho (zinc) · Em aberto (blue) · Paga (green) · Parcialmente paga (amber) · Vencida (red) · Cancelada (zinc) · Estornada (violet).
Valores financeiros sempre com rótulo explícito: **Previsto**, **Realizado**, **Recebido**, **Faturado**, **A receber**, **Em atraso**. Faturas exibem "Documento interno — sem valor fiscal".

### 2.4. Cor de destaque do estabelecimento

- Armazenada em `establishments.accent_color` (hex). Aplicada **somente** na página pública e em pequenos detalhes do painel (avatar do estabelecimento).
- Exposta como `--accent-brand` e `--accent-brand-foreground`; o foreground é calculado (preto ou branco) para garantir contraste **≥ 4,5:1 (WCAG AA)**. Se a cor não atingir contraste suficiente sobre o fundo, a UI de personalização avisa e sugere um ajuste de luminosidade.
- Seletor com sugestões prontas (preto, dourado, bordô, verde-escuro, azul-marinho, rosé) + campo hex.
- Página pública oferece tema **Claro**, **Escuro** ou **Automático** (escolhido pelo estabelecimento; padrão: Automático).

## 3. Tipografia

| Uso | Fonte | Observação |
|---|---|---|
| Interface | **Geist Sans** (`next/font`) | moderna, legível em tamanhos pequenos |
| Números (horários, valores, tabelas) | Geist Sans com `font-variant-numeric: tabular-nums` | colunas alinhadas |
| Códigos (referência da reserva) | Geist Mono | |
| Títulos da página pública | Geist Sans 600–700, tracking levemente negativo | |

Escala (rem): `xs .75` · `sm .875` (padrão em tabelas) · `base 1` · `lg 1.125` · `xl 1.25` · `2xl 1.5` · `3xl 1.875` (título de página). Peso padrão 400; rótulos 500; títulos 600.

## 4. Espaçamento, raio e elevação

- Escala Tailwind base 4 px. Padrões: gap de formulário `4` (16 px); padding de página `6` desktop / `4` mobile; seções separadas por `8`.
- Raio: `--radius: 0.5rem` (inputs, botões, cards); `0.375rem` em badges; `9999px` em avatares e chips de horário da página pública.
- Elevação: bordas `1px` + `shadow-xs` só em popovers, dropdowns e diálogos.
- Alvos de toque ≥ 44×44 px na página pública e em ações da agenda mobile.

## 5. Layouts

### 5.1. Painéis (`/admin`, `/painel`, `/profissional`)

```
┌──────────┬───────────────────────────────────────────────┐
│ Sidebar  │ Topbar: breadcrumb · seletor de estabelecimento│
│ (escura) │         · busca · tema · menu do usuário      │
│ ícone +  ├───────────────────────────────────────────────┤
│ rótulo   │ Título da página + ações primárias            │
│          │ Filtros                                       │
│ recolhe  │ Conteúdo (tabela / agenda / formulário)       │
│ em ícones│                                               │
└──────────┴───────────────────────────────────────────────┘
```

- Mobile: sidebar vira `Sheet`; barra inferior com 4–5 atalhos na área do profissional (Agenda, Disponibilidade, Histórico, Perfil).
- Formulários longos em página; criações rápidas em `Sheet` lateral; confirmações em `AlertDialog`.

### 5.2. Agenda

- **Visão dia** (padrão): colunas = profissionais (avatar + nome), linhas = horários na granularidade configurada; áreas fora do expediente hachuradas; bloqueios em cinza com rótulo; linha vermelha do "agora".
- **Semana**: um profissional por vez (ou consolidado em lista compacta por dia).
- **Mês**: contagem de atendimentos por dia + ocupação.
- **Lista**: tabela filtrável (profissional, serviço, data, status).
- Clique em espaço livre → criar agendamento pré-preenchido; clique no bloco → painel lateral com detalhes e ações de status válidas.
- Mobile: um profissional por vez, troca por avatares roláveis no topo; botão flutuante "+".

### 5.3. Página pública (`/agendar/[slug]`)

Fluxo em etapas com estado na URL (`?servico=&profissional=&data=&horario=`), botão voltar funcional:

1. **Estabelecimento**: capa (16:9 mobile, altura limitada), logo sobreposto, nome, descrição, endereço (link para mapas), WhatsApp/Instagram, horários (colapsável), lista de serviços.
2. **Serviço**: lista agrupada por categoria — nome, descrição curta, duração, preço.
3. **Profissional**: "Qualquer profissional" primeiro + cards com foto, nome e especialidades.
4. **Data e horário**: faixa horizontal de dias / calendário mensal compacto (dias sem horário desabilitados); horários em chips agrupados em Manhã / Tarde / Noite.
5. **Seus dados**: nome, WhatsApp (máscara brasileira), e-mail opcional, observações; aviso de privacidade.
6. **Confirmação**: resumo completo e botão "Confirmar agendamento".
7. **Sucesso**: código de referência, botões "Adicionar ao calendário" (.ics), "Salvar link da reserva" e "Enviar para meu WhatsApp" (link `wa.me` com o texto — sem integração automática).

Barra inferior fixa com o resumo da seleção e o CTA da etapa. Largura máxima 480 px centralizada em telas grandes.

## 6. Componentes

### 6.1. shadcn/ui utilizados
Button, Input, Textarea, Select, Combobox (Command + Popover), Checkbox, Switch, RadioGroup, Label, Form (integração RHF), Calendar, Dialog, AlertDialog, Sheet, Drawer (mobile), DropdownMenu, Tabs, Table, Badge, Avatar, Tooltip, Skeleton, Separator, Sidebar, Breadcrumb, Pagination, Sonner (toasts), Card (uso moderado).

### 6.2. Componentes do produto (`src/components/shared`)

| Componente | Função |
|---|---|
| `PageHeader` | título, descrição, ações |
| `DataTable` | tabela com busca, filtros, ordenação, paginação, estado vazio e skeleton |
| `StatusBadge` | status de agendamento/estabelecimento |
| `EmptyState` | ícone + texto + ação |
| `ConfirmDialog` | ação destrutiva com descrição do impacto |
| `MoneyInput` / `Money` | entrada e exibição em BRL (centavos) |
| `PhoneInput` / `Phone` | máscara BR, normalização E.164 |
| `DurationInput` | minutos com atalhos (15/30/45/60) |
| `WeeklyHoursEditor` | intervalos por dia da semana, copiar para outros dias |
| `DateOverrideEditor`, `BlockForm` | exceções e bloqueios, com pré-visualização de conflitos |
| `ConflictList` | agendamentos afetados por mudanças de disponibilidade |
| `ScheduleGrid` | agenda por colunas de profissionais |
| `SlotPicker` | chips de horários agrupados por período |
| `StatCard` | indicador com valor, variação e rótulo "estimado" quando aplicável |
| `ImageUpload` | upload com pré-visualização e recorte simples |
| `CopyLinkButton` | copiar/compartilhar link público |
| `WhatsAppShareButton` | abre `wa.me` com mensagem pronta (convites, cobranças, reservas) — envio manual, sem integração |
| `CompleteAppointmentDialog` | concluir atendimento + valor cobrado + formas de pagamento |
| `PlanUsageMeter` | "3 de 5 vagas de profissionais em uso" |
| `InvoiceView` | fatura em tela/impressão |
| `PlanStatusBanner` | aviso de vencimento, atraso ou modo restrito no painel |

## 7. Padrões de interface

- **Carregamento**: `loading.tsx` com skeletons do formato real; botões com spinner e desabilitados durante submissão.
- **Estados vazios**: sempre com orientação ("Nenhum serviço cadastrado — Cadastrar serviço").
- **Feedback**: toast de sucesso curto; erros de campo inline; erro geral no topo do formulário.
- **Ações destrutivas**: `AlertDialog` descrevendo consequências (ex.: "3 agendamentos futuros serão afetados").
- **Erros de concorrência**: "Esse horário acabou de ser reservado. Escolha outro." + recarrega horários.
- **Formatação**: datas `dd/MM/yyyy`, `EEEE, d 'de' MMMM` (locale `ptBR`); horas `HH:mm`; moeda `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; telefone `(11) 91234-5678`.
- **Fuso**: horários sempre exibidos no fuso do estabelecimento; se o fuso do navegador for diferente, indicar "horário de Brasília" etc.
- **Textos**: diretos, segunda pessoa ("Escolha um horário"), sem jargão técnico.

## 8. Acessibilidade

- Contraste WCAG AA em todos os tokens e na cor de destaque.
- Navegação por teclado completa (inclusive na agenda e no seletor de horários); foco visível.
- Componentes Radix (via shadcn) com ARIA corretos; `aria-live` para mudanças de horários e erros.
- Rótulos explícitos em todos os campos; ícones decorativos com `aria-hidden`.
- Respeitar `prefers-reduced-motion`.
- Status nunca comunicado apenas por cor (ícone + texto).

## 9. Temas

`next-themes` com classe `.dark`; opção Claro/Escuro/Sistema no menu do usuário. Página pública usa a preferência configurada pelo estabelecimento.

## 10. Identidade da plataforma

Nome provisório configurável (`NEXT_PUBLIC_APP_NAME`). Logotipo, nome definitivo e domínio aguardam decisão (ver MASTER_PLAN §8). Até lá, wordmark em texto com Geist Sans 600.
