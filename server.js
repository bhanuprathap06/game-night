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

// ─── Imposter Word Packs ─────────────────────────────────────────────────────
const PACKS = [
  { category:'Wild Animals', word:'Tiger', imposterWord:'Leopard' },
  { category:'Ocean Creatures', word:'Shark', imposterWord:'Dolphin' },
  { category:'Birds', word:'Eagle', imposterWord:'Hawk' },
  { category:'Insects', word:'Butterfly', imposterWord:'Moth' },
  { category:'Reptiles', word:'Crocodile', imposterWord:'Alligator' },
  { category:'African Animals', word:'Elephant', imposterWord:'Hippo' },
  { category:'Primates', word:'Gorilla', imposterWord:'Chimpanzee' },
  { category:'Fast Food', word:'Burger', imposterWord:'Hot Dog' },
  { category:'Italian Food', word:'Pizza', imposterWord:'Pasta' },
  { category:'Cocktails', word:'Margarita', imposterWord:'Mojito' },
  { category:'Desserts', word:'Cheesecake', imposterWord:'Tiramisu' },
  { category:'Asian Food', word:'Sushi', imposterWord:'Sashimi' },
  { category:'Breakfast', word:'Pancakes', imposterWord:'Waffles' },
  { category:'Street Food', word:'Tacos', imposterWord:'Burrito' },
  { category:'Coffee', word:'Espresso', imposterWord:'Americano' },
  { category:'Streaming Services', word:'Netflix', imposterWord:'Hulu' },
  { category:'Social Media', word:'Instagram', imposterWord:'TikTok' },
  { category:'Video Games', word:'Fortnite', imposterWord:'Warzone' },
  { category:'Marvel Heroes', word:'Iron Man', imposterWord:'Thor' },
  { category:'DC Heroes', word:'Batman', imposterWord:'Superman' },
  { category:'Animated Shows', word:'South Park', imposterWord:'Family Guy' },
  { category:'Reality TV', word:'Survivor', imposterWord:'Big Brother' },
  { category:'World Cities', word:'Tokyo', imposterWord:'Seoul' },
  { category:'Beach Destinations', word:'Maldives', imposterWord:'Bali' },
  { category:'European Cities', word:'Paris', imposterWord:'Rome' },
  { category:'US Cities', word:'New York', imposterWord:'Los Angeles' },
  { category:'Theme Parks', word:'Disneyland', imposterWord:'Universal Studios' },
  { category:'Deserts', word:'Sahara', imposterWord:'Gobi' },
  { category:'Smartphones', word:'iPhone', imposterWord:'Samsung Galaxy' },
  { category:'Browsers', word:'Chrome', imposterWord:'Firefox' },
  { category:'Car Brands', word:'Tesla', imposterWord:'BMW' },
  { category:'Tech Giants', word:'Google', imposterWord:'Microsoft' },
  { category:'AI Chatbots', word:'ChatGPT', imposterWord:'Claude' },
  { category:'Gaming Consoles', word:'PlayStation', imposterWord:'Xbox' },
  { category:'Ball Sports', word:'Basketball', imposterWord:'Volleyball' },
  { category:'Combat Sports', word:'Boxing', imposterWord:'MMA' },
  { category:'Racing', word:'Formula 1', imposterWord:'NASCAR' },
  { category:'Winter Sports', word:'Skiing', imposterWord:'Snowboarding' },
  { category:'Water Sports', word:'Surfing', imposterWord:'Wakeboarding' },
  { category:'Music Genres', word:'Hip Hop', imposterWord:'R&B' },
  { category:'Dance Styles', word:'Salsa', imposterWord:'Bachata' },
  { category:'Fashion Brands', word:'Gucci', imposterWord:'Louis Vuitton' },
  { category:'Painting Styles', word:'Impressionism', imposterWord:'Cubism' },
  { category:'Musical Instruments', word:'Guitar', imposterWord:'Bass Guitar' },
  { category:'Pop Icons', word:'Beyoncé', imposterWord:'Rihanna' },
  { category:'Rock Bands', word:'Metallica', imposterWord:'AC/DC' },
  { category:'Planets', word:'Mars', imposterWord:'Venus' },
  { category:'Natural Disasters', word:'Tornado', imposterWord:'Hurricane' },
  { category:'Gems', word:'Diamond', imposterWord:'Ruby' },
  { category:'Elements', word:'Gold', imposterWord:'Silver' },
  { category:'Superpowers', word:'Invisibility', imposterWord:'Teleportation' },
  { category:'Mythical Creatures', word:'Dragon', imposterWord:'Griffin' },
  { category:'Card Games', word:'Poker', imposterWord:'Blackjack' },
  { category:'Board Games', word:'Chess', imposterWord:'Checkers' },
  { category:'Phobias', word:'Arachnophobia', imposterWord:'Claustrophobia' },
  { category:'Languages', word:'Mandarin', imposterWord:'Cantonese' },
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

// ─── Truth or Dare ────────────────────────────────────────────────────────────
const TRUTHS = [
  "What's the most adventurous place you've ever hooked up?",
  "Have you ever had a one-night stand? Would you do it again?",
  "What is your biggest secret fantasy you've never told anyone?",
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

// ─── Trivia Questions ─────────────────────────────────────────────────────────
const TRIVIA_QUESTIONS = [
  // Geography
  { q:'What is the capital of Australia?', opts:['Sydney','Melbourne','Canberra','Brisbane'], correct:2 },
  { q:'Which is the world\'s largest ocean?', opts:['Atlantic','Indian','Arctic','Pacific'], correct:3 },
  { q:'Which country has the most natural lakes?', opts:['Russia','Canada','Brazil','USA'], correct:1 },
  { q:'What is the longest river in the world?', opts:['Amazon','Nile','Yangtze','Mississippi'], correct:1 },
  { q:'Which country is home to the Great Barrier Reef?', opts:['USA','Brazil','Indonesia','Australia'], correct:3 },
  { q:'What is the capital of Japan?', opts:['Osaka','Kyoto','Hiroshima','Tokyo'], correct:3 },
  { q:'Which country has the largest population?', opts:['USA','India','China','Indonesia'], correct:1 },
  // Science & Tech
  { q:'What element has the chemical symbol Au?', opts:['Silver','Platinum','Gold','Copper'], correct:2 },
  { q:'How many bones are in an adult human body?', opts:['186','206','226','246'], correct:1 },
  { q:'What planet is closest to the Sun?', opts:['Venus','Earth','Mars','Mercury'], correct:3 },
  { q:'What does DNA stand for?', opts:['Deoxyribonucleic Acid','Dynamic Neural Agent','Dinitrogen Activator','Deoxyribose Nuclease'], correct:0 },
  { q:'At what temperature does water boil at sea level (°C)?', opts:['90','95','100','105'], correct:2 },
  { q:'What is the speed of light (approximately)?', opts:['200,000 km/s','250,000 km/s','300,000 km/s','350,000 km/s'], correct:2 },
  { q:'What is the most abundant gas in Earth\'s atmosphere?', opts:['Oxygen','Carbon Dioxide','Nitrogen','Argon'], correct:2 },
  { q:'What is the powerhouse of the cell?', opts:['Nucleus','Ribosome','Mitochondria','Golgi body'], correct:2 },
  // Movies & TV
  { q:'Who played Iron Man in the Marvel Cinematic Universe?', opts:['Chris Evans','Robert Downey Jr.','Chris Hemsworth','Mark Ruffalo'], correct:1 },
  { q:'What streaming platform released Stranger Things?', opts:['HBO','Hulu','Amazon','Netflix'], correct:3 },
  { q:'Who directed Inception (2010)?', opts:['Steven Spielberg','James Cameron','Christopher Nolan','Ridley Scott'], correct:2 },
  { q:'Which movie has the line "You can\'t handle the truth!"?', opts:['The Firm','Philadelphia','A Few Good Men','Primal Fear'], correct:2 },
  { q:'What is the highest-grossing film of all time?', opts:['Titanic','Avengers: Endgame','Avatar','The Lion King'], correct:2 },
  // Music
  { q:'Which band released Bohemian Rhapsody?', opts:['The Beatles','Led Zeppelin','Queen','Pink Floyd'], correct:2 },
  { q:'How many strings does a standard guitar have?', opts:['4','5','6','7'], correct:2 },
  { q:'Who is known as the "Queen of Pop"?', opts:['Beyoncé','Madonna','Lady Gaga','Rihanna'], correct:1 },
  { q:'Which artist released Thriller in 1982?', opts:['Prince','Michael Jackson','David Bowie','Stevie Wonder'], correct:1 },
  { q:'What is the best-selling music album of all time?', opts:['The Eagles - Hotel California','Michael Jackson - Thriller','Beatles - Abbey Road','Fleetwood Mac - Rumours'], correct:1 },
  // Sports
  { q:'How many players are on a basketball team on court?', opts:['4','5','6','7'], correct:1 },
  { q:'What sport is played at Wimbledon?', opts:['Cricket','Polo','Tennis','Badminton'], correct:2 },
  { q:'How many rings are on the Olympic flag?', opts:['4','5','6','7'], correct:1 },
  { q:'How often does the FIFA World Cup take place?', opts:['Every 2 years','Every 3 years','Every 4 years','Every 5 years'], correct:2 },
  { q:'Which country has won the most FIFA World Cups?', opts:['Germany','Italy','Argentina','Brazil'], correct:3 },
  // Pop Culture & Tech
  { q:'What year was the iPhone first released?', opts:['2005','2006','2007','2008'], correct:2 },
  { q:'In Harry Potter, what house is Harry sorted into?', opts:['Slytherin','Ravenclaw','Hufflepuff','Gryffindor'], correct:3 },
  { q:'Which gaming console is made by Sony?', opts:['Xbox','Nintendo Switch','PlayStation','Steam Deck'], correct:2 },
  { q:'What does URL stand for?', opts:['Universal Resource Locator','Uniform Resource Locator','United Routing Language','Universal Record Link'], correct:1 },
  { q:'How many characters can a standard tweet be?', opts:['140','200','240','280'], correct:3 },
  // History
  { q:'In what year did World War II end?', opts:['1943','1944','1945','1946'], correct:2 },
  { q:'Who was the first person to walk on the Moon?', opts:['Buzz Aldrin','Yuri Gagarin','Neil Armstrong','John Glenn'], correct:2 },
  { q:'What was the name of the ship that sank in 1912?', opts:['Lusitania','Britannic','Olympic','Titanic'], correct:3 },
  { q:'Who painted the Mona Lisa?', opts:['Michelangelo','Raphael','Leonardo da Vinci','Caravaggio'], correct:2 },
  { q:'In which year did the Berlin Wall fall?', opts:['1987','1988','1989','1990'], correct:2 },
  // Food & Drink
  { q:'What is the main ingredient in guacamole?', opts:['Tomato','Avocado','Lime','Onion'], correct:1 },
  { q:'Which country invented sushi?', opts:['China','Korea','Japan','Thailand'], correct:2 },
  { q:'What type of pastry is a croissant?', opts:['Choux','Shortcrust','Filo','Puff'], correct:3 },
  { q:'What is the national dish of Spain?', opts:['Tapas','Gazpacho','Paella','Churros'], correct:2 },
  { q:'How many teaspoons are in a tablespoon?', opts:['2','3','4','5'], correct:1 },
  // Random Fun
  { q:'How many colors are in a rainbow?', opts:['5','6','7','8'], correct:2 },
  { q:'What is the most widely spoken language in the world?', opts:['English','Spanish','Mandarin Chinese','Hindi'], correct:2 },
  { q:'How many sides does a pentagon have?', opts:['4','5','6','7'], correct:1 },
  { q:'What animal is the tallest in the world?', opts:['Elephant','Giraffe','Camel','Ostrich'], correct:1 },
  { q:'How many hearts does an octopus have?', opts:['1','2','3','4'], correct:2 },
  // India
  { q:'What is the capital of India?', opts:['Mumbai','Kolkata','New Delhi','Chennai'], correct:2 },
  { q:'In what year did India gain independence?', opts:['1945','1946','1947','1948'], correct:2 },
  { q:'What is the national animal of India?', opts:['Lion','Elephant','Bengal Tiger','Snow Leopard'], correct:2 },
  { q:'Which Indian city is the "Silicon Valley of India"?', opts:['Mumbai','Hyderabad','Bengaluru','Pune'], correct:2 },
  { q:'What is the longest river in India?', opts:['Yamuna','Brahmaputra','Ganga','Godavari'], correct:2 },
];

// ─── Caesar Cipher ────────────────────────────────────────────────────────────
function encode(text, shift) {
  return text.split('').map(c => {
    if (c >= 'A' && c <= 'Z') return String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65);
    return c;
  }).join('');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function messageStructure(msg) { return msg.split('').map(c => c === ' ' ? 'S' : 'L'); }

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
    if (!rooms[room.code]) return;
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

function startTrivia(room) {
  const qs = shuffle([...TRIVIA_QUESTIONS]).slice(0, 10);
  room.gameData = {
    questions: qs,
    currentQ: 0,
    answers: {},
    timer: null,
    revealed: false,
    questionStartTime: 0,
  };
  emitTriviaQuestion(room);
}

function emitTriviaQuestion(room) {
  const gd = room.gameData;
  if (gd.currentQ >= gd.questions.length) {
    io.to(room.code).emit('trivia_end', { scores: room.players });
    return;
  }
  const q = gd.questions[gd.currentQ];
  gd.answers = {};
  gd.revealed = false;
  gd.questionStartTime = Date.now();

  io.to(room.code).emit('trivia_question', {
    question: q.q,
    options: q.opts,
    questionNum: gd.currentQ + 1,
    totalQuestions: gd.questions.length,
    scores: room.players,
  });

  clearTimeout(gd.timer);
  gd.timer = setTimeout(() => {
    if (!gd.revealed) revealTriviaAnswer(room);
  }, 15000);
}

function revealTriviaAnswer(room) {
  if (!room.gameData) return;
  clearTimeout(room.gameData.timer);
  const gd = room.gameData;
  gd.revealed = true;
  const q = gd.questions[gd.currentQ];

  const answeredBy = room.players.map(p => {
    const ans = gd.answers[p.id];
    const correct = ans !== undefined && ans.idx === q.correct;
    let pts = 0;
    if (correct) {
      const elapsed = ans.time - gd.questionStartTime;
      pts = Math.max(100, 300 - Math.floor(elapsed / 75));
      const idx = room.players.findIndex(pl => pl.id === p.id);
      if (idx >= 0) room.players[idx].score += pts;
    }
    return { id: p.id, name: p.name, answerIdx: ans !== undefined ? ans.idx : -1, correct, pts };
  });

  io.to(room.code).emit('trivia_reveal', {
    correctIdx: q.correct,
    correctAnswer: q.opts[q.correct],
    answeredBy,
    scores: room.players,
    questionNum: gd.currentQ + 1,
    totalQuestions: gd.questions.length,
    isLast: gd.currentQ >= gd.questions.length - 1,
  });
}

function startWordChain(room) {
  const GOOD_LETTERS = 'ABCDEFGHILMNOPRSTW';
  const startLetter = GOOD_LETTERS[Math.floor(Math.random() * GOOD_LETTERS.length)];
  const startIdx = Math.floor(Math.random() * room.players.length);
  const first = room.players[startIdx];

  room.gameData = {
    lastLetter: startLetter,
    words: [],
    usedWords: new Set(),
    turnIdx: startIdx,
    currentPlayerId: first.id,
    currentPlayerName: first.name,
    eliminated: [],
  };

  io.to(room.code).emit('wordchain_start', {
    currentPlayerId: first.id,
    currentPlayerName: first.name,
    lastLetter: startLetter,
    words: [],
    players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score, eliminated: false })),
  });
}

