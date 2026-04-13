import React, { useState, useCallback, useMemo } from 'react';
import { Player, Gender, HistoryEntry } from './types';
import { INITIAL_PLAYERS } from './constants';
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
  User,
  Pencil,
  Check,
  X,
  UserMinus,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

export default function App() {
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('volei_allPlayers');
    return saved ? JSON.parse(saved) : INITIAL_PLAYERS;
  });
  const [waitlist, setWaitlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('volei_waitlist');
    return saved ? JSON.parse(saved) : [];
  });
  const [teamA, setTeamA] = useState<Player[]>(() => {
    const saved = localStorage.getItem('volei_teamA');
    return saved ? JSON.parse(saved) : [];
  });
  const [teamB, setTeamB] = useState<Player[]>(() => {
    const saved = localStorage.getItem('volei_teamB');
    return saved ? JSON.parse(saved) : [];
  });
  const [consecutiveWinsA, setConsecutiveWinsA] = useState(() => {
    const saved = localStorage.getItem('volei_winsA');
    return saved ? parseInt(saved) : 0;
  });
  const [consecutiveWinsB, setConsecutiveWinsB] = useState(() => {
    const saved = localStorage.getItem('volei_winsB');
    return saved ? parseInt(saved) : 0;
  });
  const [showRatings, setShowRatings] = useState(true);
  const [lockedPlayers, setLockedPlayers] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('volei_locked');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [nextQueueNumber, setNextQueueNumber] = useState(() => {
    const saved = localStorage.getItem('volei_nextQueueNumber');
    return saved ? parseInt(saved) : 1;
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Persistence
  React.useEffect(() => {
    localStorage.setItem('volei_allPlayers', JSON.stringify(allPlayers));
    localStorage.setItem('volei_waitlist', JSON.stringify(waitlist));
    localStorage.setItem('volei_teamA', JSON.stringify(teamA));
    localStorage.setItem('volei_teamB', JSON.stringify(teamB));
    localStorage.setItem('volei_winsA', consecutiveWinsA.toString());
    localStorage.setItem('volei_winsB', consecutiveWinsB.toString());
    localStorage.setItem('volei_locked', JSON.stringify(Array.from(lockedPlayers)));
    localStorage.setItem('volei_nextQueueNumber', nextQueueNumber.toString());
  }, [allPlayers, waitlist, teamA, teamB, consecutiveWinsA, consecutiveWinsB, lockedPlayers, nextQueueNumber]);

  // Safety check: if no players have a queue number, nextQueueNumber should be 1
  React.useEffect(() => {
    const hasQueueNumbers = allPlayers.some(p => p.queueNumber !== undefined);
    if (!hasQueueNumbers && nextQueueNumber !== 1 && waitlist.length === 0 && teamA.length === 0 && teamB.length === 0) {
      setNextQueueNumber(1);
    }
  }, [allPlayers, nextQueueNumber, waitlist.length, teamA.length, teamB.length]);

  // UI State
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>('H');
  const [newPlayerRating, setNewPlayerRating] = useState('2.5');
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
      setTeamA([]);
      setTeamB([]);
      setWaitlist([]);
      setConsecutiveWinsA(0);
      setConsecutiveWinsB(0);
      setNextQueueNumber(1);
      setAllPlayers(prev => prev.map(p => ({ ...p, queueNumber: undefined })));
      setLockedPlayers(new Set());
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
  };

  const addPlayerToGame = (id: string) => {
    if (waitlist.includes(id) || teamA.some(p => p.id === id) || teamB.some(p => p.id === id)) return;
    saveHistory();
    
    // Assign queue number
    setAllPlayers(prev => prev.map(p => 
      p.id === id ? { ...p, queueNumber: nextQueueNumber } : p
    ));
    setNextQueueNumber(prev => prev + 1);
    
    setWaitlist(prev => [...prev, id]);
  };

  const removePlayerFromGame = (id: string) => {
    saveHistory();
    // Clear queue number
    setAllPlayers(prev => prev.map(p => 
      p.id === id ? { ...p, queueNumber: undefined } : p
    ));
    
    setWaitlist(prev => prev.filter(pid => pid !== id));
    setTeamA(prev => prev.filter(p => p.id !== id));
    setTeamB(prev => prev.filter(p => p.id !== id));
    setLockedPlayers(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const registerPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPlayerName,
      gender: newPlayerGender,
      rating: parseFloat(newPlayerRating) || 2.5,
      isGuest: true
    };
    setAllPlayers(prev => [...prev, newPlayer]);
    setNewPlayerName('');
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
    setAllPlayers(prev => prev.map(p => 
      p.id === id 
        ? { ...p, name: editName, rating: parseFloat(editRating) || 2.5, gender: editGender }
        : p
    ));
    // Update teams if player is on court
    setTeamA(prev => prev.map(p => 
      p.id === id 
        ? { ...p, name: editName, rating: parseFloat(editRating) || 2.5, gender: editGender }
        : p
    ));
    setTeamB(prev => prev.map(p => 
      p.id === id 
        ? { ...p, name: editName, rating: parseFloat(editRating) || 2.5, gender: editGender }
        : p
    ));
    setEditingPlayerId(null);
  };

  const updatePlayerRating = (id: string, newRating: number) => {
    setAllPlayers(prev => prev.map(p => p.id === id ? { ...p, rating: newRating } : p));
    setTeamA(prev => prev.map(p => p.id === id ? { ...p, rating: newRating } : p));
    setTeamB(prev => prev.map(p => p.id === id ? { ...p, rating: newRating } : p));
  };

  const deletePlayer = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este jogador permanentemente?')) return;
    setAllPlayers(prev => prev.filter(p => p.id !== id));
    setWaitlist(prev => prev.filter(pid => pid !== id));
    setTeamA(prev => prev.filter(p => p.id !== id));
    setTeamB(prev => prev.filter(p => p.id !== id));
    setLockedPlayers(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleLock = (id: string) => {
    setLockedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  };

  const moveInWaitlist = (index: number, direction: 'up' | 'down') => {
    saveHistory();
    const newWaitlist = [...waitlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newWaitlist.length) return;
    
    // Check if either player is locked
    if (lockedPlayers.has(newWaitlist[index]) || lockedPlayers.has(newWaitlist[targetIndex])) return;

    [newWaitlist[index], newWaitlist[targetIndex]] = [newWaitlist[targetIndex], newWaitlist[index]];
    updateWaitlistAndSyncNumbers(newWaitlist);
  };

  const balanceTeams = (players: Player[]) => {
    if (players.length === 0) return { teamA: [], teamB: [] };

    const half = Math.ceil(players.length / 2);
    const women = players.filter(p => p.gender === 'M').sort((a, b) => b.rating - a.rating);
    const men = players.filter(p => p.gender === 'H').sort((a, b) => b.rating - a.rating);

    const tA: Player[] = [];
    const tB: Player[] = [];

    // Distribute women first to ensure gender balance
    women.forEach((p, i) => {
      if (tA.length < half && (tB.length === half || tA.length <= tB.length)) {
        tA.push(p);
      } else if (tB.length < half) {
        tB.push(p);
      } else {
        tA.push(p);
      }
    });

    // Distribute men to balance ratings
    men.forEach(p => {
      const sumA = tA.reduce((acc, curr) => acc + curr.rating, 0);
      const sumB = tB.reduce((acc, curr) => acc + curr.rating, 0);

      if (tA.length < half && (tB.length === half || sumA <= sumB)) {
        tA.push(p);
      } else {
        tB.push(p);
      }
    });

    return { 
      teamA: tA.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)), 
      teamB: tB.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)) 
    };
  };

  const mixTeams = () => {
    const onCourt = [...teamA, ...teamB];
    if (onCourt.length === 0) return;
    saveHistory();
    const { teamA: newA, teamB: newB } = balanceTeams(onCourt);
    setTeamA(newA);
    setTeamB(newB);
    setConsecutiveWinsA(0);
    setConsecutiveWinsB(0);
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
    
    const playersForA = toAdd.slice(0, neededA);
    const playersForB = toAdd.slice(neededA);

    setTeamA(prev => [...prev, ...playersForA]);
    setTeamB(prev => [...prev, ...playersForB]);
    setWaitlist(prev => prev.slice(toAdd.length));
  }, [teamA, teamB, waitlist, allPlayers, saveHistory]);

  const handleWin = (winner: 'A' | 'B') => {
    saveHistory();
    const losingTeam = winner === 'A' ? teamB : teamA;
    
    // Losers go to waitlist (unless locked)
    const losersToWaitlist = losingTeam
      .filter(p => !lockedPlayers.has(p.id))
      .map(p => p.id);
    
    const losersStaying = losingTeam.filter(p => lockedPlayers.has(p.id));
    
    const newConsecutiveWins = (winner === 'A' ? consecutiveWinsA : consecutiveWinsB) + 1;
    if (winner === 'A') {
      setConsecutiveWinsA(newConsecutiveWins);
      setConsecutiveWinsB(0);
    } else {
      setConsecutiveWinsB(newConsecutiveWins);
      setConsecutiveWinsA(0);
    }

    // Prepare next game
    // Take players strictly by arrival order from waitlist
    const availableFromWaitlist = waitlist.slice(0, losersToWaitlist.length);
    const newPlayers = availableFromWaitlist.map(id => allPlayers.find(p => p.id === id)!);

    if (winner === 'A') {
      setTeamB([...losersStaying, ...newPlayers]);
    } else {
      setTeamA([...losersStaying, ...newPlayers]);
    }
    
    // Update waitlist: remove those who entered, add those who left
    setWaitlist(prev => prev.slice(availableFromWaitlist.length).concat(losersToWaitlist));
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
          <div className="flex gap-2">
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
            Jogadores ({allPlayers.length})
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
                      <h3 className="font-bold">Time A</h3>
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
                      teamA.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-800 group">
                          <div className="flex items-center gap-3">
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
                                    value={p.rating}
                                    onChange={(e) => updatePlayerRating(p.id, parseFloat(e.target.value) || 0)}
                                    className="w-10 bg-transparent border-none text-[10px] text-amber-500 font-bold focus:ring-0 p-0"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => startEditing(p)}
                              className="p-1.5 text-slate-500 hover:bg-slate-700 rounded-md transition-colors"
                              title="Editar Jogador"
                            >
                              <Pencil className="w-3.5 h-3.5" />
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
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Team B */}
                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
                  <div className="bg-white p-4 text-slate-950 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold">Time B</h3>
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
                      teamB.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-800 group">
                          <div className="flex items-center gap-3">
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
                                    value={p.rating}
                                    onChange={(e) => updatePlayerRating(p.id, parseFloat(e.target.value) || 0)}
                                    className="w-10 bg-transparent border-none text-[10px] text-amber-500 font-bold focus:ring-0 p-0"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => startEditing(p)}
                              className="p-1.5 text-slate-500 hover:bg-slate-700 rounded-md transition-colors"
                              title="Editar Jogador"
                            >
                              <Pencil className="w-3.5 h-3.5" />
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
                        </div>
                      ))
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
                <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-500" />
                  Próximos da Fila
                </h3>
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
                          onDragEnd={() => saveHistory()}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-800 cursor-grab active:cursor-grabbing hover:border-amber-500/30 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-amber-500/50 transition-colors" />
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
                                    value={p.rating}
                                    onChange={(e) => updatePlayerRating(p.id, parseFloat(e.target.value) || 0)}
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
                              <button onClick={(e) => { e.stopPropagation(); moveInWaitlist(index, 'up'); }} className="p-1 hover:bg-slate-700 rounded text-slate-500"><ChevronUp className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); moveInWaitlist(index, 'down'); }} className="p-1 hover:bg-slate-700 rounded text-slate-500"><ChevronDown className="w-4 h-4" /></button>
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
                    placeholder="Nota (Padrão 2.5)" 
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
                    <h3 className="font-bold text-slate-200">Base de Dados de Jogadores</h3>
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
                                    {p.queueNumber && <span className="text-amber-500 mr-1">#{p.queueNumber}</span>}
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
                                        value={p.rating}
                                        onChange={(e) => updatePlayerRating(p.id, parseFloat(e.target.value) || 0)}
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
            <span>Inativos</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
