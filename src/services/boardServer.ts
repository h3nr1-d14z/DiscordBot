// Generic room board-game server (TicTacToe 3x3x3, Caro 15x15x5).
// Same wire protocol as before: join/move/again with authoritative rooms keyed
// by 4-char join codes. One ws path per game, mounted on the shared http server.
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../utils/logger';

interface Player { ws: WebSocket; id: string; name: string; mark: 'X' | 'O'; }
interface Room {
  code: string;
  players: Player[];          // [0] = host
  marks: (0 | 1 | 2)[];       // cols*rows cells, 0 empty, 1 X, 2 O
  turn: 'X' | 'O';
  phase: 'wait' | 'play' | 'over';
  winner: 'X' | 'O' | 'draw' | null;
  line: number[] | null;      // winning cell indexes
  scores: { X: number; O: number; draw: number };
}
export interface BoardConfig {
  path: string;               // ws upgrade path, e.g. '/tictactoe'
  label: string;              // log prefix
  cols: number;
  rows: number;
  winLen: number;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// One 'upgrade' listener per http server, routing by pathname. Several
// WebSocketServer instances with the `path` option on the same http.Server
// corrupt each other's frames (client sees "RSV1 must be clear"), so we never
// let ws attach its own upgrade listeners for board games.
const routeTable = new WeakMap<Server, Map<string, WebSocketServer>>();

function routeUpgrade(server: Server, path: string, wss: WebSocketServer): void {
  let routes = routeTable.get(server);
  if (!routes) {
    routes = new Map();
    routeTable.set(server, routes);
    server.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      const target = routes!.get(pathname);
      if (target) target.handleUpgrade(req, socket, head, ws => target.emit('connection', ws, req));
      // no route match: not ours (e.g. /hexzap) — leave it to that server's handler
    });
  }
  routes.set(path, wss);
}

function makeCode(taken: Set<string>): string {
  let code: string;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (taken.has(code));
  return code;
}

export function attachBoardGame(server: Server, cfg: BoardConfig): void {
  const { cols, rows, winLen, path, label } = cfg;
  const cells = cols * rows;
  const rooms = new Map<string, Room>();

  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // longest line through idx in any direction; >= winLen wins
  function winLine(marks: (0 | 1 | 2)[], idx: number): number[] | null {
    const me = marks[idx];
    const x0 = idx % cols, y0 = Math.floor(idx / cols);
    for (const [dx, dy] of DIRS) {
      const line = [idx];
      for (const sign of [1, -1]) {
        let x = x0 + dx * sign, y = y0 + dy * sign;
        while (x >= 0 && x < cols && y >= 0 && y < rows && marks[y * cols + x] === me) {
          line.push(y * cols + x);
          x += dx * sign; y += dy * sign;
        }
      }
      if (line.length >= winLen) return line.sort((a, b) => a - b);
    }
    return null;
  }

  function send(p: Player, obj: object): void {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(obj));
  }

  function snapshot(r: Room, viewer?: Player) {
    return {
      t: r.phase === 'wait' ? 'lobby' : 'state',
      code: r.code,
      marks: r.marks,
      cols, rows, winLen,
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

  function startRound(r: Room): void {
    r.marks = new Array(cells).fill(0) as (0 | 1 | 2)[];
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
      logger.info(`[${label}] room ${r.code} closed (empty)`);
      return;
    }
    if (r.phase === 'play') {
      r.phase = 'over';
      r.winner = r.players[0].mark;
      r.line = null;
      r.scores[r.winner]++;
      broadcast(r);
      r.phase = 'wait'; // keep the room so the remaining player can host again
    } else {
      broadcast(r);
    }
  }

  const wss = new WebSocketServer({ noServer: true });
  routeUpgrade(server, path, wss);

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
          const r: Room = {
            code: makeCode(rooms.size ? new Set(rooms.keys()) : new Set()),
            players: [],
            marks: new Array(cells).fill(0) as (0 | 1 | 2)[],
            turn: 'X',
            phase: 'wait',
            winner: null,
            line: null,
            scores: { X: 0, O: 0, draw: 0 },
          };
          room = r;
          me = { ws, id: Math.random().toString(36).slice(2, 9), name, mark: 'X' };
          room.players.push(me);
          rooms.set(room.code, room);
        }
        logger.info(`[${label}] ${name} joined ${room.code} as ${me.mark}`);
        if (room.players.length === 2 && room.phase === 'wait') startRound(room);
        else broadcast(room);
        return;
      }

      if (!me || !room || !room.players.includes(me)) return;

      if (m.t === 'move' && room.phase === 'play' && room.turn === me.mark) {
        const idx = m.idx | 0;
        if (idx < 0 || idx >= cells || room.marks[idx] !== 0) return;
        room.marks[idx] = me.mark === 'X' ? 1 : 2;
        const line = winLine(room.marks, idx);
        if (line) {
          room.winner = me.mark;
          room.line = line;
          finishRound(room);
        } else if (room.marks.every(v => v !== 0)) {
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

  logger.info(`[${label}] room server attached at ${path} (${cols}x${rows}, ${winLen} to win)`);
}
