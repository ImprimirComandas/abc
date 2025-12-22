import React from 'react';
import { Team } from '../types';
import { TEAM_BLUE_COLOR, TEAM_RED_COLOR } from '../constants';

interface GameOverProps {
  winner: Team;
  earnedBP: number;
  onReturn: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ winner, earnedBP, onReturn }) => {
  const isBlueWin = winner === 'BLUE';
  
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="transform scale-150 mb-12">
        <h1 
          className="text-7xl font-black font-heading text-transparent bg-clip-text"
          style={{ 
             backgroundImage: `linear-gradient(to bottom, #fff, ${isBlueWin ? TEAM_BLUE_COLOR : TEAM_RED_COLOR})`,
             textShadow: `0 0 50px ${isBlueWin ? TEAM_BLUE_COLOR : TEAM_RED_COLOR}66`
          }}
        >
          {winner} WINS
        </h1>
      </div>
      
      <div className="bg-slate-900/50 border border-slate-700/50 p-8 rounded-3xl shadow-2xl text-center max-w-md w-full backdrop-blur-md">
         <p className="text-gray-400 mb-8 font-mono text-sm tracking-[0.2em]">
           MISSION RECAP: DATA RETRIEVED
         </p>
         
         <div className="space-y-4 mb-10">
            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 flex justify-between items-center">
              <div className="text-left">
                <span className="block text-[10px] text-gray-500 uppercase font-black tracking-widest">Rewards</span>
                <span className="text-2xl font-mono font-black text-orange-400">+{earnedBP} BP</span>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center border border-orange-500/50">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-400">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="block text-[8px] text-gray-500 uppercase font-bold mb-1">Status</span>
                  <span className="text-sm font-black text-cyan-400">SECURE</span>
               </div>
               <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                  <span className="block text-[8px] text-gray-500 uppercase font-bold mb-1">Accuracy</span>
                  <span className="text-sm font-black text-white">82%</span>
               </div>
            </div>
         </div>

         <button 
           onClick={onReturn}
           className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-lg rounded-2xl hover:brightness-110 active:scale-95 transition-all uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(8,145,178,0.3)]"
         >
           Return to Base
         </button>
      </div>
    </div>
  );
};

export default GameOver;