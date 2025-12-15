import { RoomData } from '../types';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockService = {
  async joinLobby(username: string): Promise<boolean> {
    await delay(800);
    return true;
  },

  async getRooms(): Promise<RoomData[]> {
    await delay(500);
    return [
      { id: 'RM-X92A', name: "Neon Battle Alpha", players: 3, maxPlayers: 4, isPrivate: false, status: 'WAITING' },
      { id: 'RM-B77Z', name: "Pro Tankers Only", players: 1, maxPlayers: 4, isPrivate: false, status: 'WAITING' },
      { id: 'RM-Priv', name: "Mike's Room", players: 2, maxPlayers: 4, isPrivate: true, status: 'PLAYING' },
    ];
  },

  async createRoom(roomName: string): Promise<string> {
    await delay(1000);
    return 'RM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
};