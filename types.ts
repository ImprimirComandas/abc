export type Team = 'BLUE' | 'RED';

export enum EntityType {
  PLAYER,
  BOT,
  BULLET,
  WALL_BRICK,
  WALL_STEEL,
  WATER,
  POWERUP
}

export type PowerUpType = 'RAPID_FIRE' | 'SHIELD' | 'SPEED' | 'DAMAGE';

export type SkinId = 'DEFAULT' | 'CYBER' | 'STEALTH' | 'MECHA';

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerProfile {
  username: string;
  color: string;
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  battlePoints: number;
}

export interface RoomData {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  isPrivate: boolean;
  status: 'WAITING' | 'PLAYING';
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Vector2;
  lifeTime: number; // Disappear after some time if not collected
}

export interface Tank {
  id: string;
  type: EntityType.PLAYER | EntityType.BOT;
  team: Team;
  skin: SkinId;
  position: Vector2;
  rotation: number; // Body rotation in radians
  turretRotation: number; // Turret rotation in radians
  velocity: Vector2;
  health: number;
  maxHealth: number;
  cooldown: number;
  username: string;
  isDead: boolean;
  respawnTimer: number;
  activePowerUps: Partial<Record<PowerUpType, number>>; // Type -> Frames remaining
  stats: {
    kills: number;
    deaths: number;
    shotsFired: number;
    shotsHit: number;
  };
}

export interface Bullet {
  id: string;
  ownerId: string;
  team: Team;
  position: Vector2;
  velocity: Vector2;
  damage: number;
  radius: number;
}

export interface Particle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'NORMAL' | 'SMOKE' | 'GLOW';
}

export interface GameState {
  tanks: Tank[];
  bullets: Bullet[];
  particles: Particle[];
  powerUps: PowerUp[];
  map: number[][]; // 0: Empty, 1: Brick, 2: Steel, 3: Water
  score: {
    BLUE: number;
    RED: number;
  };
  timeLeft: number;
  isGameOver: boolean;
  winner: Team | null;
}

export interface InputState {
  // Boolean for Keyboard
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  // Vector for Joysticks
  moveVector: { x: number, y: number };
  aimVector: { x: number, y: number };
  // Mouse fallback
  mouseX: number;
  mouseY: number;
}