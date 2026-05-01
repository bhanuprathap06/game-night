const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Room & Game State ──────────────────────────────────────────────────────
const rooms = {}; // roomCode → room object

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? generateRoomCode() : code;
}

function createRoom(hostId, hostName, game) {
  const code = generateRoomCode();
  rooms[code] = {
    code,
    hostId,
    game,
    players: [{ id: hostId, name: hostName, score: 0 }],
    state: 'lobby',
    gameData: {}
  };
  return rooms[code];
}

function broadcastRoom(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('room_update', {
    code: room.code,
    game: room.game,
    players: room.players,
    state: room.state,
    hostId: room.hostId
  });
}

// ─── Truth or Dare Content ───────────────────────────────────────────────────
const truths = [
  "What's the most embarrassing thing you've done in public?",
  "What's a secret you've never told anyone?",
  "Who was your first crush and did they know?",
  "What's the worst lie you've ever told?",
  "What's one thing you wish you could change about yourself?",
  "Have you ever cheated on a test or game?",
  "What's the most childish thing you still do?",
  "What's your biggest fear?",
  "Have you ever blamed someone else for something you did?",
  "What's the most embarrassing song on your playlist?",
  "What's the silliest thing you've cried about?",
  "Have you ever said 'I love you' and not meant it?",
  "What's one bad habit you can't break?",
  "What's the worst gift you've ever received?",
  "Have you ever laughed at the wrong moment?",
  "What's one thing you pretend to like but actually hate?",
  "What's the most trouble you've ever been in?",
  "Have you ever walked into a glass door?",
  "What's your most embarrassing autocorrect fail?",
  "What's one thing you're secretly bad at?"
];

const dares = [
  "Do your best impression of another player for 30 seconds.",
  "Speak in an accent for the next 3 rounds.",
  "Send a funny selfie to the group chat.",
  "Do 10 jumping jacks right now.",
  "Say the alphabet backwards as fast as you can.",
  "Try to lick your elbow.",
  "Do your best robot dance for 20 seconds.",
  "Say a tongue twister 3 times fast: 'She sells seashells by the seashore'.",
  "Describe yourself using only animal sounds.",
  "Do your best celebrity impression.",
  "Sing the first verse of any song.",
  "Talk in slow motion for the next 2 minutes.",
  "Do 5 push-ups right now.",
  "Make up a short rap about the player to your left.",
  "Hold a plank position for 20 seconds.",
  "Text someone a random compliment right now.",
  "Do your best moonwalk.",
  "Say the name of every player in a funny voice.",
  "Act like a chicken for 30 seconds.",
  "Draw a portrait of another player (30 seconds) and show it."
];

// ─── Imposter Word Packs ─────────────────────────────────────────────────────
const imposterWordPacks = [
  { category: "Animals", word: "Elephant", imposterWord: "Lion" },
  { category: "Food", word: "Pizza", imposterWord: "Burger" },
  { category: "Sports", word: "Football", imposterWord: "Tennis" },
  { category: "Movies", word: "Avengers", imposterWord: "Titanic" },
  { category: "Colors", word: "Blue", imposterWord: "Red" },
  { category: "Countries", word: "France", imposterWord: "Japan" },
  { category: "Fruits", word: "Mango", imposterWord: "Apple" },
  { category: "Vehicles", word: "Car", imposterWord: "Bicycle" },
  { category: "Music", word: "Guitar", imposterWord: "Piano" },
  { category: "Nature", word: "River", imposterWord: "Ocean" },
  { category: "Technology", word: "Laptop", imposterWord: "Phone" },
  { category: "Space", word: "Moon", imposterWord: "Mars" },
  { category: "Superheroes", word: "Batman", imposterWord: "Superman" },
  { category: "Clothing", word: "Jacket", imposterWord: "Hoodie" },
  { category: "Weather", word: "Rain", imposterWord: "Snow" },
];

// ─── Decode Message Content ───────────────────────────────────────────────────
const codeMessages = [
  { message: "THE QUICK BROWN FOX", hint: "Animals in motion" },
  { message: "MEET ME AT MIDNIGHT", hint: "A secret rendezvous" },
  { message: "FIND THE HIDDEN KEY", hint: "Search carefully" },
  { message: "THE TREASURE IS BURIED", hint: "X marks the spot" },
  { message: "TRUST NO ONE TODAY", hint: "A word of warning" },
  { message: "FOLLOW THE NORTH STAR", hint: "Navigation advice" },
  { message: "THE CODE IS CRACKED", hint: "Mission accomplished" },
  { message: "DANGER LURKS AHEAD", hint: "Proceed with caution" },
  { message: "ESCAPE BEFORE DAWN", hint: "Time is running out" },
  { message: "THE MISSION BEGINS NOW", hint: "It starts!" },
];

