# 🐱 Cat Planning Poker

> Projeto de estudo, feito para aprender desenvolvimento com apoio de IA (Claude Code).

Um Planning Poker simples e divertido, com tema de gatinhos 🐾, feito para times de scrum estimarem tarefas em tempo real.

## Funcionalidades

- Lobby com lista de salas (máximo de 5 simultâneas)
- Cada sala tem nome e senha próprios
- Mesa redonda com cadeiras que aparecem conforme as pessoas entram
- Baralho estilo carta de poker (com fotos de gatinhos no centro 🐱)
- Carta mais alta configurável ao criar a sala (21, 34, 55, 89 ou 100)
- Dois modos de votação, escolhidos ao criar a sala:
  - **Clássico**: escolha direta de uma carta Fibonacci
  - **Analítico**: cada pessoa dá notas de 0 a 5 para complexidade técnica, esforço, incerteza, dependências e risco; o Cat Poker calcula a mediana de cada pessoa, a média das medianas e converte para Fibonacci (1, 2, 3, 5, 8 ou 13). O resultado traz um gráfico com a média de cada critério, destaque de divergências e confirmação da estimativa final pela equipe
- Reconexão automática: quem cai volta para a mesa sem perder o voto da rodada (se a sala ainda existir)
- Modo espectador (acompanha sem votar e sem cadeira)
- Resultado da rodada em modal, com média e detecção de consenso
- "Jogar bolinha de papel" nos colegas de mesa, por diversão (espectadores também jogam: a bolinha vem de fora da tela)
- Salas fecham automaticamente quando ficam vazias ou após 30 minutos sem atividade

## Stack

- Node.js + Express
- Socket.io (tempo real)
- HTML/CSS/JS puro no front-end (sem build step)
- Fotos de gatinhos via [cataas.com](https://cataas.com)

## Como rodar localmente

```bash
npm install
node server.js
```

Acesse `http://localhost:8080`.

## Testes

```bash
npm test
```

Os cálculos do modo analítico ficam em `public/analytic.js`, compartilhado entre o navegador, o servidor e os testes.
