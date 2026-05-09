# 🎫 ConstruPrice — Sistema de Tickets com IA

## Visão Geral

O sistema de Tickets permite que o usuário descreva mudanças desejadas no produto em linguagem natural. A IA interpreta o pedido, executa as alterações no código e cria uma branch isolada para revisão antes de qualquer merge.

---

## Fluxo Completo

### Etapas Detalhadas

| # | Etapa | Responsável | Descrição |
|---|-------|-------------|-----------|
| 1 | **Reportar** | Usuário | Usuário abre um ticket descrevendo o que quer mudar em linguagem natural |
| 2 | **Transcrever** | IA | A IA converte o pedido em um prompt técnico claro e estruturado |
| 3 | **Planejar** | IA | A IA planeja quais arquivos e mudanças serão necessários |
| 4 | **Validar** | Usuário | Usuário revisa o prompt transcrito e aprova ou edita antes de executar |
| 5 | **Executar em Branch** | IA | A IA aplica as mudanças no código e cria uma branch isolada |
| 6 | **Testar** | Usuário | Usuário testa a branch gerada para verificar se ficou correto |
| 7 | **Deploy / Merge** | Usuário | Aprovado, o código é mergeado na branch principal |

---

## Status dos Tickets

| Status | Descrição |
|--------|-----------|
| `Pendente` | Ticket criado, aguardando transcrição da IA |
| `Transcrito` | IA transcreveu o pedido, aguardando validação do usuário |
| `Validado` | Usuário aprovou o prompt, pronto para execução |
| `Deployed` | Branch criada com as mudanças aplicadas |
| `Mergeado` | Mudanças integradas à branch principal |
| `Rejeitado` | Ticket cancelado ou mudança descartada |

---

## Tipos de Ticket

- `Interface` — Mudanças visuais e de UI/UX
- `Bug` — Correção de erros e comportamentos incorretos
- `Feature` — Novas funcionalidades
- `Refactor` — Melhorias internas de código sem mudança de comportamento

---

## Exemplo de Uso

**Usuário digita:**
> "Trocar o nome configurações para configurar"

**IA transcreve para:**
> "Alterar o texto do botão de 'Configurações' para 'Configurar' na interface do usuário. Verificar todos os locais onde o botão é exibido e realizar a mudança de forma consistente."

**Resultado:**
- Branch `ticket/mudanca-botao-configuracoes` criada
- Usuário acessa a branch e testa
- Se aprovado, faz o merge

---

## Arquitetura Técnica (Alto Nível)

---

## Observações

- Cada ticket roda em **branch isolada** — nunca afeta a `main` diretamente
- O usuário pode **editar o prompt** antes da execução caso a IA não tenha entendido corretamente
- Em caso de falha na execução, o ticket volta para o status `Validado` para nova tentativa
- O botão **"Chat IA"** dentro do ticket permite conversar com a IA para ajustar o pedido
