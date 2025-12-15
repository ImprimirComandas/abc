import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  FPS, TANK_SPEED, TANK_ROTATION_SPEED, BULLET_SPEED, FIRE_COOLDOWN, 
  RESPAWN_TIME, TEAM_BLUE_COLOR, TEAM_RED_COLOR, TILE_SIZE, 
  TILE_BRICK, TILE_STEEL, TILE_WATER, TANK_SIZE, BULLET_RADIUS,
  POWERUP_SPAWN_INTERVAL, POWERUP_DURATION, POWERUP_SIZE, MAP_WIDTH, MAP_HEIGHT, TILE_EMPTY, TANK_HITBOX, SKINS
} from '../constants';
import { 
  GameState, PlayerProfile, Tank, Bullet, EntityType, Team, InputState, PowerUpType, Vector2, SkinId 
} from '../types';
import { 
  checkTileCollision, checkBulletMapCollision, checkBulletTankCollision, 
  getSpawnPoint, checkTankPowerUpCollision 
} from '../utils/gamePhysics';
import VirtualJoystick from './VirtualJoystick';

interface GameEngineProps {
  playerProfile: PlayerProfile;
  onGameOver: (winner: Team) => void;
}

const PowerUpIcon: React.FC<{ type: PowerUpType }> = ({ type }) => {
  switch (type) {
    case 'SHIELD': return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-cyan-400">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
    );
    case 'RAPID_FIRE': return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-400">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    );
    case 'SPEED': return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-400">
        <path d="M6 17l5-5-5-5M13 17l5-5-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    );
    case 'DAMAGE': return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-400">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
      </svg>
    );
  }
};

class AudioController {
    ctx: AudioContext | null = null;
    constructor() {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      } catch (e) { console.warn("AudioContext unsupported"); }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.1) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.start(); osc.stop(this.ctx.currentTime + duration);
    }
    vibrate(ms: number) { if (navigator.vibrate) navigator.vibrate(ms); }
    playShoot() { this.playTone(180, 'square', 0.1, 0.05); this.vibrate(10); }
    playExplosion() { this.playTone(60, 'sawtooth', 0.4, 0.15); this.vibrate(40); }
    playPowerUp() { this.playTone(550, 'sine', 0.3, 0.1); this.vibrate(20); }
    playRespawn() { this.playTone(300, 'sine', 0.6, 0.1); }
}

