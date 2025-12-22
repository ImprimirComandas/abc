import React, { useState } from 'react';
import { PlayerProfile } from '../types';

interface MainMenuProps {
  onJoin: (profile: PlayerProfile) => void;
}

const COLORS = [
  '#00f0ff', // Cyan
  '#ff0055', // Neon Red
  '#39ff14', // Neon Green
  '#b026ff', // Neon Purple
  '#ffe700', // Neon Yellow
  '#ff5e00', // Neon Orange
];

const MainMenu: React.FC<MainMenuProps> = ({ onJoin }) => {
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    // Initialize profile with only default skin unlocked and 500 starting BP
    onJoin({ 
        username, 
        color: selectedColor,
        unlockedSkins: ['DEFAULT'],
        equippedSkin: 'DEFAULT',
        battlePoints: 500
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-black to-black"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30 z-0"></div>

      <div className="z-10 w-full max-w-md p-8 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl shadow-cyan-500/10">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2 filter drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
            NEON TANK
          </h1>
          <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Arena</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wider">
              Operator Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg py-3 px-4 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-lg"
              placeholder="Enter Callsign..."
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-bold mb-3 uppercase tracking-wider">
              Signature Color
            </label>
            <div className="flex justify-between gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`w-10 h-10 rounded-full transition-transform hover:scale-110 ${selectedColor === c ? 'ring-2 ring-white scale-110 shadow-[0_0_15px_currentColor]' : 'opacity-70'}`}
                  style={{ backgroundColor: c, color: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center font-bold animate-pulse">{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-lg shadow-lg transform transition hover:-translate-y-1 active:translate-y-0 uppercase tracking-widest text-lg border-b-4 border-blue-800 hover:border-blue-700"
          >
            Enter Battle
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>VERSION 1.1.0 // CONNECTED TO BOLT.REALTIME</p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;