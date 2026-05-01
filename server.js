const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(express.static(path.join(__dirname, 'public')));

// ─── State ────────────────────────────────────────────────────────────────────
const rooms = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return rooms[c] ? genCode() : c;
}

function broadcast(code) {
  const r = rooms[code];
  if (!r) return;
  io.to(code).emit('room_update', {
    code: r.code, game: r.game, players: r.players, state: r.state, hostId: r.hostId
  });
}

// ─── TTT ──────────────────────────────────────────────────────────────────────
const TTT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkTTT(board) {
  for (const line of TTT_LINES) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c])
      return { winner: board[a], line };
  }
  return null;
}

// ─── Imposter Word Packs (50+ categories) ────────────────────────────────────
const PACKS = [
  // Animals
  { category:'Wild Animals', word:'Tiger', imposterWord:'Leopard' },
  { category:'Ocean Creatures', word:'Shark', imposterWord:'Dolphin' },
  { category:'Birds', word:'Eagle', imposterWord:'Hawk' },
  { category:'Insects', word:'Butterfly', imposterWord:'Moth' },
  { category:'Reptiles', word:'Crocodile', imposterWord:'Alligator' },
  { category:'African Animals', word:'Elephant', imposterWord:'Hippo' },
  { category:'Primates', word:'Gorilla', imposterWord:'Chimpanzee' },
  // Food & Drink
  { category:'Fast Food', word:'Burger', imposterWord:'Hot Dog' },
  { category:'Italian Food', word:'Pizza', imposterWord:'Pasta' },
  { category:'Cocktails', word:'Margarita', imposterWord:'Mojito' },
  { category:'Desserts', word:'Cheesecake', imposterWord:'Tiramisu' },
  { category:'Asian Food', word:'Sushi', imposterWord:'Sashimi' },
  { category:'Breakfast', word:'Pancakes', imposterWord:'Waffles' },
  { category:'Street Food', word:'Tacos', imposterWord:'Burrito' },
  { category:'Coffee', word:'Espresso', imposterWord:'Americano' },
  // Entertainment & Pop Culture
  { category:'Streaming Services', word:'Netflix', imposterWord:'Hulu' },
  { category:'Social Media', word:'Instagram', imposterWord:'TikTok' },
  { category:'Video Games', word:'Fortnite', imposterWord:'Warzone' },
  { category:'Marvel Heroes', word:'Iron Man', imposterWord:'Thor' },
  { category:'DC Heroes', word:'Batman', imposterWord:'Superman' },
  { category:'Animated Shows', word:'South Park', imposterWord:'Family Guy' },
  { category:'Reality TV', word:'Survivor', imposterWord:'Big Brother' },
  { category:'Talk Shows', word:'Jimmy Fallon', imposterWord:'Jimmy Kimmel' },
  { category:'Podcasts', word:'Joe Rogan', imposterWord:'Call Her Daddy' },
  // Places
  { category:'World Cities', word:'Tokyo', imposterWord:'Seoul' },
  { category:'Beach Destinations', word:'Maldives', imposterWord:'Bali' },
  { category:'European Cities', word:'Paris', imposterWord:'Rome' },
  { category:'US Cities', word:'New York', imposterWord:'Los Angeles' },
  { category:'Theme Parks', word:'Disneyland', imposterWord:'Universal Studios' },
  { category:'Deserts', word:'Sahara', imposterWord:'Gobi' },
  // Technology
  { category:'Smartphones', word:'iPhone', imposterWord:'Samsung Galaxy' },
  { category:'Browsers', word:'Chrome', imposterWord:'Firefox' },
  { category:'Car Brands', word:'Tesla', imposterWord:'BMW' },
  { category:'Tech Giants', word:'Google', imposterWord:'Microsoft' },
  { category:'AI Chatbots', word:'ChatGPT', imposterWord:'Claude' },
  { category:'Gaming Consoles', word:'PlayStation', imposterWord:'Xbox' },
  { category:'Electric Cars', word:'Tesla Model 3', imposterWord:'Tesla Model S' },
  // Sports
  { category:'Ball Sports', word:'Basketball', imposterWord:'Volleyball' },
  { category:'Combat Sports', word:'Boxing', imposterWord:'MMA' },
  { category:'Racing', word:'Formula 1', imposterWord:'NASCAR' },
  { category:'Winter Sports', word:'Skiing', imposterWord:'Snowboarding' },
  { category:'Water Sports', word:'Surfing', imposterWord:'Wakeboarding' },
  { category:'Tennis Players', word:'Federer', imposterWord:'Djokovic' },
  // Music & Arts
  { category:'Music Genres', word:'Hip Hop', imposterWord:'R&B' },
  { category:'Dance Styles', word:'Salsa', imposterWord:'Bachata' },
  { category:'Fashion Brands', word:'Gucci', imposterWord:'Louis Vuitton' },
  { category:'Painting Styles', word:'Impressionism', imposterWord:'Cubism' },
  { category:'Musical Instruments', word:'Guitar', imposterWord:'Bass Guitar' },
  { category:'Pop Icons', word:'Beyoncé', imposterWord:'Rihanna' },
  { category:'Rock Bands', word:'Metallica', imposterWord:'AC/DC' },
  // Science & Nature
  { category:'Planets', word:'Mars', imposterWord:'Venus' },
  { category:'Natural Disasters', word:'Tornado', imposterWord:'Hurricane' },
  { category:'Gems', word:'Diamond', imposterWord:'Ruby' },
  { category:'Elements', word:'Gold', imposterWord:'Silver' },
  { category:'Space Missions', word:'Apollo 11', imposterWord:'Artemis' },
  { category:'Big Cats', word:'Lion', imposterWord:'Tiger' },
  // Random Fun
  { category:'Superpowers', word:'Invisibility', imposterWord:'Teleportation' },
  { category:'Mythical Creatures', word:'Dragon', imposterWord:'Griffin' },
  { category:'Card Games', word:'Poker', imposterWord:'Blackjack' },
  { category:'Board Games', word:'Chess', imposterWord:'Checkers' },
  { category:'Conspiracy Theories', word:'Flat Earth', imposterWord:'Moon Landing Hoax' },
  { category:'Phobias', word:'Arachnophobia', imposterWord:'Claustrophobia' },
  { category:'Languages', word:'Mandarin', imposterWord:'Cantonese' },
  { category:'Religions', word:'Buddhism', imposterWord:'Hinduism' },
];

