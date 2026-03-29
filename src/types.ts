export interface Bike {
  id: string;
  name: string;
  price: number;
  color: string;
  acceleration: number;
  maxSpeed: number;
  balance: number; // How easy it is to control the tilt
  wheelieMultiplier: number; // Score multiplier for this bike
}

export interface MapConfig {
  id: string;
  name: string;
  skyColor: string;
  groundColor: string;
  buildingColor: string;
  accentColor: string;
}

export interface GameState {
  score: number;
  totalPoints: number;
  currentBikeId: string;
  unlockedBikeIds: string[];
  isGameOver: boolean;
  distance: number;
  currentMapId: string;
}

export const MAPS: MapConfig[] = [
  {
    id: 'city',
    name: 'Metropolis',
    skyColor: '#E4E3E0',
    groundColor: '#141414',
    buildingColor: '#334155',
    accentColor: '#F27D26',
  },
  {
    id: 'desert',
    name: 'Red Sands',
    skyColor: '#fef3c7',
    groundColor: '#78350f',
    buildingColor: '#92400e',
    accentColor: '#f59e0b',
  },
  {
    id: 'night',
    name: 'Neon Night',
    skyColor: '#020617',
    groundColor: '#0f172a',
    buildingColor: '#1e293b',
    accentColor: '#8b5cf6',
  },
];

export const BIKES: Bike[] = [
  {
    id: 'starter',
    name: 'E-Cruiser',
    price: 0,
    color: '#94a3b8',
    acceleration: 0.04, // Increased from 0.03 to ensure top speed hit
    maxSpeed: 6,
    balance: 0.016,
    wheelieMultiplier: 1,
  },
  {
    id: 'sport',
    name: 'Volt Ripper',
    price: 500,
    color: '#ef4444',
    acceleration: 0.06, // Increased from 0.045
    maxSpeed: 8,
    balance: 0.016,
    wheelieMultiplier: 1.5,
  },
  {
    id: 'pro',
    name: 'Lithium Elite',
    price: 2000,
    color: '#10b981',
    acceleration: 0.08, // Increased from 0.06
    maxSpeed: 10,
    balance: 0.016,
    wheelieMultiplier: 2.5,
  },
  {
    id: 'legend',
    name: 'The Tesla Bike',
    price: 10000,
    color: '#f59e0b',
    acceleration: 0.1, // Increased from 0.075
    maxSpeed: 14,
    balance: 0.016,
    wheelieMultiplier: 5,
  },
  {
    id: 'neon',
    name: 'Neon Glider',
    price: 15000,
    color: '#ec4899',
    acceleration: 0.12, // Increased from 0.08
    maxSpeed: 16,
    balance: 0.016,
    wheelieMultiplier: 7,
  },
  {
    id: 'cyber',
    name: 'Cyber Commuter',
    price: 25000,
    color: '#06b6d4',
    acceleration: 0.14, // Increased from 0.09
    maxSpeed: 18,
    balance: 0.016,
    wheelieMultiplier: 10,
  },
  {
    id: 'thunder',
    name: 'Thunder Bolt',
    price: 40000,
    color: '#8b5cf6',
    acceleration: 0.16, // Increased from 0.1
    maxSpeed: 20,
    balance: 0.016,
    wheelieMultiplier: 15,
  },
  {
    id: 'vortex',
    name: 'Vortex X',
    price: 60000,
    color: '#f97316',
    acceleration: 0.18, // Increased from 0.11
    maxSpeed: 22,
    balance: 0.016,
    wheelieMultiplier: 20,
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    price: 85000,
    color: '#eab308',
    acceleration: 0.2, // Increased from 0.12
    maxSpeed: 24,
    balance: 0.016,
    wheelieMultiplier: 30,
  },
  {
    id: 'gravity',
    name: 'Gravity Defier',
    price: 120000,
    color: '#6366f1',
    acceleration: 0.22, // Increased from 0.13
    maxSpeed: 26,
    balance: 0.016,
    wheelieMultiplier: 50,
  },
  {
    id: 'quantum',
    name: 'Quantum Leap',
    price: 200000,
    color: '#14b8a6',
    acceleration: 0.24, // Increased from 0.14
    maxSpeed: 28,
    balance: 0.016,
    wheelieMultiplier: 75,
  },
  {
    id: 'hyper',
    name: 'Hyper Drive',
    price: 350000,
    color: '#ef4444',
    acceleration: 0.26, // Increased from 0.15
    maxSpeed: 30,
    balance: 0.016,
    wheelieMultiplier: 100,
  },
  {
    id: 'stellar',
    name: 'Stellar Racer',
    price: 500000,
    color: '#3b82f6',
    acceleration: 0.28, // Increased from 0.16
    maxSpeed: 32,
    balance: 0.016,
    wheelieMultiplier: 150,
  },
  {
    id: 'void',
    name: 'Void Runner',
    price: 750000,
    color: '#000000',
    acceleration: 0.3, // Increased from 0.17
    maxSpeed: 34,
    balance: 0.016,
    wheelieMultiplier: 250,
  },
  {
    id: 'final',
    name: 'The Final Boss',
    price: 1000000,
    color: '#ffffff',
    acceleration: 0.35, // Increased from 0.2
    maxSpeed: 40,
    balance: 0.016,
    wheelieMultiplier: 500,
  },
];
