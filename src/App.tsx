import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Player, Gender, HistoryEntry } from './types';
import { INITIAL_PLAYERS } from './constants';
import { db, auth } from './firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  Users, 
  UserPlus, 
  Trophy, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Shuffle,
  Trash2,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
  Pencil,
  Check,
  X,
  UserMinus,
  GripVertical,
  ArrowLeftRight,
  LogIn,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [waitlist, setWaitlist] = useState<string[]>([]);
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [consecutiveWinsA, setConsecutiveWinsA] = useState(0);
  const [consecutiveWinsB, setConsecutiveWinsB] = useState(0);
  const [showRatings, setShowRatings] = useState(true);
  const [lockedPlayers, setLockedPlayers] = useState<Set<string>>(new Set());
  const [nextQueueNumber, setNextQueueNumber] = useState(1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Firebase Auth Setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      alert(`Não foi possível fazer login com o Google: ${error.message || 'Erro desconhecido'}. Verifique se os pop-ups estão permitidos.`);
    }
  };

  const handleLogout = () => auth.signOut();

  // Sync Players from Firestore
  useEffect(() => {
    if (!isAuthReady) return;
    
    const bootstrapPlayers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'players'));
        const existingIds = new Set();
        snapshot.forEach(doc => existingIds.add(doc.id));
        
        // Find players that are in INITIAL_PLAYERS but NOT in Firestore
        const missingPlayers = INITIAL_PLAYERS.filter(p => !existingIds.has(p.id));
        
        if (missingPlayers.length > 0) {
          console.log(`Subindo ${missingPlayers.length} jogadores faltantes para o banco...`);
          await syncAllPlayersToFirebase(missingPlayers);
        }
      } catch (error) {
        console.error("Erro no bootstrap de jogadores:", error);
      }
    };
    
    bootstrapPlayers();

    const unsubscribe = onSnapshot(collection(db, 'players'), (snapshot) => {
      const players: Player[] = [];
      snapshot.forEach((doc) => {
        players.push(doc.data() as Player);
      });
      
      if (players.length > 0) {
        // Sort by name to keep UI consistent
        setAllPlayers(players.sort((a, b) => a.name.localeCompare(b.name)));
      }
    });
    return () => unsubscribe();
  }, [isAuthReady]);

  // Sync State from Firestore
  useEffect(() => {
    if (!isAuthReady) return;
    const unsubscribe = onSnapshot(doc(db, 'state', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setWaitlist(data.waitlist || []);
        setTeamA(data.teamA || []);
        setTeamB(data.teamB || []);
        setConsecutiveWinsA(data.consecutiveWinsA || 0);
        setConsecutiveWinsB(data.consecutiveWinsB || 0);
        setNextQueueNumber(data.nextQueueNumber || 1);
        setLockedPlayers(new Set(data.lockedPlayers || []));
      }
    });
    return () => unsubscribe();
  }, [isAuthReady]);

  // Push State to Firestore
  const syncStateToFirebase = useCallback(async (updates: any) => {
    if (!isAuthReady) return;
    try {
      await setDoc(doc(db, 'state', 'current'), {
        waitlist,
        teamA,
        teamB,
        consecutiveWinsA,
        consecutiveWinsB,
        nextQueueNumber,
        lockedPlayers: Array.from(lockedPlayers),
        ...updates
      }, { merge: true });
    } catch (e) {
      console.error("Error syncing state:", e);
    }
  }, [isAuthReady, waitlist, teamA, teamB, consecutiveWinsA, consecutiveWinsB, nextQueueNumber, lockedPlayers]);

  const syncPlayerToFirebase = async (player: Player) => {
    if (!isAuthReady) return;
    await setDoc(doc(db, 'players', player.id), player);
  };

  const syncAllPlayersToFirebase = async (players: Player[]) => {
    if (!isAuthReady) return;
    const batch = writeBatch(db);
    players.forEach(p => {
      batch.set(doc(db, 'players', p.id), p);
    });
    await batch.commit();
  };

  // UI State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>('H');
  const [newPlayerRating, setNewPlayerRating] = useState('3.0');
  const [activeTab, setActiveTab] = useState<'court' | 'waitlist' | 'inactive'>('court');

  // Editing State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [isBulkEditingRatings, setIsBulkEditingRatings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRating, setEditRating] = useState('');
  const [editGender, setEditGender] = useState<Gender>('H');

  const saveHistory = useCallback(() => {
    setHistory(prev => [
      {
        waitlist: [...waitlist],
        teamA: [...teamA],
        teamB: [...teamB],
        consecutiveWinsA,
        consecutiveWinsB,
        nextQueueNumber,
        allPlayers: [...allPlayers],
      },
      ...prev.slice(0, 9) // Keep last 10 entries
    ]);
  }, [waitlist, teamA, teamB, consecutiveWinsA, consecutiveWinsB, nextQueueNumber, allPlayers]);

  const resetSession = () => {
    if (window.confirm('Deseja resetar a partida? Isso removerá todos os jogadores da quadra e da espera, resetando a fila, mas MANTENDO as notas e nomes.')) {
      saveHistory();
      const updates = {
        teamA: [],
        teamB: [],
        waitlist: [],
        consecutiveWinsA: 0,
        consecutiveWinsB: 0,
        nextQueueNumber: 1,
        lockedPlayers: []
      };
      setTeamA([]);
      setTeamB([]);
      setWaitlist([]);
      setConsecutiveWinsA(0);
      setConsecutiveWinsB(0);
      setNextQueueNumber(1);
      const updatedPlayers = allPlayers.map(p => ({ ...p, queueNumber: undefined }));
      setAllPlayers(updatedPlayers);
      setLockedPlayers(new Set());
      
      syncStateToFirebase(updates);
      syncAllPlayersToFirebase(updatedPlayers);
    }
  };

  const revertLastAction = () => {
    if (history.length === 0) return;
    const last = history[0];
    setWaitlist(last.waitlist);
    setTeamA(last.teamA);
    setTeamB(last.teamB);
    setConsecutiveWinsA(last.consecutiveWinsA);
    setConsecutiveWinsB(last.consecutiveWinsB);
    setNextQueueNumber(last.nextQueueNumber);
    setAllPlayers(last.allPlayers);
    setHistory(prev => prev.slice(1));

    syncStateToFirebase({
      waitlist: last.waitlist,
      teamA: last.teamA,
      teamB: last.teamB,
      consecutiveWinsA: last.consecutiveWinsA,
      consecutiveWinsB: last.consecutiveWinsB,
      nextQueueNumber: last.nextQueueNumber
    });
    syncAllPlayersToFirebase(last.allPlayers);
  };

  const addPlayerToGame = (id: string) => {
    if (waitlist.includes(id) || teamA.some(p => p.id === id) || teamB.some(p => p.id === id)) return;
    saveHistory();
    
    // Assign queue number
    const updatedPlayers = allPlayers.map(p => 
      p.id === id ? { ...p, queueNumber: nextQueueNumber } : p
    );
    setAllPlayers(updatedPlayers);
    const newNextQueue = nextQueueNumber + 1;
    setNextQueueNumber(newNextQueue);
    
    const newWaitlist = [...waitlist, id];
    setWaitlist(newWaitlist);

    // Automatically lock players when they enter the waitlist
    const newLocked = new Set(lockedPlayers);
    newLocked.add(id);
    setLockedPlayers(newLocked);

    syncAllPlayersToFirebase(updatedPlayers);
    syncStateToFirebase({
      waitlist: newWaitlist,
      nextQueueNumber: newNextQueue,
      lockedPlayers: Array.from(newLocked)
    });
  };

  const removePlayerFromGame = (id: string) => {
    saveHistory();
    
    let fromTeam: 'A' | 'B' | null = null;
    if (teamA.some(p => p.id === id)) fromTeam = 'A';
    else if (teamB.some(p => p.id === id)) fromTeam = 'B';

    // Clear queue number
    const updatedPlayers = allPlayers.map(p => 
      p.id === id ? { ...p, queueNumber: undefined } : p
    );
    setAllPlayers(updatedPlayers);
    
    const newLocked = new Set(lockedPlayers);
    newLocked.delete(id);
    setLockedPlayers(newLocked);

    let newTeamA = [...teamA];
    let newTeamB = [...teamB];
    let newWaitlist = waitlist.filter(pid => pid !== id);

    if (fromTeam && newWaitlist.length > 0) {
      const nextId = newWaitlist[0];
      const nextPlayer = updatedPlayers.find(p => p.id === nextId);
      if (nextPlayer) {
        if (fromTeam === 'A') newTeamA = [...newTeamA.filter(p => p.id !== id), nextPlayer];
        else newTeamB = [...newTeamB.filter(p => p.id !== id), nextPlayer];
        newWaitlist = newWaitlist.slice(1);
      }
    } else {
      if (fromTeam === 'A') newTeamA = newTeamA.filter(p => p.id !== id);
      if (fromTeam === 'B') newTeamB = newTeamB.filter(p => p.id !== id);
    }

    setWaitlist(newWaitlist);
    setTeamA(newTeamA);
    setTeamB(newTeamB);

    syncAllPlayersToFirebase(updatedPlayers);
    syncStateToFirebase({
      waitlist: newWaitlist,
      teamA: newTeamA,
      teamB: newTeamB,
      lockedPlayers: Array.from(newLocked)
    });
  };

  const registerPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const ratingValue = parseFloat(newPlayerRating);
    const newPlayer: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPlayerName,
      gender: newPlayerGender,
      rating: isNaN(ratingValue) ? 3.0 : Math.min(5, Math.max(0, ratingValue)),
      isGuest: true
    };
    setAllPlayers(prev => [...prev, newPlayer]);
    setNewPlayerName('');
    syncPlayerToFirebase(newPlayer);
  };

  const startEditing = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditName(p.name);
    setEditRating(p.rating.toString());
    setEditGender(p.gender);
  };

  const cancelEditing = () => {
    setEditingPlayerId(null);
  };

  const savePlayerEdit = (id: string) => {
    const ratingValue = parseFloat(editRating);
    const validatedRating = isNaN(ratingValue) ? 3.0 : Math.min(5, Math.max(0, ratingValue));

    const updatedPlayer = { ...allPlayers.find(p => p.id === id)!, name: editName, rating: validatedRating, gender: editGender };
    
    setAllPlayers(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    setTeamA(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    setTeamB(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    setEditingPlayerId(null);

    syncPlayerToFirebase(updatedPlayer);
    syncStateToFirebase({}); // Trigger state sync to update teams in Firestore
  };

  const updatePlayerRating = (id: string, newRating: number) => {
    const updatedPlayer = { ...allPlayers.find(p => p.id === id)!, rating: newRating };
    setAllPlayers(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    setTeamA(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    setTeamB(prev => prev.map(p => p.id === id ? updatedPlayer : p));
    
    syncPlayerToFirebase(updatedPlayer);
    syncStateToFirebase({});
  };

  const deletePlayer = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este jogador permanentemente?')) return;
    const updatedPlayers = allPlayers.filter(p => p.id !== id);
    const newWaitlist = waitlist.filter(pid => pid !== id);
    const newTeamA = teamA.filter(p => p.id !== id);
    const newTeamB = teamB.filter(p => p.id !== id);
    const newLocked = new Set(lockedPlayers);
    newLocked.delete(id);

    setAllPlayers(updatedPlayers);
    setWaitlist(newWaitlist);
    setTeamA(newTeamA);
    setTeamB(newTeamB);
    setLockedPlayers(newLocked);

    // Delete from Firestore
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'players', id));
    syncStateToFirebase({
      waitlist: newWaitlist,
      teamA: newTeamA,
      teamB: newTeamB,
      lockedPlayers: Array.from(newLocked)
    });
  };

  const toggleLock = (id: string) => {
    const next = new Set(lockedPlayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLockedPlayers(next);
    syncStateToFirebase({ lockedPlayers: Array.from(next) });
  };

  const updateWaitlistAndSyncNumbers = (newWaitlist: string[]) => {
    // Get the pool of queue numbers currently in the waitlist
    const playersInWaitlist = waitlist.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const currentNumbers = playersInWaitlist.map(p => p.queueNumber || 0).sort((a, b) => a - b);
    
    // Re-assign these numbers to the players in their new positions
    const updatedAllPlayers = [...allPlayers];
    newWaitlist.forEach((id, index) => {
      const playerIndex = updatedAllPlayers.findIndex(p => p.id === id);
      if (playerIndex !== -1 && index < currentNumbers.length) {
        updatedAllPlayers[playerIndex] = {
          ...updatedAllPlayers[playerIndex],
          queueNumber: currentNumbers[index]
        };
      }
    });
    
    setAllPlayers(updatedAllPlayers);
    setWaitlist(newWaitlist);

    syncAllPlayersToFirebase(updatedAllPlayers);
    syncStateToFirebase({ waitlist: newWaitlist });
  };

  const moveInWaitlist = (index: number, direction: 'up' | 'down') => {
    saveHistory();
    const newWaitlist = [...waitlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWaitlist.length) return;
    
    [newWaitlist[index], newWaitlist[targetIndex]] = [newWaitlist[targetIndex], newWaitlist[index]];
    updateWaitlistAndSyncNumbers(newWaitlist);
  };

  const moveInTeam = (team: 'A' | 'B', index: number, direction: 'up' | 'down') => {
    saveHistory();
    const currentTeam = team === 'A' ? [...teamA] : [...teamB];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentTeam.length) return;
    
    // Check if either player is locked
    if (lockedPlayers.has(currentTeam[index].id) || lockedPlayers.has(currentTeam[targetIndex].id)) return;

    [currentTeam[index], currentTeam[targetIndex]] = [currentTeam[targetIndex], currentTeam[index]];
    if (team === 'A') {
      setTeamA(currentTeam);
      syncStateToFirebase({ teamA: currentTeam });
    } else {
      setTeamB(currentTeam);
      syncStateToFirebase({ teamB: currentTeam });
    }
  };

  const onReorderTeam = (team: 'A' | 'B', newOrder: Player[]) => {
    // Check if any locked player changed their relative position
    // This is complex with Reorder.Group, so we'll just allow it for now
    // but prevent dragging locked players via dragListener
    if (team === 'A') {
      setTeamA(newOrder);
      syncStateToFirebase({ teamA: newOrder });
    } else {
      setTeamB(newOrder);
      syncStateToFirebase({ teamB: newOrder });
    }
  };

  const switchTeam = (id: string) => {
    saveHistory();
    const playerA = teamA.find(p => p.id === id);
    const playerB = teamB.find(p => p.id === id);

    if (playerA) {
      const newA = teamA.filter(p => p.id !== id);
      const newB = [...teamB, playerA];
      setTeamA(newA);
      setTeamB(newB);
      syncStateToFirebase({ teamA: newA, teamB: newB });
    } else if (playerB) {
      const newB = teamB.filter(p => p.id !== id);
      const newA = [...teamA, playerB];
      setTeamB(newB);
      setTeamA(newA);
      syncStateToFirebase({ teamA: newA, teamB: newB });
    }
  };

  const balanceTeams = useCallback((players: Player[]) => {
    if (players.length === 0) return { teamA: [], teamB: [] };

    // Shuffle players first to ensure different results on each mix for identical ratings
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    const women = shuffled.filter(p => p.gender === 'M').sort((a, b) => b.rating - a.rating);
    const men = shuffled.filter(p => p.gender === 'H').sort((a, b) => b.rating - a.rating);

    const tA: Player[] = [];
    const tB: Player[] = [];

    const totalCount = players.length;
    const half = Math.ceil(totalCount / 2);

    const distributeGroup = (group: Player[]) => {
      group.forEach((p) => {
        const sumA = tA.reduce((acc, curr) => acc + curr.rating, 0);
        const sumB = tB.reduce((acc, curr) => acc + curr.rating, 0);

        const canAddToA = tA.length < half;
        const canAddToB = tB.length < half;

        if (canAddToA && canAddToB) {
          if (sumA < sumB) {
            tA.push(p);
          } else if (sumB < sumA) {
            tB.push(p);
          } else {
            // Equal sums, put in the team with fewer players
            if (tA.length <= tB.length) {
              tA.push(p);
            } else {
              tB.push(p);
            }
          }
        } else if (canAddToA) {
          tA.push(p);
        } else if (canAddToB) {
          tB.push(p);
        }
      });
    };

    // Interleave/distribute women first to ensure perfect gender balance, then men
    distributeGroup(women);
    distributeGroup(men);

    return { 
      teamA: tA.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)), 
      teamB: tB.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)) 
    };
  }, []);

  const mixTeams = () => {
    const onCourt = [...teamA, ...teamB];
    if (onCourt.length === 0) return;
    saveHistory();
    const { teamA: newA, teamB: newB } = balanceTeams(onCourt);
    setTeamA(newA);
    setTeamB(newB);
    setConsecutiveWinsA(0);
    setConsecutiveWinsB(0);
    syncStateToFirebase({
      teamA: newA,
      teamB: newB,
      consecutiveWinsA: 0,
      consecutiveWinsB: 0
    });
  };

  const fillCourt = useCallback(() => {
    const neededA = 6 - teamA.length;
    const neededB = 6 - teamB.length;
    const totalNeeded = neededA + neededB;
    
    if (totalNeeded === 0) return;

    const toAddIds = waitlist.slice(0, totalNeeded);
    const toAdd = toAddIds.map(id => allPlayers.find(p => p.id === id)!).filter(Boolean);

    if (toAdd.length === 0) return;

    saveHistory();
    
    // Combine existing players with new players and run interleaved balancing
    const pool = [...teamA, ...teamB, ...toAdd];
    const { teamA: newA, teamB: newB } = balanceTeams(pool);
    const newWaitlist = waitlist.slice(toAdd.length);

    setTeamA(newA);
    setTeamB(newB);
    setWaitlist(newWaitlist);

    syncStateToFirebase({
      teamA: newA,
      teamB: newB,
      waitlist: newWaitlist
    });
  }, [teamA, teamB, waitlist, allPlayers, saveHistory, syncStateToFirebase, balanceTeams]);

  const handleWin = (winner: 'A' | 'B') => {
    saveHistory();
    const losingTeam = winner === 'A' ? [...teamB] : [...teamA];
    const winningTeam = winner === 'A' ? [...teamA] : [...teamB];
    
    // Update wins
    const newConsecutiveWins = (winner === 'A' ? consecutiveWinsA : consecutiveWinsB) + 1;
    let finalWinsA = winner === 'A' ? newConsecutiveWins : 0;
    let finalWinsB = winner === 'B' ? newConsecutiveWins : 0;

    // Logic for next team:
    // 1. Take as many as possible from waitlist (up to 6)
    // 2. If waitlist has < 6, take from the losing team to complete 6
    const numFromWaitlist = Math.min(waitlist.length, 6);
    const playersFromWaitlist = waitlist.slice(0, numFromWaitlist).map(id => allPlayers.find(p => p.id === id)!).filter(Boolean);
    
    const numNeededFromLosers = 6 - playersFromWaitlist.length;
    const playersFromLosers = losingTeam.slice(0, numNeededFromLosers);
    
    const newChallengerTeam = [...playersFromWaitlist, ...playersFromLosers];
    const remainingLosers = losingTeam.slice(numNeededFromLosers);
    
    // UPDATE QUEUE NUMBERS for players going to waitlist
    let currentNext = nextQueueNumber;
    const losersWithNewNumbers = remainingLosers.map(p => {
      const updated = { ...p, queueNumber: currentNext };
      currentNext++;
      return updated;
    });

    // Update allPlayers with new queue numbers
    const updatedAllPlayers = allPlayers.map(p => {
      const updatedLoser = losersWithNewNumbers.find(l => l.id === p.id);
      return updatedLoser || p;
    });

    let newTeamA = winner === 'A' ? winningTeam : newChallengerTeam;
    let newTeamB = winner === 'B' ? winningTeam : newChallengerTeam;
    
    // New waitlist: remaining waitlist + remaining losers (with updated IDs)
    const newWaitlist = [...waitlist.slice(numFromWaitlist), ...losersWithNewNumbers.map(p => p.id)];

    setConsecutiveWinsA(finalWinsA);
    setConsecutiveWinsB(finalWinsB);
    setTeamA(newTeamA);
    setTeamB(newTeamB);
    setWaitlist(newWaitlist);
    setAllPlayers(updatedAllPlayers);
    setNextQueueNumber(currentNext);

    syncAllPlayersToFirebase(updatedAllPlayers);
    syncStateToFirebase({
      teamA: newTeamA,
      teamB: newTeamB,
      waitlist: newWaitlist,
      consecutiveWinsA: finalWinsA,
      consecutiveWinsB: finalWinsB,
      nextQueueNumber: currentNext
    });
  };

  const teamAScore = useMemo(() => teamA.reduce((acc, p) => acc + p.rating, 0), [teamA]);
  const teamBScore = useMemo(() => teamB.reduce((acc, p) => acc + p.rating, 0), [teamB]);
  const imbalance = useMemo(() => {
    if (teamAScore === 0 || teamBScore === 0) return 0;
    return Math.abs(teamAScore - teamBScore) / Math.max(teamAScore, teamBScore);
  }, [teamAScore, teamBScore]);

  const inactivePlayers = allPlayers.filter(p => 
    !waitlist.includes(p.id) && 
    !teamA.some(tp => tp.id === p.id) && 
    !teamB.some(tp => tp.id === p.id)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold tracking-tight">Gestor de Vôlei v3.0</h1>
          </div>
          <div className="flex gap-2 items-center">
            {user ? (
              <div className="flex items-center gap-2">
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || ''} 
                  className="w-8 h-8 rounded-full border border-amber-500"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-rose-900/30 text-rose-500 rounded-full transition-colors"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-amber-500 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-400 transition-all"
              >
                <LogIn className="w-4 h-4" /> ENTRAR
              </button>
            )}
            <div className="w-px h-6 bg-slate-800 mx-1" />
            <button 
              onClick={() => setShowRatings(!showRatings)}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors"
              title={showRatings ? "Ocultar Notas" : "Mostrar Notas"}
            >
              {showRatings ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button 
              onClick={revertLastAction}
              disabled={history.length === 0}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
              title="Reverter Última Ação"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button 
              onClick={resetSession}
              className="p-2 hover:bg-rose-900/30 text-rose-500 rounded-full transition-colors"
              title="Resetar Partida (Limpar Quadra e Espera)"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Tabs */}
        <div className="flex bg-slate-900 rounded-xl shadow-sm p-1 border border-slate-800">
          <button 
            onClick={() => setActiveTab('court')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'court' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Quadra
          </button>
          <button 
            onClick={() => setActiveTab('waitlist')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'waitlist' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            Espera ({waitlist.length})
          </button>
          <button 
            onClick={() => setActiveTab('inactive')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inactive' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            FORA DE JOGO ({allPlayers.length})
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'court' && (
            <motion.div 
              key="court"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={mixTeams}
                  disabled={teamA.length + teamB.length === 0}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-amber-500 py-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 font-bold transition-all"
                >
                  <Shuffle className="w-5 h-5" />
                  MEXER NAS EQUIPES
                </button>
                <button 
                  onClick={fillCourt}
                  disabled={waitlist.length === 0 || (teamA.length === 6 && teamB.length === 6)}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-slate-950 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-amber-500/20 transition-all"
                >
                  <UserPlus className="w-5 h-5" />
                  COMPLETAR QUADRA
                </button>
              </div>

              {/* Status Alerts */}
              {(consecutiveWinsA >= 3 || consecutiveWinsB >= 3 || imbalance > 0.15) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-amber-500/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Shuffle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-amber-200 font-bold text-sm">Sugestão de Reequilíbrio</p>
                      <p className="text-amber-400/70 text-xs">
                        {consecutiveWinsA >= 3 || consecutiveWinsB >= 3 
                          ? `Sequência de vitórias: ${Math.max(consecutiveWinsA, consecutiveWinsB)} partidas` 
                          : `Desequilíbrio técnico: ${(imbalance * 100).toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={mixTeams}
                    className="bg-amber-500 text-slate-950 px-4 py-2 rounded-lg text-xs font-black hover:bg-amber-400 transition-all active:scale-95 shadow-md shadow-amber-500/20"
                  >
                    MISTURAR AGORA
                  </button>
                </motion.div>
              )}

              {/* Teams Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Team A */}
                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
                  <div className="bg-amber-500 p-4 text-slate-950 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold flex items-center gap-1.5">
                        <span>Time A</span>
                        <span className="text-xs bg-slate-950/15 text-slate-900 px-2 py-0.5 rounded-full font-extrabold" title="Nota geral média do time">
                          ★ {teamA.length > 0 ? (teamAScore / teamA.length).toFixed(1) : "0.0"}
                        </span>
                      </h3>
                      {showRatings && (
                        <div className="flex items-center gap-2">
                          <p className="text-amber-900 text-xs font-medium">Soma: {teamAScore.toFixed(2)}</p>
                          {imbalance > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${imbalance > 0.15 ? 'bg-rose-500/20 text-rose-900' : 'bg-amber-600/20 text-amber-900'}`}>
                              Δ {(imbalance * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-amber-600/30 px-2 py-1 rounded-full">Vitórias: {consecutiveWinsA}</span>
                      <button onClick={() => handleWin('A')} className="p-2 bg-slate-950/20 hover:bg-slate-950/30 rounded-lg transition-colors">
                        <Trophy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {teamA.length === 0 ? (
                      <p className="text-slate-600 text-center py-8 text-sm italic">Vazio</p>
                    ) : (
                      <Reorder.Group axis="y" values={teamA} onReorder={(newOrder) => onReorderTeam('A', newOrder)} className="space-y-2">
                        {teamA.map((p, index) => (
                          <Reorder.Item 
                            key={p.id} 
                            value={p}
                            dragListener={!lockedPlayers.has(p.id)}
                            onDragEnd={() => saveHistory()}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-800 group"
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className={`w-3.5 h-3.5 ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'text-slate-600 group-hover:text-amber-500/50'} transition-colors`} />
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.gender === 'H' ? 'bg-blue-900/50 text-blue-400' : 'bg-pink-900/50 text-pink-400'}`}>
                                {p.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-200">
                                  {p.queueNumber && <span className="text-amber-500 mr-1">#{p.queueNumber}</span>}
                                  {p.name}
                                </p>
                                {showRatings && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">Nota:</span>
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      min="0"
                                      max="5"
                                      value={p.rating}
                                      onChange={(e) => updatePlayerRating(p.id, Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                                      className="w-10 bg-transparent border-none text-[10px] text-amber-500 font-bold focus:ring-0 p-0"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveInTeam('A', index, 'up'); }} 
                                  disabled={lockedPlayers.has(p.id)}
                                  className={`p-0.5 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveInTeam('A', index, 'down'); }} 
                                  disabled={lockedPlayers.has(p.id)}
                                  className={`p-0.5 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                              <button 
                                onClick={() => startEditing(p)}
                                className="p-1.5 text-slate-500 hover:bg-slate-700 rounded-md transition-colors"
                                title="Editar Jogador"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => switchTeam(p.id)}
                                className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                                title="Mudar de Time"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => removePlayerFromGame(p.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-900/30 rounded-md transition-colors"
                                title="Retirar da Quadra"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleLock(p.id)} className={`p-1.5 rounded-md transition-colors ${lockedPlayers.has(p.id) ? 'bg-amber-500/20 text-amber-500' : 'text-slate-600 hover:bg-slate-700'}`}>
                                {lockedPlayers.has(p.id) ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
                </div>

                {/* Team B */}
                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
                  <div className="bg-white p-4 text-slate-950 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold flex items-center gap-1.5">
                        <span>Time B</span>
                        <span className="text-xs bg-slate-950/10 text-slate-800 px-2 py-0.5 rounded-full font-extrabold" title="Nota geral média do time">
                          ★ {teamB.length > 0 ? (teamBScore / teamB.length).toFixed(1) : "0.0"}
                        </span>
                      </h3>
                      {showRatings && (
                        <div className="flex items-center gap-2">
                          <p className="text-slate-500 text-xs font-medium">Soma: {teamBScore.toFixed(2)}</p>
                          {imbalance > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${imbalance > 0.15 ? 'bg-rose-500/20 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                              Δ {(imbalance * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-slate-200 px-2 py-1 rounded-full">Vitórias: {consecutiveWinsB}</span>
                      <button onClick={() => handleWin('B')} className="p-2 bg-slate-950/10 hover:bg-slate-950/20 rounded-lg transition-colors">
                        <Trophy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {teamB.length === 0 ? (
                      <p className="text-slate-600 text-center py-8 text-sm italic">Vazio</p>
                    ) : (
                      <Reorder.Group axis="y" values={teamB} onReorder={(newOrder) => onReorderTeam('B', newOrder)} className="space-y-2">
                        {teamB.map((p, index) => (
                          <Reorder.Item 
                            key={p.id} 
                            value={p}
                            dragListener={!lockedPlayers.has(p.id)}
                            onDragEnd={() => saveHistory()}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-800 group"
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className={`w-3.5 h-3.5 ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'text-slate-600 group-hover:text-amber-500/50'} transition-colors`} />
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.gender === 'H' ? 'bg-blue-900/50 text-blue-400' : 'bg-pink-900/50 text-pink-400'}`}>
                                {p.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-200">
                                  {p.queueNumber && <span className="text-amber-500 mr-1">#{p.queueNumber}</span>}
                                  {p.name}
                                </p>
                                {showRatings && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500">Nota:</span>
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      min="0"
                                      max="5"
                                      value={p.rating}
                                      onChange={(e) => updatePlayerRating(p.id, Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                                      className="w-10 bg-transparent border-none text-[10px] text-amber-500 font-bold focus:ring-0 p-0"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="flex flex-col gap-0.5 mr-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveInTeam('B', index, 'up'); }} 
                                  disabled={lockedPlayers.has(p.id)}
                                  className={`p-0.5 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); moveInTeam('B', index, 'down'); }} 
                                  disabled={lockedPlayers.has(p.id)}
                                  className={`p-0.5 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                              <button 
                                onClick={() => startEditing(p)}
                                className="p-1.5 text-slate-500 hover:bg-slate-700 rounded-md transition-colors"
                                title="Editar Jogador"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => switchTeam(p.id)}
                                className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                                title="Mudar de Time"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => removePlayerFromGame(p.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-900/30 rounded-md transition-colors"
                                title="Retirar da Quadra"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleLock(p.id)} className={`p-1.5 rounded-md transition-colors ${lockedPlayers.has(p.id) ? 'bg-amber-500/20 text-amber-500' : 'text-slate-600 hover:bg-slate-700'}`}>
                                {lockedPlayers.has(p.id) ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    )}
                  </div>
                </div>
              </div>

              {teamA.length + teamB.length < 12 && waitlist.length > 0 && (
                <button 
                  onClick={fillCourt}
                  className="w-full py-4 bg-amber-500 text-slate-950 rounded-xl font-bold shadow-lg hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                >
                  <Users className="w-5 h-5" />
                  COMPLETAR QUADRA
                </button>
              )}
            </motion.div>
          )}

          {activeTab === 'waitlist' && (
            <motion.div 
              key="waitlist"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-500" />
                    Próximos da Fila
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const next = new Set(lockedPlayers);
                        waitlist.forEach(id => next.add(id));
                        setLockedPlayers(next);
                        syncStateToFirebase({ lockedPlayers: Array.from(next) });
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-amber-500 hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" /> BLOQUEAR TODOS
                    </button>
                    <button 
                      onClick={() => {
                        const next = new Set(lockedPlayers);
                        waitlist.forEach(id => next.delete(id));
                        setLockedPlayers(next);
                        syncStateToFirebase({ lockedPlayers: Array.from(next) });
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      <Unlock className="w-3 h-3" /> DESBLOQUEAR
                    </button>
                  </div>
                </div>
                <Reorder.Group axis="y" values={waitlist} onReorder={updateWaitlistAndSyncNumbers} className="space-y-2">
                  {waitlist.length === 0 ? (
                    <p className="text-slate-600 text-center py-12 text-sm italic">Ninguém na espera</p>
                  ) : (
                    waitlist.map((id, index) => {
                      const p = allPlayers.find(ap => ap.id === id);
                      if (!p) return null;
                      return (
                        <Reorder.Item 
                          key={p.id} 
                          value={p.id}
                          dragListener={!lockedPlayers.has(p.id)}
                          onDragEnd={() => saveHistory()}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 cursor-grab active:cursor-grabbing hover:border-amber-500/30 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className={`w-4 h-4 ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'text-slate-600 group-hover:text-amber-500/50'} transition-colors`} />
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${p.gender === 'H' ? 'bg-blue-900/50 text-blue-400' : 'bg-pink-900/50 text-pink-400'}`}>
                              {p.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-200">
                                {index + 1}. {p.queueNumber && <span className="text-amber-500 mr-1">#{p.queueNumber}</span>}
                                {p.name}
                              </p>
                              {showRatings && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-500">Nota:</span>
                                  <input 
                                    type="number" 
                                    step="0.1"
                                    min="0"
                                    max="5"
                                    value={p.rating}
                                    onChange={(e) => updatePlayerRating(p.id, Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-10 bg-transparent border-none text-[10px] text-amber-500 font-bold focus:ring-0 p-0"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                              className="p-2 text-slate-500 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Editar Jogador"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <div className="flex flex-col gap-1 mr-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveInWaitlist(index, 'up'); }} 
                                disabled={lockedPlayers.has(p.id)}
                                className={`p-1 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveInWaitlist(index, 'down'); }} 
                                disabled={lockedPlayers.has(p.id)}
                                className={`p-1 rounded transition-colors ${lockedPlayers.has(p.id) ? 'text-slate-800' : 'hover:bg-slate-700 text-slate-500'}`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleLock(p.id); }} className={`p-2 rounded-lg transition-colors ${lockedPlayers.has(p.id) ? 'bg-amber-500/20 text-amber-500' : 'text-slate-600 hover:bg-slate-700'}`}>
                              {lockedPlayers.has(p.id) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removePlayerFromGame(p.id); }} 
                              className="p-2 text-rose-500 hover:bg-rose-900/30 rounded-lg transition-colors"
                              title="Retirar do Jogo"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          </div>
                        </Reorder.Item>
                      );
                    })
                  )}
                </Reorder.Group>
              </div>
            </motion.div>
          )}

          {activeTab === 'inactive' && (
            <motion.div 
              key="inactive"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Add Guest Form */}
              <form onSubmit={registerPlayer} className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-4 space-y-4">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-500" />
                  Novo Jogador / Convidado
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Nome" 
                    value={newPlayerName}
                    onChange={e => setNewPlayerName(e.target.value)}
                    className="col-span-2 p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                  />
                  <select 
                    value={newPlayerGender}
                    onChange={e => setNewPlayerGender(e.target.value as Gender)}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="H">Homem (H)</option>
                    <option value="M">Mulher (M)</option>
                  </select>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="5"
                    placeholder="Nota (0 a 5)" 
                    value={newPlayerRating}
                    onChange={e => setNewPlayerRating(e.target.value)}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                  />
                </div>
                <button type="submit" className="w-full py-3 bg-amber-500 text-slate-950 rounded-xl font-bold hover:bg-amber-400 transition-all">
                  CADASTRAR
                </button>
              </form>

              {/* Players List */}
              <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-slate-200">Jogadores FORA DE JOGO</h3>
                    <button 
                      onClick={() => setIsBulkEditingRatings(!isBulkEditingRatings)}
                      className={`text-[10px] font-bold px-2 py-1 rounded mt-1 transition-colors ${isBulkEditingRatings ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {isBulkEditingRatings ? 'CONCLUIR EDIÇÃO' : 'EDITAR TODAS AS NOTAS'}
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm('Deseja resetar todos os jogadores para a lista inicial? Isso apagará jogadores novos e resetará a contagem da fila.')) {
                        saveHistory();
                        setAllPlayers(INITIAL_PLAYERS);
                        setWaitlist([]);
                        setTeamA([]);
                        setTeamB([]);
                        setLockedPlayers(new Set());
                        setNextQueueNumber(1);
                      }
                    }}
                    className="text-[10px] text-slate-500 hover:text-rose-500 transition-colors"
                  >
                    RESETAR LISTA
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {[...allPlayers].sort((a, b) => {
                    const aInGame = waitlist.includes(a.id) || teamA.some(tp => tp.id === a.id) || teamB.some(tp => tp.id === a.id);
                    const bInGame = waitlist.includes(b.id) || teamA.some(tp => tp.id === b.id) || teamB.some(tp => tp.id === b.id);
                    
                    if (aInGame && bInGame) return (a.queueNumber || 0) - (b.queueNumber || 0);
                    if (aInGame && !bInGame) return -1;
                    if (!aInGame && bInGame) return 1;
                    return a.name.localeCompare(b.name);
                  }).map(p => {
                    const isInGame = waitlist.includes(p.id) || teamA.some(tp => tp.id === p.id) || teamB.some(tp => tp.id === p.id);
                    
                    return (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 hover:border-amber-500/30 transition-colors">
                        {editingPlayerId === p.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <input 
                                type="text" 
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                className="col-span-2 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                              />
                              <select 
                                value={editGender}
                                onChange={e => setEditGender(e.target.value as Gender)}
                                className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                              >
                                <option value="H">H</option>
                                <option value="M">M</option>
                              </select>
                              <input 
                                type="number" 
                                step="0.01"
                                min="0"
                                max="5"
                                value={editRating}
                                onChange={e => setEditRating(e.target.value)}
                                className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => savePlayerEdit(p.id)}
                                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <Check className="w-3 h-3" /> SALVAR
                              </button>
                              <button 
                                onClick={cancelEditing}
                                className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <X className="w-3 h-3" /> CANCELAR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.gender === 'H' ? 'bg-blue-900/50 text-blue-400' : 'bg-pink-900/50 text-pink-400'}`}>
                                {p.name[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-200">
                                    {isInGame && p.queueNumber && <span className="text-amber-500 mr-1">#{p.queueNumber}</span>}
                                    {p.name}
                                  </p>
                                  {isInGame && <span className="text-[8px] bg-amber-500/20 text-amber-500 px-1 rounded">EM JOGO</span>}
                                </div>
                                {showRatings && (
                                  isBulkEditingRatings ? (
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="text-[10px] text-slate-500">Nota:</span>
                                      <input 
                                        type="number" 
                                        step="0.1"
                                        min="0"
                                        max="5"
                                        value={p.rating}
                                        onChange={(e) => updatePlayerRating(p.id, Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                                        className="w-12 bg-slate-800 border border-slate-700 rounded px-1 text-[10px] text-amber-500 font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-500">Nota: {p.rating}</p>
                                  )
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => startEditing(p)}
                                className="p-2 text-slate-500 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Editar Jogador"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => deletePlayer(p.id)}
                                className="p-2 text-rose-500 hover:bg-rose-900/30 rounded-lg transition-colors"
                                title="Excluir Jogador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {!isInGame && (
                                <button 
                                  onClick={() => addPlayerToGame(p.id)}
                                  className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors ml-2"
                                  title="Adicionar ao Jogo"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Stats */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-3 z-40">
        <div className="max-w-4xl mx-auto flex justify-around items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex flex-col items-center">
            <span className="text-amber-500 text-sm">{waitlist.length}</span>
            <span>Em Espera</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-amber-500 text-sm">{teamA.length + teamB.length}</span>
            <span>Em Quadra</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-amber-500 text-sm">{inactivePlayers.length}</span>
            <span>FORA DE JOGO</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
