// TicTacToe PvP room server — same pattern as hexzapServer: ws upgrade on a
// dedicated path, authoritative rooms keyed by short join code, JSON messages.
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../utils/logger';

interface Player { ws: WebSocket; id: string; name: string; mark: 'X' | 'O'; }
interface Room {
  code: string;
  players: Player[];          // [0] = X (host), [1] = O
  board: number;              // bitmask, bit i set = taken by turn owner
  marks: (0 | 1 | 2)[];       // 0 empty, 1 X, 2 O
  turn: 'X' | 'O';
  phase: 'wait' | 'play' | 'over';
  winner: 'X' | 'O' | 'draw' | null;
  line: number[] | null;      // winning cell indexes
  scores: { X: number; O: number; draw: number };
}

const rooms = new Map<string, Room>();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function makeCode(): string {
  let code: string;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function newRoom(): Room {
  return {
    code: makeCode(),
    players: [],
    board: 0,
    marks: new Array(9).fill(0) as (0 | 1 | 2)[],
    turn: 'X',
    phase: 'wait',
    winner: null,
    line: null,
    scores: { X: 0, O: 0, draw: 0 },
  };
}

function send(p: Player, obj: object): void {
  if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(obj));
}

function snapshot(r: Room, viewer?: Player) {
  return {
    t: r.phase === 'wait' ? 'lobby' : 'state',
    code: r.code,
    marks: r.marks,
    turn: r.turn,
    phase: r.phase,
    winner: r.winner,
    line: r.line,
    scores: r.scores,
    players: r.players.map(p => ({ nm: p.name, mark: p.mark })),
    host: r.players[0] ? r.players[0].mark : null,
    you: viewer ? viewer.mark : null,
  };
}

function broadcast(r: Room): void {
  for (const p of r.players) send(p, snapshot(r, p));
}

function findWin(marks: (0 | 1 | 2)[]): { line: number[] | null; winner: 'X' | 'O' | null } {
  for (const line of WINS) {
    const [a, b, c] = line;
    if (marks[a] && marks[a] === marks[b] && marks[a] === marks[c]) {
      return { line, winner: marks[a] === 1 ? 'X' : 'O' };
    }
  }
  return { line: null, winner: null };
}

function startRound(r: Room): void {
  r.board = 0;
  r.marks = new Array(9).fill(0) as (0 | 1 | 2)[];
  r.turn = 'X';
  r.phase = 'play';
  r.winner = null;
  r.line = null;
  broadcast(r);
}

function finishRound(r: Room): void {
  r.phase = 'over';
  if (r.winner && r.winner !== 'draw') r.scores[r.winner]++;
  else if (r.winner === 'draw') r.scores.draw++;
  broadcast(r);
}

function dropPlayer(r: Room, p: Player): void {
  r.players = r.players.filter(q => q !== p);
  if (r.players.length === 0) {
    rooms.delete(r.code);
    logger.info(`[tictactoe] room ${r.code} closed (empty)`);
    return;
  }
  // remaining player wins by forfeit if a round was live
  if (r.phase === 'play') {
    r.phase = 'over';
    r.winner = r.players[0].mark;
    r.line = null;
    r.scores[r.winner]++;
    broadcast(r);
    r.phase = 'wait'; // keep room so the remaining player can host again
  } else {
    broadcast(r);
  }
}

export function attachTicTacToe(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/tictactoe' });

  wss.on('connection', (ws) => {
    let me: Player | null = null;
    let room: Room | null = null;

    ws.on('message', (data) => {
      let m: any;
      try { m = JSON.parse(String(data)); } catch { return; }

      if (m.t === 'join' && !me) {
        const name = String(m.name || 'Player').slice(0, 14);
        const code = m.code ? String(m.code).toUpperCase() : '';
        if (code) {
          // never ghost-create on a typo'd code — the joiner would wait alone
          room = rooms.get(code) ?? null;
          if (!room) {
            ws.send(JSON.stringify({ t: 'err', msg: 'Room not found' }));
            return;
          }
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ t: 'err', msg: 'Room is full' }));
            return;
          }
          me = { ws, id: Math.random().toString(36).slice(2, 9), name, mark: room.players.some(p => p.mark === 'X') ? 'O' : 'X' };
          room.players.push(me);
        } else {
          room = newRoom();
          me = { ws, id: Math.random().toString(36).slice(2, 9), name, mark: 'X' };
          room.players.push(me);
          rooms.set(room.code, room);
        }
        logger.info(`[tictactoe] ${name} joined ${room.code} as ${me.mark}`);
        if (room.players.length === 2 && room.phase === 'wait') startRound(room);
        else broadcast(room);
        return;
      }

      if (!me || !room || !room.players.includes(me)) return;

      if (m.t === 'move' && room.phase === 'play' && room.turn === me.mark) {
        const idx = m.idx | 0;
        if (idx < 0 || idx > 8 || room.marks[idx] !== 0) return;
        room.marks[idx] = me.mark === 'X' ? 1 : 2;
        room.board |= 1 << idx;
        const { line, winner } = findWin(room.marks);
        if (winner) {
          room.winner = winner;
          room.line = line;
          finishRound(room);
        } else if (room.board === 0x1ff) {
          room.winner = 'draw';
          finishRound(room);
        } else {
          room.turn = room.turn === 'X' ? 'O' : 'X';
          broadcast(room);
        }
        return;
      }

      // host seat (players[0]) may be either mark after a forfeit — don't gate on 'X'
      if (m.t === 'again' && room.phase === 'over' && room.players[0] === me) {
        startRound(room);
      }
    });

    ws.on('close', () => {
      if (me && room) dropPlayer(room, me);
    });
  });

  logger.info('[tictactoe] room server attached at /tictactoe');
}
