import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, BIKES, GameState, MAPS, MapConfig } from './types';
import { Trophy, ShoppingCart, Play, RotateCcw, Home, Map as MapIcon, Trash2, AlertTriangle } from 'lucide-react';

const GROUND_Y_OFFSET = 100; // Offset from bottom
const GRAVITY = 0.25;
const BIKE_SCALE = 2.5; // Scale factor for the bike

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    totalPoints: Number(localStorage.getItem('totalPoints')) || 0,
    currentBikeId: localStorage.getItem('currentBikeId') || 'starter',
    unlockedBikeIds: JSON.parse(localStorage.getItem('unlockedBikeIds') || '["starter"]'),
    isGameOver: false,
    distance: 0,
    currentMapId: localStorage.getItem('currentMapId') || 'city',
    comboActive: false,
    comboStage: 0,
    targetRotation: 0,
    stageTimer: 0,
    comboSuccesses: 0,
    activeMultiplier: 1,
    multiplierTimer: 0,
  });
  const [view, setView] = useState<'menu' | 'game' | 'shop' | 'maps'>('menu');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Game loop refs
  const requestRef = useRef<number>(null);
  const bikeRef = useRef({
    x: 100,
    y: 0,
    vx: 0,
    vy: 0,
    rotation: 0,
    vRotation: 0,
    isWheelie: false,
    wheelieTime: 0,
  });

  const bikeImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = 'https://images.unsplash.com/photo-1614165933834-1db511494424?q=80&w=1000&auto=format&fit=crop';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      bikeImageRef.current = img;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);

  const groundLevel = dimensions.height - 60;
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const currentBike = BIKES.find(b => b.id === gameState.currentBikeId) || BIKES[0];
  const currentMap = MAPS.find(m => m.id === gameState.currentMapId) || MAPS[0];

  const saveGame = useCallback((points: number, unlocked: string[], currentId: string, mapId: string) => {
    localStorage.setItem('totalPoints', points.toString());
    localStorage.setItem('unlockedBikeIds', JSON.stringify(unlocked));
    localStorage.setItem('currentBikeId', currentId);
    localStorage.setItem('currentMapId', mapId);
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    keysRef.current[e.code] = true;
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    keysRef.current[e.code] = false;
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetGame = () => {
    bikeRef.current = {
      x: 100,
      y: groundLevel - 15,
      vx: 0,
      vy: 0,
      rotation: 0,
      vRotation: 0,
      isWheelie: false,
      wheelieTime: 0,
    };
    setGameState(prev => ({ 
      ...prev, 
      score: 0, 
      isGameOver: false, 
      distance: 0,
    }));
    setView('game');
  };

  const update = () => {
    if (view !== 'game' || gameState.isGameOver) return;

    const bike = bikeRef.current;
    const stats = currentBike;

    // Controls
    if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) {
      bike.vx += stats.acceleration;
    }
    // Brake with 'A' or 'S' or 'ArrowDown' (repurposing 'A' as requested)
    if (keysRef.current['KeyA'] || keysRef.current['KeyS'] || keysRef.current['ArrowDown']) {
      bike.vx *= 0.993; // 3x weaker braking (was 0.98)
      // 3x weaker forward torque when braking
      bike.vRotation += bike.rotation < -Math.PI * 0.5 ? 0.0083 : 0.0016; 
    }
    if (keysRef.current['ArrowLeft']) {
      bike.vx -= stats.acceleration * 0.5;
    }
    
    // Tilt controls
    if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) {
      bike.vRotation -= stats.balance;
    }
    if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) {
      bike.vRotation += stats.balance;
    }

    // Constant downward force when in wheelie
    if (bike.rotation < 0) {
      if (bike.rotation < -Math.PI * 0.5) {
        // Past 90 degrees: Start falling backwards!
        const overLimit = Math.abs(bike.rotation) - (Math.PI * 0.5);
        let pull = 0.00066 + (overLimit * 0.00416);
        
        // Past 93 degrees (approx 1.623 rad): Harder to control over time
        if (bike.rotation < -1.623) {
          const extremeFactor = 1 + (bike.wheelieTime / 180);
          pull *= extremeFactor;
        }
        
        bike.vRotation -= pull; 
      } else {
        // Normal wheelie: Natural downward force
        bike.vRotation += 0.006;
      }
    }

    // Physics
    bike.vx *= 0.995; // Reduced friction to allow reaching top speeds (was 0.98)
    
    // Enforce max speed
    if (bike.vx > stats.maxSpeed) {
      bike.vx = stats.maxSpeed;
    }
    if (bike.vx < -stats.maxSpeed * 0.5) {
      bike.vx = -stats.maxSpeed * 0.5;
    }

    bike.x += bike.vx;
    bike.distance += bike.vx;

    // Rear wheel is fixed to ground, so no vy/y physics needed for the pivot point
    bike.y = groundLevel;
    bike.vy = 0;

    bike.rotation += bike.vRotation;
    bike.vRotation *= 0.90; // Slightly relaxed damping for faster reaction (was 0.85)

    // Ground collision / Rotation limits
    // Since rear wheel is pivot, we just limit rotation so front wheel doesn't go below ground
    if (bike.rotation > 0) {
      bike.rotation = 0;
      bike.vRotation = 0;
    }

    // If bike flips over completely (Limit increased to 135 degrees)
    if (bike.rotation < -Math.PI * 0.75) {
       setGameState(prev => {
          const newTotal = prev.totalPoints + Math.floor(prev.score);
          saveGame(newTotal, prev.unlockedBikeIds, prev.currentBikeId, prev.currentMapId);
          return { ...prev, isGameOver: true, totalPoints: newTotal };
        });
    }

    // Wheelie detection
    if (bike.rotation < -0.1) {
      bike.isWheelie = true;
      bike.wheelieTime++;
      // Move forward when wheelieing
      // Speed boost: faster the longer you wheelie
      const speedBoost = Math.min(0.15, bike.wheelieTime / 300);
      bike.vx += 0.05 + speedBoost; 
    } else {
      bike.isWheelie = false;
      bike.wheelieTime = 0;
    }

    // Update game state once per frame
    setGameState(prev => {
      const angleBonus = Math.abs(bike.rotation) * 5;
      const extremeBonus = Math.abs(bike.rotation) > 1.623 ? 3.0 : 1.0;
      const durationPenalty = Math.max(0.1, 1 / (1 + bike.wheelieTime / 180));
      
      // 1.75x easier to get points as requested
      const basePoints = bike.vx * stats.wheelieMultiplier * angleBonus * durationPenalty * 0.004 * extremeBonus * 1.75;
      const pointsChange = bike.isWheelie 
        ? basePoints
        : -1.0;

      return {
        ...prev,
        score: Math.max(0, prev.score + pointsChange),
        distance: bike.distance,
      };
    });

    // If bike flips over completely (Safety check with 135 degree limit)
    if (bike.rotation < -Math.PI * 0.75 || bike.rotation > Math.PI * 0.4) {
       setGameState(prev => {
          const newTotal = prev.totalPoints + Math.floor(prev.score);
          saveGame(newTotal, prev.unlockedBikeIds, prev.currentBikeId, prev.currentMapId);
          return { ...prev, isGameOver: true, totalPoints: newTotal };
        });
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bike = bikeRef.current;
    const map = currentMap;

    // Clear / Sky
    ctx.fillStyle = map.skyColor;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw City Background (Parallax)
    const drawBuildings = (count: number, color: string, parallax: number, heightMult: number) => {
      ctx.fillStyle = color;
      const bWidth = 150;
      const bOffset = (bike.x * parallax) % bWidth;
      for (let x = -bOffset; x < dimensions.width + bWidth; x += bWidth) {
        // Use a stable world position for height to prevent vertical jitter
        const worldX = x + bike.x * parallax;
        const buildingIndex = Math.floor(worldX / bWidth);
        const h = 100 + (Math.sin(buildingIndex * 123.45) * 50) + heightMult;
        
        ctx.fillRect(x, groundLevel - h, bWidth - 10, h);
        // Windows
        ctx.fillStyle = map.id === 'night' ? '#fbbf24' : '#ffffff44';
        for (let wy = groundLevel - h + 20; wy < groundLevel - 20; wy += 30) {
          ctx.fillRect(x + 10, wy, 10, 10);
          ctx.fillRect(x + bWidth - 30, wy, 10, 10);
        }
        ctx.fillStyle = color;
      }
    };

    drawBuildings(10, map.buildingColor + '88', 0.1, 100); // Back buildings
    drawBuildings(15, map.buildingColor, 0.3, 50);  // Mid buildings

    // Draw Road
    ctx.fillStyle = map.groundColor;
    ctx.fillRect(0, groundLevel, dimensions.width, dimensions.height - groundLevel);
    
    // Road Lines
    ctx.strokeStyle = map.id === 'desert' ? '#fde68a' : '#ffffff';
    const dashPattern = [60, 60];
    ctx.setLineDash(dashPattern);
    ctx.lineWidth = 4;
    const roadOffset = bike.x % (dashPattern[0] + dashPattern[1]);
    ctx.beginPath();
    ctx.moveTo(-roadOffset, groundLevel + 30);
    ctx.lineTo(dimensions.width, groundLevel + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Bike
    ctx.save();
    // Pivot around the rear wheel hub
    ctx.translate(dimensions.width * 0.25, bike.y); 
    ctx.scale(BIKE_SCALE, BIKE_SCALE);
    ctx.rotate(bike.rotation);
    
    // Procedural Bike Drawing based on model
    const drawBikeFrame = (id: string, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (id === 'starter') {
        // E-Cruiser: Classic curved frame
        ctx.beginPath();
        ctx.moveTo(0, 0); // Rear hub (Pivot)
        ctx.quadraticCurveTo(15, -25, 30, -15); // Top tube curve
        ctx.lineTo(40, 0); // Front hub
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(25, -5); // Down tube
        ctx.lineTo(30, -15);
        ctx.stroke();

        // High bars
        ctx.beginPath();
        ctx.moveTo(30, -15);
        ctx.lineTo(33, -25);
        ctx.lineTo(43, -25);
        ctx.stroke();
        
        // Seat
        ctx.fillStyle = '#141414';
        ctx.fillRect(17, -22, 8, 3);
      } else if (id === 'sport') {
        // Volt Ripper: Aggressive sharp angles
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(18, -20); // Seat tube
        ctx.lineTo(38, -20); // Top tube
        ctx.lineTo(46, 0); // Fork
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(18, -20);
        ctx.lineTo(28, -5); // Mid frame
        ctx.lineTo(38, -20);
        ctx.stroke();

        // Low bars
        ctx.beginPath();
        ctx.moveTo(38, -20);
        ctx.lineTo(43, -22);
        ctx.lineTo(53, -22);
        ctx.stroke();
        
        // Racing seat
        ctx.fillStyle = '#141414';
        ctx.beginPath();
        ctx.ellipse(16, -21, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === 'pro') {
        // Lithium Elite: Thick monocoque frame
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(15, -35, 35, -35, 43, 0);
        ctx.stroke();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff'; // Highlight
        ctx.beginPath();
        ctx.moveTo(5, -10);
        ctx.lineTo(35, -10);
        ctx.stroke();

        // Integrated bars
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(37, -25);
        ctx.lineTo(50, -25);
        ctx.stroke();
        
        // Sleek seat
        ctx.fillStyle = '#141414';
        ctx.fillRect(20, -32, 10, 3);
      } else if (id === 'neon') {
        // Neon Glider: Low, long, futuristic
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, -10);
        ctx.lineTo(40, -10);
        ctx.lineTo(50, 0);
        ctx.stroke();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, -10);
        ctx.lineTo(45, -20);
        ctx.lineTo(55, -20);
        ctx.stroke();
        
        ctx.fillStyle = '#141414';
        ctx.fillRect(5, -12, 12, 3);
      } else if (id === 'cyber') {
        // Cyber Commuter: Boxy, industrial
        ctx.fillStyle = color;
        ctx.fillRect(5, -15, 35, 15);
        ctx.strokeStyle = '#141414';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, -15, 35, 15);
        
        ctx.beginPath();
        ctx.moveTo(40, -10);
        ctx.lineTo(45, -30);
        ctx.lineTo(55, -30);
        ctx.stroke();
      } else if (id === 'thunder' || id === 'vortex') {
        // Thunder/Vortex: Dual beam frame
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, -25);
        ctx.lineTo(45, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(20, -30);
        ctx.lineTo(45, -5);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(40, -20);
        ctx.lineTo(45, -35);
        ctx.lineTo(55, -35);
        ctx.stroke();
      } else if (id === 'solar' || id === 'gravity') {
        // Solar/Gravity: Circular core frame
        ctx.beginPath();
        ctx.arc(20, -15, 12, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, -10);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(30, -10);
        ctx.lineTo(45, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(30, -20);
        ctx.lineTo(45, -35);
        ctx.lineTo(55, -35);
        ctx.stroke();
      } else if (id === 'quantum' || id === 'hyper') {
        // Quantum/Hyper: Split frame, very light
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, -30);
        ctx.lineTo(40, -30);
        ctx.lineTo(45, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(10, -30);
        ctx.lineTo(25, -15);
        ctx.stroke();
      } else if (id === 'stellar' || id === 'void') {
        // Stellar/Void: Organic, flowing lines
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(25, -40, 50, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(35, -25);
        ctx.lineTo(55, -25);
        ctx.stroke();
      } else if (id === 'legend' || id === 'final') {
        // The Tesla Bike / Final Boss: Minimalist single beam / Ultra tech
        ctx.lineWidth = id === 'final' ? 12 : 8;
        ctx.strokeStyle = '#141414';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(50, 0);
        ctx.stroke();
        
        // Glowing accent
        ctx.strokeStyle = color;
        ctx.lineWidth = id === 'final' ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(45, 0);
        ctx.stroke();

        // Minimalist bars
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(45, 0);
        ctx.lineTo(45, -25);
        ctx.lineTo(55, -25);
        ctx.stroke();
        
        // Floating seat
        ctx.fillStyle = '#141414';
        ctx.fillRect(15, -15, 12, 4);
        
        if (id === 'final') {
          // Extra glow for final boss
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else {
        // Generic "Cool" Frame for others
        const tier = BIKES.findIndex(b => b.id === id);
        ctx.lineWidth = 3 + (tier * 0.2);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15, -25);
        ctx.lineTo(40, -25);
        ctx.lineTo(45, 0);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(15, -25);
        ctx.lineTo(25, -5);
        ctx.lineTo(40, -25);
        ctx.stroke();

        // Bars
        ctx.beginPath();
        ctx.moveTo(40, -25);
        ctx.lineTo(42, -35);
        ctx.lineTo(52, -35);
        ctx.stroke();
        
        // Seat
        ctx.fillStyle = '#141414';
        ctx.fillRect(10, -28, 10, 3);
      }

      // Common Wheels for all (procedural)
      // Use a color that doesn't match the map ground or buildings
      ctx.strokeStyle = map.id === 'night' ? '#94a3b8' : '#334155'; 
      if (map.id === 'city') ctx.strokeStyle = '#475569';
      if (map.id === 'desert') ctx.strokeStyle = '#1e293b';
      
      ctx.lineWidth = 2.5;
      // Rear (Always at 0,0)
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      // Front
      const frontX = (id === 'sport' ? 46 : (id === 'legend' || id === 'final' ? 50 : (id === 'pro' ? 43 : 40)));
      ctx.beginPath();
      ctx.arc(frontX, 0, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Add a small inner rim to make it look less like the background
      ctx.lineWidth = 1;
      ctx.strokeStyle = color; // Use bike color for rim
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(frontX, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
    };

    drawBikeFrame(currentBike.id, currentBike.color);

    // Draw Chain
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0); // Rear hub
    ctx.lineTo(25, 0); // Crank
    ctx.stroke();

    // Draw Rider (Stylized)
    const riderColor = currentBike.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dynamic positions based on bike model
    let seatPos = { x: 23, y: -22 };
    let barPos = { x: 45, y: -25 };
    let crankPos = { x: 25, y: 0 };

    if (currentBike.id === 'starter') {
      seatPos = { x: 21, y: -22 };
      barPos = { x: 43, y: -25 };
    } else if (currentBike.id === 'sport') {
      seatPos = { x: 18, y: -20 };
      barPos = { x: 53, y: -22 };
    } else if (currentBike.id === 'pro') {
      seatPos = { x: 25, y: -32 };
      barPos = { x: 50, y: -25 };
    } else if (currentBike.id === 'legend') {
      seatPos = { x: 20, y: -15 };
      barPos = { x: 55, y: -25 };
    }
    
    // Torso (Shirt in bike color)
    ctx.strokeStyle = riderColor;
    ctx.beginPath();
    ctx.moveTo(seatPos.x, seatPos.y);
    ctx.lineTo(seatPos.x + 8, seatPos.y - 20); // Shoulder
    ctx.stroke();

    // Head (Helmet in bike color)
    ctx.fillStyle = riderColor;
    ctx.beginPath();
    ctx.arc(seatPos.x + 10, seatPos.y - 26, 4, 0, Math.PI * 2);
    ctx.fill();

    // Arms to handlebars (Black)
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 2.5; // Slightly thicker for visibility
    ctx.beginPath();
    ctx.moveTo(seatPos.x + 8, seatPos.y - 20); // Shoulder
    ctx.lineTo(barPos.x, barPos.y);
    ctx.stroke();

    // Legs to pedals (Black)
    const pedalRotation = bike.x * 0.1;
    const pedalX = crankPos.x + Math.cos(pedalRotation) * 5;
    const pedalY = crankPos.y + Math.sin(pedalRotation) * 5;
    
    ctx.beginPath();
    ctx.moveTo(seatPos.x, seatPos.y); // Hip
    ctx.lineTo(pedalX, pedalY); // Foot
    ctx.stroke();

    // Animate the back wheel (spinning effect)
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    const wheelRotation = bike.x * 0.2;
    ctx.beginPath();
    const hubX = 0; // Rear wheel is always at 0,0 now
    for (let i = 0; i < 3; i++) {
      const angle = wheelRotation + (i * Math.PI * 2 / 3);
      ctx.moveTo(hubX + Math.cos(angle) * 2, Math.sin(angle) * 2);
      ctx.lineTo(hubX + Math.cos(angle) * 8, Math.sin(angle) * 8);
    }
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // UI Overlay in Canvas
    if (bike.isWheelie) {
      ctx.fillStyle = currentMap.accentColor;
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WHEELIE!', dimensions.width * 0.25, bike.y - 150);
    }
  };

  useEffect(() => {
    if (view === 'game' && !gameState.isGameOver) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [view, gameState.isGameOver, gameState.currentBikeId]);

  const buyBike = (bike: Bike) => {
    if (gameState.totalPoints >= bike.price && !gameState.unlockedBikeIds.includes(bike.id)) {
      const newUnlocked = [...gameState.unlockedBikeIds, bike.id];
      const newTotal = gameState.totalPoints - bike.price;
      setGameState(prev => ({
        ...prev,
        totalPoints: newTotal,
        unlockedBikeIds: newUnlocked,
        currentBikeId: bike.id
      }));
      saveGame(newTotal, newUnlocked, bike.id, gameState.currentMapId);
    } else if (gameState.unlockedBikeIds.includes(bike.id)) {
      setGameState(prev => ({ ...prev, currentBikeId: bike.id }));
      saveGame(gameState.totalPoints, gameState.unlockedBikeIds, bike.id, gameState.currentMapId);
    }
  };

  const selectMap = (mapId: string) => {
    setGameState(prev => ({ ...prev, currentMapId: mapId }));
    saveGame(gameState.totalPoints, gameState.unlockedBikeIds, gameState.currentBikeId, mapId);
    setView('menu');
  };

  const resetProgress = () => {
    const initialPoints = 0;
    const initialBikes = ['starter'];
    const initialBikeId = 'starter';
    const initialMapId = 'city';
    
    setGameState(prev => ({
      ...prev,
      totalPoints: initialPoints,
      unlockedBikeIds: initialBikes,
      currentBikeId: initialBikeId,
      currentMapId: initialMapId,
      score: 0,
      distance: 0,
      isGameOver: false
    }));
    
    saveGame(initialPoints, initialBikes, initialBikeId, initialMapId);
    setShowResetConfirm(false);
    setView('menu');
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-4 flex justify-between items-center relative">
        <div className="flex items-center gap-2 z-10">
          {/* Left side empty or for future use */}
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#141414] rounded-full flex items-center justify-center text-[#E4E3E0]">
              <Trophy size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tighter uppercase italic font-serif">Wheelie King</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-sm z-10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] opacity-50 uppercase">Balance</span>
            <span className="font-bold">{gameState.totalPoints.toLocaleString()} PTS</span>
          </div>
          <button 
            onClick={() => setView('menu')}
            className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors border border-transparent hover:border-[#141414]"
            title="Main Menu"
          >
            <Home size={20} />
          </button>
        </div>
      </header>

      <main className={`${view === 'game' ? 'w-full h-[calc(100vh-64px)]' : 'max-w-4xl mx-auto p-8'}`}>
        <AnimatePresence mode="wait">
          {view === 'menu' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-12 py-20 relative"
            >
              {/* Reset Progress Button in Top Left */}
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="absolute top-0 left-0 flex items-center gap-2 p-2 border border-red-500/20 text-red-500/40 hover:border-red-500 hover:text-red-500 hover:bg-red-500/5 transition-all font-mono text-[10px] uppercase"
              >
                <Trash2 size={12} />
                <span>Reset Progress</span>
              </button>

              <div className="text-center space-y-4">
                <h2 className="text-7xl font-black uppercase tracking-tighter italic font-serif leading-none">
                  Push The <br /> Limit
                </h2>
                <p className="text-sm opacity-60 max-w-xs mx-auto font-mono">
                  Hold UP to wheelie. Balance is everything. Don't flip over.
                </p>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-xs">
                <button 
                  onClick={resetGame}
                  className="group relative flex items-center justify-between p-6 bg-[#141414] text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] border-2 border-[#141414] transition-all"
                >
                  <span className="text-2xl font-bold uppercase italic font-serif">Start Run</span>
                  <Play className="group-hover:translate-x-2 transition-transform" />
                </button>
                
                <button 
                  onClick={() => setView('shop')}
                  className="flex items-center justify-between p-6 border-2 border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  <span className="text-2xl font-bold uppercase italic font-serif">Garage</span>
                  <ShoppingCart />
                </button>

                <button 
                  onClick={() => setView('maps')}
                  className="flex items-center justify-between p-6 border-2 border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  <span className="text-2xl font-bold uppercase italic font-serif">Locations</span>
                  <MapIcon />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-8 w-full border-t border-[#141414] pt-8 font-mono text-xs uppercase opacity-50">
                <div className="space-y-1">
                  <p>Controls</p>
                  <p>WASD / ARROWS</p>
                </div>
                <div className="space-y-1">
                  <p>Objective</p>
                  <p>Longest Wheelie</p>
                </div>
                <div className="space-y-1">
                  <p>Current Bike</p>
                  <p>{currentBike.name}</p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'game' && (
            <motion.div 
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full flex flex-col"
            >
              <div className="absolute top-4 left-4 right-4 flex justify-between items-end font-mono z-10 pointer-events-none">
                <div className="space-y-1">
                  <span className="text-[10px] opacity-50 uppercase bg-[#E4E3E0]/50 px-1">Current Score</span>
                  <div className="text-6xl font-black">{Math.floor(gameState.score).toLocaleString()}</div>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded-sm flex flex-col items-center">
                    <span className="text-[10px] uppercase opacity-50">Speed</span>
                    <span className="text-4xl font-black italic">{Math.max(0, Math.floor(bikeRef.current.vx * 10) - 40)} <span className="text-sm not-italic">MPH</span></span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-[10px] opacity-50 uppercase bg-[#E4E3E0]/50 px-1">Total Points</span>
                  <div className="text-2xl font-bold">{gameState.totalPoints.toLocaleString()}</div>
                </div>
              </div>

              <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden">
                <canvas 
                  ref={canvasRef} 
                  width={dimensions.width} 
                  height={dimensions.height}
                  className="w-full h-full block"
                />
                
                {gameState.isGameOver && (
                  <div className="absolute inset-0 bg-[#141414]/90 flex flex-col items-center justify-center text-[#E4E3E0] p-8 text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="space-y-8"
                    >
                      <div className="space-y-2">
                        <h3 className="text-5xl font-black uppercase italic font-serif">Wasted</h3>
                        <p className="font-mono text-sm opacity-60">You pushed too hard.</p>
                      </div>
                      
                      <div className="flex flex-col items-center border-y border-[#E4E3E0]/20 py-6 font-mono">
                        <div>
                          <p className="text-[10px] uppercase opacity-50">Earned</p>
                          <p className="text-4xl font-bold">+{Math.floor(gameState.score)}</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={resetGame}
                          className="flex-1 p-4 bg-[#E4E3E0] text-[#141414] font-bold uppercase italic font-serif flex items-center justify-center gap-2 hover:bg-white transition-colors"
                        >
                          <RotateCcw size={20} /> Try Again
                        </button>
                        <button 
                          onClick={() => setView('menu')}
                          className="flex-1 p-4 border border-[#E4E3E0] font-bold uppercase italic font-serif hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors"
                        >
                          Menu
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-8 font-mono text-[10px] uppercase opacity-40">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#141414] rotate-45" />
                  <span>W/UP: Tilt Back</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#141414] rotate-45" />
                  <span>S/DOWN: Tilt Forward</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#141414] rotate-45" />
                  <span>A: Brake</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#141414] rotate-45" />
                  <span>D/RIGHT: Accelerate</span>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'maps' && (
            <motion.div 
              key="maps"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end border-b border-[#141414] pb-4">
                <h2 className="text-4xl font-black uppercase italic font-serif">Locations</h2>
                <button 
                  onClick={() => setView('menu')}
                  className="font-mono text-xs uppercase hover:underline"
                >
                  Back to Menu
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MAPS.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => selectMap(map.id)}
                    className={`group relative border-2 border-[#141414] p-6 flex flex-col gap-4 transition-all ${gameState.currentMapId === map.id ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
                  >
                    <div 
                      className="w-full h-32 border-2 border-[#141414] relative overflow-hidden"
                      style={{ backgroundColor: map.skyColor }}
                    >
                      <div 
                        className="absolute bottom-0 w-full h-8"
                        style={{ backgroundColor: map.groundColor }}
                      />
                      <div 
                        className="absolute bottom-8 left-4 w-8 h-12"
                        style={{ backgroundColor: map.buildingColor }}
                      />
                      <div 
                        className="absolute bottom-8 right-8 w-12 h-16"
                        style={{ backgroundColor: map.buildingColor }}
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-bold uppercase italic font-serif">{map.name}</h3>
                      <p className="text-[10px] opacity-60 font-mono uppercase">
                        {gameState.currentMapId === map.id ? 'Current Location' : 'Travel Here'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'shop' && (
            <motion.div 
              key="shop"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-end border-b border-[#141414] pb-4">
                <h2 className="text-4xl font-black uppercase italic font-serif">The Garage</h2>
                <button 
                  onClick={() => setView('menu')}
                  className="font-mono text-xs uppercase hover:underline"
                >
                  Back to Menu
                </button>
              </div>

              <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                {BIKES.map((bike) => {
                  const isUnlocked = gameState.unlockedBikeIds.includes(bike.id);
                  const isCurrent = gameState.currentBikeId === bike.id;
                  const canAfford = gameState.totalPoints >= bike.price;

                  return (
                    <div 
                      key={bike.id}
                      className={`group relative border-2 border-[#141414] p-6 flex items-center justify-between transition-all ${isCurrent ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
                    >
                      <div className="flex items-center gap-8">
                        <div 
                          className="w-24 h-16 border-2 border-[#141414] flex items-center justify-center relative overflow-hidden"
                          style={{ backgroundColor: bike.color + '20' }}
                        >
                           {/* Simple bike icon with rider */}
                           <div className="relative w-12 h-8">
                             {/* Wheels */}
                             <div className="absolute bottom-0 left-0 w-4 h-4 rounded-full border-2 border-current" />
                             <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-current" />
                             {/* Frame */}
                             <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-current rotate-[-30deg]" />
                             {/* Rider */}
                             <div className="absolute -top-3 left-1 w-1 h-4 bg-current rotate-[20deg]" /> {/* Torso */}
                             <div className="absolute -top-5 left-2 w-2 h-2 bg-current rounded-full" /> {/* Head */}
                           </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h3 className="text-2xl font-bold uppercase italic font-serif">{bike.name}</h3>
                          <div className="flex gap-4 font-mono text-[10px] uppercase opacity-60">
                            <span>Top Speed: {Math.max(0, bike.maxSpeed * 10 - 40)} MPH</span>
                            <span>Balance: {Math.floor(bike.balance * 100)}</span>
                            <span>Mult: x{bike.wheelieMultiplier}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {!isUnlocked && (
                          <div className="font-mono text-xl font-bold">{bike.price.toLocaleString()} PTS</div>
                        )}
                        
                        <button
                          disabled={!isUnlocked && !canAfford}
                          onClick={() => buyBike(bike)}
                          className={`px-6 py-3 font-bold uppercase italic font-serif border-2 border-current transition-all disabled:opacity-30
                            ${isCurrent ? 'bg-[#E4E3E0] text-[#141414] border-[#E4E3E0]' : 'hover:bg-[#141414] hover:text-[#E4E3E0]'}
                          `}
                        >
                          {isCurrent ? 'Selected' : isUnlocked ? 'Select' : 'Unlock'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset Confirmation Modal */}
        <AnimatePresence>
          {showResetConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#E4E3E0] border-4 border-[#141414] p-8 max-w-md w-full space-y-6 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
              >
                <div className="flex items-center gap-4 text-red-600">
                  <AlertTriangle size={40} />
                  <h3 className="text-3xl font-black uppercase italic font-serif leading-none">Danger Zone</h3>
                </div>
                
                <div className="space-y-2 font-mono text-sm">
                  <p className="font-bold">Are you absolutely sure?</p>
                  <p className="opacity-70">This will permanently delete all your points and lock all bikes except the starter. This action cannot be undone.</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={resetProgress}
                    className="flex-1 p-4 bg-red-600 text-white font-bold uppercase italic font-serif hover:bg-red-700 transition-colors"
                  >
                    Yes, Reset Everything
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 p-4 border-2 border-[#141414] font-bold uppercase italic font-serif hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[#141414] bg-[#E4E3E0] p-2 flex justify-between items-center font-mono text-[9px] uppercase opacity-50">
        <div className="flex gap-4">
          <span>System: Active</span>
          <span>Engine: Physics_v2.4</span>
        </div>
        <div>
          <span>© 2026 Wheelie King Industries</span>
        </div>
      </footer>
    </div>
  );
}
