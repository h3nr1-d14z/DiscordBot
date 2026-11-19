import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from '../utils/logger';

// HexZap — blind laser duel on a collapsing hex floor.
// Server-authoritative: clients send intents, this module owns all state.

const TICK_MS = 50;               // 20 Hz sim
const BROADCAST_MS = 66;          // ~15 Hz snapshots
const GRID_R = 6;                 // arena radius in hex rings (127 tiles)
const PLAYER_SPEED = 3.1;         // tiles / second
const PLAYER_RADIUS = 0.30;       // laser hit radius, in tiles
const AIM_WINDOW_MS = 8000;       // time to move + lock aim before all lasers fire
const RESOLVE_MS = 3000;          // lasers visible / round pause
const RING_FALL_MS = 6500;        // ring mode: one ring collapses every N ms
const RANDOM_FALL_MS = 1300;      // random mode: one random tile every N ms
const WARN_MS = 1600;             // warning state before a tile disappears
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

interface Tile { state: 0 | 1 | 2 | 3; warnAt: number; } // 0 solid, 1 warning, 2 falling, 3 gone
interface Player {
  id: string; ws: WebSocket; name: string; color: string;
  x: number; y: number; aim: number; locked: boolean;
  mx: number; my: number; alive: boolean; wins: number;
}
type Phase = 'lobby' | 'playing' | 'firing' | 'over';

interface Room {
  code: string;
  players: Map<string, Player>;
  tiles: Map<string, Tile>;         // "q,r" -> tile
  phase: Phase;
  hostId: string;
  floorMode: 'ring' | 'random';
  phaseEndsAt: number;
  lastRingFall: number; lastRandomFall: number; nextRing: number;
  lasers: Array<{ x: number; y: number; a: number }>;
  winnerId: string | null;
  rounds: number;
}

const rooms = new Map<string, Room>();
const COLORS = ['#5865f2', '#eb459e', '#57f287', '#fee75c', '#f23f43', '#00d4ff', '#ff9f43', '#b980ff'];

// Axial hex helpers (flat-top). World coords are in "tile units" — 1 tile ≈ 1.
function axialToPixel(q: number, r: number): { x: number; y: number } {
  return { x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2) };
}
function pixelToAxial(x: number, y: number): { q: number; r: number } {
  const q = (2 / 3) * x;
  const r = (-1 / 3) * x + (Math.sqrt(3) / 3) * y;
  return { q: Math.round(q), r: Math.round(r) };
}
function key(q: number, r: number): string { return `${q},${r}`; }

function buildFloor(): Map<string, Tile> {
  const tiles = new Map<string, Tile>();
  for (let q = -GRID_R; q <= GRID_R; q++) {
    for (let r = Math.max(-GRID_R, -q - GRID_R); r <= Math.min(GRID_R, -q + GRID_R); r++) {
      tiles.set(key(q, r), { state: 0, warnAt: 0 });
    }
  }
  return tiles;
}

