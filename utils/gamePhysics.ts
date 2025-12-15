import { 
  TILE_SIZE, TANK_HITBOX, BULLET_RADIUS, TILE_BRICK, TILE_STEEL, TILE_WATER, 
  MAP_WIDTH, MAP_HEIGHT, POWERUP_SIZE
} from '../constants';
import { Tank, Vector2, Bullet, PowerUp } from '../types';

/**
 * AABB Collision for Tank vs Tile.
 * Uses a small buffer (epsilon) to prevent floating-point precision issues
 * from making the tank feel "sticky" when touching walls.
 */
export const checkTileCollision = (x: number, y: number, map: number[][]): boolean => {
  const epsilon = 0.5; // Small buffer for smoother sliding
  const halfSize = (TANK_HITBOX / 2) - epsilon;

  const left = Math.floor((x - halfSize) / TILE_SIZE);
  const right = Math.floor((x + halfSize) / TILE_SIZE);
  const top = Math.floor((y - halfSize) / TILE_SIZE);
  const bottom = Math.floor((y + halfSize) / TILE_SIZE);

  // Map Boundary Checks
  if (x - halfSize < 0 || x + halfSize >= MAP_WIDTH * TILE_SIZE || 
      y - halfSize < 0 || y + halfSize >= MAP_HEIGHT * TILE_SIZE) {
    return true;
  }

  // Iterate through potentially colliding tiles
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r < 0 || r >= MAP_HEIGHT || c < 0 || c >= MAP_WIDTH) continue;
      
      const tile = map[r][c];
      // Blocks that prevent movement (Brick, Steel, Water)
      if (tile === TILE_BRICK || tile === TILE_STEEL || tile === TILE_WATER) {
        return true;
      }
    }
  }
  return false;
};

// Circle vs Rect (Bullet vs Tile)
export const checkBulletMapCollision = (bullet: Bullet, map: number[][]): { hit: boolean, tileType: number, c: number, r: number } => {
  const c = Math.floor(bullet.position.x / TILE_SIZE);
  const r = Math.floor(bullet.position.y / TILE_SIZE);

  if (c < 0 || c >= MAP_WIDTH || r < 0 || r >= MAP_HEIGHT) return { hit: true, tileType: TILE_STEEL, c, r };

  const tile = map[r]?.[c];
  if (tile === TILE_BRICK || tile === TILE_STEEL) {
    return { hit: true, tileType: tile, c, r };
  }
  return { hit: false, tileType: 0, c: -1, r: -1 };
};

// Circle vs Circle (Bullet vs Tank)
export const checkBulletTankCollision = (bullet: Bullet, tank: Tank): boolean => {
  if (tank.isDead || bullet.ownerId === tank.id || bullet.team === tank.team) return false;
  
  const dx = bullet.position.x - tank.position.x;
  const dy = bullet.position.y - tank.position.y;
  const distSq = dx * dx + dy * dy;
  const combinedRadius = BULLET_RADIUS + (TANK_HITBOX / 2);
  
  return distSq < (combinedRadius * combinedRadius);
};

// Circle vs Circle (Tank vs PowerUp)
export const checkTankPowerUpCollision = (tank: Tank, powerUp: PowerUp): boolean => {
  if (tank.isDead) return false;
  const dx = tank.position.x - powerUp.position.x;
  const dy = tank.position.y - powerUp.position.y;
  const distSq = dx * dx + dy * dy;
  const combinedRadius = (TANK_HITBOX / 2) + (POWERUP_SIZE / 2);

  return distSq < (combinedRadius * combinedRadius);
};

export const getSpawnPoint = (team: 'BLUE' | 'RED', index: number): Vector2 => {
    const xOffsets = [7, 3, 11, 5, 9, 2, 12]; 
    const xTile = xOffsets[index % xOffsets.length];
    
    if (team === 'RED') {
        return { 
            x: xTile * TILE_SIZE + (TILE_SIZE / 2), 
            y: 1 * TILE_SIZE + (TILE_SIZE / 2) 
        };
    } else {
        return {
            x: xTile * TILE_SIZE + (TILE_SIZE / 2),
            y: (MAP_HEIGHT - 2) * TILE_SIZE + (TILE_SIZE / 2)
        };
    }
}