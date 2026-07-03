const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const FIB_SEQUENCE = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '100'];
const DEFAULT_MAX_CARD = '21';
const MAX_ROOMS = 5;
const INACTIVITY_MS = 30 * 60 * 1000;

function buildDeck(maxCard) {
  const idx = FIB_SEQUENCE.indexOf(String(maxCard));
  const cutoff = idx === -1 ? FIB_SEQUENCE.indexOf(DEFAULT_MAX_CARD) : idx;
  return [...FIB_SEQUENCE.slice(0, cutoff + 1), '?', '☕'];
}

// roomId -> { id, name, password, players: Map(socketId -> {name, vote, spectator, joinedAt}), revealed, lastActivity }
const rooms = new Map();
let roomCounter = 0;

function touch(room) {
  room.lastActivity = Date.now();
}

function seatedPlayers(room) {
  return Array.from(room.players.values()).filter((p) => !p.spectator);
}

function roomSummary(room) {
  return { id: room.id, name: room.name, playerCount: room.players.size };
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
    .map(([id, p]) => ({
      id,
      name: p.name,
      voted: p.vote !== null,
      vote: room.revealed ? p.vote : null,
    }));
  const spectators = Array.from(room.players.entries())
    .filter(([, p]) => p.spectator)
    .map(([id, p]) => ({ id, name: p.name }));
  return {
    roomName: room.name,
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
}, 60 * 1000);

io.on('connection', (socket) => {
  socket.emit('rooms', roomList());

  function joinSocketToRoom(room, name, spectator) {
    const clean = String(name || '').trim().slice(0, 20);
    if (!clean) {
      socket.emit('room-error', 'Informe um nome');
      return;
    }
    socket.join(room.id);
    socket.data.roomId = room.id;
    room.players.set(socket.id, {
      name: clean,
      vote: null,
      spectator: !!spectator,
      joinedAt: Date.now(),
    });
    touch(room);
    socket.emit('joined', { roomId: room.id, roomName: room.name, spectator: !!spectator });
    broadcastRoomState(room);
    broadcastRoomList();
  }

  function currentRoom() {
    const roomId = socket.data.roomId;
    return roomId ? rooms.get(roomId) : null;
  }

  socket.on('create-room', ({ roomName, password, name, spectator, maxCard } = {}) => {
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
      players: new Map(),
      revealed: false,
      cards: buildDeck(maxCard),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    rooms.set(id, room);
    joinSocketToRoom(room, name, spectator);
  });

  socket.on('join-room', ({ roomId, password, name, spectator } = {}) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room-error', 'Sala não existe mais');
      return;
    }
    if (String(password || '') !== room.password) {
      socket.emit('room-error', 'Senha incorreta');
      return;
    }
    joinSocketToRoom(room, name, spectator);
  });

  socket.on('vote', (card) => {
    const room = currentRoom();
    const player = room && room.players.get(socket.id);
    if (!room || !player || player.spectator || room.revealed) return;
    if (!room.cards.includes(card)) return;
    player.vote = card;
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
    for (const player of room.players.values()) {
      player.vote = null;
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

  function leaveCurrentRoom() {
    const room = currentRoom();
    if (!room) return;
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

  socket.on('leave-room', leaveCurrentRoom);
  socket.on('disconnect', leaveCurrentRoom);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Planning Poker rodando em http://localhost:${PORT}`);
});
