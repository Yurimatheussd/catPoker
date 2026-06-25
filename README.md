# 🐱 Cat Planning Poker

> ⚠️ **Aviso:** este é um projeto de **estudo**, criado para explorar e aprender sobre desenvolvimento de software com o auxílio de IA (Claude/Claude Code). Não é um produto pronto para produção — não há garantias de segurança, performance ou manutenção contínua.

Um Planning Poker simples e divertido, com tema de gatinhos 🐾, feito para times de scrum estimarem tarefas em tempo real.

## Funcionalidades

- Lobby com lista de salas (máximo de 5 simultâneas)
- Cada sala tem nome e senha próprios
- Mesa redonda com cadeiras que aparecem conforme as pessoas entram
- Baralho estilo carta de poker (com fotos de gatinhos no centro 🐱)
- Modo espectador (acompanha sem votar e sem cadeira)
- Resultado da rodada em modal, com média e detecção de consenso
- "Jogar bolinha de papel" nos colegas de mesa, por diversão
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

Acesse `http://localhost:3000`.

## Aviso final

Este projeto foi desenvolvido com forte apoio de ferramentas de IA, como parte de um estudo pessoal sobre esse tipo de fluxo de trabalho. Sinta-se livre para explorar o código, mas use por sua conta e risco.