// ─── Decode Messages ──────────────────────────────────────────────────────────
const MESSAGES = [
  { message:'THE PARTY STARTS NOW', hint:'Time to celebrate' },
  { message:'MEET ME AT MIDNIGHT', hint:'A secret rendezvous' },
  { message:'FIND THE HIDDEN KEY', hint:'Search carefully' },
  { message:'DANGER LURKS AHEAD', hint:'Proceed with caution' },
  { message:'TRUST NO ONE TONIGHT', hint:'Stay alert' },
  { message:'FOLLOW THE NORTH STAR', hint:'Navigation advice' },
  { message:'THE GAME IS AFOOT', hint:'Sherlock quote' },
  { message:'ESCAPE BEFORE DAWN', hint:'Time is critical' },
  { message:'THE EAGLE HAS LANDED', hint:'Famous mission phrase' },
  { message:'OPERATION NIGHT STORM', hint:'Military codename' },
  { message:'SILENCE IS GOLDEN', hint:'Old saying' },
  { message:'THE TRUTH IS OUT THERE', hint:'X-Files reference' },
  { message:'FORTUNE FAVORS THE BOLD', hint:'Latin proverb' },
  { message:'THE SPY HAS ESCAPED', hint:'Mission failed' },
  { message:'BURN AFTER READING', hint:'Top secret instruction' },
  { message:'WE ARE NOT ALONE', hint:'Something out there' },
  { message:'THE CLOCK IS TICKING', hint:'Time pressure' },
  { message:'CROSS THE FINISH LINE', hint:'Victory awaits' },
];