function ringOf(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function newRoom(code: string): Room {
  return {
    code, players: new Map(), tiles: buildFloor(), phase: 'lobby',
    hostId: '', floorMode: Math.random() < 0.5 ? 'ring' : 'random',
    phaseEndsAt: 0, lastRingFall: 0, lastRandomFall: 0, nextRing: GRID_R,
    lasers: [], winnerId: null, rounds: 0,
  };
}

function makeCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do { code = Array.from({ length: 5 }, () => abc[Math.floor(Math.random() * abc.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function tileKeyAt(x: number, y: number): string | null {
  const { q, r } = pixelToAxial(x, y);
  return tilesHas(q, r) ? key(q, r) : null;
}
function tilesHas(q: number, r: number): boolean {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= GRID_R;
}

function update(room: Room, now: number) {
  if (room.phase === 'lobby' || room.phase === 'over') return;

  // Floor collapse
  if (room.floorMode === 'ring' && now - room.lastRingFall >= RING_FALL_MS) {
    room.lastRingFall = now;
    const ring = room.nextRing;
    if (ring >= 0) {
      for (const [k, t] of room.tiles) {
        if (t.state === 0) {
          const [q, r] = k.split(',').map(Number);
          if (ringOf(q, r) === ring) { t.state = 1; t.warnAt = now; }
        }
      }
      room.nextRing = ring - 1;
    }
  } else if (room.floorMode === 'random' && now - room.lastRandomFall >= RANDOM_FALL_MS) {
    room.lastRandomFall = now;
    const solid = [...room.tiles.entries()].filter(([, t]) => t.state === 0);
    if (solid.length > Math.max(9, room.players.size * 2)) {
      const [, t] = solid[Math.floor(Math.random() * solid.length)];
      t.state = 1; t.warnAt = now;
    }
  }
  for (const t of room.tiles.values()) {
    if (t.state === 1 && now - t.warnAt >= WARN_MS) t.state = 3;
  }

  if (room.phase === 'playing') {
    // Movement
    const dt = TICK_MS / 1000;
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      if (p.mx || p.my) {
        const len = Math.hypot(p.mx, p.my) || 1;
        p.x += (p.mx / len) * PLAYER_SPEED * dt;
        p.y += (p.my / len) * PLAYER_SPEED * dt;
      }
      const k = tileKeyAt(p.x, p.y);
      if (!k || room.tiles.get(k)!.state === 3) {
        p.alive = false; // floor vanished under them
      }
    }
  }

  // Fire resolution
  if (now >= room.phaseEndsAt) {
    if (room.phase === 'playing') {
      room.phase = 'firing';
      room.phaseEndsAt = now + RESOLVE_MS;
      room.rounds++;
      room.lasers = [];
      for (const p of room.players.values()) {
        if (p.alive) room.lasers.push({ x: p.x, y: p.y, a: p.aim });
      }
      // every alive player fires; anyone (alive) within PLAYER_RADIUS of any beam dies
      for (const victim of room.players.values()) {
        if (!victim.alive) continue;
        for (const l of room.lasers) {
          const dx = victim.x - l.x, dy = victim.y - l.y;
          const along = dx * Math.cos(l.a) + dy * Math.sin(l.a);
          const perp = Math.abs(-dx * Math.sin(l.a) + dy * Math.cos(l.a));
          if (along > 0.01 && perp < PLAYER_RADIUS) { victim.alive = false; break; }
        }
      }
      const alive = [...room.players.values()].filter(p => p.alive);
      if (alive.length <= 1 && room.rounds >= 1) {
        room.phase = 'over';
        room.phaseEndsAt = now + 5000;
        room.winnerId = alive[0]?.id ?? null;
        if (alive[0]) alive[0].wins++;
      }
    } else if (room.phase === 'firing') {
      room.lasers = [];
      room.phase = 'playing';
      room.phaseEndsAt = now + AIM_WINDOW_MS;
    }
  }
}

function encodeTiles(room: Room): string {
  const arr = new Uint8Array(room.tiles.size);
  let i = 0;
  for (const t of room.tiles.values()) arr[i++] = t.state;
  return Buffer.from(arr).toString('base64');
}

function snapshot(room: Room) {
  return {
    t: 'state',
    phase: room.phase,
    endsAt: room.phaseEndsAt,
    floorMode: room.floorMode,
    tiles: encodeTiles(room),
    lasers: room.lasers,
    alive: [...room.players.values()].filter(p => p.alive).length,
    winner: room.winnerId
      ? { id: room.winnerId, name: room.players.get(room.winnerId)?.name ?? '' }
      : null,
    players: [...room.players.values()].map(p => ({
      id: p.id, nm: p.name, c: p.color,
      x: +p.x.toFixed(2), y: +p.y.toFixed(2), a: +p.aim.toFixed(3),
      alive: p.alive, lk: p.locked, w: p.wins, host: p.id === room.hostId,
    })),
  };
}

function broadcast(room: Room) {
  if (!room.players.size) return;
  const msg = JSON.stringify(snapshot(room));
  for (const p of room.players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(msg);
  }
}

const tick = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) update(room, now);
  // cleanup empty rooms
  for (const [code, room] of rooms) {
    const connected = [...room.players.values()].filter(p => p.ws.readyState === WebSocket.OPEN);
    if (!connected.length) rooms.delete(code);
  }
}, TICK_MS);

const cast = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) broadcast(room);
  void now;
}, BROADCAST_MS);

