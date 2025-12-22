import React, { useEffect, useState, useRef } from 'react';
import { PlayerProfile, RoomData, SkinId } from '../types';
import { MockService } from '../services/mockService';
import { SKINS, TEAM_BLUE_COLOR, TANK_SIZE } from '../constants';

interface LobbyProps {
  currentUser: PlayerProfile;
  onUpdateSkin: (skin: SkinId) => void;
  onUnlockSkin: (skin: SkinId) => void;
  onStartGame: () => void;
  onBack: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ currentUser, onUpdateSkin, onUnlockSkin, onStartGame, onBack }) => {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  
  // Customization State
  const [previewSkin, setPreviewSkin] = useState<SkinId>(currentUser.equippedSkin);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Fake "Lobby State" for visual effect
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);

  useEffect(() => {
    loadRooms();
  }, []);

  // Update preview when skin selection changes
  useEffect(() => {
    if (inLobby && canvasRef.current) {
        drawPreview();
    }
  }, [inLobby, previewSkin]);

  const drawPreview = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      
      // Clear
      ctx.clearRect(0, 0, 200, 200);
      
      // Center
      ctx.save();
      ctx.translate(100, 100);
      ctx.scale(2.5, 2.5); // Zoom in
      
      const primaryColor = TEAM_BLUE_COLOR;
      const bodyColor = '#1e3a8a';
      const isUnlocked = currentUser.unlockedSkins.includes(previewSkin);
      
      if (!isUnlocked) {
          ctx.globalAlpha = 0.3; // Locked look
          ctx.filter = 'grayscale(100%)';
      }

      // Draw Tank (Mirroring GameEngine logic)
      if (previewSkin === 'CYBER') {
           ctx.fillStyle = '#000';
           ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
           ctx.strokeStyle = primaryColor;
           ctx.lineWidth = 2.5;
           ctx.shadowBlur = 10; ctx.shadowColor = primaryColor;
           ctx.strokeRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
           ctx.shadowBlur = 0;
           ctx.lineWidth = 0.5;
           ctx.beginPath();
           ctx.moveTo(-TANK_SIZE/2, 0); ctx.lineTo(TANK_SIZE/2, 0);
           ctx.moveTo(0, -TANK_SIZE/2); ctx.lineTo(0, TANK_SIZE/2);
           ctx.stroke();
      } else if (previewSkin === 'STEALTH') {
           ctx.fillStyle = '#1e293b';
           ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
           ctx.fillStyle = primaryColor;
           ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, 4, 4);
           ctx.fillRect(TANK_SIZE/2 - 4, -TANK_SIZE/2, 4, 4);
           ctx.fillRect(TANK_SIZE/2 - 4, TANK_SIZE/2 - 4, 4, 4);
           ctx.fillRect(-TANK_SIZE/2, TANK_SIZE/2 - 4, 4, 4);
      } else if (previewSkin === 'MECHA') {
           ctx.fillStyle = '#64748b';
           ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
           ctx.fillStyle = primaryColor;
           ctx.fillRect(-TANK_SIZE/4, -TANK_SIZE/4, TANK_SIZE/2, TANK_SIZE/2);
           ctx.fillStyle = '#94a3b8';
           ctx.fillRect(-TANK_SIZE/2 + 2, -TANK_SIZE/2 + 2, 2, 2);
           ctx.fillRect(TANK_SIZE/2 - 4, -TANK_SIZE/2 + 2, 2, 2);
           ctx.fillRect(TANK_SIZE/2 - 4, TANK_SIZE/2 - 4, 2, 2);
           ctx.fillRect(-TANK_SIZE/2 + 2, TANK_SIZE/2 - 4, 2, 2);
      } else {
           // DEFAULT
           ctx.fillStyle = bodyColor;
           ctx.fillRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
           ctx.strokeStyle = primaryColor;
           ctx.lineWidth = 2;
           ctx.strokeRect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
      }
      
      // Turret
      ctx.fillStyle = (previewSkin === 'STEALTH' ? '#0f172a' : (previewSkin === 'CYBER' ? '#000' : '#94a3b8'));
      if (previewSkin === 'CYBER') {
          ctx.strokeStyle = primaryColor; ctx.lineWidth = 1;
          ctx.strokeRect(0, -6, 26, 12); ctx.fillRect(0, -6, 26, 12);
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else {
          ctx.fillRect(0, -6, 26, 12);
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
      }

      ctx.restore();
  };

  const loadRooms = async () => {
    setIsLoading(true);
    const data = await MockService.getRooms();
    setRooms(data);
    setIsLoading(false);
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    await MockService.createRoom(`${currentUser.username}'s Arena`);
    enterFakeLobby();
  };

  const handleJoinRoom = async (roomId: string) => {
    setSelectedRoom(roomId);
    await MockService.joinLobby(currentUser.username);
    enterFakeLobby();
  };

  const enterFakeLobby = () => {
    setInLobby(true);
    setIsCreating(false);
    
    setLobbyPlayers([{ name: currentUser.username, team: 'BLUE', status: 'READY', isBot: false }]);

    setTimeout(() => {
      setLobbyPlayers(prev => [...prev, { name: 'Bot_Alpha', team: 'BLUE', status: 'READY', isBot: true }]);
    }, 1000);
    setTimeout(() => {
      setLobbyPlayers(prev => [...prev, { name: 'Bot_Bravo', team: 'RED', status: 'READY', isBot: true }]);
    }, 2000);
    setTimeout(() => {
      setLobbyPlayers(prev => [...prev, { name: 'Bot_Charlie', team: 'RED', status: 'READY', isBot: true }]);
    }, 3000);
  };

  const handleEquipSkin = () => {
      onUpdateSkin(previewSkin);
  };

  const handleUnlockSkin = () => {
      if (currentUser.battlePoints >= SKINS[previewSkin].price) {
          onUnlockSkin(previewSkin);
      }
  };

  if (inLobby) {
    const isUnlocked = currentUser.unlockedSkins.includes(previewSkin);
    const canAfford = currentUser.battlePoints >= SKINS[previewSkin].price;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
        <div className="w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl flex flex-col md:flex-row gap-6">
          
          {/* Main Lobby Column */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                <div>
                <h2 className="text-3xl font-heading text-cyan-400">LOBBY: BATTLE STATION</h2>
                <p className="text-gray-400 text-sm">Room Code: {selectedRoom || 'NEW-ROOM-01'}</p>
                </div>
                <div className="px-4 py-2 bg-slate-800 border border-cyan-500/30 rounded-xl flex items-center gap-3">
                  <span className="text-[10px] font-black text-cyan-400">BATTLE POINTS</span>
                  <span className="text-lg font-mono font-black text-white">{currentUser.battlePoints}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Team Blue */}
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                <h3 className="text-blue-400 font-bold mb-4 text-center tracking-widest text-sm">TEAM BLUE</h3>
                <div className="space-y-2">
                    {lobbyPlayers.filter(p => p.team === 'BLUE').map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-blue-900/40 p-2 rounded border border-blue-500/30 text-sm">
                        <span className="font-mono text-blue-100">{p.name}</span>
                        {p.isBot && <span className="text-[10px] bg-blue-600 px-1 rounded text-white">BOT</span>}
                    </div>
                    ))}
                    {Array.from({ length: 2 - lobbyPlayers.filter(p => p.team === 'BLUE').length }).map((_, i) => (
                    <div key={`empty-b-${i}`} className="p-2 rounded border border-blue-900/30 border-dashed text-blue-800 flex justify-center text-sm">
                        <span className="animate-pulse">Searching...</span>
                    </div>
                    ))}
                </div>
                </div>

                {/* Team Red */}
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                <h3 className="text-red-400 font-bold mb-4 text-center tracking-widest text-sm">TEAM RED</h3>
                <div className="space-y-2">
                    {lobbyPlayers.filter(p => p.team === 'RED').map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-red-900/40 p-2 rounded border border-red-500/30 text-sm">
                        <span className="font-mono text-red-100">{p.name}</span>
                        {p.isBot && <span className="text-[10px] bg-red-600 px-1 rounded text-white">BOT</span>}
                    </div>
                    ))}
                    {Array.from({ length: 2 - lobbyPlayers.filter(p => p.team === 'RED').length }).map((_, i) => (
                    <div key={`empty-r-${i}`} className="p-2 rounded border border-red-900/30 border-dashed text-red-800 flex justify-center text-sm">
                        <span className="animate-pulse">Searching...</span>
                    </div>
                    ))}
                </div>
                </div>
            </div>

            <div className="flex justify-between items-center mt-auto">
                <button onClick={() => setInLobby(false)} className="px-6 py-3 text-gray-400 hover:text-white font-bold transition">
                LEAVE
                </button>
                <button 
                onClick={onStartGame} 
                disabled={lobbyPlayers.length < 2}
                className={`px-12 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded shadow-lg transform hover:scale-105 transition-all ${lobbyPlayers.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                DEPLOY
                </button>
            </div>
          </div>

          {/* Customization Column */}
          <div className="w-full md:w-80 bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex flex-col">
              <h3 className="text-cyan-400 font-bold mb-4 tracking-widest border-b border-gray-700 pb-2 uppercase">Garage</h3>
              
              {/* Preview */}
              <div className="w-full aspect-square bg-gray-900 rounded-lg border border-gray-600 mb-4 flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0f172a_100%)]"></div>
                  <canvas ref={canvasRef} width={200} height={200} className="relative z-10" />
                  {!isUnlocked && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-gray-500 mb-2">
                              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                          </svg>
                          <span className="text-white font-black text-xs uppercase tracking-widest">Locked Skin</span>
                      </div>
                  )}
              </div>

              {/* Skin Selection */}
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="space-y-2">
                      {Object.keys(SKINS).map(skinId => {
                          const id = skinId as SkinId;
                          const skin = SKINS[id];
                          const unlocked = currentUser.unlockedSkins.includes(id);
                          return (
                          <div 
                            key={id} 
                            onClick={() => setPreviewSkin(id)}
                            className={`p-3 rounded cursor-pointer transition-all border ${previewSkin === id ? 'bg-gray-700 border-cyan-500 shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'bg-gray-800 border-transparent hover:bg-gray-700'}`}
                          >
                              <div className="flex justify-between items-center mb-1">
                                  <div className="flex items-center gap-2">
                                    {!unlocked && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                    <span className={`font-bold text-sm ${previewSkin === id ? 'text-white' : 'text-gray-400'}`}>
                                        {skin.name}
                                    </span>
                                  </div>
                                  {currentUser.equippedSkin === id && (
                                      <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 rounded border border-green-500/30">EQUIPPED</span>
                                  )}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-tight mb-2">{skin.description}</p>
                              {!unlocked && (
                                  <div className="text-[10px] font-black text-cyan-400 flex items-center gap-1">
                                      <span className="opacity-50">COST:</span> {skin.price} BP
                                  </div>
                              )}
                          </div>
                      )})}
                  </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                  {isUnlocked ? (
                      currentUser.equippedSkin !== previewSkin ? (
                          <button 
                            onClick={handleEquipSkin}
                            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-lg transition-all text-sm uppercase tracking-wider"
                          >
                              Equip Skin
                          </button>
                      ) : (
                          <div className="w-full py-2 text-center text-cyan-400 text-sm font-black border border-cyan-500/30 rounded bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(0,240,255,0.1)]">
                              ACTIVE SKIN
                          </div>
                      )
                  ) : (
                      <button 
                        onClick={handleUnlockSkin}
                        disabled={!canAfford}
                        className={`w-full py-2 flex items-center justify-center gap-2 font-bold rounded shadow-lg transition-all text-sm uppercase tracking-wider ${canAfford ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" />
                          </svg>
                          Unlock {SKINS[previewSkin].price} BP
                      </button>
                  )}
              </div>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-heading text-cyan-400">SERVER BROWSER</h2>
            <div className="flex gap-4">
                <button onClick={onBack} className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-800 transition">Back</button>
                <button onClick={loadRooms} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition">Refresh</button>
                <button onClick={handleCreateRoom} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded font-bold shadow-lg shadow-cyan-500/30 transition">
                   {isCreating ? 'Creating...' : '+ Create Room'}
                </button>
            </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="bg-gray-800 border border-gray-700 p-6 rounded-lg hover:border-cyan-500 transition-colors group cursor-pointer" onClick={() => handleJoinRoom(room.id)}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold font-heading group-hover:text-cyan-400 transition-colors">{room.name}</h3>
                  {room.isPrivate && <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded">PRIVATE</span>}
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Region</span>
                    <span className="text-white">US-East</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players</span>
                    <span className={`${room.players === room.maxPlayers ? 'text-red-400' : 'text-green-400'}`}>{room.players}/{room.maxPlayers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mode</span>
                    <span className="text-white">Team Deathmatch</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-mono">{room.id}</span>
                    <button className="text-cyan-400 text-sm font-bold group-hover:translate-x-1 transition-transform">JOIN &rarr;</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;