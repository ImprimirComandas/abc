import React from 'react';
import { Team } from '../types';
import { TEAM_BLUE_COLOR, TEAM_RED_COLOR } from '../constants';

interface GameOverProps {
  winner: Team;
  onReturn: () => void;
}

const GameOver: React.FC<GameOverProps> = ({ winner, onReturn }) => {
  const isBlueWin = winner === 'BLUE';
  
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="transform scale-150 mb-8">
        <h1 
          className="text-8xl font-black font-heading text-transparent bg-clip-text"
          style={{ 
             backgroundImage: `linear-gradient(to bottom, #fff, ${isBlueWin ? TEAM_BLUE_COLOR : TEAM_RED_COLOR})`,
             textShadow: `0 0 50px ${isBlueWin ? TEAM_BLUE_COLOR : TEAM_RED_COLOR}`
          }}
        >
          {winner} WINS
        </h1>
      </div>
      
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-xl shadow-2xl text-center max-w-lg w-full">
         <p className="text-gray-400 mb-8 font-mono text-lg">
           MATCH COMPLETE. ALL OBJECTIVES SECURED.
         </p>
         
         <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <span className="block text-xs text-gray-500 uppercase">Total Kills</span>
              <span className="text-2xl font-bold text-white">24</span>
            </div>
             <div className="bg-gray-800 p-4 rounded border border-gray-700">
              <span className="block text-xs text-gray-500 uppercase">MVP</span>
              <span className="text-2xl font-bold text-cyan-400">PlayerOne</span>
            </div>
         </div>

         <button 
           onClick={onReturn}
           className="w-full py-4 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition uppercase tracking-widest"
         >
           Return to Lobby
         </button>
      </div>
    </div>
  );
};

export default GameOver;