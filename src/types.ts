export type Gender = 'H' | 'M';

export interface Player {
  id: string;
  name: string;
  rating: number;
  gender: Gender;
  isGuest?: boolean;
}

export interface Team {
  players: Player[];
  score: number;
  consecutiveWins: number;
}

export interface GameState {
  allPlayers: Player[];
  waitlist: string[]; // Array of player IDs
  teamA: Player[];
  teamB: Player[];
  consecutiveWinsA: number;
  consecutiveWinsB: number;
  showRatings: boolean;
  lockedPlayers: Set<string>; // Set of player IDs
}

export interface HistoryEntry {
  waitlist: string[];
  teamA: Player[];
  teamB: Player[];
  consecutiveWinsA: number;
  consecutiveWinsB: number;
}