const GameEngine: React.FC<GameEngineProps> = ({ playerProfile, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioController>(new AudioController());
  const frameRef = useRef<number>(0);
  
  const gameState = useRef<GameState>({
    tanks: [], bullets: [], particles: [], powerUps: [],
    map: JSON.parse(JSON.stringify(LEVEL_1)),
    score: { BLUE: 0, RED: 0 },
    timeLeft: 180, isGameOver: false, winner: null
  });

  const inputState = useRef<InputState>({
    up: false, down: false, left: false, right: false, shoot: false,
    moveVector: { x: 0, y: 0 },
    aimVector: { x: 0, y: 0 },
    mouseX: 0, mouseY: 0
  });

  const [ui, setUi] = useState({
    score: { BLUE: 0, RED: 0 },
    health: 100,
    activePowerUps: {} as Record<string, number>,
    timeLeft: 180,
    isDead: false,
    respawnTime: 0
  });

  const findSafeSpawnPoint = (team: Team, seedIndex: number, map: number[][], currentTanks: Tank[]): Vector2 => {
    const preferred = getSpawnPoint(team, seedIndex);
    if (!checkTileCollision(preferred.x, preferred.y, map)) return preferred;
    const row = team === 'RED' ? 1 : MAP_HEIGHT - 2;
    for (let c = 1; c < MAP_WIDTH - 1; c++) {
      const candidate = { x: c * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
      if (!checkTileCollision(candidate.x, candidate.y, map)) return candidate;
    }
    return preferred;
  };

  const createParticles = (pos: Vector2, color: string, count: number, speedMult: number = 1) => {
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2 + 1) * speedMult;
      gameState.current.particles.push({
        id: Math.random().toString(),
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 30 + Math.random() * 20,
        maxLife: 50, color, size: Math.random() * 3 + 2
      });
    }
  };

  const spawnPowerUp = (s: GameState) => {
    let x = 0, y = 0, valid = false, attempts = 0;
    while(!valid && attempts < 50) {
      const c = Math.floor(Math.random() * (MAP_WIDTH - 4)) + 2;
      const r = Math.floor(Math.random() * (MAP_HEIGHT - 4)) + 2;
      if (s.map[r][c] === 0) { x = c * TILE_SIZE + TILE_SIZE / 2; y = r * TILE_SIZE + TILE_SIZE / 2; valid = true; }
      attempts++;
    }
    if (valid) {
      const types: PowerUpType[] = ['RAPID_FIRE', 'SHIELD', 'SPEED', 'DAMAGE'];
      s.powerUps.push({
        id: Math.random().toString(),
        type: types[Math.floor(Math.random() * types.length)],
        position: { x, y }, lifeTime: POWERUP_DURATION
      });
    }
  };

  const fireBullet = (tank: Tank) => {
    if (tank.cooldown > 0) return;
    const turretLen = 22;
    const bullet: Bullet = {
      id: Math.random().toString(), ownerId: tank.id, team: tank.team,
      position: { 
        x: tank.position.x + Math.cos(tank.turretRotation) * turretLen, 
        y: tank.position.y + Math.sin(tank.turretRotation) * turretLen 
      },
      velocity: { x: Math.cos(tank.turretRotation) * BULLET_SPEED, y: Math.sin(tank.turretRotation) * BULLET_SPEED },
      damage: !!tank.activePowerUps['DAMAGE'] ? 20 : 10, radius: BULLET_RADIUS
    };
    gameState.current.bullets.push(bullet);
    // Cooldown is 30 by default, reduced to 6 for rapid fire
    tank.cooldown = !!tank.activePowerUps['RAPID_FIRE'] ? 6 : FIRE_COOLDOWN;
    tank.stats.shotsFired++;
    audioRef.current.playShoot();
  };

  const respawnTank = (tank: Tank) => {
    tank.position = findSafeSpawnPoint(tank.team, Math.floor(Math.random() * 10), gameState.current.map, gameState.current.tanks);
    tank.health = tank.maxHealth; tank.isDead = false; tank.activePowerUps = { 'SHIELD': 120 };
    audioRef.current.playRespawn();
    createParticles(tank.position, tank.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR, 30, 2);
  };

  const damageTank = (tank: Tank, amount: number, attackerId: string) => {
    if (tank.activePowerUps['SHIELD']) return;
    tank.health -= amount;
    if (tank.health <= 0) {
      tank.health = 0; tank.isDead = true; tank.respawnTimer = RESPAWN_TIME; tank.stats.deaths++;
      audioRef.current.playExplosion();
      createParticles(tank.position, tank.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR, 20);
      const attacker = gameState.current.tanks.find(t => t.id === attackerId);
      if (attacker && attacker.team !== tank.team) {
        attacker.stats.kills++;
        if (attacker.team === 'BLUE') gameState.current.score.BLUE++; else gameState.current.score.RED++;
      }
    }
  };

  useEffect(() => {
    const levels = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];
    gameState.current.map = JSON.parse(JSON.stringify(levels[Math.floor(Math.random() * levels.length)]));

    const playerTank: Tank = {
      id: 'p1', type: EntityType.PLAYER, team: 'BLUE', skin: playerProfile.equippedSkin,
      position: findSafeSpawnPoint('BLUE', 0, gameState.current.map, []),
      rotation: -Math.PI/2, turretRotation: -Math.PI/2, velocity: {x:0,y:0},
      health: 100, maxHealth: 100, cooldown: 0, username: playerProfile.username,
      isDead: false, respawnTimer: 0, activePowerUps: {}, stats: {kills:0,deaths:0,shotsFired:0,shotsHit:0}
    };

    const botSkins: SkinId[] = ['DEFAULT', 'CYBER', 'STEALTH', 'MECHA'];
    const tanks = [playerTank];
    for (let i = 0; i < 3; i++) {
      const team = i === 0 ? 'BLUE' : 'RED';
      tanks.push({
        id: `bot-${i}`, type: EntityType.BOT, team, skin: botSkins[Math.floor(Math.random()*4)],
        position: findSafeSpawnPoint(team, i+1, gameState.current.map, tanks),
        rotation: team === 'RED' ? Math.PI/2 : -Math.PI/2, turretRotation: team === 'RED' ? Math.PI/2 : -Math.PI/2,
        velocity: {x:0,y:0}, health: 100, maxHealth: 100, cooldown: 0, username: `BOT-${i+1}`,
        isDead: false, respawnTimer: 0, activePowerUps: {}, stats: {kills:0,deaths:0,shotsFired:0,shotsHit:0}
      });
    }
    gameState.current.tanks = tanks;

    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      update(dt);
      render();
      const p = gameState.current.tanks.find(t => t.type === EntityType.PLAYER);
      if (p) {
        setUi({
          score: { ...gameState.current.score },
          health: p.health,
          activePowerUps: { ...p.activePowerUps } as Record<string, number>,
          timeLeft: Math.ceil(gameState.current.timeLeft),
          isDead: p.isDead,
          respawnTime: Math.ceil(p.respawnTimer / 60)
        });
      }
      if (!gameState.current.isGameOver) frameRef.current = requestAnimationFrame(loop);
      else onGameOver(gameState.current.winner!);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const update = (dt: number) => {
    const s = gameState.current;
    const inputs = inputState.current;
    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.isGameOver = true;
      s.winner = s.score.BLUE > s.score.RED ? 'BLUE' : (s.score.RED > s.score.BLUE ? 'RED' : null);
    }
    if (Math.random() < 0.005) spawnPowerUp(s);

    const player = s.tanks.find(t => t.type === EntityType.PLAYER);
    if (player && !player.isDead) {
      let dx = inputs.moveVector.x;
      let dy = inputs.moveVector.y;
      if (inputs.up) dy -= 1; if (inputs.down) dy += 1;
      if (inputs.left) dx -= 1; if (inputs.right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const speed = !!player.activePowerUps['SPEED'] ? TANK_SPEED * 1.5 : TANK_SPEED;
        const mag = Math.sqrt(dx*dx + dy*dy);
        const vx = (dx/mag) * speed;
        const vy = (dy/mag) * speed;
        player.rotation = Math.atan2(vy, vx);
        if (!checkTileCollision(player.position.x + vx, player.position.y, s.map)) player.position.x += vx;
        if (!checkTileCollision(player.position.x, player.position.y + vy, s.map)) player.position.y += vy;
      }
      
      if (Math.abs(inputs.aimVector.x) > 0.1 || Math.abs(inputs.aimVector.y) > 0.1) {
        player.turretRotation = Math.atan2(inputs.aimVector.y, inputs.aimVector.x);
        inputState.current.shoot = true;
      } else {
        const mDx = inputs.mouseX - player.position.x;
        const mDy = inputs.mouseY - player.position.y;
        if (!inputs.aimVector.x) player.turretRotation = Math.atan2(mDy, mDx);
      }
      if (inputs.shoot) fireBullet(player);
    }

    s.tanks.forEach(t => {
      if (t.type === EntityType.BOT && !t.isDead) {
        const enemies = s.tanks.filter(e => e.team !== t.team && !e.isDead);
        if (enemies.length > 0) {
          const target = enemies[0];
          const dist = Math.hypot(target.position.x - t.position.x, target.position.y - t.position.y);
          const angle = Math.atan2(target.position.y - t.position.y, target.position.x - t.position.x);
          t.turretRotation = angle;
          if (dist > 180) {
            const vx = Math.cos(angle) * TANK_SPEED * 0.45;
            const vy = Math.sin(angle) * TANK_SPEED * 0.45;
            if (!checkTileCollision(t.position.x + vx, t.position.y, s.map)) t.position.x += vx;
            if (!checkTileCollision(t.position.x, t.position.y + vy, s.map)) t.position.y += vy;
            t.rotation = angle;
          }
          if (dist < 380 && t.cooldown <= 0 && Math.random() < 0.04) fireBullet(t);
        }
      }
      if (t.cooldown > 0) t.cooldown--;
      if (t.isDead) { t.respawnTimer--; if (t.respawnTimer <= 0) respawnTank(t); }
      Object.keys(t.activePowerUps).forEach(k => {
        const key = k as PowerUpType;
        if (t.activePowerUps[key]! > 0) t.activePowerUps[key]!--;
        else delete t.activePowerUps[key];
      });
      for (let i = s.powerUps.length - 1; i >= 0; i--) {
        if (checkTankPowerUpCollision(t, s.powerUps[i])) {
          t.activePowerUps[s.powerUps[i].type] = POWERUP_DURATION;
          audioRef.current.playPowerUp(); s.powerUps.splice(i, 1);
        }
      }
    });

    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i];
      b.position.x += b.velocity.x; b.position.y += b.velocity.y;
      const hit = checkBulletMapCollision(b, s.map);
      if (hit.hit) {
        if (hit.tileType === TILE_BRICK) { s.map[hit.r][hit.c] = 0; audioRef.current.playExplosion(); }
        s.bullets.splice(i, 1); continue;
      }
      for (const t of s.tanks) {
        if (checkBulletTankCollision(b, t)) {
          damageTank(t, b.damage, b.ownerId); s.bullets.splice(i, 1); break;
        }
      }
      if (b.position.x < -100 || b.position.x > CANVAS_WIDTH + 100 || b.position.y < -100 || b.position.y > CANVAS_HEIGHT + 100) {
        s.bullets.splice(i, 1);
      }
    }
    s.powerUps.forEach((p, i) => { p.lifeTime--; if (p.lifeTime <= 0) s.powerUps.splice(i, 1); });
    s.particles.forEach((p, i) => {
      p.position.x += p.velocity.x; p.position.y += p.velocity.y; p.life--;
      if (p.life <= 0) s.particles.splice(i, 1);
    });
  };

  const render = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const s = gameState.current;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Background Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke(); }
    for (let i = 0; i < CANVAS_HEIGHT; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke(); }

    for (let r = 0; r < s.map.length; r++) {
      for (let c = 0; c < s.map[r].length; c++) {
        const t = s.map[r][c]; if (t === 0) continue;
        const x = c * TILE_SIZE, y = r * TILE_SIZE;
        if (t === TILE_BRICK) { 
          ctx.fillStyle = '#92400e'; ctx.fillRect(x+2,y+2,TILE_SIZE-4,TILE_SIZE-4);
          ctx.fillStyle = '#78350f'; ctx.fillRect(x+6,y+6,TILE_SIZE-12,TILE_SIZE-12);
        }
        else if (t === TILE_STEEL) { 
          ctx.fillStyle = '#475569'; ctx.fillRect(x+1,y+1,TILE_SIZE-2,TILE_SIZE-2);
          ctx.fillStyle = '#cbd5e1'; ctx.fillRect(x+10,y+10,TILE_SIZE-20,TILE_SIZE-20);
        }
        else if (t === TILE_WATER) { ctx.fillStyle = '#0ea5e966'; ctx.fillRect(x,y,TILE_SIZE,TILE_SIZE); }
      }
    }

    s.powerUps.forEach(p => {
      const color = p.type === 'SHIELD' ? '#22d3ee' : p.type === 'SPEED' ? '#4ade80' : p.type === 'RAPID_FIRE' ? '#fbbf24' : '#f87171';
      ctx.shadowBlur = 10; ctx.shadowColor = color;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.position.x, p.position.y, 10, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    s.particles.forEach(p => {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      ctx.fillRect(p.position.x, p.position.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    s.tanks.forEach(t => {
      if (t.isDead) return;
      ctx.save(); ctx.translate(t.position.x, t.position.y);
      if (t.activePowerUps['SHIELD']) {
        ctx.beginPath(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3;
        ctx.arc(0, 0, TANK_SIZE - 2, 0, Math.PI*2); ctx.stroke();
      }
      ctx.rotate(t.rotation);
      const accent = t.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR;
      ctx.fillStyle = t.team === 'BLUE' ? '#1e3a8a' : '#7f1d1d';
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28);
      ctx.restore();

      ctx.save(); ctx.translate(t.position.x, t.position.y); ctx.rotate(t.turretRotation);
      
      // FIRE RATE COOLDOWN RING (Depleting)
      const maxCD = t.activePowerUps['RAPID_FIRE'] ? 6 : FIRE_COOLDOWN;
      if (t.cooldown > 0) {
          const ratio = t.cooldown / maxCD;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 3;
          // Draw arc around base of turret
          ctx.arc(0, 0, 15, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * ratio));
          ctx.stroke();
      }

      // Turret Glow for RAPID_FIRE
      if (t.activePowerUps['RAPID_FIRE']) {
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 15;
      }

      ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, -5, 24, 10);
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'white'; ctx.font = 'bold 12px Rajdhani'; ctx.textAlign = 'center';
      ctx.fillText(t.username, t.position.x, t.position.y - 35);
    });

    s.bullets.forEach(b => {
      ctx.fillStyle = b.team === 'BLUE' ? '#67e8f9' : '#fda4af';
      ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 4, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 5; ctx.shadowColor = ctx.fillStyle;
    });
    ctx.shadowBlur = 0;
  };

  const handleJoystickMove = useCallback((x: number, y: number) => {
    audioRef.current.resume(); inputState.current.moveVector = { x, y };
  }, []);
  const handleJoystickAim = useCallback((x: number, y: number) => {
    audioRef.current.resume(); inputState.current.aimVector = { x, y };
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-[#020617] overflow-hidden select-none touch-none">
      
      {/* Dynamic Background Warning Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-10 transition-opacity duration-300"
        style={{ boxShadow: 'inset 0 0 120px rgba(239, 68, 68, 0.5)', opacity: ui.health < 30 ? 1 : 0 }}
      />

      {/* --- HUD TOP --- */}
      <div className="flex items-center justify-center px-6 pt-[var(--sat)] h-20 pointer-events-none z-30">
        <div className="flex items-center gap-6 bg-slate-900/95 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-cyan-500 font-black uppercase tracking-widest">BLUE</span>
            <span className="text-white font-black text-2xl">{ui.score.BLUE}</span>
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center">TIMER</span>
            <span className="font-mono text-cyan-400 font-black text-xl">
              {Math.floor(Number(ui.timeLeft) / 60)}:{(Number(ui.timeLeft) % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-red-500 font-black uppercase tracking-widest">RED</span>
            <span className="text-white font-black text-2xl">{ui.score.RED}</span>
          </div>
        </div>
      </div>

      {/* --- GAME ARENA --- */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-2">
        <div className="relative w-full h-full max-w-[450px] aspect-[9/16] bg-black shadow-2xl rounded-sm border border-white/5 overflow-hidden">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain" />
          
          {/* Internal Overlays */}
          {ui.isDead && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="text-center p-10 bg-slate-900/90 border border-red-500/30 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.2)] scale-110">
                <h2 className="text-red-500 text-3xl font-black mb-2 font-heading tracking-tighter italic underline decoration-red-500/50 underline-offset-8 uppercase">Unit Destroyed</h2>
                <p className="text-white/40 mb-6 font-mono text-sm tracking-widest animate-pulse">RE-ESTABLISHING NEURAL LINK...</p>
                <div className="relative flex items-center justify-center">
                   <div className="absolute w-24 h-24 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin"></div>
                   <div className="text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{ui.respawnTime}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- CONTROLS AREA --- */}
      <div className="flex flex-col h-64 pb-[var(--sab)] px-6 relative z-50 bg-slate-950/40 backdrop-blur-sm border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        
        {/* Health Bar & Power-ups (Bottom Center) */}
        <div className="flex flex-col items-center -translate-y-8 pointer-events-none">
           <div className="flex items-center justify-center gap-4 mb-3">
              {Object.entries(ui.activePowerUps).map(([type, frames]) => (
                <div key={type} className="flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-xl border border-white/20 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-300">
                  <div className="flex items-center justify-center p-1 bg-white/5 rounded-lg">
                    <PowerUpIcon type={type as PowerUpType} />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-tighter">{type.replace('_', ' ')}</span>
                    <span className="text-xs font-black text-white">{(Number(frames) / 60).toFixed(1)}s</span>
                  </div>
                </div>
              ))}
           </div>

           <div className="w-64 h-3.5 bg-slate-900 rounded-full border border-white/30 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,1)] ring-4 ring-black/60 relative">
              <div 
                className={`h-full transition-all duration-300 ${ui.health < 30 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-cyan-400 to-blue-600'}`}
                style={{ width: `${ui.health}%` }}
              />
              {/* Subtle glass overlay on health bar */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
           </div>
           <div className="text-[10px] text-center text-white/60 font-black mt-2 tracking-[0.4em] uppercase drop-shadow-md">Unit Integrity</div>
        </div>

        {/* Joystick Layout */}
        <div className="flex-1 flex items-center justify-between -mt-8">
          <div className="transform scale-110 active:scale-105 transition-transform">
            <VirtualJoystick onMove={handleJoystickMove} label="MOVE" size={150} color="blue" />
          </div>
          <div className="transform scale-110 active:scale-105 transition-transform">
            <VirtualJoystick onMove={handleJoystickAim} label="AIM & FIRE" size={150} color="red" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default GameEngine;