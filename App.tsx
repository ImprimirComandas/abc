import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import GameEngine from './components/GameEngine';
import GameOver from './components/GameOver';
import { PlayerProfile, Team, SkinId } from './types';
import { SKINS } from './constants';

type ViewState = 'MENU' | 'LOBBY' | 'GAME' | 'GAMEOVER';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('MENU');
  const [userProfile, setUserProfile] = useState<PlayerProfile | null>(null);
  const [lastWinner, setLastWinner] = useState<Team | null>(null);
  const [sessionBP, setSessionBP] = useState(0);

  const handleJoin = (profile: PlayerProfile) => {
    setUserProfile(profile);
    setView('LOBBY');
  };

  const handleUpdateSkin = (skin: SkinId) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, equippedSkin: skin });
    }
  };

  const handleUnlockSkin = (skin: SkinId) => {
    if (userProfile) {
      const cost = SKINS[skin].price;
      if (userProfile.battlePoints >= cost && !userProfile.unlockedSkins.includes(skin)) {
        setUserProfile({
          ...userProfile,
          battlePoints: userProfile.battlePoints - cost,
          unlockedSkins: [...userProfile.unlockedSkins, skin]
        });
      }
    }
  };

  const handleStartGame = () => {
    setView('GAME');
  };

  const handleGameOver = (winner: Team, earnedBP: number) => {
    setLastWinner(winner);
    setSessionBP(earnedBP);
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        battlePoints: userProfile.battlePoints + earnedBP
      });
    }
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
          onUnlockSkin={handleUnlockSkin}
          onStartGame={handleStartGame} 
          onBack={() => setView('MENU')} 
        />
      )}

      {view === 'GAME' && userProfile && (
        <GameEngine 
          playerProfile={userProfile} 
          onGameOver={handleGameOver} 
          onUpdateSkin={handleUpdateSkin}
          onUnlockSkin={handleUnlockSkin}
        />
      )}

      {view === 'GAMEOVER' && lastWinner && (
        <GameOver winner={lastWinner} earnedBP={sessionBP} onReturn={handleReturnToLobby} />
      )}
    </div>
  );
};

export default App;