// ─── Socket.io ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`✅ connected: ${socket.id}`);

  socket.on('create_room', ({ name, game }) => {
    if (!name || !game) return;
    const code = genCode();
    rooms[code] = {
      code, hostId: socket.id, game,
      players: [{ id: socket.id, name: name.slice(0,20), score: 0 }],
      state: 'lobby', gameData: {}
    };
    socket.join(code);
    socket.emit('room_created', { code });
    broadcast(code);
  });

  socket.on('join_room', ({ name, code }) => {
    if (!name || !code) return;
    const upper = code.toUpperCase().trim();
    const room = rooms[upper];
    if (!room) { socket.emit('error_msg', 'Room not found. Check the code!'); return; }
    if (room.state !== 'lobby') { socket.emit('error_msg', 'Game already in progress!'); return; }
    if (room.players.length >= 10) { socket.emit('error_msg', 'Room is full (max 10)!'); return; }
    if (room.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      socket.emit('error_msg', 'That name is taken in this room!'); return;
    }
    room.players.push({ id: socket.id, name: name.slice(0,20), score: 0 });
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
    const minPlayers = { tictactoe:2, imposter:3, decode:2, truthordare:2, trivia:2, wordchain:3 };
    const min = minPlayers[room.game] || 2;
    if (room.players.length < min) {
      socket.emit('error_msg', `Need at least ${min} players for this game!`); return;
    }
    room.state = 'playing';
    if      (room.game === 'tictactoe')   startTTT(room);
    else if (room.game === 'imposter')    startImposter(room);
    else if (room.game === 'decode')      startDecode(room);
    else if (room.game === 'truthordare') startTOD(room);
    else if (room.game === 'trivia')      startTrivia(room);
    else if (room.game === 'wordchain')   startWordChain(room);
  });

  // ── TTT ──────────────────────────────────────────────────────────────────────
  socket.on('ttt_move', ({ code, index }) => {
    const room = rooms[code];
    if (!room || room.game !== 'tictactoe') return;
    const gd = room.gameData;
    const [p1, p2] = gd.players;
    const activeId = gd.turn === 'X' ? p1.id : p2.id;
    if (socket.id !== activeId || gd.board[index] !== '' || gd.winner) return;

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

  // ── Imposter ──────────────────────────────────────────────────────────────────
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
    if (gd.votes[socket.id] || socket.id === votedId) return;
    gd.votes[socket.id] = votedId;
    const totalVotes = Object.keys(gd.votes).length;
    io.to(code).emit('imposter_vote_update', { totalVotes, needed: room.players.length });

    if (totalVotes >= room.players.length) {
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
        imposterName: imposterPlayer ? imposterPlayer.name : '?',
        imposterId: gd.imposterId,
        word: gd.word,
        imposterWord: gd.imposterWord,
        category: gd.category,
        caught,
        mostVotedId,
        mostVotedName: mostVotedPlayer ? mostVotedPlayer.name : '?',
        scores: room.players,
      });
    }
  });

  socket.on('imposter_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'imposter' || room.hostId !== socket.id) return;
    startImposter(room);
  });

  // ── Decode ────────────────────────────────────────────────────────────────────
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
        solverId: socket.id, solver: player.name,
        message: gd.message, scores: room.players, guesses: gd.guesses,
      });
    } else {
      io.to(code).emit('decode_wrong_guess', { guesser: player.name, guess: clean, guesses: gd.guesses });
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
      revealPositions, message: gd.message, hintsUsed: gd.hintsUsed, hint: gd.hint,
    });
  });

  socket.on('decode_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'decode' || room.hostId !== socket.id) return;
    startDecode(room);
  });

  // ── Truth or Dare ─────────────────────────────────────────────────────────────
  socket.on('tod_pick', ({ code, choice }) => {
    const room = rooms[code];
    if (!room || room.game !== 'truthordare') return;
    const gd = room.gameData;
    if (socket.id !== gd.currentPlayerId) return;
    const content = choice === 'truth' ? rnd(TRUTHS) : rnd(DARES);
    gd.currentChoice = choice;
    gd.currentContent = content;
    io.to(code).emit('tod_show', {
      playerName: gd.currentPlayerName, playerId: gd.currentPlayerId, choice, content,
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
      currentPlayerId: next.id, currentPlayerName: next.name, players: room.players,
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
      currentPlayerId: next.id, currentPlayerName: next.name, players: room.players, spun: true,
    });
  });

  // ── Trivia Blitz ──────────────────────────────────────────────────────────────
  socket.on('trivia_answer', ({ code, answerIdx }) => {
    const room = rooms[code];
    if (!room || room.game !== 'trivia') return;
    const gd = room.gameData;
    if (gd.revealed || gd.answers[socket.id] !== undefined) return;
    if (typeof answerIdx !== 'number' || answerIdx < 0 || answerIdx > 3) return;
    gd.answers[socket.id] = { idx: answerIdx, time: Date.now() };
    const answeredCount = Object.keys(gd.answers).length;
    io.to(code).emit('trivia_answer_count', { answered: answeredCount, total: room.players.length });
    if (answeredCount >= room.players.length) revealTriviaAnswer(room);
  });

  socket.on('trivia_next', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'trivia' || room.hostId !== socket.id) return;
    if (!room.gameData.revealed) return;
    room.gameData.currentQ++;
    emitTriviaQuestion(room);
  });

  // ── Word Chain ────────────────────────────────────────────────────────────────
  socket.on('wordchain_submit', ({ code, word }) => {
    const room = rooms[code];
    if (!room || room.game !== 'wordchain') return;
    const gd = room.gameData;
    if (socket.id !== gd.currentPlayerId) return;

    const clean = (word || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length < 2) {
      socket.emit('wordchain_invalid', { reason: 'Word must be at least 2 letters' }); return;
    }
    if (clean[0] !== gd.lastLetter) {
      socket.emit('wordchain_invalid', { reason: `Word must start with "${gd.lastLetter}"` }); return;
    }
    if (gd.usedWords.has(clean)) {
      socket.emit('wordchain_invalid', { reason: 'Word already used!' }); return;
    }

    gd.usedWords.add(clean);
    const prevLetter = gd.lastLetter;
    gd.lastLetter = clean[clean.length - 1];
    const player = room.players.find(p => p.id === socket.id);
    gd.words.push({ playerName: player ? player.name : 'Unknown', word: clean });

    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx >= 0) room.players[idx].score += 1;

    // Advance to next non-eliminated player
    let nextIdx = (gd.turnIdx + 1) % room.players.length;
    let safety = 0;
    while (room.players[nextIdx] && gd.eliminated.includes(room.players[nextIdx].id) && safety++ < room.players.length) {
      nextIdx = (nextIdx + 1) % room.players.length;
    }
    gd.turnIdx = nextIdx;
    const next = room.players[nextIdx];
    if (!next) return; // all players eliminated — shouldn't happen but guard anyway
    gd.currentPlayerId = next.id;
    gd.currentPlayerName = next.name;

    io.to(code).emit('wordchain_turn', {
      currentPlayerId: next.id,
      currentPlayerName: next.name,
      lastLetter: gd.lastLetter,
      lastWord: clean,
      lastWordPlayer: player ? player.name : 'Unknown',
      words: gd.words.slice(-8),
      players: room.players.map(p => ({ ...p, eliminated: gd.eliminated.includes(p.id) })),
    });
  });

  socket.on('wordchain_eliminate', ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.game !== 'wordchain' || room.hostId !== socket.id) return;
    const gd = room.gameData;

    if (!gd.eliminated.includes(targetId)) {
      gd.eliminated.push(targetId);
    }

    const alive = room.players.filter(p => !gd.eliminated.includes(p.id));
    if (alive.length <= 1) {
      const winner = alive[0];
      if (winner) {
        const wi = room.players.findIndex(p => p.id === winner.id);
        if (wi >= 0) room.players[wi].score += 5;
      }
      io.to(code).emit('wordchain_end', {
        winner: winner ? winner.name : null, scores: room.players,
      });
      return;
    }

    // If eliminated player is current, advance
    if (gd.currentPlayerId === targetId) {
      let nextIdx = (gd.turnIdx + 1) % room.players.length;
      let safety = 0;
      while (room.players[nextIdx] && gd.eliminated.includes(room.players[nextIdx].id) && safety++ < room.players.length) {
        nextIdx = (nextIdx + 1) % room.players.length;
      }
      gd.turnIdx = nextIdx;
      const next = room.players[nextIdx];
      gd.currentPlayerId = next.id;
      gd.currentPlayerName = next.name;
    }

    io.to(code).emit('wordchain_turn', {
      currentPlayerId: gd.currentPlayerId,
      currentPlayerName: gd.currentPlayerName,
      lastLetter: gd.lastLetter,
      words: gd.words.slice(-8),
      players: room.players.map(p => ({ ...p, eliminated: gd.eliminated.includes(p.id) })),
      eliminatedId: targetId,
    });
  });

  socket.on('wordchain_next_round', ({ code }) => {
    const room = rooms[code];
    if (!room || room.game !== 'wordchain' || room.hostId !== socket.id) return;
    startWordChain(room);
  });

  // ── Lobby ─────────────────────────────────────────────────────────────────────
  socket.on('back_to_lobby', ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    if (room.gameData && room.gameData.timer) clearTimeout(room.gameData.timer);
    room.state = 'lobby';
    room.gameData = {};
    broadcast(code);
    io.to(code).emit('lobby_reset');
  });

  // ── Disconnect ────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`❌ disconnected: ${socket.id}`);
    for (const [code, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;
      const name = room.players[idx].name;
      const wasHost = room.hostId === socket.id;
      room.players.splice(idx, 1);
      if (room.players.length === 0) {
        if (room.gameData && room.gameData.timer) clearTimeout(room.gameData.timer);
        delete rooms[code];
        continue;
      }
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
