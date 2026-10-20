const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const analytic = require('./public/analytic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const FIB_SEQUENCE = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '100'];
const DEFAULT_MAX_CARD = '21';
const MAX_ROOMS = 5;
const INACTIVITY_MS = 30 * 60 * 1000;
// Tempo durante o qual o voto de quem caiu fica guardado para ser restaurado ao reconectar.
const RECONNECT_GRACE_MS = 2 * 60 * 1000;
const MODES = ['classic', 'analytic'];
const FINAL_ESTIMATES = analytic.FIBONACCI_POINTS.map(String);

function buildDeck(maxCard) {
  const sequence = ['89', '100'].includes(String(maxCard))
    ? [...FIB_SEQUENCE.slice(0, FIB_SEQUENCE.indexOf('89')), '60', '70', '80', '89', '90', '100']
    : FIB_SEQUENCE;
  const idx = sequence.indexOf(String(maxCard));
  const cutoff = idx === -1 ? sequence.indexOf(DEFAULT_MAX_CARD) : idx;
  return [...sequence.slice(0, cutoff + 1), '?', '☕'];
}

// roomId -> { id, name, password, mode, round, finalEstimate, revealed, lastActivity,
//   players: Map(socketId -> {name, vote, scores, spectator, clientId, joinedAt}),
//   departed: Map(clientId -> {vote, scores, round, leftAt}) }
// No modo analítico, `vote` guarda a mediana individual (string) assim que as cinco notas são dadas.
const rooms = new Map();
let roomCounter = 0;

function touch(room) {
  room.lastActivity = Date.now();
}

function seatedPlayers(room) {
  return Array.from(room.players.values()).filter((p) => !p.spectator);
}

function roomSummary(room) {
  return { id: room.id, name: room.name, mode: room.mode, playerCount: room.players.size };
}

function roomList() {
  return Array.from(rooms.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(roomSummary);
}

function broadcastRoomList() {
  io.emit('rooms', roomList());
}

function roomPublicState(room) {
  const players = Array.from(room.players.entries())
    .filter(([, p]) => !p.spectator)
    .map(([id, p]) => {
      const player = {
        id,
        name: p.name,
        voted: p.vote !== null,
        vote: room.revealed ? p.vote : null,
      };
      if (room.mode === 'analytic') {
        player.progress = analytic.answeredCount(p.scores);
        player.scores = room.revealed ? p.scores.slice() : null;
      }
      return player;
    });
  const spectators = Array.from(room.players.entries())
    .filter(([, p]) => p.spectator)
    .map(([id, p]) => ({ id, name: p.name }));
  return {
    roomName: room.name,
    mode: room.mode,
    round: room.round,
    finalEstimate: room.finalEstimate,
    revealed: room.revealed,
    cards: room.cards,
    allVoted: players.length > 0 && players.every((p) => p.voted),
    players,
    spectators,
  };
}

function broadcastRoomState(room) {
  io.to(room.id).emit('state', roomPublicState(room));
}

function closeRoom(room, reason) {
  io.to(room.id).emit('room-closed', reason);
  io.in(room.id).socketsLeave(room.id);
  rooms.delete(room.id);
  broadcastRoomList();
}

setInterval(() => {
  const now = Date.now();
  for (const room of Array.from(rooms.values())) {
    if (now - room.lastActivity > INACTIVITY_MS) {
      closeRoom(room, 'Mesa fechada por inatividade (30 minutos sem uso)');
    }
  }
}, 60 * 1000).unref();

io.on('connection', (socket) => {
  socket.emit('rooms', roomList());

  // Recupera o voto de uma conexão anterior do mesmo navegador (mesmo clientId), evitando cadeira e voto duplicados.
  function takePreviousVote(room, clientId) {
    if (!clientId) return null;
    for (const [id, p] of room.players) {
      if (p.clientId !== clientId || id === socket.id) continue;
      room.players.delete(id);
      const oldSocket = io.sockets.sockets.get(id);
      if (oldSocket) {
        oldSocket.leave(room.id);
        oldSocket.data.roomId = null;
      }
      return { vote: p.vote, scores: p.scores, round: room.round };
    }
    const departed = room.departed.get(clientId);
    room.departed.delete(clientId);
    if (departed && Date.now() - departed.leftAt <= RECONNECT_GRACE_MS) return departed;
    return null;
  }

  function joinSocketToRoom(room, name, spectator, clientId) {
    const clean = String(name || '').trim().slice(0, 20);
    if (!clean) {
      socket.emit('room-error', 'Informe um nome');
      return;
    }
    const cleanClientId = typeof clientId === 'string' ? clientId.slice(0, 64) : null;
    const previous = takePreviousVote(room, cleanClientId);
    const restored = previous && !spectator && previous.round === room.round ? previous : null;
    socket.join(room.id);
    socket.data.roomId = room.id;
    room.players.set(socket.id, {
      name: clean,
      vote: restored ? restored.vote : null,
      scores: restored && restored.scores ? restored.scores.slice() : analytic.emptyScores(),
      spectator: !!spectator,
      clientId: cleanClientId,
      joinedAt: Date.now(),
    });
    touch(room);
    const me = room.players.get(socket.id);
    socket.emit('joined', {
      roomId: room.id,
      roomName: room.name,
      mode: room.mode,
      spectator: !!spectator,
      round: room.round,
      vote: me.vote,
      scores: me.scores.slice(),
    });
    broadcastRoomState(room);
    broadcastRoomList();
  }

  function currentRoom() {
    const roomId = socket.data.roomId;
    return roomId ? rooms.get(roomId) : null;
  }

  socket.on('create-room', ({ roomName, password, name, spectator, maxCard, mode, clientId } = {}) => {
    if (rooms.size >= MAX_ROOMS) {
      socket.emit('room-error', 'Limite de 5 salas atingido');
      return;
    }
    const cleanRoomName = String(roomName || '').trim().slice(0, 30);
    if (!cleanRoomName) {
      socket.emit('room-error', 'Informe um nome para a sala');
      return;
    }
    if (!password) {
      socket.emit('room-error', 'Informe uma senha para a sala');
      return;
    }
    const id = `room-${++roomCounter}-${Date.now().toString(36)}`;
    const room = {
      id,
      name: cleanRoomName,
      password: String(password),
      mode: MODES.includes(mode) ? mode : 'classic',
      round: 1,
      finalEstimate: null,
      players: new Map(),
      departed: new Map(),
      revealed: false,
      cards: buildDeck(maxCard),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    rooms.set(id, room);
    joinSocketToRoom(room, name, spectator, clientId);
  });

  socket.on('join-room', ({ roomId, password, name, spectator, clientId } = {}) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room-error', 'Sala não existe mais');
      return;
    }
    if (String(password || '') !== room.password) {
      socket.emit('room-error', 'Senha incorreta');
      return;
    }
    joinSocketToRoom(room, name, spectator, clientId);
  });

  socket.on('vote', (card) => {
    const room = currentRoom();
    const player = room && room.players.get(socket.id);
    if (!room || !player || player.spectator || room.revealed) return;
    if (room.mode !== 'classic' || !room.cards.includes(card)) return;
    player.vote = card;
    touch(room);
    broadcastRoomState(room);
  });

  socket.on('analytic-score', ({ index, value } = {}) => {
    const room = currentRoom();
    const player = room && room.players.get(socket.id);
    if (!room || !player || player.spectator || room.revealed || room.mode !== 'analytic') return;
    if (!Number.isInteger(index) || index < 0 || index >= analytic.CRITERIA_COUNT) return;
    if (!analytic.isValidScore(value)) return;
    player.scores[index] = value;
    const median = analytic.median(player.scores);
    player.vote = median === null ? null : String(median);
    touch(room);
    broadcastRoomState(room);
  });

  socket.on('set-final', (value) => {
    const room = currentRoom();
    const sender = room && room.players.get(socket.id);
    if (!room || !sender || sender.spectator || !room.revealed || room.mode !== 'analytic') return;
    if (value !== null && !FINAL_ESTIMATES.includes(String(value))) return;
    room.finalEstimate = value === null ? null : String(value);
    touch(room);
    broadcastRoomState(room);
  });

  socket.on('reveal', () => {
    const room = currentRoom();
    if (!room) return;
    const sender = room.players.get(socket.id);
    if (!sender || sender.spectator) return;
    const seated = seatedPlayers(room);
    if (seated.length === 0) return;
    if (!seated.every((p) => p.vote !== null)) return;
    room.revealed = true;
    touch(room);
    broadcastRoomState(room);
  });

  socket.on('reset', () => {
    const room = currentRoom();
    if (!room) return;
    const sender = room.players.get(socket.id);
    if (!sender || sender.spectator) return;
    room.revealed = false;
    room.round += 1;
    room.finalEstimate = null;
    room.departed.clear();
    for (const player of room.players.values()) {
      player.vote = null;
      player.scores = analytic.emptyScores();
    }
    touch(room);
    broadcastRoomState(room);
  });

  socket.on('throw-paper', (targetId) => {
    const room = currentRoom();
    if (!room) return;
    const thrower = room.players.get(socket.id);
    if (!thrower || !targetId || targetId === socket.id) return;
    if (!room.players.has(targetId)) return;
    touch(room);
    io.to(room.id).emit('paper-thrown', { fromId: socket.id, toId: targetId, fromName: thrower.name });
  });

  function leaveCurrentRoom(keepVote) {
    const room = currentRoom();
    if (!room) return;
    const player = room.players.get(socket.id);
    const hasVote = player && (player.vote !== null || analytic.answeredCount(player.scores) > 0);
    if (keepVote && hasVote && !player.spectator && player.clientId) {
      room.departed.set(player.clientId, { vote: player.vote, scores: player.scores, round: room.round, leftAt: Date.now() });
    }
    room.players.delete(socket.id);
    socket.leave(room.id);
    socket.data.roomId = null;
    if (room.players.size === 0) {
      rooms.delete(room.id);
      broadcastRoomList();
    } else {
      touch(room);
      broadcastRoomState(room);
      broadcastRoomList();
    }
  }

  socket.on('leave-room', () => leaveCurrentRoom(false));
  socket.on('disconnect', () => leaveCurrentRoom(true));
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Planning Poker rodando em http://localhost:${PORT}`);
  });
}

module.exports = { server, io, rooms };
