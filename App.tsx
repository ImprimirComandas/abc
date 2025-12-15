import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import GameEngine from './components/GameEngine';
import GameOver from './components/GameOver';
import { PlayerProfile, Team, SkinId } from './types';

type ViewState = 'MENU' | 'LOBBY' | 'GAME' | 'GAMEOVER';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('MENU');
  const [userProfile, setUserProfile] = useState<PlayerProfile | null>(null);
  const [lastWinner, setLastWinner] = useState<Team | null>(null);

  const handleJoin = (profile: PlayerProfile) => {
    setUserProfile(profile);
    setView('LOBBY');
  };

  const handleUpdateSkin = (skin: SkinId) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, equippedSkin: skin });
    }
  };

  const handleStartGame = () => {
    setView('GAME');
  };

  const handleGameOver = (winner: Team) => {
    setLastWinner(winner);
    setView('GAMEOVER');
  };

  const handleReturnToLobby = () => {
    setView('LOBBY');
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden">
      {view === 'MENU' && <MainMenu onJoin={handleJoin} />}
      
      {view === 'LOBBY' && userProfile && (
        <Lobby 
          currentUser={userProfile} 
          onUpdateSkin={handleUpdateSkin}
          onStartGame={handleStartGame} 
          onBack={() => setView('MENU')} 
        />
      )}

      {view === 'GAME' && userProfile && (
        <GameEngine playerProfile={userProfile} onGameOver={handleGameOver} />
      )}

      {view === 'GAMEOVER' && lastWinner && (
        <GameOver winner={lastWinner} onReturn={handleReturnToLobby} />
      )}
    </div>
  );
};

export default App;