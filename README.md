# Sistema de Planejamento do Estágio Supervisionado

Aplicação web para auxílio na organização e distribuição e acompanhamento da carga horária obrigatória do estágio supervisionado.

---

## 1. Visão Geral

O **Sistema de Planejamento do Estágio Supervisionado** permite que estudantes organizem sua carga horária de estágio ao longo do período letivo. A partir das informações de disponibilidade semanal, feriados/recessos e modalidades exigidas, o sistema gera automaticamente um cronograma detalhado, calcula a viabilidade do plano e permite a exportação dos eventos no formato []`.ics` (compatível com [Google Calendar](https://support.google.com/calendar/answer/37118?hl=pt-BR&co=GENIE.Platform%3DDesktop), Outlook e Apple Calendar).

---

## 2. Objetivo do Produto

Disponibilizar uma ferramenta para que o estudante possa:

* Planejar a realização do estágio supervisionado;
* Distribuir a carga horária entre as modalidades (Observação, Participação e Regência);
* Identificar se a disponibilidade atual é suficiente, insuficiente ou excedente;
* Gerenciar feriados, recessos escolares e bloqueios de agenda;
* Exportar o calendário para utilização com agendas digitais.

---

## 3. Público-Alvo

* **Estudantes** matriculados em componentes curriculares de estágio supervisionado;
<!-- * **Professores orientadores** e **coordenações de curso** acompanhando o planejamento de seus alunos. -->

---

## 4. Modalidades e Carga Horária Padrão

| Modalidade | Carga Horária Padrão | Descrição |
| :--- | :---: | :--- |
| **Observação** | 50h | Acompanhamento passivo das rotinas de aula. |
| **Participação** | 35h | Auxílio ao docente regente e interação com alunos. |
| **Regência** | 15h | Condução direta e responsável pelas aulas. |
| **TOTAL** | **100h** | **Carga horária total mínima exigida.** |

> *Nota:* Os valores de cada modalidade são editáveis pelo estudante para adequação a diferentes projetos pedagógicos de curso (PPC).

---

## 5. Período Padrão do Estágio

* **Data Inicial Padrão:** 17/08
* **Data Final Padrão:** 23/11
* **Ano Vigente:** Preenchido dinamicamente com o ano atual ~~ou configurável pelo usuário~~.

---

## 6. Requisitos Funcionais (RF)

### Configuração e Carga Horária
* **RF01 — Configurar Observação:** Permitir definir as horas de observação (Padrão: **50h**).
* **RF02 — Configurar Participação:** Permitir definir as horas de participação (Padrão: **35h**).
* **RF03 — Configurar Regência:** Permitir definir as horas de regência (Padrão: **15h**).
* **RF04 — Calcular Total:** Somar automaticamente as modalidades para obter a Carga Horária Total Exigida.
* **RF05 — Definir Período:** Permitir a edição das datas de início e término. Padrão: **17/08 a 23/11**.

### Disponibilidade e Validações
* **RF06 — Selecionar Dias da Semana:** Permitir selecionar quais dias (Segunda a Domingo) haverá estágio.
* **RF07 — Definir Horas Diárias:** Permitir informar a carga horária diária prevista para cada dia da semana ativo.
* **RF08 — Validar Teto Diário e Semanal:**
  * Impedir o planejamento de **mais de 6 horas em um mesmo dia** (considerando o acúmulo total de atividades no mesmo dia).
  * Impedir o planejamento de **mais de 30 horas totais em uma única semana** (de segunda a domingo).
* **RF09 — Gerenciar Bloqueios (Feriados/Recessos):** Permitir adicionar datas ou períodos indisponíveis para suspensão automática do agendamento.

### Gerador de Cronograma e Edição
* **RF10 — Gerar Cronograma Automático:** Criar os eventos respeitando período, disponibilidade, dias úteis e bloqueios cadastrados.
* **RF11 — Sequência das Modalidades:** Alocar as horas prioritariamente na ordem: **Observação $\rightarrow$ Participação $\rightarrow$ Regência**.
* **RF12 — Ajustes Manuais:** Permitir alteração de data, hora, modalidade, exclusão de eventos e adição de novas atividades.
* **RF13 — Recálculo Automático:** Atualizar métricas (horas planejadas, restantes, % de progresso) a cada alteração manual.

### Diagnóstico, Exibição e Exportação
* **RF14 — Status da Viabilidade:**
  * **Suficiente:** Carga horária total atingida até a data final informando a data exata de conclusão.
  * **Insuficiente:** Faltam horas para atingir o total exigido dentro do período informando quantas horas faltam.
  * **Excedente:** Horas planejadas superam a exigência obrigatória.
* **RF15 — Diferenciação Visual Acessível:** Exibir distintivos gráficos e textuais para cada modalidade (Ex: `[OBS]`, `[PAR]`, `[REG]`) para não depender apenas de cores.
* **RF16 — Exportação `.ics`:** Gerar arquivo iCalendar contendo título, horários de início/fim e modalidade para cada evento.
* **RF17 — Persistência Local:** Salvar e carregar o estado do planejamento via `localStorage`.

---

## 7. Regras de Negócio (RN)

* **RN01 — Limites Legais:** A carga horária de estágio **não pode ultrapassar 6 horas diárias** (acumuladas no dia) e **30 horas semanais**.
* **RN02 — Não Negatividade:** Nenhuma carga horária ou campo numérico pode assumir valor negativo.
* **RN03 — Validação de Intervalo:** A data final deve ser estritamente posterior ou igual à data inicial.
* **RN04 — Parada de Alocação:** A geração automática é encerrada assim que a carga horária total obrigatória for totalmente preenchida.
* **RN05 — Ajuste de Carga Parcial:** No último dia de alocação, se a sobra necessária for menor do que a disponibilidade do dia, gera-se uma atividade com duração apenas da fração restante.
* **RN06 — Respeito a Indisponibilidades:** Dias marcados em feriados/recessos não recebem atividades automáticas.

---

## 8. Critérios de Aceitação (CA)

* **CA01 — Inicialização Padrão:**
  * **Dado que** o estudante acessa o sistema pela primeira vez,
  * **Então** os campos devem exibir 50h (Obs), 35h (Part), 15h (Reg), Total de 100h e período de **17/08 a 23/11** do ano vigente.

* **CA02 — Bloqueio de Excesso de Carga Horária:**
  * **Dado que** o estudante tenta agendar mais de 6h em um dia ou ultrapassar 30h na semana,
  * **Então** o sistema deve exibir alerta impeditivo informando o limite regulamentar excedido.

* **CA03 — Cronograma Suficiente:**
  * **Dado que** a disponibilidade informada permite cumprir 100% das horas exigidas,
  * **Então** o sistema exibe mensagem de sucesso informando a data exata de término do estágio.

* **CA04 — Cronograma Insuficiente:**
  * **Dado que** o período ou a disponibilidade informada não são suficientes,
  * **Então** o sistema sinaliza o déficit e indica exatamente quantas horas adicionais precisam ser planejadas.

* **CA05 — Exportação `.ics`:**
  * **Dado que** um cronograma foi gerado,
  * **Quando** o usuário clica em "Exportar Calendário",
  * **Então** um arquivo `.ics` válido é baixado contendo todos os eventos individualizados.

---

## 9. Requisitos Não Funcionais (RNF)

* **RNF01 — Usabilidade e Responsividade:** Interface fluida para dispositivos móveis, tablets e computadores desktop.
* **RNF02 — Acessibilidade:** Conformidade visual (contraste) e semântica (rótulos em inputs, textos descritivos complementando cores).
* **RNF03 — Compatibilidade `.ics`:** Suporte integral ao padrão RFC 5545 (iCalendar) aceito pelo Google Calendar, Outlook e Apple Calendar.
* **RNF04 — Privacidade:** Todos os dados permanecem armazenados localmente no navegador do estudante (`localStorage`), sem tráfego em servidores externos.

---

## 10. Estrutura dos Arquivos

```text
├── index.html     # Interface da aplicação e formulários
├── styles.css     # Estilização responsiva e temas de status
└── script.js     # Lógica de validações, algoritmo de alocação e exportador .ics