function caesarEncode(text, shift) {
  return text.split('').map(char => {
    if (char >= 'A' && char <= 'Z') {
      return String.fromCharCode(((char.charCodeAt(0) - 65 + shift) % 26) + 65);
    }
    return char;
  }).join('');
}

// ─── Socket.io Logic ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────────────────────────────────
  socket.on('create_room', ({ name, game }) => {
    const room = createRoom(socket.id, name, game);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code });
    broadcastRoom(room.code);
  });

  // ── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on('join_room', ({ name, code }) => {
    const upper = code.toUpperCase().trim();
    const room = rooms[upper];
    if (!room) { socket.emit('error_msg', 'Room not found. Check the code!'); return; }
    if (room.state !== 'lobby') { socket.emit('error_msg', 'Game already started!'); return; }
    if (room.players.length >= 8) { socket.emit('error_msg', 'Room is full (max 8 players)!'); return; }
    if (room.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      socket.emit('error_msg', 'That name is already taken in this room!'); return;
    }
    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(upper);
    socket.emit('room_joined', { code: upper });
    broadcastRoom(upper);
  });

  // ── CHANGE GAME ──────────────────────────────────────────────────────────
  socket.on('change_game', ({ code, game }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.game = game;
    broadcastRoom(code);
  });

  // ── START GAME ───────────────────────────────────────────────────────────
  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;

    room.state = 'playing';

    if (room.game === 'tictactoe') {
      if (room.players.length < 2) { socket.emit('error_msg', 'Need at least 2 players!'); room.state = 'lobby'; return; }
      startTicTacToe(room);
    } else if (room.game === 'imposter') {
      if (room.players.length < 3) { socket.emit('error_msg', 'Need at least 3 players!'); room.state = 'lobby'; return; }
      startImposter(room);
    } else if (room.game === 'decode') {
      if (room.players.length < 2) { socket.emit('error_msg', 'Need at least 2 players!'); room.state = 'lobby'; return; }
      startDecode(room);
    } else if (room.game === 'truthordare') {
      if (room.players.length < 2) { socket.emit('error_msg', 'Need at least 2 players!'); room.state = 'lobby'; return; }
      startTruthOrDare(room);
    }
  });

  // ── TIC TAC TOE ──────────────────────────────────────────────────────────
  socket.on('ttt_move', ({ code, index }) => {
    const room = rooms[code];
    if (!room || room.game !== 'tictactoe') return;
    const gd = room.gameData;
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx < 0) return;

    // Only the two active players can move
    const p1 = gd.players[0];
    const p2 = gd.players[1];
    const currentPlayerId = gd.turn === 'X' ? p1.id : p2.id;
    if (socket.id !== currentPlayerId) return;
    if (gd.board[index] !== '') return;

    gd.board[index] = gd.turn;
    const winner = checkTTTWinner(gd.board);
    if (winner) {
      const winPlayer = winner === 'X' ? p1 : p2;
      const winIdx = room.players.findIndex(p => p.id === winPlayer.id);
      if (winIdx >= 0) room.players[winIdx].score++;
      gd.winner = winner;
      gd.winnerName = winPlayer.name;
      io.to(code).emit('ttt_update', { board: gd.board, turn: gd.turn, winner, winnerName: winPlayer.name, scores: room.players });
    } else if (gd.board.every(c => c !== '')) {
      gd.winner = 'draw';
      io.to(code).emit('ttt_update', { board: gd.board, turn: gd.turn, winner: 'draw', winnerName: null, scores: room.players });
    } else {
      gd.turn = gd.turn === 'X' ? 'O' : 'X';
      io.to(code).emit('ttt_update', { board: gd.board, turn: gd.turn, winner: null, winnerName: null, scores: room.players });
    }
  });

  socket.on('ttt_rematch', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'tictactoe') return;
    const gd = room.gameData;
    gd.board = Array(9).fill('');
    // Swap X and O for rematch
    const temp = gd.players[0];
    gd.players[0] = gd.players[1];
    gd.players[1] = temp;
    gd.turn = 'X';
    gd.winner = null;
    io.to(code).emit('ttt_start', {
      board: gd.board,
      players: gd.players,
      turn: gd.turn,
      scores: room.players
    });
  });

  // ── IMPOSTER ─────────────────────────────────────────────────────────────
  socket.on('imposter_clue', ({ code, clue }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter') return;
    const gd = room.gameData;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (gd.currentClueIdx !== gd.clueOrder.indexOf(socket.id)) return;
    gd.clues.push({ name: player.name, clue });
    gd.currentClueIdx++;
    if (gd.currentClueIdx >= gd.clueOrder.length) {
      io.to(code).emit('imposter_vote_phase', { clues: gd.clues, players: room.players });
    } else {
      const nextId = gd.clueOrder[gd.currentClueIdx];
      const nextPlayer = room.players.find(p => p.id === nextId);
      io.to(code).emit('imposter_clue_phase', {
        clues: gd.clues,
        currentPlayer: nextPlayer.name,
        currentPlayerId: nextId
      });
    }
  });

  socket.on('imposter_vote', ({ code, votedName }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter') return;
    const gd = room.gameData;
    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || gd.votes[voter.name]) return;
    gd.votes[voter.name] = votedName;
    const totalVotes = Object.keys(gd.votes).length;
    io.to(code).emit('imposter_vote_update', { votes: gd.votes, totalVotes, needed: room.players.length });
    if (totalVotes >= room.players.length) {
      // Tally votes
      const tally = {};
      Object.values(gd.votes).forEach(v => { tally[v] = (tally[v] || 0) + 1; });
      const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      const imposterPlayer = room.players.find(p => p.id === gd.imposterId);
      const caught = imposterPlayer.name === mostVoted;
      if (caught) {
        room.players.forEach(p => { if (p.id !== gd.imposterId) p.score++; });
      } else {
        imposterPlayer.score++;
      }
      io.to(code).emit('imposter_reveal', {
        imposterName: imposterPlayer.name,
        word: gd.word,
        imposterWord: gd.imposterWord,
        category: gd.category,
        caught,
        mostVoted,
        tally,
        scores: room.players
      });
    }
  });

  socket.on('imposter_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter' || room.hostId !== socket.id) return;
    startImposter(room);
  });

  // ── DECODE MESSAGE ───────────────────────────────────────────────────────
  socket.on('decode_guess', ({ code, guess }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode') return;
    const gd = room.gameData;
    if (gd.solved) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const clean = guess.toUpperCase().replace(/[^A-Z ]/g, '').trim();
    gd.guesses.push({ name: player.name, guess: clean, time: Date.now() });
    if (clean === gd.message) {
      gd.solved = true;
      const solverIdx = room.players.findIndex(p => p.id === socket.id);
      if (solverIdx >= 0) room.players[solverIdx].score += 3;
      io.to(code).emit('decode_solved', {
        solver: player.name,
        message: gd.message,
        scores: room.players,
        guesses: gd.guesses
      });
    } else {
      io.to(code).emit('decode_wrong_guess', {
        guesser: player.name,
        guess: clean,
        guesses: gd.guesses
      });
    }
  });

  socket.on('decode_hint', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode' || room.hostId !== socket.id) return;
    const gd = room.gameData;
    if (gd.hintsUsed < 3) {
      gd.hintsUsed++;
      // Reveal one more letter each hint
      const revealCount = gd.hintsUsed * Math.ceil(gd.message.replace(/ /g,'').length / 4);
      const positions = [];
      for (let i = 0; i < gd.message.length; i++) {
        if (gd.message[i] !== ' ') positions.push(i);
      }
      const toReveal = positions.slice(0, revealCount);
      io.to(code).emit('decode_hint_given', {
        hint: gd.hint,
        revealPositions: toReveal,
        message: gd.message,
        hintsUsed: gd.hintsUsed
      });
    }
  });

  socket.on('decode_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode' || room.hostId !== socket.id) return;
    startDecode(room);
  });

  // ── TRUTH OR DARE ────────────────────────────────────────────────────────
  socket.on('tod_pick', ({ code, choice }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
    if (socket.id !== gd.currentPlayerId) return;
    const content = choice === 'truth'
      ? truths[Math.floor(Math.random() * truths.length)]
      : dares[Math.floor(Math.random() * dares.length)];
    gd.currentChoice = choice;
    gd.currentContent = content;
    io.to(code).emit('tod_show', {
      playerName: gd.currentPlayerName,
      choice,
      content
    });
  });

  socket.on('tod_next', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
    gd.turnIdx = (gd.turnIdx + 1) % room.players.length;
    const next = room.players[gd.turnIdx];
    gd.currentPlayerId = next.id;
    gd.currentPlayerName = next.name;
    gd.currentChoice = null;
    gd.currentContent = null;
    io.to(code).emit('tod_turn', {
      currentPlayerId: next.id,
      currentPlayerName: next.name,
      players: room.players
    });
  });

  socket.on('tod_spin', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
    // Random spin to pick a player
    gd.turnIdx = Math.floor(Math.random() * room.players.length);
    const next = room.players[gd.turnIdx];
    gd.currentPlayerId = next.id;
    gd.currentPlayerName = next.name;
    gd.currentChoice = null;
    gd.currentContent = null;
    io.to(code).emit('tod_turn', {
      currentPlayerId: next.id,
      currentPlayerName: next.name,
      players: room.players,
      spun: true
    });
  });

  // ── BACK TO LOBBY ────────────────────────────────────────────────────────
  socket.on('back_to_lobby', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.state = 'lobby';
    room.gameData = {};
    broadcastRoom(code);
    io.to(code).emit('lobby_reset');
  });

  // ── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    for (const [code, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      const wasHost = room.hostId === socket.id;
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        if (wasHost) room.hostId = room.players[0].id;
        io.to(code).emit('player_left', { name: room.players[idx]?.name || 'Someone', players: room.players, newHostId: room.hostId });
        broadcastRoom(code);
      }
    }
  });
});

