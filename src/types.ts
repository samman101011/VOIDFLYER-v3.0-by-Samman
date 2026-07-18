export interface PlanetConfig {
  id: string;
  name: string;
  color: string;
  atmosphereColor: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  description: string;
  features: string[];
  hasRing?: boolean;
  ringColor?: string;
  ringInnerRadius?: number;
  ringOuterRadius?: number;
  
  // New Planet Features
  biome: string;
  weather: string;
  gravity: number;
  hasOceans: boolean;
  hasMountains: boolean;
  cloudsColor?: string;
  mineralDensity: {
    iron: number;
    titanium: number;
    gold: number;
    crystal: number;
    uranium: number;
    darkMatter: number;
  };
}

export interface GameLog {
  id: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  timestamp: number;
}

export interface CargoHold {
  iron: number;
  titanium: number;
  gold: number;
  crystal: number;
  uranium: number;
  darkMatter: number;
}

export interface ShipUpgrades {
  engines: number;
  shields: number;
  armor: number;
  cargo: number;
  radar: number;
  lasers: number;
  missiles: number;
  hyperdrive: number;
}

export interface ActiveMission {
  id: string;
  type: "pirate_hunt" | "escort" | "explore" | "scan_anomaly" | "rescue" | "cargo_delivery";
  title: string;
  description: string;
  targetSystemId: string;
  targetPlanetId?: string;
  rewardCredits: number;
  rewardScore: number;
  status: "active" | "completed" | "failed";
  progress: number; // 0 to 1
  objective: string;
}

export interface FactionReputation {
  terranVanguard: number; // -100 to 100
  xylosSwarm: number;     // -100 to 100
  zoraxSyndicate: number; // -100 to 100
}

export interface DiscoveryDatabase {
  blackHole: boolean;
  neutronStar: boolean;
  pulsar: boolean;
  whiteDwarf: boolean;
  supernova: boolean;
  wormhole: boolean;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  fuel: number;
  maxFuel: number;
  speed: number;
  maxSpeed: number;
  boostSpeed: number;
  isBoosting: boolean;
  isLanded: boolean;
  currentPlanetId: string | null;
  landingProgress: number; // 0 to 1
  score: number;
  credits: number;
  
  // Expanded Player Stats
  currentSystemId: string;
  cargo: CargoHold;
  maxCargo: number;
  upgrades: ShipUpgrades;
  factionRep: FactionReputation;
  discoveries: DiscoveryDatabase;
  activeMission: ActiveMission | null;
  unlockedFacts?: string[];
  discoveredObjects?: string[];
  exploredSystems?: string[];
}

export interface SolarSystem {
  id: string;
  name: string;
  galaxy: "Milky Way" | "Andromeda" | "Triangulum" | "Centaurus" | "Sombrero";
  starType: "Red Dwarf" | "Yellow Star" | "Blue Giant" | "White Dwarf" | "Neutron Star";
  starColor: string;
  hasBlackHole: boolean;
  hasWormhole: boolean;
  wormholeTargetSystemId?: string;
  hasSpaceStation: boolean;
  planets: PlanetConfig[];
  description: string;
}

export interface GameSettings {
  resolution: "low" | "medium" | "high";
  fullscreen: boolean;
  volume: number;
  musicVolume?: number;
  sfxVolume?: number;
  mouseSensitivity?: number;
  graphics?: "low" | "medium" | "high";
  vsync?: boolean;
  flightMode?: "arcade" | "simulation";
  postProcessing: boolean;
  uiScale?: number;
  touchSensitivity?: number;
  joystickSize?: number;
  colorblindMode?: boolean;
}

export type GameDifficulty = "easy" | "medium" | "hard";

export type GameState = "MainMenu" | "Playing" | "Pause" | "GameOver";