// ─── Truth or Dare (18+) ──────────────────────────────────────────────────────
const TRUTHS = [
  "What's the most adventurous place you've ever hooked up?",
  "Have you ever had a one-night stand? Would you do it again?",
  "What is your biggest sexual fantasy you've never told anyone?",
  "Have you ever sent or received an explicit photo? To whom?",
  "What's the most embarrassing thing that's happened to you in the bedroom?",
  "Have you ever faked it? Be honest.",
  "Have you ever slept with someone and immediately regretted it?",
  "What's the wildest thing you've done on a first date?",
  "Have you ever had feelings for someone who was already in a relationship?",
  "What body part do you find most attractive on another person?",
  "Have you ever hooked up with a coworker or classmate?",
  "What's the most scandalous text you've ever sent? Read it.",
  "Have you ever been walked in on? Explain.",
  "What's your number — be honest.",
  "Have you ever been attracted to someone significantly older or younger?",
  "What's your biggest turn-on that you're embarrassed to admit?",
  "Have you ever made out with a complete stranger? Details.",
  "If you had to pick someone in this room to date, who would it be and why?",
  "What's the most risqué dare you've ever completed?",
  "Have you ever had a crush on a friend's partner?",
  "What's the most inappropriate thought you've had about someone in this room?",
  "Have you ever used a dating app? What was your worst match like?",
  "What's something you've done that would shock everyone here?",
  "Have you ever kissed someone of the same sex?",
  "What's the biggest lie you've told a partner?",
  "Have you ever ghosted someone after a hookup?",
  "What's the most public place you've done something you shouldn't?",
  "Have you ever cheated or been cheated on? What happened?",
  "What's your most embarrassing drunk story?",
  "If your search history was shown right now, what would be the most embarrassing thing?",
];

const DARES = [
  "Give someone in this room a 30-second shoulder massage.",
  "Text your ex a flirty message right now — group approves it first.",
  "Let someone in the group go through your DMs for 30 seconds.",
  "Do your most seductive walk across the room.",
  "Whisper something genuinely flirty in someone's ear (their choice).",
  "Let the group pick a contact — you send 'thinking of you 😏'.",
  "Body roll to the next song that plays for 20 seconds.",
  "Demonstrate your best flirting technique on the person to your left.",
  "Sit on someone's lap (group picks who) for the next 2 rounds.",
  "Give a 60-second speed dating pitch trying to impress the group.",
  "Post a story on Instagram saying 'I have a confession' and leave it 5 minutes.",
  "Read your most recent text conversation out loud — no skipping.",
  "Let someone scroll through your camera roll for 20 seconds.",
  "Act out your best 'morning after an awkward night' scene.",
  "Call someone right now (group picks who) and say 'I've been thinking about you'.",
  "Let the group pick your profile photo on any social media for the next hour.",
  "Describe your ideal night out with someone in this room — name them.",
  "Show your most embarrassing photo in your camera roll.",
  "Send a voice note to someone in your contacts saying 'Hey, miss you lately'.",
  "Pretend you're in a dramatic movie proposal scene and propose to someone here.",
  "Let someone write anything they want on your arm with a marker.",
  "Do a 30-second impression of someone in this room — they have to guess who.",
  "Swap phones with someone for 3 minutes. They can do anything.",
  "Give a compliment to every person in the room that's personal and specific.",
  "Let someone choose your next Instagram or WhatsApp status.",
  "Read your most recent Google search out loud.",
  "Try to kiss your elbow for 15 seconds — while someone films it.",
  "Say something flirty to each person in the room without laughing.",
  "Let the group roast you for 60 seconds — you can't respond.",
  "Do 20 seconds of your sexiest dance move — no music needed.",
];

// ─── Caesar Cipher ────────────────────────────────────────────────────────────
function encode(text, shift) {
  return text.split('').map(c => {
    if (c >= 'A' && c <= 'Z') return String.fromCharCode(((c.charCodeAt(0)-65+shift)%26)+65);
    return c;
  }).join('');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random()-0.5); }
