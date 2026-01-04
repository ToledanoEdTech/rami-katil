
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, GameStats, LeaderboardEntry, ShopItem, Achievement, Sugia } from './types';
import { SHOP_ITEMS, SCRIPT_URL, ACHIEVEMENTS, SUGIOT } from './constants';
import { Sound } from './utils/sound';
import { GameEngine, GameConfig } from './game/GameEngine';

const safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const safeInt = (key: string, fallback: number) => {
  const val = localStorage.getItem(key);
  return val ? parseInt(val, 10) : fallback;
};

const GoldCoin = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block align-middle">
    <circle cx="12" cy="12" r="10" fill="#FBBF24" stroke="#B45309" strokeWidth="2"/>
    <circle cx="12" cy="12" r="7" stroke="#D97706" strokeWidth="1" strokeDasharray="2 2"/>
    <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="12" fontWeight="900" fill="#92400E" fontFamily="Arial">$</text>
  </svg>
);

function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [coins, setCoins] = useState(safeInt('coins', 0));
  const [isPaused, setIsPaused] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(() => safeParse('achievements', []));
  const [unlockNotification, setUnlockNotification] = useState<Achievement | null>(null);
  const [maxLevelReached, setMaxLevelReached] = useState(() => safeInt('maxLevel', 1));
  const [selectedSugia, setSelectedSugia] = useState<Sugia | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const [inventory, setInventory] = useState(() => ({
    bombs: safeInt('bombs', 1),
    shields: safeInt('shields', 0),
    potions: safeInt('potions', 0),
    skins: safeParse('skins', ["skin_default"]),
    currentSkin: localStorage.getItem('currentSkin') || 'skin_default'
  }));
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const animationFrameId = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastTouchRef = useRef<{x: number, y: number} | null>(null);
  const isInputOnUI = useRef(false);
  
  const [stats, setStats] = useState<GameStats>({
    score: 0, level: 1, lives: 3, combo: 0, coins: 0, bombs: 0, shields: 0, potions: 0,
    hasShield: false, bossActive: false, bossHpPercent: 0, currentWord: 'טוען...', weaponAmmo: 0, sugiaTitle: ''
  });

  const [feedback, setFeedback] = useState<{msg: string, isGood: boolean} | null>(null);
  const [config, setConfig] = useState<GameConfig>({
      difficulty: 'medium',
      category: 'common',
      skin: inventory.currentSkin
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerClass, setPlayerClass] = useState('');

  useEffect(() => {
    Sound.init();
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    if (gameState === 'MENU') {
      Sound.startMusic('menu');
    }
  }, []);

  useEffect(() => {
    if (displayScore < stats.score) {
      const diff = stats.score - displayScore;
      const step = Math.ceil(diff / 10);
      const timer = setTimeout(() => setDisplayScore(displayScore + step), 30);
      return () => clearTimeout(timer);
    }
  }, [stats.score, displayScore]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(SCRIPT_URL);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      if (Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    setUnlockedAchievements(prev => {
      if (prev.includes(id)) return prev;
      const newUnlocked = [...prev, id];
      localStorage.setItem('achievements', JSON.stringify(newUnlocked));
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        setUnlockNotification(ach);
        Sound.play('powerup');
        setTimeout(() => setUnlockNotification(null), 4000);
      }
      return newUnlocked;
    });
  }, []);

  const gameLoop = useCallback((time: number) => {
    if (engineRef.current) {
        const deltaTime = lastTimeRef.current ? (time - lastTimeRef.current) / (1000 / 60) : 1;
        lastTimeRef.current = time;
        
        engineRef.current.update(Math.min(deltaTime, 2.0)); 
        engineRef.current.draw();
        animationFrameId.current = requestAnimationFrame(gameLoop);
    }
  }, []);

  const startGame = (sugia?: Sugia) => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    engineRef.current = null;
    lastTimeRef.current = 0;
    setDisplayScore(0);
    setStats({
        score: 0, level: sugia ? sugia.requiredLevel : 1, lives: 3, combo: 0, coins: 0, 
        bombs: inventory.bombs, shields: inventory.shields, potions: inventory.potions,
        hasShield: false, bossActive: false, bossHpPercent: 0, currentWord: 'מתחיל...', weaponAmmo: 0,
        sugiaTitle: sugia?.title || 'פתיחת הסוגיא'
    });
    
    Sound.resume();
    Sound.play('ui_click');
    Sound.startMusic('game');
    setGameState('PLAYING');
    setIsPaused(false);
    
    requestAnimationFrame((time) => {
        if(canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
            
            engineRef.current = new GameEngine(
                canvasRef.current,
                { 
                  ...config, 
                  skin: inventory.currentSkin, 
                  location: sugia?.location || 'nehardea',
                  modifier: sugia?.modifier || 'wave',
                  sugiaTitle: sugia?.title || 'פתיחת הסוגיא'
                },
                { bombs: inventory.bombs, shields: inventory.shields, potions: inventory.potions },
                {
                    onStatsUpdate: (s: any) => {
                        setStats(prev => {
                            const newStats = {...prev, ...s};
                            if (newStats.level > maxLevelReached) {
                              setMaxLevelReached(newStats.level);
                              localStorage.setItem('maxLevel', newStats.level.toString());
                            }
                            return newStats;
                        });
                    },
                    onGameOver: (finalScore: number) => {
                        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                        setGameState('GAMEOVER');
                        Sound.startMusic('menu');
                        const earned = Math.floor(finalScore / 20);
                        const newCoins = coins + earned;
                        setCoins(newCoins);
                        localStorage.setItem('coins', newCoins.toString());
                    },
                    onFeedback: (msg: string, isGood: boolean) => {
                        setFeedback({msg, isGood});
                        setTimeout(() => setFeedback(null), 1200);
                    },
                    onAchievement: (id: string) => {
                        unlockAchievement(id);
                    }
                }
            );
            lastTimeRef.current = time;
            animationFrameId.current = requestAnimationFrame(gameLoop);
        }
    });
  };

  const handleReturnToMenu = () => {
    if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    engineRef.current = null;
    Sound.play('ui_click');
    Sound.startMusic('menu');
    setGameState('MENU');
  };

  const navigateTo = (state: GameState) => {
    Sound.play('ui_click');
    setGameState(state);
  };

  useEffect(() => {
      const handleResize = () => { if(engineRef.current) engineRef.current.resize(window.innerWidth, window.innerHeight); };
      
      const handleMove = (e: any) => {
          if(!engineRef.current || gameState !== 'PLAYING' || isInputOnUI.current) return;
          
          if (e.touches) {
              const touch = e.touches[0];
              if (lastTouchRef.current) {
                  // חישוב תזוזה יחסית - מונע קפיצות במובייל
                  const dx = touch.clientX - lastTouchRef.current.x;
                  const dy = touch.clientY - lastTouchRef.current.y;
                  engineRef.current.movePlayer(dx, dy);
              }
              lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
              e.preventDefault();
          } else {
              // במחשב התנועה נשארת ישירה (עוקבת אחרי הסמן)
              engineRef.current.setPlayerPos(e.clientX, e.clientY);
          }
      };

      const handleTouchStart = (e: TouchEvent) => {
          if(!engineRef.current || gameState !== 'PLAYING') return;
          
          // בדיקה האם המגע התחיל על כפתור - אם כן, נתעלם ממנו לצורכי תנועה
          const target = e.target as HTMLElement;
          if (target.closest('button')) {
            isInputOnUI.current = true;
            lastTouchRef.current = null;
            return;
          }
          
          isInputOnUI.current = false;
          lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      };

      const handleTouchEnd = () => {
          lastTouchRef.current = null;
          isInputOnUI.current = false;
      };

      const handleInput = (e: any) => { 
          if(!engineRef.current || e.target.closest('button') || isPaused || gameState !== 'PLAYING') return; 
          if (!isMobile) {
            engineRef.current.fire(); 
          }
      };
      
      const handleKey = (e: KeyboardEvent) => {
          if (e.target instanceof HTMLInputElement) return;
          if (e.code === 'Escape' && gameState === 'PLAYING') {
              if (engineRef.current) { const paused = engineRef.current.togglePause(); setIsPaused(paused); Sound.play('ui_click'); }
              return;
          }
          if(!engineRef.current || isPaused || gameState !== 'PLAYING') return;
          
          if(e.code === 'KeyA') engineRef.current.useBomb();
          if(e.code === 'KeyS') engineRef.current.useShield();
          if(e.code === 'KeyD') engineRef.current.usePotion();
          if(e.code === 'Space') engineRef.current.fire();
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove, {passive: false});
      window.addEventListener('touchstart', handleTouchStart);
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('mousedown', handleInput);
      window.addEventListener('keydown', handleKey);
      
      return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('mousemove', handleMove);
          window.removeEventListener('touchmove', handleMove);
          window.removeEventListener('touchstart', handleTouchStart);
          window.removeEventListener('touchend', handleTouchEnd);
          window.removeEventListener('mousedown', handleInput);
          window.removeEventListener('keydown', handleKey);
      };
  }, [gameLoop, isPaused, gameState, isMobile]);

  const buyItem = (item: ShopItem) => {
    if (item.requiredAchievement && !unlockedAchievements.includes(item.requiredAchievement)) {
      const achName = ACHIEVEMENTS.find(a => a.id === item.requiredAchievement)?.title;
      alert(`פריט זה נעול! עליך להשיג את ההישג "${achName}" כדי לקנות אותו.`);
      return;
    }

    if (coins >= item.price) {
        const newCoins = coins - item.price;
        setCoins(newCoins);
        localStorage.setItem('coins', newCoins.toString());
        if(item.type === 'skin') {
            const newSkins = [...inventory.skins, item.id];
            setInventory(prev => ({...prev, skins: newSkins}));
            localStorage.setItem('skins', JSON.stringify(newSkins));
            const allSkins = SHOP_ITEMS.filter(i => i.type === 'skin').map(i => i.id);
            if (allSkins.every(sId => newSkins.includes(sId))) { unlockAchievement('gamir'); }
        } else {
            let key: 'bombs'|'shields'|'potions' = item.id.includes('bomb') ? 'bombs' : item.id.includes('shield') ? 'shields' : 'potions';
            const newVal = (inventory[key] as number) + 1;
            setInventory(prev => ({...prev, [key]: newVal}));
            localStorage.setItem(key, newVal.toString());
        }
        Sound.play('powerup');
    } else { alert('אין לך מספיק מטבעות!'); }
};

