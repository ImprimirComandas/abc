import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  color?: 'blue' | 'red';
  label?: string;
  size?: number;
}

const VirtualJoystick: React.FC<VirtualJoystickProps> = React.memo(({ 
  onMove, 
  color = 'blue', 
  label,
  size = 140 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const VISUAL_RADIUS = size / 2;
  const STICK_RADIUS = size * 0.25;
  const MAX_DISTANCE = VISUAL_RADIUS - (STICK_RADIUS / 2);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      setStickPos({ x: 0, y: 0 });
      onMove(0, 0);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const clampedDistance = Math.min(distance, MAX_DISTANCE);
    
    const nx = Math.cos(angle) * clampedDistance;
    const ny = Math.sin(angle) * clampedDistance;
    
    setStickPos({ x: nx, y: ny });
    onMove(nx / MAX_DISTANCE, ny / MAX_DISTANCE);
  }, [MAX_DISTANCE, onMove]);

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (activePointerId.current === e.pointerId) {
        updatePosition(e.clientX, e.clientY);
      }
    };

    const handleGlobalUp = (e: PointerEvent) => {
      if (activePointerId.current === e.pointerId) {
        activePointerId.current = null;
        setActive(false);
        setStickPos({ x: 0, y: 0 });
        onMove(0, 0);
      }
    };

    if (active) {
      window.addEventListener('pointermove', handleGlobalMove);
      window.addEventListener('pointerup', handleGlobalUp);
      window.addEventListener('pointercancel', handleGlobalUp);
    }

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [active, onMove, updatePosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activePointerId.current !== null) return;
    
    activePointerId.current = e.pointerId;
    setActive(true);
    updatePosition(e.clientX, e.clientY);
  };

  const accentColor = color === 'red' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 211, 238, 0.8)';
  const baseBg = color === 'red' ? 'bg-red-950/30' : 'bg-cyan-950/30';
  const stickBg = color === 'red' ? 'bg-red-500 shadow-red-500/50' : 'bg-cyan-500 shadow-cyan-500/50';

  return (
    <div 
      ref={containerRef}
      className={`relative flex items-center justify-center touch-none select-none transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-70'}`}
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
    >
      {/* Outer Ring */}
      <div 
        className={`absolute inset-0 rounded-full border-2 border-white/20 ${baseBg} backdrop-blur-md flex items-center justify-center overflow-hidden`}
        style={{ boxShadow: active ? `inset 0 0 20px ${accentColor}` : 'none' }}
      >
        {!active && label && (
          <div className="text-[11px] font-black text-white/30 tracking-[0.2em] font-heading text-center pointer-events-none uppercase">
            {label}
          </div>
        )}
      </div>

      {/* Crosshair decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div className="w-full h-px bg-white/50" />
        <div className="h-full w-px bg-white/50 absolute" />
      </div>

      {/* Handle */}
      <div 
        className={`absolute rounded-full z-10 ${stickBg} shadow-2xl transition-transform duration-75 ease-out`}
        style={{ 
          width: STICK_RADIUS * 2, 
          height: STICK_RADIUS * 2,
          transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
        }}
      >
        <div className="absolute inset-2 rounded-full border border-white/40 bg-gradient-to-tr from-black/20 to-white/20" />
      </div>
    </div>
  );
});

export default VirtualJoystick;