function messageStructure(msg) {
  // Returns array: 'L' for letter, 'S' for space
  return msg.split('').map(c => c === ' ' ? 'S' : 'L');
}

// ─── Game Starters ────────────────────────────────────────────────────────────
function startTTT(room) {
  const [p1, p2] = shuffle(room.players);
  room.gameData = {
    board: Array(9).fill(''),
    turn: 'X',
    winner: null,
    winLine: null,
    players: [
      { id: p1.id, name: p1.name, symbol: 'X' },
      { id: p2.id, name: p2.name, symbol: 'O' },
    ]
  };
  io.to(room.code).emit('ttt_start', {
    board: room.gameData.board,
    players: room.gameData.players,
    turn: 'X',
    scores: room.players,
  });
}

function startImposter(room) {
  const pack = rnd(PACKS);
  const impIdx = Math.floor(Math.random() * room.players.length);
  const imposter = room.players[impIdx];
  const clueOrder = shuffle(room.players).map(p => p.id);

  room.gameData = {
    word: pack.word,
    imposterWord: pack.imposterWord,
    category: pack.category,
    imposterId: imposter.id,
    clueOrder,
    currentClueIdx: 0,
    clues: [],
    votes: {},
  };

  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) sock.emit('imposter_role', {
      word: p.id === imposter.id ? pack.imposterWord : pack.word,
      category: pack.category,
      isImposter: p.id === imposter.id,
      players: room.players,
    });
  });

  setTimeout(() => {
    const firstId = clueOrder[0];
    const firstPlayer = room.players.find(p => p.id === firstId);
    io.to(room.code).emit('imposter_clue_phase', {
      clues: [],
      currentPlayer: firstPlayer ? firstPlayer.name : 'Unknown',
      currentPlayerId: firstId,
      clueNumber: 1,
      totalClues: clueOrder.length,
    });
  }, 6000);
}

function startDecode(room) {
  const shift = Math.floor(Math.random() * 5) + 2;
  const pack = rnd(MESSAGES);
  const encoded = encode(pack.message, shift);
  room.gameData = {
    message: pack.message,
    encoded,
    hint: pack.hint,
    shift,
    solved: false,
    hintsUsed: 0,
    guesses: [],
    structure: messageStructure(pack.message),
  };
  io.to(room.code).emit('decode_start', {
    encoded,
    hint: pack.hint,
    structure: room.gameData.structure,
    players: room.players,
  });
}

