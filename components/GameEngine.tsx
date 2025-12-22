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
  onGameOver: (winner: Team, earnedBP: number) => void;
  onUpdateSkin?: (skin: SkinId) => void;
  onUnlockSkin?: (skin: SkinId) => void;
}

const PowerUpHUDItem: React.FC<{ type: PowerUpType, frames: number }> = ({ type, frames }) => {
  const seconds = (frames / 60).toFixed(1);
  
  const getIcon = () => {
    switch (type) {
      case 'SHIELD': 
        return (
          <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 17.9c-3.7-.93-6-4.72-6-8.81V6.3l6-2.25 6 2.25v4.79c0 4.09-2.3 7.88-6 8.81z" />
        );
      case 'RAPID_FIRE': 
        return (
          <path d="M7 2v11h3v9l7-12h-4l4-8H7z" />
        );
      case 'SPEED': 
        return (
          <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
        );
      case 'DAMAGE': 
        return (
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        );
      default: return null;
    }
  };

  const colors = {
    'SHIELD': 'text-cyan-400 border-cyan-500/50 shadow-cyan-500/20',
    'RAPID_FIRE': 'text-orange-400 border-orange-500/50 shadow-orange-500/20',
    'SPEED': 'text-green-400 border-green-500/50 shadow-green-500/20',
    'DAMAGE': 'text-red-400 border-red-500/50 shadow-red-500/20'
  };

  return (
    <div className={`flex items-center gap-1.5 bg-black/80 px-2 py-1 rounded-md border backdrop-blur-md ${colors[type]} animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        {getIcon()}
      </svg>
      <span className="text-[10px] font-black font-mono tabular-nums tracking-tighter">{seconds}s</span>
    </div>
  );
};

class AudioController {
    ctx: AudioContext | null = null;
    engineOsc: OscillatorNode | null = null;
    engineGain: GainNode | null = null;

    constructor() {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = AudioContextClass ? new AudioContextClass() : null;
      } catch (e) { console.warn("AudioContext unsupported"); }
    }
    
    resume() { 
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); 
    }

    setEngine(active: boolean) {
      if (!this.ctx) return;
      if (active) {
        if (!this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineGain = this.ctx.createGain();
          this.engineOsc.type = 'sawtooth';
          this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
          this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
          this.engineOsc.connect(this.engineGain);
          this.engineGain.connect(this.ctx.destination);
          this.engineOsc.start();
        }
        this.engineGain?.gain.setTargetAtTime(0.04, this.ctx.currentTime, 0.1);
        this.engineOsc.frequency.setTargetAtTime(55, this.ctx.currentTime, 0.1);
      } else {
        this.engineGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.engineOsc?.frequency.setTargetAtTime(45, this.ctx.currentTime, 0.2);
      }
    }

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
    playRespawn() { this.playTone(200, 'sine', 0.5, 0.15); this.playTone(600, 'sine', 0.5, 0.05); }
}

const GameEngine: React.FC<GameEngineProps> = ({ playerProfile, onGameOver, onUpdateSkin, onUnlockSkin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioController>(new AudioController());
  const frameRef = useRef<number>(0);
  const earnedBPRef = useRef<number>(0);
  
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
    respawnTime: 0,
    earnedBP: 0
  });

  const [isGarageOpen, setIsGarageOpen] = useState(false);

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

  const createParticles = (pos: Vector2, color: string, count: number, speedMult: number = 1, type: 'NORMAL' | 'SMOKE' | 'GLOW' = 'NORMAL') => {
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 2 + 1) * speedMult;
      gameState.current.particles.push({
        id: Math.random().toString(),
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: type === 'SMOKE' ? 15 + Math.random() * 15 : (type === 'GLOW' ? 40 + Math.random() * 20 : 30 + Math.random() * 20),
        maxLife: type === 'SMOKE' ? 30 : (type === 'GLOW' ? 60 : 50), 
        color, 
        size: type === 'GLOW' ? Math.random() * 10 + 5 : Math.random() * 3 + 2,
        type
      });
    }
  };

  const createRespawnEffect = (pos: Vector2, color: string) => {
    // Neon Shockwave particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      gameState.current.particles.push({
        id: Math.random().toString(),
        position: { ...pos },
        velocity: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 },
        life: 30, maxLife: 30, color, size: 4, type: 'GLOW'
      });
    }
    // Center burst
    createParticles(pos, color, 40, 2.5, 'GLOW');
    audioRef.current.playRespawn();
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
    tank.cooldown = !!tank.activePowerUps['RAPID_FIRE'] ? 8 : FIRE_COOLDOWN;
    tank.stats.shotsFired++;
    audioRef.current.playShoot();
  };

  const respawnTank = (tank: Tank) => {
    tank.position = findSafeSpawnPoint(tank.team, Math.floor(Math.random() * 10), gameState.current.map, gameState.current.tanks);
    tank.health = tank.maxHealth; tank.isDead = false; tank.activePowerUps = { 'SHIELD': 120 };
    tank.skin = playerProfile.equippedSkin; 
    createRespawnEffect(tank.position, tank.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR);
    setIsGarageOpen(false);
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
        if (attacker.type === EntityType.PLAYER) {
          earnedBPRef.current += 100;
        }
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

    const botSkinPool: SkinId[] = ['DEFAULT', 'CYBER', 'STEALTH', 'MECHA'];
    const tanks = [playerTank];
    for (let i = 0; i < 3; i++) {
      const team = i === 0 ? 'BLUE' : 'RED';
      tanks.push({
        id: `bot-${i}`, type: EntityType.BOT, team, skin: botSkinPool[Math.floor(Math.random() * botSkinPool.length)],
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
          respawnTime: Math.ceil(p.respawnTimer / 60),
          earnedBP: earnedBPRef.current
        });
      }
      if (!gameState.current.isGameOver) frameRef.current = requestAnimationFrame(loop);
      else onGameOver(gameState.current.winner!, earnedBPRef.current);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameRef.current);
      audioRef.current.setEngine(false);
    }
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
      
      if (dx !== 0 || dy !== 0) {
        audioRef.current.setEngine(true);
        const speed = !!player.activePowerUps['SPEED'] ? TANK_SPEED * 1.5 : TANK_SPEED;
        const mag = Math.sqrt(dx*dx + dy*dy);
        const vx = (dx/mag) * speed;
        const vy = (dy/mag) * speed;
        player.rotation = Math.atan2(vy, vx);
        
        if (!checkTileCollision(player.position.x + vx, player.position.y, s.map)) player.position.x += vx;
        if (!checkTileCollision(player.position.x, player.position.y + vy, s.map)) player.position.y += vy;
        
        if (player.skin === 'MECHA' && Math.random() < 0.2) {
          const exhaustX = player.position.x - Math.cos(player.rotation) * 15;
          const exhaustY = player.position.y - Math.sin(player.rotation) * 15;
          createParticles({ x: exhaustX, y: exhaustY }, '#475569', 1, 0.5, 'SMOKE');
        }
      } else {
        audioRef.current.setEngine(false);
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
    } else {
      audioRef.current.setEngine(false);
    }

    s.tanks.forEach(t => {
      if (t.type === EntityType.BOT && !t.isDead) {
        const enemies = s.tanks.filter(e => e.team !== t.team && !e.isDead);
        if (enemies.length > 0) {
          const target = enemies[0];
          const dist = Math.hypot(target.position.x - t.position.x, target.position.y - t.position.y);
          const angle = Math.atan2(target.position.y - t.position.y, target.position.x - t.position.x);
          t.turretRotation = angle;
          if (dist > 150) {
            const vx = Math.cos(angle) * TANK_SPEED * 0.4;
            const vy = Math.sin(angle) * TANK_SPEED * 0.4;
            if (!checkTileCollision(t.position.x + vx, t.position.y, s.map)) t.position.x += vx;
            if (!checkTileCollision(t.position.x, t.position.y + vy, s.map)) t.position.y += vy;
            t.rotation = angle;
            
            if (t.skin === 'MECHA' && Math.random() < 0.1) {
              const exX = t.position.x - Math.cos(t.rotation) * 15;
              const exY = t.position.y - Math.sin(t.rotation) * 15;
              createParticles({ x: exX, y: exY }, '#475569', 1, 0.3, 'SMOKE');
            }
          }
          if (dist < 400 && t.cooldown <= 0 && Math.random() < 0.05) fireBullet(t);
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
        else { audioRef.current.playTone(400, 'sine', 0.05, 0.02); } 
        s.bullets.splice(i, 1); continue;
      }
      for (const t of s.tanks) {
        if (checkBulletTankCollision(b, t)) {
          damageTank(t, b.damage, b.ownerId); s.bullets.splice(i, 1); break;
        }
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
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke(); }
    for (let i = 0; i < CANVAS_HEIGHT; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke(); }

    for (let r = 0; r < s.map.length; r++) {
      for (let c = 0; c < s.map[r].length; c++) {
        const t = s.map[r][c]; if (t === 0) continue;
        const x = c * TILE_SIZE, y = r * TILE_SIZE;
        if (t === TILE_BRICK) { ctx.fillStyle = '#92400e'; ctx.fillRect(x+2,y+2,TILE_SIZE-4,TILE_SIZE-4); }
        else if (t === TILE_STEEL) { ctx.fillStyle = '#475569'; ctx.fillRect(x+1,y+1,TILE_SIZE-2,TILE_SIZE-2); }
        else if (t === TILE_WATER) { ctx.fillStyle = '#0ea5e966'; ctx.fillRect(x,y,TILE_SIZE,TILE_SIZE); }
      }
    }

    s.powerUps.forEach(p => {
      const color = p.type === 'SHIELD' ? '#22d3ee' : p.type === 'SPEED' ? '#4ade80' : p.type === 'RAPID_FIRE' ? '#fbbf24' : '#f87171';
      ctx.shadowBlur = 15; ctx.shadowColor = color;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.position.x, p.position.y, 10, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    s.particles.forEach(p => {
      ctx.globalAlpha = p.life/p.maxLife; ctx.fillStyle = p.color;
      if (p.type === 'SMOKE' || p.type === 'GLOW') {
          if (p.type === 'GLOW') { ctx.shadowBlur = p.size; ctx.shadowColor = p.color; }
          ctx.beginPath(); ctx.arc(p.position.x, p.position.y, p.size / 2, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
      } else {
          ctx.fillRect(p.position.x, p.position.y, p.size, p.size);
      }
    });
    ctx.globalAlpha = 1;

    s.tanks.forEach(t => {
      if (t.isDead) return;
      ctx.save(); ctx.translate(t.position.x, t.position.y);
      
      if (t.activePowerUps['SHIELD']) {
        ctx.beginPath(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
        ctx.arc(0, 0, TANK_SIZE + 2, 0, Math.PI*2); ctx.stroke();
      }

      ctx.save();
      ctx.rotate(t.rotation);
      const teamColor = t.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR;
      const bodyColor = t.team === 'BLUE' ? '#1e3a8a' : '#7f1d1d';
      
      if (t.skin === 'CYBER') {
          ctx.fillStyle = '#000';
          ctx.fillRect(-14, -14, 28, 28);
          ctx.strokeStyle = teamColor;
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 10; ctx.shadowColor = teamColor;
          ctx.strokeRect(-14, -14, 28, 28);
          ctx.shadowBlur = 0;
          const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.2 + pulse * 0.4;
          ctx.beginPath();
          ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
          ctx.moveTo(0, -14); ctx.lineTo(0, 14);
          ctx.stroke();
          ctx.globalAlpha = 1;
          const scanY = (Date.now() / 5) % 28 - 14;
          ctx.fillStyle = teamColor; ctx.globalAlpha = 0.3;
          ctx.fillRect(-14, scanY, 28, 2); ctx.globalAlpha = 1;
      } else if (t.skin === 'STEALTH') {
          const camoAlpha = 0.5 + ((Math.sin(Date.now() / 400) + 1) / 2) * 0.3;
          ctx.globalAlpha = camoAlpha;
          ctx.fillStyle = '#1e293b'; 
          ctx.fillRect(-14, -14, 28, 28);
          ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.strokeRect(-14, -14, 28, 28);
          ctx.fillStyle = teamColor;
          ctx.fillRect(-14, -14, 4, 4); ctx.fillRect(10, -14, 4, 4);
          ctx.fillRect(-14, 10, 4, 4); ctx.fillRect(10, 10, 4, 4);
          ctx.globalAlpha = 1;
      } else if (t.skin === 'MECHA') {
          ctx.fillStyle = '#475569'; 
          ctx.fillRect(-14, -14, 28, 28);
          ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28);
          ctx.fillStyle = teamColor;
          ctx.shadowBlur = 5; ctx.shadowColor = teamColor;
          ctx.fillRect(-6, -6, 12, 12);
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(-12, -12, 3, 3); ctx.fillRect(9, -12, 3, 3);
          ctx.fillRect(-12, 9, 3, 3); ctx.fillRect(9, 9, 3, 3);
          ctx.fillRect(-14, -4, 4, 8); ctx.fillRect(10, -4, 4, 8);
      } else {
          ctx.fillStyle = bodyColor;
          ctx.fillRect(-14, -14, 28, 28);
          ctx.strokeStyle = teamColor; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28);
          ctx.fillStyle = teamColor;
          ctx.globalAlpha = 0.3; ctx.fillRect(-7, -7, 14, 14); ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.save(); 
      ctx.rotate(t.turretRotation);
      
      const maxCD = t.activePowerUps['RAPID_FIRE'] ? 8 : FIRE_COOLDOWN;
      
      const indicatorRadius = 18;
      if (t.cooldown > 0) {
        const progress = t.cooldown / maxCD;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 4;
        ctx.arc(0, 0, indicatorRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = t.team === 'BLUE' ? TEAM_BLUE_COLOR : TEAM_RED_COLOR;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.arc(0, 0, indicatorRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        const currentAngle = -Math.PI / 2 + (Math.PI * 2 * progress);
        ctx.arc(0, 0, indicatorRadius, currentAngle - 0.2, currentAngle);
        ctx.stroke();
      } else {
        const readyPulse = (Math.sin(Date.now() / 120) + 1) / 2;
        ctx.shadowBlur = 8 + readyPulse * 15;
        ctx.shadowColor = teamColor;
        ctx.beginPath();
        ctx.strokeStyle = teamColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.1 + (readyPulse * 0.3);
        ctx.arc(0, 0, indicatorRadius + 2 + readyPulse * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      if (t.activePowerUps['RAPID_FIRE']) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fbbf24';
      }

      ctx.fillStyle = (t.skin === 'STEALTH') ? '#0f172a' : (t.skin === 'CYBER' ? '#000' : (t.skin === 'MECHA' ? '#334155' : '#94a3b8'));
      if (t.skin === 'CYBER') {
          ctx.strokeStyle = teamColor; ctx.lineWidth = 1;
          ctx.strokeRect(0, -5, 24, 10); ctx.fillRect(0, -5, 24, 10);
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else {
          ctx.fillRect(0, -5, 24, 10);
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = 'white'; ctx.font = 'bold 12px Rajdhani'; ctx.textAlign = 'center';
      ctx.fillText(t.username, 0, -35);
      ctx.restore();
    });

    s.bullets.forEach(b => {
      ctx.fillStyle = b.team === 'BLUE' ? '#67e8f9' : '#fda4af';
      ctx.beginPath(); ctx.arc(b.position.x, b.position.y, 4, 0, Math.PI*2); ctx.fill();
    });
  };

  const handleJoystickMove = useCallback((x: number, y: number) => {
    audioRef.current.resume(); inputState.current.moveVector = { x, y };
  }, []);
  const handleJoystickAim = useCallback((x: number, y: number) => {
    audioRef.current.resume(); inputState.current.aimVector = { x, y };
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-[#020617] overflow-hidden select-none touch-none">
      
      <div 
        className="fixed inset-0 pointer-events-none z-10 transition-opacity duration-300"
        style={{ 
          boxShadow: 'inset 0 0 100px rgba(239, 68, 68, 0.6)', 
          opacity: ui.health < 30 ? (0.4 + Math.sin(Date.now()/100)*0.2) : 0 
        }}
      />

      {/* --- REFACTORED MOBILE HUD TOP --- */}
      <div className="fixed top-0 left-0 w-full px-4 pt-[var(--sat)] h-20 flex items-center justify-between pointer-events-none z-30">
        
        {/* Battle Points & Player Status (Left) */}
        <div className="flex flex-col gap-1.5 bg-slate-900/80 backdrop-blur-lg border border-white/5 p-2 rounded-xl shadow-xl min-w-[90px]">
           <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-orange-400">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
              </svg>
              <span className="text-[10px] font-mono font-black text-white">{ui.earnedBP + playerProfile.battlePoints} BP</span>
           </div>
           <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${ui.health < 30 ? 'bg-red-500' : 'bg-cyan-500'}`} 
                style={{ width: `${ui.health}%` }}
              />
           </div>
        </div>

        {/* Unified Match Header (Center) */}
        <div className="flex items-center bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-2xl gap-3">
          <span className="text-cyan-400 font-black text-lg">{ui.score.BLUE}</span>
          <div className="flex flex-col items-center">
             <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Time</span>
             <span className={`font-mono font-black text-sm leading-tight ${ui.timeLeft < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {Math.floor(Number(ui.timeLeft) / 60)}:{(Number(ui.timeLeft) % 60).toString().padStart(2, '0')}
             </span>
          </div>
          <span className="text-red-500 font-black text-lg">{ui.score.RED}</span>
        </div>

        <div className="w-20" /> 
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full max-w-[450px] aspect-[9/16] bg-black shadow-inner overflow-hidden border-x border-white/5">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain" />
          
          {ui.isDead && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="text-center p-8 bg-slate-900/95 border border-red-500/50 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                <h2 className="text-red-500 text-xl font-black mb-1 font-heading uppercase tracking-tighter">System Offline</h2>
                <div className="text-6xl font-black text-white font-mono mb-4">{ui.respawnTime}</div>
                <button 
                  onClick={() => setIsGarageOpen(true)}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg shadow-cyan-500/30 transition-all uppercase tracking-widest text-xs"
                >
                  Quick Garage
                </button>
              </div>

              {isGarageOpen && (
                <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col p-6 animate-in slide-in-from-bottom duration-300">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-cyan-400 font-black tracking-tighter text-2xl font-heading">GARAGE</h3>
                      <button onClick={() => setIsGarageOpen(false)} className="text-white/40 hover:text-white uppercase text-[10px] font-black tracking-widest">Close</button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto space-y-3">
                      {Object.keys(SKINS).map(skinId => {
                         const id = skinId as SkinId;
                         const skin = SKINS[id];
                         const isUnlocked = playerProfile.unlockedSkins.includes(id);
                         const isEquipped = playerProfile.equippedSkin === id;
                         const canAfford = (playerProfile.battlePoints + earnedBPRef.current) >= skin.price;

                         return (
                            <div key={id} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${isEquipped ? 'bg-cyan-500/10 border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                               <div className="flex flex-col">
                                  <span className={`font-black text-sm tracking-tight ${isEquipped ? 'text-cyan-400' : 'text-white'}`}>{skin.name}</span>
                                  <span className="text-[10px] text-white/40 italic">{skin.description}</span>
                               </div>
                               <div>
                                  {isUnlocked ? (
                                     <button 
                                      disabled={isEquipped}
                                      onClick={() => onUpdateSkin?.(id)}
                                      className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${isEquipped ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
                                     >
                                        {isEquipped ? 'Equipped' : 'Select'}
                                     </button>
                                  ) : (
                                     <button 
                                      disabled={!canAfford}
                                      onClick={() => onUnlockSkin?.(id)}
                                      className={`px-4 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${canAfford ? 'bg-orange-500 text-black hover:bg-orange-400' : 'bg-slate-800 text-white/20'}`}
                                     >
                                        Unlock {skin.price} BP
                                     </button>
                                  )}
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- REFACTORED MOBILE CONTROLS --- */}
      <div className="relative h-72 pb-[var(--sab)] flex flex-col items-center justify-end z-50">
        
        {/* Tactical Overlay (Active Items) */}
        <div className="absolute top-0 w-full px-6 pointer-events-none">
           <div className="flex flex-wrap justify-center gap-2 h-10 items-center">
              {Object.entries(ui.activePowerUps).length > 0 ? (
                Object.entries(ui.activePowerUps).map(([type, frames]) => (
                  <PowerUpHUDItem key={type} type={type as PowerUpType} frames={Number(frames)} />
                ))
              ) : (
                <span className="text-[8px] text-white/10 uppercase tracking-[0.4em] font-black">System Nominal</span>
              )}
           </div>
        </div>

        {/* Ergonimic Joysticks */}
        <div className="w-full h-full flex items-center justify-between px-8 pt-6">
          <div className="flex flex-col items-center gap-2">
            <VirtualJoystick onMove={handleJoystickMove} size={155} color="blue" />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <VirtualJoystick onMove={handleJoystickAim} size={155} color="red" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default GameEngine;