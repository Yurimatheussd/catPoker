# 🐱 Cat Planning Poker

Planning Poker com tema de gatinhos para estimar tarefas em equipe, em tempo real. Crie uma sala, compartilhe o nome e a senha e escolha entre votação por cartas ou avaliação por critérios.

> Projeto de estudo desenvolvido com apoio de IA (Claude Code).

## Funcionalidades

- Lobby com lista de salas (máximo de 5 simultâneas)
- Cada sala tem nome e senha próprios
- Mesa redonda com cadeiras que aparecem conforme as pessoas entram
- Baralho estilo carta de poker (com fotos de gatinhos no centro 🐱)
- Carta mais alta configurável ao criar a sala (21, 34, 55, 89 ou 100)
- Dois modos de votação, escolhidos ao criar a sala:
  - **Clássico (modelo antigo)**: escolha direta de uma carta
  - **Analítico**: cada pessoa dá notas de 0 a 5 para complexidade técnica, esforço, incerteza, dependências e risco; o Cat Poker calcula a média arredondada de cada pessoa, a média dessas notas individuais e converte para Fibonacci (1, 2, 3, 5, 8 ou 13). O resultado traz um gráfico com a média de cada critério, destaque de divergências e confirmação da estimativa final pela equipe
- Reconexão automática com recuperação do voto por até **2 minutos**, enquanto a sala e a rodada ainda existirem
- Modo espectador (acompanha sem votar e sem cadeira)
- Resultado da rodada em modal, com média e detecção de consenso
- "Jogar bolinha de papel" nos colegas de mesa, por diversão (espectadores também jogam: a bolinha vem de fora da tela)
- Salas fecham automaticamente quando ficam vazias ou após 30 minutos sem atividade

## Como funciona o analítico

Cada participante avalia cinco critérios com notas inteiras de **0 a 5**:

| Critério | O que avaliar |
| --- | --- |
| Complexidade técnica | Dificuldade de implementar a solução. |
| Esforço | Volume de trabalho necessário. |
| Incerteza | O que ainda precisa ser descoberto ou definido. |
| Dependências | Sistemas, equipes e componentes envolvidos. |
| Risco | Possibilidade e impacto de algo dar errado. |

O cálculo acontece em três etapas:

1. Soma as cinco notas de cada pessoa, divide por cinco e **arredonda para o inteiro mais próximo**.
2. Calcula a média dessas notas individuais, considerando apenas avaliações completas.
3. Converte a média coletiva em uma sugestão Fibonacci.

**Exemplo:** `5 + 4 + 1 + 1 + 2 = 13`; `13 ÷ 5 = 2,6` → nota individual **3**. Se apenas essa pessoa votar, a média coletiva será 3 e a sugestão Fibonacci será **5 pontos**.

| Média coletiva | Sugestão Fibonacci |
| --- | --- |
| De 0 até menos de 5/6 (≈ 0,8333) | 1 |
| De 5/6 até menos de 10/6 (≈ 1,6667) | 2 |
| De 10/6 até menos de 15/6 (2,5) | 3 |
| De 15/6 até menos de 20/6 (≈ 3,3333) | 5 |
| De 20/6 até menos de 25/6 (≈ 4,1667) | 8 |
| De 25/6 até 5 | 13 |

Os limites usam as frações exatas. A média coletiva não recebe um novo arredondamento antes da conversão. O gráfico apresenta a média original de cada critério e destaca divergências. A equipe confirma a estimativa final após discutir o resultado.

## Tecnologias

- Node.js + Express
- Socket.io (tempo real)
- HTML/CSS/JS puro no front-end (sem build step)
- Fotos de gatinhos via [cataas.com](https://cataas.com)

## Como rodar localmente

É necessário ter Node.js e npm instalados.

```bash
git clone https://github.com/Yurimatheussd/catPoker.git
cd catPoker
npm ci
npm start
```

Acesse [localhost:8080](http://localhost:8080). Para simular uma equipe, abra a mesma sala em outras abas ou navegadores.

A variável de ambiente `PORT` permite alterar a porta; o padrão é `8080`.

## Testes

```bash
npm test
```

Os cálculos do modo analítico ficam em `public/analytic.js`, compartilhado entre o navegador, o servidor e os testes.

A suíte verifica os cálculos, os limites Fibonacci, a ocultação e revelação dos votos, a troca de rodada e a reconexão dos participantes.

## Gerar ZIP para a Discloud

No Windows, execute [`gerar-zip.bat`](gerar-zip.bat) na raiz do projeto:

```bat
gerar-zip.bat
```

O script cria o próximo arquivo disponível no formato `catPoker-discloud_vN.zip`, começando pela versão 5, sem sobrescrever pacotes existentes. O ZIP inclui `public/`, `server.js`, `package.json`, `package-lock.json`, `discloud.config` e este README.

O arquivo `discloud.config` precisa existir localmente antes de gerar o pacote. Ele e os arquivos ZIP estão no `.gitignore`; configure os dados da sua aplicação antes de empacotar. A geração do ZIP não faz o envio para a hospedagem.

## Estrutura do projeto

```text
public/
  index.html       Interface e ajuda dos modos de votação
  app.js           Interações da mesa e comunicação em tempo real
  analytic.js      Critérios e cálculos compartilhados
  style.css        Estilos da aplicação
test/
  analytic.test.js Testes dos cálculos
  server.test.js   Testes de integração das salas
server.js          Servidor e estado das salas
gerar-zip.bat      Empacotamento para a Discloud no Windows
```

As salas ficam na memória do servidor. Reiniciar o processo encerra as salas e apaga os votos em andamento.