function startTOD(room) {
  const startIdx = Math.floor(Math.random() * room.players.length);
  const first = room.players[startIdx];
  room.gameData = { turnIdx: startIdx, currentPlayerId: first.id, currentPlayerName: first.name };
  io.to(room.code).emit('tod_start', {
    players: room.players,
    currentPlayerId: first.id,
    currentPlayerName: first.name,
  });
}

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ ${socket.id}`);

  socket.on('create_room', ({ name, game }) => {
    const code = genCode();
    rooms[code] = {
      code, hostId: socket.id, game,
      players: [{ id: socket.id, name, score: 0 }],
      state: 'lobby', gameData: {}
    };
    socket.join(code);
    socket.emit('room_created', { code });
    broadcast(code);
  });

  socket.on('join_room', ({ name, code }) => {
    const upper = code.toUpperCase().trim();
    const room = rooms[upper];
    if (!room) { socket.emit('error_msg', 'Room not found. Check the code!'); return; }
    if (room.state !== 'lobby') { socket.emit('error_msg', 'Game already in progress!'); return; }
    if (room.players.length >= 10) { socket.emit('error_msg', 'Room is full (max 10)!'); return; }
    if (room.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      socket.emit('error_msg', 'That name is taken in this room!'); return;
    }
    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(upper);
    socket.emit('room_joined', { code: upper });
    broadcast(upper);
  });

  socket.on('change_game', ({ code, game }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.game = game;
    broadcast(code);
  });

  socket.on('start_game', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    const minPlayers = { tictactoe: 2, imposter: 3, decode: 2, truthordare: 2 };
    const min = minPlayers[room.game] || 2;
    if (room.players.length < min) {
      socket.emit('error_msg', `Need at least ${min} players for this game!`); return;
    }
    room.state = 'playing';
    if (room.game === 'tictactoe') startTTT(room);
    else if (room.game === 'imposter') startImposter(room);
    else if (room.game === 'decode') startDecode(room);
    else if (room.game === 'truthordare') startTOD(room);
  });

  // ── TTT ──────────────────────────────────────────────────────────────────
  socket.on('ttt_move', ({ code, index }) => {
    const room = rooms[code];
    if (!room || room.game !== 'tictactoe') return;
    const gd = room.gameData;
    const [p1, p2] = gd.players;
    const activeId = gd.turn === 'X' ? p1.id : p2.id;
    if (socket.id !== activeId) return;
    if (gd.board[index] !== '') return;
    if (gd.winner) return;

    gd.board[index] = gd.turn;
    const result = checkTTT(gd.board);

    if (result) {
      gd.winner = result.winner;
      gd.winLine = result.line;
      const winPlayer = result.winner === 'X' ? p1 : p2;
      const idx = room.players.findIndex(p => p.id === winPlayer.id);
      if (idx >= 0) room.players[idx].score++;
      io.to(code).emit('ttt_update', {
        board: gd.board, turn: gd.turn, winner: result.winner,
        winLine: result.line, winnerName: winPlayer.name, scores: room.players
      });
    } else if (gd.board.every(c => c !== '')) {
      gd.winner = 'draw';
      io.to(code).emit('ttt_update', {
        board: gd.board, turn: gd.turn, winner: 'draw',
        winLine: null, winnerName: null, scores: room.players
      });
    } else {
      gd.turn = gd.turn === 'X' ? 'O' : 'X';
      io.to(code).emit('ttt_update', {
        board: gd.board, turn: gd.turn, winner: null,
        winLine: null, winnerName: null, scores: room.players
      });
    }
  });

  socket.on('ttt_rematch', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'tictactoe' || room.hostId !== socket.id) return;
    const gd = room.gameData;
    [gd.players[0], gd.players[1]] = [gd.players[1], gd.players[0]];
    gd.board = Array(9).fill('');
    gd.turn = 'X';
    gd.winner = null;
    gd.winLine = null;
    io.to(room.code).emit('ttt_start', {
      board: gd.board, players: gd.players, turn: 'X', scores: room.players
    });
  });

  // ── Imposter ─────────────────────────────────────────────────────────────
  socket.on('imposter_clue', ({ code, clue }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter') return;
    const gd = room.gameData;
    const expectedId = gd.clueOrder[gd.currentClueIdx];
    if (socket.id !== expectedId) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    gd.clues.push({ name: player.name, clue: clue.trim() });
    gd.currentClueIdx++;

    if (gd.currentClueIdx >= gd.clueOrder.length) {
      io.to(code).emit('imposter_vote_phase', { clues: gd.clues, players: room.players });
    } else {
      const nextId = gd.clueOrder[gd.currentClueIdx];
      const nextPlayer = room.players.find(p => p.id === nextId);
      io.to(code).emit('imposter_clue_phase', {
        clues: gd.clues,
        currentPlayer: nextPlayer ? nextPlayer.name : 'Unknown',
        currentPlayerId: nextId,
        clueNumber: gd.currentClueIdx + 1,
        totalClues: gd.clueOrder.length,
      });
    }
  });

  socket.on('imposter_vote', ({ code, votedId }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter') return;
    const gd = room.gameData;
    if (gd.votes[socket.id] || socket.id === votedId) return; // no self-vote
    gd.votes[socket.id] = votedId;
    const totalVotes = Object.keys(gd.votes).length;
    io.to(code).emit('imposter_vote_update', { votes: gd.votes, totalVotes, needed: room.players.length });

    if (totalVotes >= room.players.length) {
      // Tally by player id
      const tally = {};
      Object.values(gd.votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
      const mostVotedId = Object.entries(tally).sort((a,b) => b[1]-a[1])[0][0];
      const imposterPlayer = room.players.find(p => p.id === gd.imposterId);
      const caught = gd.imposterId === mostVotedId;
      const mostVotedPlayer = room.players.find(p => p.id === mostVotedId);

      if (caught) {
        room.players.forEach(p => { if (p.id !== gd.imposterId) p.score++; });
      } else {
        if (imposterPlayer) imposterPlayer.score += 2;
      }

      io.to(code).emit('imposter_reveal', {
        imposterName: imposterPlayer?.name || '?',
        imposterId: gd.imposterId,
        word: gd.word,
        imposterWord: gd.imposterWord,
        category: gd.category,
        caught,
        mostVotedId,
        mostVotedName: mostVotedPlayer?.name || '?',
        scores: room.players,
      });
    }
  });

  socket.on('imposter_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter' || room.hostId !== socket.id) return;
    startImposter(room);
  });

  // ── Decode ───────────────────────────────────────────────────────────────
  socket.on('decode_guess', ({ code, guess }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode') return;
    const gd = room.gameData;
    if (gd.solved) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const clean = guess.toUpperCase().replace(/[^A-Z ]/g,'').replace(/\s+/g,' ').trim();
    gd.guesses.push({ name: player.name, guess: clean });
    if (clean === gd.message) {
      gd.solved = true;
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx >= 0) room.players[idx].score += 3;
      io.to(code).emit('decode_solved', {
        solverId: socket.id,
        solver: player.name,
        message: gd.message,
        scores: room.players,
        guesses: gd.guesses,
      });
    } else {
      io.to(code).emit('decode_wrong_guess', {
        guesser: player.name,
        guess: clean,
        guesses: gd.guesses,
      });
    }
  });

  socket.on('decode_hint', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode' || room.hostId !== socket.id) return;
    const gd = room.gameData;
    if (gd.hintsUsed >= 3 || gd.solved) return;
    gd.hintsUsed++;
    const letters = [];
    gd.message.split('').forEach((c, i) => { if (c !== ' ') letters.push(i); });
    const count = Math.ceil(letters.length * (gd.hintsUsed / 4));
    const revealPositions = letters.slice(0, count);
    io.to(code).emit('decode_hint_given', {
      revealPositions,
      message: gd.message,
      hintsUsed: gd.hintsUsed,
      hint: gd.hint,
    });
  });

  socket.on('decode_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode' || room.hostId !== socket.id) return;
    startDecode(room);
  });

  // ── Truth or Dare ─────────────────────────────────────────────────────────
  socket.on('tod_pick', ({ code, choice }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
    if (socket.id !== gd.currentPlayerId) return;
    const content = choice === 'truth' ? rnd(TRUTHS) : rnd(DARES);
    gd.currentChoice = choice;
    gd.currentContent = content;
    io.to(code).emit('tod_show', {
      playerName: gd.currentPlayerName,
      playerId: gd.currentPlayerId,
      choice,
      content,
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
      players: room.players,
    });
  });

  socket.on('tod_spin', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
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
      spun: true,
    });
  });

  // ── Lobby ─────────────────────────────────────────────────────────────────
  socket.on('back_to_lobby', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.state = 'lobby';
    room.gameData = {};
    broadcast(code);
    io.to(code).emit('lobby_reset');
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      const name = room.players[idx].name;
      const wasHost = room.hostId === socket.id;
      room.players.splice(idx, 1);
      if (room.players.length === 0) { delete rooms[code]; continue; }
      if (wasHost) room.hostId = room.players[0].id;
      io.to(code).emit('player_left', { name, players: room.players, newHostId: room.hostId });
      broadcast(code);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Game Night server → http://localhost:${PORT}\n`);
});