export function attachHexZap(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/hexzap')) return;
    wss.handleUpgrade(req, socket, head, ws => {
      let room: Room | null = null;
      let me: Player | null = null;

      ws.on('message', raw => {
        let m: any;
        try { m = JSON.parse(String(raw)); } catch { return; }
        const now = Date.now();

        if (m.t === 'join' && !me) {
          const name = String(m.name ?? 'Player').slice(0, 14) || 'Player';
          const requested = typeof m.code === 'string' && m.code.trim();
          const code: string = requested ? m.code.trim().toUpperCase().slice(0, 5) : makeCode();
          // joining an explicit code that doesn't exist must fail — never ghost-create a room
          if (requested && !rooms.has(code)) {
            ws.send(JSON.stringify({ t: 'noRoom' }));
            return;
          }
          room = rooms.get(code) ?? newRoom(code);
          rooms.set(code, room);
          if (room.players.size >= MAX_PLAYERS) {
            ws.send(JSON.stringify({ t: 'full' })); return;
          }
          const id = Math.random().toString(36).slice(2, 9);
          let sx = 0, sy = 0;
          if (room.phase === 'lobby' || room.phase === 'over') {
            // spawn near center ring 1
            const spawnRing = 1;
            const angle = Math.random() * Math.PI * 2;
            sx = 1.5 * spawnRing * Math.cos(angle);
            sy = Math.sqrt(3) * spawnRing * Math.sin(angle);
          } else {
            // mid-game join: drop on a random solid tile edge
            const solid = [...room.tiles.entries()].filter(([, t]) => t.state === 0);
            if (solid.length) {
              const [k] = solid[Math.floor(Math.random() * solid.length)];
              const [q, r] = k.split(',').map(Number);
              const px = axialToPixel(q, r); sx = px.x; sy = px.y;
            }
          }
          me = {
            id, ws, name, color: COLORS[room.players.size % COLORS.length],
            x: sx, y: sy, aim: 0, locked: false, mx: 0, my: 0,
            alive: room.phase !== 'playing' ? true : true, wins: 0,
          };
          room.players.set(id, me);
          if (!room.hostId) room.hostId = id;
          ws.send(JSON.stringify({ t: 'joined', code: room.code, you: id }));
          logger.info(`[hexzap] ${name} joined room ${room.code} (${room.players.size} players)`);
          return;
        }

        if (!me || !room) return;

        if (m.t === 'input') {
          me.mx = Math.max(-1, Math.min(1, +m.mx || 0));
          me.my = Math.max(-1, Math.min(1, +m.my || 0));
          me.aim = +m.a || 0;
          me.locked = !!m.lk;
        } else if (m.t === 'start' && me.id === room.hostId) {
          if (room.players.size >= MIN_PLAYERS && (room.phase === 'lobby' || room.phase === 'over')) {
            room.phase = 'playing';
            room.phaseEndsAt = now + AIM_WINDOW_MS;
            room.tiles = buildFloor();
            room.floorMode = Math.random() < 0.5 ? 'ring' : 'random';
            room.lastRingFall = now; room.lastRandomFall = now; room.nextRing = GRID_R;
            room.lasers = []; room.winnerId = null; room.rounds = 0;
            for (const p of room.players.values()) { p.alive = true; p.locked = false; }
          }
        } else if (m.t === 'again' && me.id === room.hostId && room.phase === 'over') {
          room.phase = 'lobby';
          room.winnerId = null;
          room.tiles = buildFloor();
        }
      });

      ws.on('close', () => {
        if (me && room) {
          room.players.delete(me.id);
          if (room.hostId === me.id) {
            const next = room.players.values().next().value;
            room.hostId = next?.id ?? '';
          }
        }
      });
    });
  });
  logger.info('[hexzap] websocket server attached');
}

process.on('SIGTERM', () => { clearInterval(tick); clearInterval(cast); });