// ─── Game Starters ────────────────────────────────────────────────────────────

function startTicTacToe(room) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  room.gameData = {
    board: Array(9).fill(''),
    turn: 'X',
    winner: null,
    players: [
      { id: shuffled[0].id, name: shuffled[0].name, symbol: 'X' },
      { id: shuffled[1].id, name: shuffled[1].name, symbol: 'O' }
    ]
  };
  io.to(room.code).emit('ttt_start', {
    board: room.gameData.board,
    players: room.gameData.players,
    turn: room.gameData.turn,
    scores: room.players
  });
}

function startImposter(room) {
  const pack = imposterWordPacks[Math.floor(Math.random() * imposterWordPacks.length)];
  const imposterIdx = Math.floor(Math.random() * room.players.length);
  const imposter = room.players[imposterIdx];
  const clueOrder = [...room.players].sort(() => Math.random() - 0.5).map(p => p.id);

  room.gameData = {
    word: pack.word,
    imposterWord: pack.imposterWord,
    category: pack.category,
    imposterId: imposter.id,
    clueOrder,
    currentClueIdx: 0,
    clues: [],
    votes: {}
  };

  // Send individual word assignments
  room.players.forEach(player => {
    const sock = io.sockets.sockets.get(player.id);
    if (sock) {
      sock.emit('imposter_role', {
        word: player.id === imposter.id ? pack.imposterWord : pack.word,
        category: pack.category,
        isImposter: player.id === imposter.id,
        players: room.players
      });
    }
  });

  const firstId = clueOrder[0];
  const firstPlayer = room.players.find(p => p.id === firstId);
  setTimeout(() => {
    io.to(room.code).emit('imposter_clue_phase', {
      clues: [],
      currentPlayer: firstPlayer.name,
      currentPlayerId: firstId
    });
  }, 5000);
}

function startDecode(room) {
  const shift = Math.floor(Math.random() * 5) + 2; // shift 2-6
  const pack = codeMessages[Math.floor(Math.random() * codeMessages.length)];
  const encoded = caesarEncode(pack.message, shift);

  room.gameData = {
    message: pack.message,
    encoded,
    hint: pack.hint,
    shift,
    solved: false,
    hintsUsed: 0,
    guesses: []
  };

  io.to(room.code).emit('decode_start', {
    encoded,
    hint: pack.hint,
    players: room.players
  });
}

function startTruthOrDare(room) {
  const startIdx = Math.floor(Math.random() * room.players.length);
  const first = room.players[startIdx];
  room.gameData = {
    turnIdx: startIdx,
    currentPlayerId: first.id,
    currentPlayerName: first.name,
    currentChoice: null,
    currentContent: null
  };
  io.to(room.code).emit('tod_start', {
    players: room.players,
    currentPlayerId: first.id,
    currentPlayerName: first.name
  });
}

// ─── Win checker ─────────────────────────────────────────────────────────────
function checkTTTWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  return null;
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Multiplayer Games Server running!`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`📱 On your network, others can join at: http://<your-ip>:${PORT}\n`);
});