const equipSkin = (id: string) => {
    Sound.play('ui_click');
    setInventory(prev => ({...prev, currentSkin: id}));
    localStorage.setItem('currentSkin', id);
    setConfig(prev => ({...prev, skin: id}));
};

  const ControlsDisplay = () => (
    <div className="mt-4 md:mt-8 bg-slate-900/60 p-4 rounded-xl border border-slate-700 text-sm text-slate-300 backdrop-blur-sm shadow-2xl">
      <h3 className="font-bold mb-2 text-white border-b border-slate-700/50 pb-1">מקשי המשחק:</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-right">
        <div className="flex justify-between gap-4"><span>תנועה:</span> <span className="text-amber-400 font-bold">עכבר / מגע</span></div>
        <div className="flex justify-between gap-4"><span>ירי:</span> <span className="text-amber-400 font-bold">{isMobile ? "כפתור 🔥" : "קליק / רווח"}</span></div>
        <div className="flex justify-between gap-4"><span>פצצה:</span> <span className="text-amber-400 font-bold">A</span></div>
        <div className="flex justify-between gap-4"><span>מגן:</span> <span className="text-amber-400 font-bold">S</span></div>
        <div className="flex justify-between gap-4"><span>שיקוי זמן:</span> <span className="text-amber-400 font-bold">D</span></div>
        <div className="flex justify-between gap-4"><span>עצירה:</span> <span className="text-amber-400 font-bold">Esc</span></div>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-screen bg-slate-950 text-white overflow-hidden select-none font-rubik" dir="rtl" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {unlockNotification && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce-slow pointer-events-none w-full max-w-sm px-4">
          <div className="bg-gradient-to-r from-amber-600 to-yellow-400 p-1 rounded-2xl shadow-2xl">
            <div className="bg-slate-900 rounded-xl px-4 py-3 md:px-8 md:py-4 flex items-center gap-4 md:gap-6 border border-amber-400/30">
              <span className="text-3xl md:text-5xl">{unlockNotification.icon}</span>
              <div className="text-right">
                <div className="text-amber-400 font-black text-xs md:text-sm uppercase tracking-widest">הישג חדש!</div>
                <div className="text-white font-black text-lg md:text-2xl">{unlockNotification.title}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 pointer-events-none p-3 md:p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start gap-2">
                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl md:rounded-2xl p-2 md:p-4 border border-slate-700 shadow-2xl min-w-[100px] md:min-w-[140px]">
                    <div className="text-amber-400 font-black text-lg md:text-2xl flex items-center gap-1 md:gap-2">
                      <GoldCoin size={18} /> {displayScore.toLocaleString()}
                    </div>
                    <div className="text-slate-400 text-[10px] md:text-xs font-bold mt-1 uppercase truncate max-w-[80px] md:max-w-none">{stats.sugiaTitle}</div>
                    <div className="text-slate-500 text-[8px] md:text-[10px] font-bold uppercase">שלב {stats.level}</div>
                    {stats.weaponAmmo && stats.weaponAmmo > 0 && stats.weaponAmmo < 9000 && (
                        <div className="text-red-400 text-[10px] font-black mt-1">תחמושת: {stats.weaponAmmo}</div>
                    )}
                </div>
                
                <div className="text-center absolute left-1/2 -translate-x-1/2 top-4 md:top-6 w-full max-w-[200px] md:max-w-lg z-10">
                    <div className="font-aramaic text-3xl md:text-6xl text-white drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] md:drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]"
                         style={{ textShadow: '2px 2px 0 #000, -1px -1px 0 #000' }}>
                        {stats.currentWord}
                    </div>
                    {stats.bossActive && (
                        <div className="w-32 md:w-64 h-2 md:h-4 bg-slate-800 rounded-full mt-3 md:mt-6 overflow-hidden border border-red-900/50 shadow-inner mx-auto">
                            <div className="h-full bg-gradient-to-l from-red-600 to-red-400 transition-all duration-300" style={{width: `${stats.bossHpPercent}%`}}></div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900/80 backdrop-blur-md rounded-xl md:rounded-2xl p-2 md:p-4 border border-slate-700 shadow-2xl text-left min-w-[80px] md:min-w-[120px]">
                    <div className="text-red-500 text-lg md:text-2xl">{"❤️".repeat(Math.max(0, stats.lives))}</div>
                </div>
            </div>

            <div className="flex justify-between items-end w-full pb-4 md:pb-0">
                <div className="flex flex-col gap-4 md:gap-6 pointer-events-auto">
                    <AbilityButton icon="💣" count={stats.bombs} color="red" onClick={() => engineRef.current?.useBomb()} label="פצצה" shortcut="A" />
                    <AbilityButton icon="🛡️" count={stats.shields} color="blue" onClick={() => engineRef.current?.useShield()} label="מגן" shortcut="S" />
                    <AbilityButton icon="⏳" count={stats.potions} color="purple" onClick={() => engineRef.current?.usePotion()} label="זמן" shortcut="D" />
                </div>
                
                <div className="flex flex-col gap-4 items-center pointer-events-auto">
                    {isMobile && (
                      <button 
                        onPointerDown={(e) => { e.preventDefault(); engineRef.current?.fire(); }}
                        // הקטנת כפתור הירי במובייל מ-20 ל-16
                        className="w-16 h-16 bg-red-600/30 rounded-full border-4 border-white/30 flex items-center justify-center text-3xl shadow-2xl active:scale-90 active:bg-red-600/50 backdrop-blur-sm"
                      >
                        🔥
                      </button>
                    )}
                    <button onClick={() => { if (engineRef.current) { const paused = engineRef.current.togglePause(); setIsPaused(paused); Sound.play('ui_click'); } }}
                       className="pointer-events-auto w-14 h-14 bg-slate-800/80 rounded-full flex items-center justify-center text-2xl border border-slate-600 active:scale-90">
                       ⏸️
                    </button>
                </div>
            </div>

            {isPaused && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto flex flex-col items-center justify-center z-[100] p-6">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 drop-shadow-2xl">הפסקה</h2>
                    <div className="flex flex-col gap-4 md:gap-6 w-full max-w-xs">
                        <button onClick={() => { engineRef.current?.togglePause(); setIsPaused(false); Sound.play('ui_click'); }} className="bg-blue-600 p-4 md:p-5 rounded-2xl text-xl md:text-2xl font-black shadow-xl active:scale-95 border-b-4 border-blue-900">המשך</button>
                        <button onClick={handleReturnToMenu} className="bg-slate-700 p-4 md:p-5 rounded-2xl text-xl md:text-2xl font-black shadow-xl active:scale-95 border-b-4 border-slate-900">תפריט ראשי</button>
                        <ControlsDisplay />
                    </div>
                </div>
            )}
        </div>
      )}

      {feedback && (
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl md:text-4xl font-black drop-shadow-2xl transition-all transform scale-110 duration-300 z-50 text-center
            ${feedback.isGood ? 'text-amber-400' : 'text-red-500'}`}>
              <div className="font-aramaic mb-1">{feedback.msg}</div>
          </div>
      )}

      {gameState === 'MENU' && (
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000')] bg-cover bg-center flex items-center justify-center">
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"></div>
              <div className="relative z-10 flex flex-col items-center p-4 md:p-8 w-full max-w-xl text-center overflow-y-auto max-h-full">
                  <h1 className="font-aramaic text-6xl md:text-9xl bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] mb-2 md:mb-4 animate-bounce-slow">
                      רמי וקטיל
                  </h1>
                  <p className="text-slate-300 mb-6 md:mb-8 text-lg md:text-2xl font-light tracking-widest border-b border-amber-500/30 pb-2">אלוף הארמית - גרסת הקרב</p>
                  
                  <div className="flex flex-col gap-4 md:gap-6 w-full px-2 md:px-4">
                      <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div className="flex flex-col gap-1 text-right">
                          <label className="text-slate-500 text-[10px] md:text-xs font-bold mr-2">רמת קושי</label>
                          <select className="bg-slate-900 border border-slate-700 p-2 md:p-3 rounded-xl text-sm md:text-lg text-white outline-none"
                            value={config.difficulty} onChange={e => { setConfig({...config, difficulty: e.target.value as any}); Sound.play('ui_click'); }}>
                              <option value="easy">🌟 קל</option>
                              <option value="medium">🔥🔥 בינוני</option>
                              <option value="hard">⚡⚡⚡ קשה</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                          <label className="text-slate-500 text-[10px] md:text-xs font-bold mr-2">קטגוריית מילים</label>
                          <select className="bg-slate-900 border border-slate-700 p-2 md:p-3 rounded-xl text-sm md:text-lg text-white outline-none"
                            value={config.category} onChange={e => { setConfig({...config, category: e.target.value as any}); Sound.play('ui_click'); }}>
                              <option value="common">📖 מילים נפוצות</option>
                              <option value="berachot">🍷 מסכת ברכות</option>
                              <option value="bava_kamma">⚖️ מסכת בבא קמא</option>
                          </select>
                        </div>
                      </div>

                      <button onClick={() => navigateTo('MAP')} className="group relative bg-gradient-to-r from-amber-700 to-amber-500 p-4 md:p-6 rounded-2xl text-2xl md:text-4xl font-black shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:scale-105 transition-all border-b-4 border-amber-900 active:translate-y-1 active:border-b-0 overflow-hidden">
                          נתיב הסוגיות
                      </button>
                      <div className="grid grid-cols-3 gap-2 md:gap-4">
                          <button onClick={() => navigateTo('SHOP')} className="bg-slate-800/80 p-3 md:p-5 rounded-xl border border-slate-700 text-sm md:text-xl font-bold transition-all shadow-lg">🛒 חנות</button>
                          <button onClick={() => { fetchLeaderboard(); navigateTo('LEADERBOARD'); }} className="bg-amber-800/80 p-3 md:p-5 rounded-xl border border-amber-700 text-sm md:text-xl font-bold transition-all shadow-lg">🏆 אלופים</button>
                          <button onClick={() => navigateTo('ACHIEVEMENTS')} className="bg-purple-800/80 p-3 md:p-5 rounded-xl border border-purple-700 text-sm md:text-xl font-bold transition-all shadow-lg">📜 הישגים</button>
                      </div>
                      
                      <div className="hidden md:block">
                        <ControlsDisplay />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Map, Shop, Leaderboard, Achievements screens... */}
      {/* ... keeping other screens logic same but updating button sizes where applicable ... */}

      {gameState === 'MAP' && (
          <div className="absolute inset-0 bg-[#fbf3db] flex flex-col z-[50] overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/parchment.png')]"></div>
              <div className="absolute inset-0 border-[10px] md:border-[30px] border-amber-900/10 pointer-events-none"></div>

              <div className="relative z-10 p-4 md:p-8 flex justify-between items-center bg-amber-900/10 border-b-4 border-amber-900/30 backdrop-blur-sm">
                <button onClick={handleReturnToMenu} className="bg-amber-800 text-white px-4 py-2 md:px-8 md:py-3 rounded-xl font-bold text-sm md:text-lg shadow-lg">חזור</button>
                <h2 className="text-3xl md:text-6xl font-aramaic text-amber-900 font-black tracking-tighter">דף הסוגיות</h2>
                <div className="bg-white/60 px-3 py-1 md:px-6 md:py-2 rounded-full border-2 border-amber-900/30 font-black text-amber-900 text-xs md:text-base">רמה: {maxLevelReached}</div>
              </div>
              
              <div className="flex-1 relative flex items-center justify-start p-6 md:p-12 overflow-x-auto scrollbar-hide">
                  <div className="flex gap-10 md:gap-20 px-10 md:px-24 relative min-w-max">
                      {SUGIOT.map((sugia, idx) => {
                          const isUnlocked = maxLevelReached >= sugia.requiredLevel;
                          const isSelected = selectedSugia?.id === sugia.id;
                          const dafLabel = sugia.title.split(' ')[0] + ' ' + sugia.title.split(' ')[1];

                          return (
                              <div key={sugia.id} className="relative group flex flex-col items-center">
                                  {idx < SUGIOT.length - 1 && (
                                    <div className={`absolute top-16 md:top-24 left-[7rem] md:left-[10rem] w-12 md:w-20 h-1 ${maxLevelReached >= SUGIOT[idx+1].requiredLevel ? 'bg-amber-600' : 'bg-amber-900/10'}`}></div>
                                  )}

                                  <div onClick={() => { if(isUnlocked) { Sound.play('ui_click'); setSelectedSugia(sugia); } }}
                                      className={`w-24 h-32 md:w-36 md:h-48 rounded-lg border-2 flex flex-col items-center justify-center text-2xl md:text-4xl font-aramaic transition-all cursor-pointer relative shadow-2xl
                                          ${isUnlocked ? (isSelected ? 'border-amber-600 bg-amber-50 scale-110 -translate-y-2 md:-translate-y-4 ring-4 ring-amber-400/20' : 'border-amber-900/30 bg-white hover:border-amber-700') : 'border-slate-300 bg-slate-100 grayscale opacity-40 cursor-not-allowed'}`}>
                                      <div className="text-amber-900/30 absolute top-1 right-1 text-[8px] md:text-[10px] font-bold">סוגיא {idx+1}</div>
                                      <div className="text-amber-900 font-black mb-1 md:mb-2">{isUnlocked ? String.fromCharCode(0x5D0 + (idx % 22)) : '🔒'}</div>
                                      <div className="text-amber-800/50 text-[8px] md:text-[10px] font-bold">{dafLabel}</div>
                                  </div>
                                  <div className={`mt-3 md:mt-6 font-black text-xs md:text-base text-center leading-tight max-w-[100px] md:max-w-[140px] ${isUnlocked ? 'text-amber-950' : 'text-slate-400'}`}>{sugia.title}</div>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {selectedSugia && (
                  <div className="bg-white/95 backdrop-blur-lg p-4 md:p-10 border-t-4 md:border-t-8 border-amber-900/40 flex flex-col md:flex-row items-center justify-between z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] animate-slide-up gap-4">
                      <div className="text-right w-full md:w-auto">
                          <h3 className="text-2xl md:text-4xl font-black text-amber-900 mb-1 font-aramaic">{selectedSugia.title}</h3>
                          <p className="text-sm md:text-xl text-amber-800/70 italic max-w-2xl">{selectedSugia.description}</p>
                      </div>
                      <button onClick={() => startGame(selectedSugia)} className="w-full md:w-auto bg-gradient-to-r from-blue-700 to-blue-500 text-white px-10 md:px-20 py-4 md:py-6 rounded-2xl text-2xl md:text-4xl font-black shadow-2xl active:scale-95 border-b-4 md:border-b-8 border-blue-900">התחל בסוגיא</button>
                  </div>
              )}
          </div>
      )}

      {gameState === 'SHOP' && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center p-4 md:p-8 z-20 overflow-y-auto">
              <div className="w-full max-w-5xl">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-12 border-b border-slate-800 pb-4 md:pb-6 gap-4">
                  <h2 className="text-4xl md:text-6xl font-aramaic text-amber-500 drop-shadow-lg">חנות הציוד</h2>
                  <div className="text-2xl md:text-4xl font-black text-white bg-slate-900 px-6 py-2 md:px-8 md:py-3 rounded-full border border-slate-700 shadow-inner flex items-center gap-3">
                    {coins.toLocaleString()} <GoldCoin size={24} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-8 md:mb-12">
                    {SHOP_ITEMS.map(item => {
                        const owned = item.type === 'skin' ? inventory.skins.includes(item.id) : false;
                        const equipped = inventory.currentSkin === item.id;
                        const locked = item.requiredAchievement && !unlockedAchievements.includes(item.requiredAchievement);
                        
                        return (
                            <div key={item.id} onClick={() => owned && item.type === 'skin' ? equipSkin(item.id) : buyItem(item)}
                              className={`relative p-3 md:p-6 rounded-2xl md:rounded-3xl border-2 flex flex-col items-center text-center cursor-pointer transition-all duration-300 group
                                  ${equipped ? 'border-amber-400 bg-amber-900/20 shadow-lg' : 'border-slate-800 bg-slate-900/50'}
                                  ${locked ? 'opacity-60 grayscale cursor-not-allowed' : ''}
                              `}>
                                <div className="text-4xl md:text-7xl mb-3 md:mb-6 transform group-hover:scale-110 transition-transform">{item.icon}</div>
                                <h3 className="font-black text-white text-sm md:text-2xl mb-1 md:mb-2">{item.name}</h3>
                                <p className="text-[10px] md:text-sm text-slate-400 mb-3 md:mb-6 flex-1 line-clamp-2">{item.desc}</p>
                                <div className={`w-full py-2 md:py-3 rounded-xl font-black text-xs md:text-base flex items-center justify-center gap-1 md:gap-2 ${owned && item.type === 'skin' ? (equipped ? 'bg-green-600' : 'bg-slate-700') : 'bg-amber-600'}`}>
                                  {locked ? '🔒 נעול' : (owned && item.type === 'skin' ? (equipped ? 'בשימוש' : 'בחר') : <>{item.price} <GoldCoin size={14} /></>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button onClick={handleReturnToMenu} className="bg-slate-700 px-10 md:px-16 py-3 md:py-4 rounded-2xl text-xl md:text-2xl font-black mx-auto block">חזור</button>
              </div>
          </div>
      )}

      {/* Same for Leaderboard and Achievements... */}
      {gameState === 'LEADERBOARD' && (
          <div className="absolute inset-0 bg-slate-950/98 flex flex-col items-center p-4 md:p-8 z-20 overflow-y-auto">
              <div className="w-full max-w-4xl">
                  <h2 className="text-4xl md:text-7xl font-aramaic text-amber-500 text-center mb-6 md:mb-12">טבלת האלופים</h2>
                  {loading ? (
                      <div className="text-xl md:text-3xl text-center text-slate-400 animate-pulse">טוען נתונים...</div>
                  ) : (
                      <div className="bg-slate-900/50 rounded-2xl md:rounded-3xl border border-slate-800 overflow-hidden mb-6 md:mb-12">
                          <table className="w-full text-right border-collapse text-xs md:text-base">
                              <thead className="bg-slate-800 text-slate-400 uppercase tracking-widest font-black">
                                  <tr>
                                      <th className="p-3 md:p-6">מיקום</th>
                                      <th className="p-3 md:p-6">שם</th>
                                      <th className="p-3 md:p-6">כיתה</th>
                                      <th className="p-3 md:p-6">ניקוד</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {leaderboard.map((entry, idx) => (
                                      <tr key={idx} className={`border-b border-slate-800 ${idx === 0 ? 'bg-amber-900/10' : ''}`}>
                                          <td className="p-3 md:p-6 text-lg md:text-2xl font-black text-slate-500">{idx + 1}</td>
                                          <td className="p-3 md:p-6 text-sm md:text-xl font-bold text-white truncate max-w-[80px] md:max-w-none">{entry.name}</td>
                                          <td className="p-3 md:p-6 text-xs md:text-lg text-slate-400 truncate max-w-[60px] md:max-w-none">{entry.class}</td>
                                          <td className="p-3 md:p-6 text-sm md:text-2xl font-black text-amber-400 flex items-center gap-1">
                                            {entry.score.toLocaleString()} <GoldCoin size={14} />
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  )}
                  <button onClick={handleReturnToMenu} className="bg-slate-700 px-10 md:px-16 py-3 md:py-4 rounded-2xl text-xl md:text-2xl font-black mx-auto block">חזור</button>
              </div>
          </div>
      )}

      {gameState === 'ACHIEVEMENTS' && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center p-4 md:p-8 z-20 overflow-y-auto">
              <div className="w-full max-w-4xl">
                  <h2 className="text-4xl md:text-7xl font-aramaic text-purple-400 text-center mb-6 md:mb-12">הישגים תורניים</h2>
                  <div className="space-y-4 md:space-y-6 mb-8 md:mb-12">
                      {ACHIEVEMENTS.map(ach => {
                          const unlocked = unlockedAchievements.includes(ach.id);
                          return (
                              <div key={ach.id} className={`flex items-center gap-4 md:gap-8 p-4 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all ${unlocked ? 'border-purple-500 bg-purple-900/20' : 'border-slate-800 bg-slate-900/30 grayscale opacity-40'}`}>
                                  <div className="text-4xl md:text-8xl">{ach.icon}</div>
                                  <div className="text-right flex-1">
                                      <h3 className="text-xl md:text-4xl font-black text-white mb-1">{ach.title}</h3>
                                      <p className="text-xs md:text-xl text-slate-400">{ach.desc}</p>
                                  </div>
                                  {unlocked && <div className="text-green-400 font-black text-xs md:text-lg">הושלם!</div>}
                              </div>
                          );
                      })}
                  </div>
                  <button onClick={handleReturnToMenu} className="bg-slate-700 px-10 md:px-16 py-3 md:py-4 rounded-2xl text-xl md:text-2xl font-black mx-auto block">חזור</button>
              </div>
          </div>
      )}

      {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-slate-950/98 flex flex-col items-center justify-center p-4 md:p-8 z-30 overflow-y-auto">
              <h2 className="text-5xl md:text-8xl text-red-600 font-black mb-4 font-aramaic">המשחק נגמר</h2>
              <div className="text-2xl md:text-4xl text-amber-500 font-black mb-8 md:mb-12 bg-slate-900 px-6 py-3 md:px-12 md:py-5 rounded-3xl border-2 border-amber-600/30 shadow-2xl flex items-center gap-2 md:gap-4">
                ניקוד: {stats.score.toLocaleString()} <GoldCoin size={24} />
              </div>
              <div className="bg-slate-900/80 p-6 md:p-8 rounded-3xl w-full max-w-md mb-8 md:mb-12 border border-slate-800">
                  <h3 className="text-xl md:text-2xl text-white font-black mb-4 md:mb-6 text-center">שמור תוצאה</h3>
                  <div className="space-y-3 md:space-y-4">
                    <input type="text" placeholder="שם מלא" value={playerName} onChange={e => setPlayerName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 md:p-4 text-center text-white text-lg md:text-xl font-bold outline-none" />
                    <input type="text" placeholder="כיתה / קבוצה" value={playerClass} onChange={e => setPlayerClass(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 md:p-4 text-center text-white text-lg md:text-xl font-bold outline-none" />
                    <button onClick={() => {
                        if(!playerName || !playerClass) return alert('נא למלא פרטים');
                        setLoading(true);
                        fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ name: playerName, class: playerClass, score: stats.score }) })
                          .then(() => { setLoading(false); alert('הציון נשמר!'); handleReturnToMenu(); })
                          .catch(() => { setLoading(false); alert('שגיאה בשמירה'); });
                    }} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 py-3 md:py-4 rounded-xl font-black text-white text-xl md:text-2xl shadow-xl transition-all disabled:opacity-50">
                        {loading ? 'שומר...' : 'שמור בטבלה'}
                    </button>
                  </div>
              </div>
              <div className="flex gap-2 md:gap-4 w-full max-w-md">
                  <button onClick={() => startGame(selectedSugia || undefined)} className="flex-1 bg-blue-600 px-4 py-3 md:px-8 md:py-5 rounded-2xl font-black text-sm md:text-xl transition-all">שוב</button>
                  <button onClick={() => {
                      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
                      engineRef.current = null;
                      Sound.play('ui_click');
                      setGameState('MAP');
                  }} className="flex-1 bg-amber-700 px-4 py-3 md:px-8 md:py-5 rounded-2xl font-black text-sm md:text-xl transition-all">מפה</button>
                  <button onClick={handleReturnToMenu} className="flex-1 bg-slate-800 px-4 py-3 md:px-8 md:py-5 rounded-2xl font-black text-sm md:text-xl transition-all">תפריט</button>
              </div>
          </div>
      )}
    </div>
  );
}

const AbilityButton = ({icon, count, color, onClick, label, shortcut}: {icon:string, count:number, color:string, onClick: () => void, label: string, shortcut: string}) => {
    const bg = color === 'red' ? 'bg-red-600 active:bg-red-700' : color === 'blue' ? 'bg-blue-600 active:bg-blue-700' : 'bg-purple-600 active:bg-purple-700';
    return (
        <div className="flex flex-col items-center gap-1 group pointer-events-auto">
          <button onClick={(e) => { e.stopPropagation(); Sound.play('ui_click'); onClick(); }} disabled={count <= 0}
              // הקטנת כפתורי היכולות במובייל מ-14 ל-12
              className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-xl md:text-4xl relative shadow-2xl border-b-4 active:border-b-0 active:translate-y-1 transition-all text-white
              ${count > 0 ? bg : 'bg-slate-800 grayscale opacity-40 cursor-not-allowed'}`}>
              {icon}
              <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-white text-slate-950 font-black text-[8px] md:text-sm px-1 md:px-2 py-0.5 rounded-full shadow-lg border border-slate-950">{count}</span>
          </button>
          <div className="hidden md:flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-[10px] font-black tracking-widest uppercase">{label} ({shortcut})</span>
          </div>
        </div>
    )
}

export default App;
