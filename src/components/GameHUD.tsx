import React, { useEffect, useState } from "react";
import { PlayerStats, GameLog, PlanetConfig, GameSettings, SolarSystem } from "../types";
import { 
  Gauge, Heart, AlertTriangle, ShieldAlert, Navigation, Compass, 
  Terminal, Shield, RefreshCw, Zap, Settings, Coins, Target, 
  Save, FolderOpen, ShieldCheck, Volume2, Flame, Crosshair, HelpCircle,
  Map, Cpu, Award, FileText, BarChart3, Sparkles, ArrowRight, CheckCircle2, ShoppingBag, Globe,
  Eye, BatteryCharging
} from "lucide-react";
import { GALAXY_SYSTEMS } from "../data/galaxy";
import { audioEngine } from "./AudioEngine";
import { ALL_SCIENTIFIC_FACTS } from "../data/facts";

interface GameHUDProps {
  stats: PlayerStats;
  logs: GameLog[];
  planets: PlanetConfig[];
  shipName: string;
  hullColor: string;
  fps: number;
  playerPos: [number, number, number];
  playerRot: number; // yaw angle for radar rotation
  laserCooldown: number; // 0 to 100
  missileCooldown: number; // 0 to 100
  targetEnemy: { name: string; classType: string; health: number; maxHealth: number; shield: number; maxShield: number; distance: number } | null;
  blackHoleDistance: number;
  settings: GameSettings;
  enemyPositions?: { x: number; z: number; id: string }[];
  onUpdateSettings: (settings: GameSettings) => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onRefuel: () => void;
  onRepair: () => void;
  onTakeOff: () => void;
  onRestart: () => void;
  onQuit: () => void;
  activeScreen: string;
  onWarp: (targetSystemId: string) => void;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onAddLog: (msg: string, type: "info" | "success" | "warning" | "danger") => void;
  isPaused?: boolean;
  onTogglePause?: () => void;
  damageNumbers?: { id: string; amount: number; x: number; y: number }[];
  hitMarkerActive?: boolean;
  navTargets?: {
    station?: { x: number; y: number; z: number; dist: number } | null;
    blackHole?: { x: number; y: number; z: number; dist: number } | null;
    wormhole?: { x: number; y: number; z: number; dist: number } | null;
    mission?: { x: number; y: number; z: number; dist: number; label: string } | null;
    planets: { id: string; name: string; x: number; y: number; z: number; dist: number }[];
  } | null;
  enemiesData?: any[];
  landingStage?: "space" | "descent" | "landed" | "takeoff";
  scanTargets?: {
    id: string;
    name: string;
    type: string;
    localPos: [number, number, number];
    scanned: boolean;
    fact: string;
    bonusCredits: number;
  }[];
  activeScanTargetId?: string | null;
  scanProgress?: number;
  isScanning?: boolean;
  onInitiateScan?: (targetId: string) => void;
  reentryIntensity?: number;
  weather?: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  logs,
  planets,
  shipName,
  hullColor,
  fps,
  playerPos,
  playerRot,
  laserCooldown,
  missileCooldown,
  targetEnemy,
  blackHoleDistance,
  settings,
  enemyPositions = [],
  onUpdateSettings,
  onSaveGame,
  onLoadGame,
  onRefuel,
  onRepair,
  onTakeOff,
  onRestart,
  onQuit,
  activeScreen,
  onWarp,
  onUpdateStats,
  onAddLog,
  isPaused = false,
  onTogglePause = () => {},
  damageNumbers = [],
  hitMarkerActive = false,
  navTargets = null,
  enemiesData = [],
  landingStage = "space",
  scanTargets = [],
  activeScanTargetId = null,
  scanProgress = 0,
  isScanning = false,
  onInitiateScan = (_id: string) => {},
  reentryIntensity = 0,
  weather = "Calm",
}) => {
  const [radarScale, setRadarScale] = useState<number>(1); // Zoom levels: 1x, 2x, 5x
  const [pulse, setPulse] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // --- Phase 2 Scenic View vs Base Operations ---
  const [showOutpostOps, setShowOutpostOps] = useState<boolean>(false);

  useEffect(() => {
    if (activeScreen !== "landed") {
      setShowOutpostOps(false);
    }
  }, [activeScreen]);

  // Galaxy Map interactive states
  const [showGalaxyMap, setShowGalaxyMap] = useState(false);
  const [mapPan, setMapPan] = useState({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 });
  const [mapZoom, setMapZoom] = useState(0.8);
  const [selectedMapSystem, setSelectedMapSystem] = useState<SolarSystem | null>(null);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [dragMapStart, setDragMapStart] = useState({ x: 0, y: 0 });

  // Tab state inside the Landed/Docked control modal
  const [dockedTab, setDockedTab] = useState<"port" | "hyperdrive" | "engineering" | "council" | "database">("port");
  const [selectedGalaxy, setSelectedGalaxy] = useState<"Milky Way" | "Andromeda" | "Triangulum" | "Centaurus" | "Sombrero">("Milky Way");
  const [selectedSystemSearch, setSelectedSystemSearch] = useState<string>("");

  // Claimed science grants tracking (to prevent claiming same discovery twice)
  const [claimedGrants, setClaimedGrants] = useState<Record<string, boolean>>({
    blackHole: false,
    pulsar: false,
    whiteDwarf: false,
    wormhole: false,
  });

  const [isLogCollapsed, setIsLogCollapsed] = useState<boolean>(false);

  const getCockpitMetrics = (planet: PlanetConfig) => {
    const biome = planet.biome.toLowerCase();
    let temp = "22°C";
    let danger = "LOW (STABLE)";
    let atmosphere = "Nitrogen-Oxygen (Class-M)";
    let resources = "Iron, Copper, Silica";

    if (biome.includes("forest") || biome.includes("lush")) {
      temp = "18°C to 26°C (Temperate)";
      danger = "MINIMAL (LIFE SIGNALS)";
      atmosphere = "Nitrogen-Oxygen (Class-M, Safe)";
      resources = "Lush Flora, Titanium, Bio-Carbon";
    } else if (biome.includes("desert") || biome.includes("barren")) {
      temp = "48°C to 65°C (Extreme Heat)";
      danger = "MODERATE (HIGH SOLAR)";
      atmosphere = "Helium-Argon Dense Compound";
      resources = "Gold, Pyrite, Silicate, Iron";
    } else if (biome.includes("volcanic") || biome.includes("basalt")) {
      temp = "680°C to 840°C (Magma Flow)";
      danger = "CRITICAL (PYROCLASTIC CONVECTION)";
      atmosphere = "Superheated Sulphur-Carbonic";
      resources = "Uranium, Obsidian, Basalt, Gold";
    } else if (biome.includes("glacial") || biome.includes("tundra")) {
      temp = "-125°C to -82°C (Frozen)";
      danger = "HIGH (RAPID THERMAL LOSS)";
      atmosphere = "Thin Nitrogen-Methane Gas";
      resources = "Ice Geodes, Deuterium, Titanium";
    } else if (biome.includes("crystal")) {
      temp = "-15°C to 8°C (Cold)";
      danger = "LOW (RESONANCE HARMONICS)";
      atmosphere = "Charged Quartz-Argon Class-E";
      resources = "Amethyst Spire, Rare Crystals, Copper";
    } else if (biome.includes("swamp") || biome.includes("magnetic")) {
      temp = "34°C to 42°C (Humid)";
      danger = "EXTREME (ACIDIC STORM RAIN)";
      atmosphere = "Corrosive Acid-Sulphate Vapor";
      resources = "Magnetic Mud, Bio-Acid, Dark Matter";
    } else {
      temp = "-150°C to -20°C (Extreme Range)";
      danger = "HIGH (AIRLESS VACUUM)";
      atmosphere = "Anoxic Trace Carbon Oxide";
      resources = "Silicon Pebbles, Iron, Nickel, Quartz";
    }

    return { temp, danger, atmosphere, resources };
  };

  // Pulse effect for warning alarms
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Keyboard hotkeys for Pause and Galaxy Map
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      const activeElement = document.activeElement?.tagName.toLowerCase();
      if (activeElement === "input" || activeElement === "textarea") return;

      if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        // If map is open, close it first
        if (showGalaxyMap) {
          setShowGalaxyMap(false);
          audioEngine.playClick();
        } else if (activeScreen === "flight") {
          onTogglePause();
        }
      }

      if (e.key.toLowerCase() === "m") {
        if (activeScreen === "flight" && !isPaused) {
          e.preventDefault();
          audioEngine.playClick();
          setShowGalaxyMap((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [activeScreen, showGalaxyMap, isPaused]);

  const mockStation: PlanetConfig = {
    id: "station",
    name: "Astra-Outpost 9",
    color: "#38bdf8",
    atmosphereColor: "Neon Blue",
    radius: 120,
    orbitRadius: 3000,
    orbitSpeed: 0.1,
    rotationSpeed: 0.2,
    biome: "High-Tech",
    weather: "Controlled Atmosphere",
    gravity: 1.0,
    hasOceans: false,
    hasMountains: false,
    description: "An orbital refueling station serving as a secure hub for outer-rim pilots, featuring heavy repair bays and direct connection to the Hyperdrive jump grid.",
    features: ["Orbital Refueling Matrix", "Armor Restoration Dock", "Bulk Raw Mineral Refinery", "Interstellar Job Exchange Board"],
    mineralDensity: { iron: 0, titanium: 0, gold: 0, crystal: 0, uranium: 0, darkMatter: 0 }
  };

  const currentPlanet = planets.find((p) => p.id === stats.currentPlanetId) || (stats.currentPlanetId === "station" ? mockStation : null);
  const currentSystem = GALAXY_SYSTEMS.find(s => s.id === stats.currentSystemId) || GALAXY_SYSTEMS[0];

  // Radar position calculation relative to player
  const getRadarPosition = (planetX: number, planetZ: number) => {
    const dx = planetX - playerPos[0];
    const dz = planetZ - playerPos[2];
    const distanceFactor = 0.0003 * radarScale;
    let rx = dx * distanceFactor;
    let ry = -dz * distanceFactor;

    const cos = Math.cos(-playerRot);
    const sin = Math.sin(-playerRot);
    const rxRot = rx * cos - ry * sin;
    const ryRot = rx * sin + ry * cos;

    const distSq = rxRot * rxRot + ryRot * ryRot;
    if (distSq > 2500) {
      const dist = Math.sqrt(distSq);
      return {
        x: (rxRot / dist) * 50 + 50,
        y: (ryRot / dist) * 50 + 50,
        outOfBounds: true,
      };
    }
    return {
      x: rxRot + 50,
      y: ryRot + 50,
      outOfBounds: false,
    };
  };

  const getPlanetNameColor = (planetId: string) => {
    switch (planetId) {
      case "aurelia": return "text-amber-400";
      case "verdant": return "text-emerald-400";
      case "zephyr": return "text-fuchsia-400";
      case "kryos": return "text-cyan-400";
      case "ignis": return "text-red-500";
      default: return "text-sky-400";
    }
  };

  // Raw minerals total in cargo
  const totalCargo = Object.values(stats.cargo || {}).reduce((a, b) => (a as number) + (b as number), 0) as number;

  // Raw Ore Sell Matrix
  const orePrices = {
    iron: 45,
    titanium: 90,
    gold: 185,
    crystal: 290,
    uranium: 480,
    darkMatter: 850
  };

  const handleSellCargo = () => {
    const payout = 
      stats.cargo.iron * orePrices.iron +
      stats.cargo.titanium * orePrices.titanium +
      stats.cargo.gold * orePrices.gold +
      stats.cargo.crystal * orePrices.crystal +
      stats.cargo.uranium * orePrices.uranium +
      stats.cargo.darkMatter * orePrices.darkMatter;

    if (payout > 0) {
      audioEngine.playRefuel();
      onUpdateStats({
        credits: stats.credits + payout,
        cargo: { iron: 0, titanium: 0, gold: 0, crystal: 0, uranium: 0, darkMatter: 0 }
      });
      onAddLog(`CARGO REFINE: Liquidated cargo hold. Discharged ores for +${payout} Credits!`, "success");
    }
  };

  // Buy Upgrades handler
  const buyUpgrade = (key: keyof typeof stats.upgrades, cost: number, newStats: Partial<PlayerStats>) => {
    if (stats.credits < cost) {
      onAddLog("TRANSACTION REJECTED: Insufficient credits. Complete missions or sell mined ores!", "danger");
      return;
    }
    audioEngine.playRefuel();
    
    const updatedUpgrades = { ...stats.upgrades };
    updatedUpgrades[key] = (updatedUpgrades[key] || 0) + 1;

    onUpdateStats({
      credits: stats.credits - cost,
      upgrades: updatedUpgrades,
      ...newStats
    });

    onAddLog(`UPGRADE SECURED: Enhanced Starship ${(key as string).toUpperCase()} matrix to Level ${updatedUpgrades[key]}!`, "success");
  };

  // Claim Science database grant
  const claimScienceGrant = (key: keyof typeof stats.discoveries, reward: number) => {
    if (claimedGrants[key]) return;
    audioEngine.playRefuel();
    setClaimedGrants(prev => ({ ...prev, [key]: true }));
    onUpdateStats({ credits: stats.credits + reward });
    onAddLog(`SCIENCE GRANT DISBURSED: Received +${reward} Credits for log achievement: ${(key as string).toUpperCase()}!`, "success");
  };

  // Procedural active missions
  const acceptMission = (mTitle: string, mReward: number) => {
    audioEngine.playClick();
    onUpdateStats({
      activeMission: {
        id: Math.random().toString(),
        type: mTitle.includes("Crystal") ? "cargo_delivery" : "pirate_hunt",
        title: mTitle,
        description: mTitle.includes("Crystal") 
          ? `Kepler Mining Union is short on materials. Mine and deliver 5x Raw Crystals from regional asteroid clusters to complete.` 
          : `Zorax Syndicate pirate scouts are harassing cargo vessels in Kepler's orbital lanes. Hunt and eliminate 3 pirate vessels.`,
        targetSystemId: stats.currentSystemId,
        rewardCredits: mReward,
        rewardScore: 150,
        status: "active",
        progress: 0,
        objective: mTitle.includes("Crystal") 
          ? "Deliver 5x raw crystals to orbital base" 
          : "Eliminate 3 pirate vessels (Progress: 0 / 3)"
      }
    });
    onAddLog(`CONTRACT SECURED: Accepted mission: ${mTitle}. Coordinates mapped.`, "warning");
  };

  const deliverCrystalMission = () => {
    if (stats.cargo.crystal >= 5) {
      audioEngine.playRefuel();
      onUpdateStats({
        cargo: { ...stats.cargo, crystal: stats.cargo.crystal - 5 },
        credits: stats.credits + (stats.activeMission?.rewardCredits || 1000),
        activeMission: null
      });
      onAddLog(`MISSION SUCCESS: Delivered 5x high-energy crystals. Reward credits deposited (+${stats.activeMission?.rewardCredits} CR)!`, "success");
    } else {
      onAddLog(`LOGISTICS FAILED: Missing materials. Current: ${stats.cargo.crystal}/5 Crystals in silos.`, "danger");
    }
  };

  // Compass and Map helpers
  const heading = Math.round(((-playerRot * 180) / Math.PI + 360) % 360);

  const getCompassLabel = (deg: number) => {
    if (deg >= 337.5 || deg < 22.5) return "NORTH";
    if (deg >= 22.5 && deg < 67.5) return "NORTH-EAST";
    if (deg >= 67.5 && deg < 112.5) return "EAST";
    if (deg >= 112.5 && deg < 157.5) return "SOUTH-EAST";
    if (deg >= 157.5 && deg < 202.5) return "SOUTH";
    if (deg >= 202.5 && deg < 247.5) return "SOUTH-WEST";
    if (deg >= 247.5 && deg < 292.5) return "WEST";
    return "NORTH-WEST";
  };

  const getSystemCoords = (id: string, idx: number) => {
    if (id === "sol_sector") return { x: 0, y: 0 };
    // spiral galaxy pattern centered around 0, 0
    const theta = idx * 0.45;
    const r = 220 + idx * 26;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    return { x, y };
  };

  const handleMapMouseDown = (e: React.MouseEvent) => {
    setIsDraggingMap(true);
    setDragMapStart({ x: e.clientX - mapPan.x, y: e.clientY - mapPan.y });
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;
    setMapPan({ x: e.clientX - dragMapStart.x, y: e.clientY - dragMapStart.y });
  };

  const handleMapWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setMapZoom((prev) => Math.max(0.3, Math.min(5.0, prev * factor)));
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 font-sans select-none z-40">
      {/* Dynamic Keyframe Injection */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translate(-50%, -50%) scale(0.65); opacity: 0; }
          15% { transform: translate(-50%, -120%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -240%) scale(0.8); opacity: 0; }
        }
      `}</style>
      
      {/* SCREEN VIGNETTE */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.85)] z-0" />

      {/* COCKPIT CANOPY WIREFRAME GLASS */}
      {activeScreen === "flight" && !isPaused && !showGalaxyMap && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none text-blue-500/10 z-0" viewBox="0 0 1920 1080" preserveAspectRatio="none">
          {/* Glass framing struts */}
          <path d="M 0,0 L 250,150 L 250,930 L 0,1080" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
          <path d="M 1920,0 L 1670,150 L 1670,930 L 1920,1080" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
          
          {/* Canopy horizontal divider arch */}
          <path d="M 250,150 L 960,80 L 1670,150" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-15" />
          
          {/* Bottom console outline support */}
          <path d="M 250,930 L 500,990 L 1420,990 L 1670,930" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-35" />
          
          {/* Cybernetic decorative corners */}
          <path d="M 250,150 L 290,170" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-30" />
          <path d="M 1670,150 L 1630,170" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-30" />
          <path d="M 250,930 L 290,910" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-30" />
          <path d="M 1670,930 L 1630,910" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-30" />
        </svg>
      )}

      {/* ================= TOP ROW: STATS & COMPASS ================= */}
      <div className="flex justify-between items-start w-full gap-4 z-10">
        
        {/* Left Side: Systems Console */}
        <div className="bg-black/40 backdrop-blur-md border-l-2 border-blue-500 p-4 pointer-events-auto w-72 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1 font-mono flex justify-between">
            <span>CURRENT SECTOR</span>
            <span className="text-emerald-400">{currentSystem.galaxy.toUpperCase()}</span>
          </div>
          <div className="text-xl font-light tracking-tight italic text-white flex justify-between items-center">
            <span>{currentPlanet ? currentPlanet.name : "Deep Space"}</span>
            {currentPlanet && <span className="text-xs opacity-50 font-normal ml-2">[{currentSystem.name}]</span>}
          </div>
          
          <div className="text-xs text-neutral-400 font-mono mt-1 pt-1.5 border-t border-white/5 flex justify-between">
            <span>SECTOR TYPE:</span>
            <span className="text-white font-bold">{currentSystem.starType.toUpperCase()}</span>
          </div>

          <div className="text-[10px] text-neutral-500 font-mono leading-none flex justify-between">
            <span>COORD X:</span>
            <span className="text-neutral-400">{Math.round(playerPos[0])}</span>
          </div>
          <div className="text-[10px] text-neutral-500 font-mono leading-none flex justify-between">
            <span>COORD Y:</span>
            <span className="text-neutral-400">{Math.round(playerPos[1])}</span>
          </div>
          <div className="text-[10px] text-neutral-500 font-mono leading-none flex justify-between">
            <span>COORD Z:</span>
            <span className="text-neutral-400">{Math.round(playerPos[2])}</span>
          </div>

          <div className="text-xs text-amber-400 font-mono mt-1 pt-1.5 border-t border-white/5 flex justify-between items-center">
            <span>CREDITS:</span>
            <span className="font-bold flex items-center gap-1 text-amber-400"><Coins className="w-3.5 h-3.5" /> {stats.credits || 0} CR</span>
          </div>
        </div>

        {/* Center top: Danger alerts */}
        {playerPos[0] * playerPos[0] + playerPos[2] * playerPos[2] < 3000 * 3000 && (
          <div className={`px-4 py-2.5 bg-red-950/80 border border-red-500/50 rounded-none backdrop-blur-md flex items-center gap-2 text-red-300 font-mono text-xs ${pulse ? "animate-pulse border-red-500 bg-red-900" : ""}`}>
            <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />
            <span className="tracking-wide text-[10px] sm:text-xs">CRITICAL STAR CORONA INTENSITY: TURN AWAY</span>
          </div>
        )}

        {blackHoleDistance < 4000 && (
          <div className={`px-4 py-2.5 bg-purple-950/90 border border-purple-500 rounded-none backdrop-blur-md flex items-center gap-2 text-purple-300 font-mono text-xs ${pulse ? "animate-pulse border-purple-400 bg-purple-900" : ""}`}>
            <AlertTriangle className="w-4 h-4 text-purple-400 animate-bounce" />
            <span className="tracking-wide text-[10px] sm:text-xs">GRAVITATIONAL HORIZON WARNING: {Math.round(blackHoleDistance)}u TO SINGULARITY Core!</span>
          </div>
        )}

        {/* Right Side: Interactive Cosmic Radar */}
        <div className="flex flex-col gap-2 pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-4 w-52 items-center text-center">
          <span className="font-mono text-[10px] font-bold text-blue-400 tracking-wider flex items-center gap-1 uppercase">
            <Navigation className="w-3 h-3 text-blue-400" /> SYSTEM SCANNER
          </span>

          {/* 2D Compass Disk */}
          <div className="relative w-28 h-28 rounded-full border border-white/20 bg-neutral-900/50 flex items-center justify-center my-1 overflow-hidden">
            <div className="absolute inset-2 rounded-full border border-dashed border-white/10" />
            <div className="absolute inset-6 rounded-full border border-dashed border-white/5" />
            
            {/* Center Player Cross */}
            <div className="absolute w-1 h-1 bg-blue-400 z-10" />

            {/* Render Celestial Sun (0,0) */}
            {(() => {
              const sunRadar = getRadarPosition(0, 0);
              return (
                <div
                  className={`absolute w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-md shadow-yellow-400/80 cursor-help`}
                  style={{
                    left: `${sunRadar.x}%`,
                    top: `${sunRadar.y}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: sunRadar.outOfBounds ? 0.35 : 1,
                  }}
                  title="STAR CORE"
                />
              );
            })()}

            {/* Planets */}
            {planets.map((planet) => {
              const time = Date.now() * 0.00005 * planet.orbitSpeed;
              const px = Math.cos(time) * planet.orbitRadius;
              const pz = Math.sin(time) * planet.orbitRadius;
              const radar = getRadarPosition(px, pz);

              return (
                <div
                  key={planet.id}
                  className={`absolute w-1 h-1 rounded-full border border-white/20 z-10 ${
                    planet.id === "aurelia" ? "bg-amber-400" :
                    planet.id === "verdant" ? "bg-emerald-400" :
                    planet.id === "zephyr" ? "bg-fuchsia-400" :
                    planet.id === "kryos" ? "bg-cyan-400" : "bg-red-500"
                  }`}
                  style={{
                    left: `${radar.x}%`,
                    top: `${radar.y}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: radar.outOfBounds ? 0.4 : 1,
                  }}
                  title={planet.name}
                />
              );
            })}

            {/* Black Hole if in system */}
            {currentSystem.hasBlackHole && (() => {
              const bhRadar = getRadarPosition(12000, -12000);
              return (
                <div
                  className="absolute w-2 h-2 rounded-full bg-purple-600 border border-black animate-pulse z-20 shadow-[0_0_8px_#8b5cf6]"
                  style={{
                    left: `${bhRadar.x}%`,
                    top: `${bhRadar.y}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: bhRadar.outOfBounds ? 0.3 : 1,
                  }}
                  title="SINGULARITY CORE"
                />
              );
            })()}

            {/* Active Enemy Ships */}
            {enemyPositions.map((enemy) => {
              const radar = getRadarPosition(enemy.x, enemy.z);
              return (
                <div
                  key={enemy.id}
                  className="absolute w-1.5 h-1.5 rounded-full bg-red-600 shadow-sm shadow-red-500/80 z-20 animate-ping"
                  style={{
                    left: `${radar.x}%`,
                    top: `${radar.y}%`,
                    transform: "translate(-50%, -50%)",
                    opacity: radar.outOfBounds ? 0.2 : 1,
                  }}
                  title="HOSTILE CONTACT"
                />
              );
            })}
          </div>

          {/* Radar Zoom Controls */}
          <div className="flex gap-1 w-full justify-between items-center text-[9px] font-mono border-t border-white/5 pt-1.5">
            <span className="text-neutral-500 uppercase">ZOOM</span>
            <div className="flex gap-1">
              {[1, 2, 5].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    audioEngine.playClick();
                    setRadarScale(z);
                  }}
                  className={`px-1.5 py-0.5 rounded-none border transition-colors ${
                    radarScale === z
                      ? "border-blue-400 bg-blue-950/30 text-blue-400 font-bold"
                      : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ================= COCKPIT CROSSHAIR ================= */}
      {activeScreen === "flight" && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none opacity-30">
          <div className="relative w-12 h-12 border border-white/50 rounded-full flex items-center justify-center">
            <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
          <div className="absolute -top-2 left-1/2 w-[1px] h-3 bg-white"></div>
          <div className="absolute -bottom-2 left-1/2 w-[1px] h-3 bg-white"></div>
          <div className="absolute top-1/2 -left-2 w-3 h-[1px] bg-white"></div>
          <div className="absolute top-1/2 -right-2 w-3 h-[1px] bg-white"></div>
        </div>
      )}

      {/* ================= ATMOSPHERE & LANDING GUIDANCE ================= */}
      {activeScreen === "landing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[1px] z-20">
          <div className="p-6 rounded-none border-l-2 border-blue-500 bg-neutral-950/90 max-w-md w-full shadow-2xl text-center space-y-4 pointer-events-auto">
            <div className="flex items-center justify-center gap-2 text-blue-400 animate-pulse font-mono font-bold text-sm tracking-wider uppercase">
              <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />
              LANDING COUPLERS ENGAGING
            </div>
            
            <p className="text-xs text-neutral-400 leading-normal">
              Approaching planet atmosphere boundary. Magnetic stabilization beams locked. Retract landing landing landing gears.
            </p>

            <div className="space-y-1.5 py-2">
              <div className="flex justify-between text-xs font-mono text-neutral-400 uppercase tracking-wider">
                <span>DOCKING DYNAMICS</span>
                <span className="text-white font-bold">{Math.round(stats.landingProgress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-none overflow-hidden">
                <div
                  className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                  style={{ width: `${stats.landingProgress * 100}%` }}
                />
              </div>
            </div>

            <div className="text-[10px] font-mono p-2 bg-blue-950/20 border border-blue-500/20 text-blue-300">
              [SYSTEMS]: VELOCITY COMPENSATOR ENERGISED
            </div>
          </div>
        </div>
      )}

      {/* ================= CODESPACE LANDED TABBED CONTROL CONTROL CENTER ================= */}
      {activeScreen === "landed" && currentPlanet && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent p-4 z-20 pointer-events-none">
          {/* 1. SCENIC COCKPIT ENVIRONMENTAL SURVEYOR MODE */}
          {stats.currentPlanetId !== "station" && !showOutpostOps ? (
            <div className="w-full h-full flex flex-col justify-between pointer-events-none font-mono">
              
              {/* TOP HEADER ROW: Planet Name & Coordinates */}
              <div className="w-full flex justify-between items-center bg-neutral-950/75 border border-blue-500/20 backdrop-blur-md px-5 py-3 pointer-events-auto shrink-0 shadow-lg select-none">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-400 animate-pulse" />
                  <div>
                    <h2 className="text-lg font-light tracking-tight text-white uppercase flex items-center gap-2">
                      Cockpit Environmental Surveyor
                      <span className="text-blue-400 font-bold font-mono">[{currentPlanet.name}]</span>
                    </h2>
                    <p className="text-[10px] text-neutral-400">SECTOR: {currentSystem.name} | COORDINATES: X:{Math.round(playerPos[0])} Z:{Math.round(playerPos[2])}</p>
                  </div>
                </div>
                
                {/* Visual state indicators */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/20 border border-amber-500/20 px-2.5 py-1">
                    <Coins className="w-3.5 h-3.5" />
                    <span className="font-bold">{stats.credits} CR</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400 bg-blue-950/20 border border-blue-500/20 px-2.5 py-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="font-bold">{totalCargo} / {stats.maxCargo} CARGO</span>
                  </div>
                </div>
              </div>

              {/* CENTER AREA: Left Side (Diagnostic Grid) & Right Side (Scientific Scanner) */}
              <div className="flex-1 flex justify-between items-stretch p-2 md:p-4 gap-4 overflow-hidden">
                
                {/* LEFT SIDE PANEL: Environmental Diagnostics */}
                <div className="w-80 bg-neutral-950/80 border border-white/10 backdrop-blur-md p-4 pointer-events-auto flex flex-col justify-between shadow-2xl select-none">
                  <div className="space-y-4 overflow-y-auto pr-1">
                    <div className="border-b border-white/10 pb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Atmospheric Diagnostics</h3>
                    </div>

                    {(() => {
                      const metrics = getCockpitMetrics(currentPlanet);
                      const scannedPct = ((scanTargets.filter(t => t.scanned).length / 5) * 100).toFixed(0);
                      return (
                        <div className="space-y-3.5 text-xs">
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Planet Classification:</span>
                            <span className="text-white font-bold">{currentPlanet.biome} Surface</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Local Gravity:</span>
                            <span className="text-white font-bold">{currentPlanet.gravity || 1.0} G</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Extrapolated Temp:</span>
                            <span className="text-white font-bold">{metrics.temp}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Atmosphere Composition:</span>
                            <span className="text-white font-bold text-[11px] leading-tight block">{metrics.atmosphere}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Active Surface Weather:</span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5 uppercase">
                              <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "6s" }} /> {weather}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Hazard Threat Level:</span>
                            <span className={`font-bold uppercase ${metrics.danger.includes("LOW") ? "text-green-400" : metrics.danger.includes("MODERATE") ? "text-amber-400" : "text-red-500"}`}>
                              {metrics.danger}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block text-[9px] uppercase">Surface Minerals & Flora:</span>
                            <span className="text-neutral-300 block text-[10px] italic">{metrics.resources}</span>
                          </div>
                          <div className="pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] mb-1">
                              <span className="text-neutral-400">SURFACE DISCOVERY RATIO:</span>
                              <span className="text-cyan-400 font-bold">{scannedPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-neutral-900 border border-white/5 rounded-none overflow-hidden">
                              <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${scannedPct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-3 border-t border-white/10 text-[9px] text-neutral-500 select-none">
                    [SENSOR ARRAYS COUPLING SECURE]
                  </div>
                </div>

                {/* MIDDLE HUD OVERLAY: Scanner Targeting Reticle */}
                {isScanning && (
                  <div className="flex-1 flex flex-col justify-center items-center pointer-events-none">
                    <div className="relative w-52 h-52 border-2 border-dashed border-cyan-500/40 rounded-full flex flex-col justify-center items-center animate-spin" style={{ animationDuration: "12s" }}>
                      <div className="w-44 h-44 border border-cyan-500/20 rounded-full" />
                      <div className="absolute w-2 h-2 bg-cyan-400 rounded-full top-0" />
                      <div className="absolute w-2 h-2 bg-cyan-400 rounded-full bottom-0" />
                    </div>
                    <div className="absolute flex flex-col items-center gap-1 text-center bg-neutral-950/90 border border-cyan-400/40 p-4 shadow-xl max-w-xs backdrop-blur-md">
                      <span className="text-[10px] font-bold text-cyan-400 animate-pulse">ACQUIRING MOLECULAR TELEMETRY</span>
                      <span className="text-xs font-bold text-white uppercase">{scanTargets.find(t => t.id === activeScanTargetId)?.name}</span>
                      <div className="w-40 h-2 bg-neutral-950 border border-white/10 rounded-none overflow-hidden mt-2">
                        <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${scanProgress}%` }} />
                      </div>
                      <span className="text-[9px] text-neutral-500 mt-1">{scanProgress.toFixed(0)}% DECRYPTED</span>
                    </div>
                  </div>
                )}

                {/* RIGHT SIDE PANEL: Bio-Anomaly Scientific Scanner */}
                <div className="w-80 bg-neutral-950/80 border border-white/10 backdrop-blur-md p-4 pointer-events-auto flex flex-col shadow-2xl select-none overflow-hidden">
                  <div className="border-b border-white/10 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Surface Anomalies</h3>
                    </div>
                    <span className="text-[9px] font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5">
                      {scanTargets.filter(t => t.scanned).length} / 5 LOGS
                    </span>
                  </div>

                  {/* Scientific scanner targets list */}
                  <div className="flex-1 overflow-y-auto space-y-2 mt-3.5 pr-1">
                    {scanTargets.map((t) => {
                      const isActive = activeScanTargetId === t.id;
                      const isUnexplored = !t.scanned;
                      
                      return (
                        <div 
                          key={t.id}
                          className={`p-2.5 border transition-all flex flex-col justify-between gap-2 text-left ${
                            isActive
                              ? "border-cyan-400 bg-cyan-950/20 shadow-[0_0_15px_rgba(34,211,238,0.2)] animate-pulse"
                              : t.scanned
                                ? "border-emerald-500/15 bg-emerald-950/5 hover:border-emerald-500/30"
                                : "border-white/5 bg-white/[0.01] hover:border-white/15"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-[9px] text-neutral-500 uppercase font-bold">{t.type} Signal</div>
                              <h4 className="text-[11px] font-bold text-white uppercase mt-0.5">{t.scanned ? t.name : "Unexplored Anomaly"}</h4>
                            </div>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 ${t.scanned ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20" : "bg-neutral-900 text-amber-500 border border-amber-500/10"}`}>
                              {t.scanned ? "SCANNED" : "UNEXPLORED"}
                            </span>
                          </div>

                          {t.scanned ? (
                            <p className="text-[10px] text-neutral-300 italic font-sans leading-tight">
                              "{t.fact}"
                              <span className="block mt-1 text-[9px] font-mono font-bold text-amber-400">Bonus Grant Reward claimed: +{t.bonusCredits} CR</span>
                            </p>
                          ) : (
                            <div className="flex justify-between items-center pt-1 border-t border-white/5">
                              <span className="text-[9px] text-cyan-400">GRANT VALUE: +{t.bonusCredits} CR</span>
                              <button
                                onClick={() => { audioEngine.playClick(); onInitiateScan(t.id); }}
                                disabled={isScanning || t.scanned}
                                className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-neutral-900 disabled:text-neutral-500 text-neutral-950 font-extrabold text-[9px] transition-all cursor-pointer uppercase rounded-sm"
                              >
                                {isActive ? "SCANNING..." : "SCAN TARGET"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BOTTOM PILOT UTILITY BUTTONS RAIL */}
              <div className="w-full bg-neutral-950/75 border border-white/10 backdrop-blur-md p-3.5 pointer-events-auto flex flex-col md:flex-row justify-between items-center gap-3 shrink-0 shadow-2xl mt-auto select-none">
                <div className="text-neutral-400 text-[10px] text-center md:text-left">
                  <span className="text-white font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 mr-2">A / D</span> Rotate spaceship sensor view & pan surrounding landscape
                </div>

                <div className="flex gap-4">
                  {/* Option 1: Access Outpost Hangar Services */}
                  <button
                    onClick={() => { audioEngine.playClick(); setShowOutpostOps(true); }}
                    className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold font-mono tracking-wider transition-all cursor-pointer rounded-sm"
                  >
                    ACCESS OUTPOST OPERATIONS & TRADE
                  </button>

                  {/* Option 2: Launch Spaceship into Space Orbit */}
                  <button
                    onClick={onTakeOff}
                    className="px-8 py-2.5 bg-blue-500 hover:bg-blue-400 text-neutral-950 text-xs font-black font-mono tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] cursor-pointer rounded-sm active:scale-95 flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4 fill-current text-neutral-950 animate-pulse" /> ENGAGE ENGINES / LAUNCH IN ORBIT
                  </button>
                </div>
              </div>
            </div>
          ) : (
            
            /* 2. ORIGINAL DETAILS TABBED CONTROL CENTER SCREEN */
            <div className="w-full max-w-5xl bg-neutral-950 border border-white/15 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto flex flex-col h-[85vh] overflow-hidden">
              
              {/* Modal Top Header Bar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 border-b border-white/10 bg-white/[0.02] shrink-0 gap-3">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-400" />
                  <div>
                    <h2 className="text-xl font-light tracking-tight text-white uppercase flex items-center gap-2">
                      {stats.currentPlanetId === "station" ? "Orbital Outpost Base" : "Planet Outpost"}
                      <span className="text-blue-400 font-bold font-mono">[{currentPlanet.name}]</span>
                    </h2>
                    <p className="text-[10px] text-neutral-400 font-mono">SECTOR: {currentSystem.name} | GALAXY: {currentSystem.galaxy}</p>
                  </div>
                </div>

                {/* Top Row Indicators */}
                <div className="flex gap-4 items-center text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/20 border border-amber-500/20 px-2.5 py-1">
                    <Coins className="w-3.5 h-3.5" />
                    <span className="font-bold">{stats.credits} CR</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-400 bg-blue-950/20 border border-blue-500/20 px-2.5 py-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="font-bold">{totalCargo} / {stats.maxCargo} CARGO</span>
                  </div>
                  
                  {/* Close operations view back to scenic view */}
                  {stats.currentPlanetId !== "station" && (
                    <button
                      onClick={() => { audioEngine.playClick(); setShowOutpostOps(false); }}
                      className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white border border-white/10 font-bold font-mono text-[10px] uppercase transition-all cursor-pointer"
                    >
                      COCKPIT VIEW
                    </button>
                  )}
                  
                  <button
                    onClick={onTakeOff}
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono text-[10px] tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" /> LAUNCH IN ORBIT
                  </button>
                </div>
              </div>

              {/* TAB SELECTOR RAIL */}
              <div className="flex border-b border-white/15 bg-neutral-900/40 shrink-0 font-mono text-[10px] overflow-x-auto">
                {[
                  { id: "port", name: "PORT SERVICES", icon: ShoppingBag },
                  { id: "hyperdrive", name: "HYPERDRIVE MAP", icon: Map },
                  { id: "engineering", name: "UPGRADE LAB", icon: Cpu },
                  { id: "council", name: "MISSION COUNCIL", icon: Award },
                  { id: "database", name: "SCIENCE REGISTRY", icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { audioEngine.playClick(); setDockedTab(tab.id as any); }}
                      className={`flex items-center gap-2 px-5 py-3 border-r border-white/10 transition-colors uppercase cursor-pointer shrink-0 ${
                        dockedTab === tab.id
                          ? "bg-neutral-950 text-blue-400 font-bold border-b-2 border-b-blue-500"
                          : "text-neutral-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>

              {/* TAB BODY CONTROLLER */}
              <div className="flex-1 p-6 overflow-y-auto text-left">
                
                {/* TAB 1: PORT SERVICES & ORE TRADING */}
                {dockedTab === "port" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                    <div className="md:col-span-7 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-mono text-blue-400 uppercase tracking-widest">Base Information</h3>
                        <p className="text-xs text-neutral-300 leading-relaxed font-sans">{currentPlanet.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 border border-white/5 bg-white/[0.02] space-y-2">
                          <div className="text-xs font-mono text-neutral-400">REFUEL HANGAR</div>
                          <div className="text-lg font-bold text-white font-mono">{Math.round(stats.fuel)} / {stats.maxFuel} GAL</div>
                          <button
                            onClick={onRefuel}
                            disabled={stats.fuel >= stats.maxFuel}
                            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-900 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider transition-all uppercase"
                          >
                            Refill Tanks (Free)
                          </button>
                        </div>

                        <div className="p-4 border border-white/5 bg-white/[0.02] space-y-2">
                          <div className="text-xs font-mono text-neutral-400">ARMOR DRY-DOCK</div>
                          <div className="text-lg font-bold text-white font-mono">{Math.round(stats.health)} / {stats.maxHealth} HP</div>
                          <button
                            onClick={onRepair}
                            disabled={stats.health >= stats.maxHealth}
                            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-900 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider transition-all uppercase"
                          >
                            Repair Hull (Free)
                          </button>
                        </div>
                      </div>

                      {/* Atmospheric & weather data */}
                      <div className="p-4 border border-white/10 bg-blue-950/15 space-y-2">
                        <div className="text-xs font-mono text-blue-400 uppercase font-bold">ATMOSPHERIC LOCAL SURVEY</div>
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                          <div><span className="text-neutral-500">BIOME:</span> <span className="text-white font-bold">{currentPlanet.biome}</span></div>
                          <div><span className="text-neutral-500">WEATHER:</span> <span className="text-white font-bold">{currentPlanet.weather}</span></div>
                          <div><span className="text-neutral-500">GRAVITY:</span> <span className="text-white font-bold">{currentPlanet.gravity} G</span></div>
                          <div><span className="text-neutral-500">OCEANS:</span> <span className="text-white font-bold">{currentPlanet.hasOceans ? "Yes" : "No"}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* CARGO REFINE MARKETPLACE */}
                    <div className="md:col-span-5 p-4 border border-white/10 bg-white/[0.01] flex flex-col justify-between">
                      <div className="space-y-4">
                        <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest flex items-center gap-1">
                          <ShoppingBag className="w-3.5 h-3.5" /> BULK ORE LIQUIDATION
                        </h3>
                        <p className="text-[11px] text-neutral-400">Sell harvested space raw minerals straight from planetary asteroid belt mining operations to earn precious Trade Credits.</p>

                        <div className="space-y-1.5 font-mono text-xs">
                          {Object.entries(stats.cargo || {}).map(([key, count]) => {
                            const price = orePrices[key as keyof typeof orePrices] || 0;
                            return (
                              <div key={key} className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-neutral-400 uppercase">{key}:</span>
                                <span className="text-white font-bold">{count as number} silos <span className="text-amber-500 font-normal">(@{price} CR)</span></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-neutral-400">TOTAL ESTIMATED REFINE VALUE:</span>
                          <span className="text-lg font-bold text-amber-400">
                            {stats.cargo.iron * orePrices.iron +
                             stats.cargo.titanium * orePrices.titanium +
                             stats.cargo.gold * orePrices.gold +
                             stats.cargo.crystal * orePrices.crystal +
                             stats.cargo.uranium * orePrices.uranium +
                             stats.cargo.darkMatter * orePrices.darkMatter} CR
                          </span>
                        </div>
                        <button
                          onClick={handleSellCargo}
                          disabled={totalCargo === 0}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-900 disabled:text-neutral-600 font-bold font-mono text-[10px] tracking-widest transition-all text-neutral-950 uppercase"
                        >
                        LIQUIDATE RAW SILOS COUPLING
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HYPERDRIVE GALACTIC MAP */}
              {dockedTab === "hyperdrive" && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex gap-1.5 shrink-0 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                      {["Milky Way", "Andromeda", "Triangulum", "Centaurus", "Sombrero"].map((gal) => (
                        <button
                          key={gal}
                          onClick={() => { audioEngine.playClick(); setSelectedGalaxy(gal as any); }}
                          className={`px-3 py-1.5 border font-mono text-[10px] cursor-pointer transition-colors ${
                            selectedGalaxy === gal
                              ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold"
                              : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                          }`}
                        >
                          {gal.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Search 100+ systems..."
                      value={selectedSystemSearch}
                      onChange={(e) => setSelectedSystemSearch(e.target.value)}
                      className="w-full md:w-64 bg-neutral-900 border border-white/10 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[48vh] pr-1 pt-1.5">
                    {GALAXY_SYSTEMS
                      .filter(s => s.galaxy === selectedGalaxy && s.name.toLowerCase().includes(selectedSystemSearch.toLowerCase()))
                      .map((sys) => {
                        const isCurrent = sys.id === stats.currentSystemId;
                        return (
                          <div
                            key={sys.id}
                            className={`p-4 border transition-all flex flex-col justify-between ${
                              isCurrent
                                ? "border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                : "border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/15"
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start mb-1">
                                <h4 className="font-mono text-sm font-bold text-white uppercase">{sys.name}</h4>
                                <span className="text-[9px] font-mono px-2 py-0.5 bg-neutral-900 text-neutral-400 rounded-full border border-white/5">{sys.planets.length} PLANETS</span>
                              </div>
                              <p className="text-[10px] font-mono text-blue-400 mb-1.5 uppercase flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-blue-400" />
                                {sys.starType} Star
                              </p>
                              <p className="text-[10px] text-neutral-400 font-sans leading-normal line-clamp-2">{sys.description}</p>
                              
                              <div className="flex flex-wrap gap-1 mt-2.5">
                                {sys.hasSpaceStation && <span className="text-[8px] font-mono px-1.5 py-0.5 bg-blue-950/40 text-blue-300 border border-blue-500/20">OUTPOST</span>}
                                {sys.hasWormhole && <span className="text-[8px] font-mono px-1.5 py-0.5 bg-fuchsia-950/40 text-fuchsia-300 border border-fuchsia-500/20">WORMHOLE</span>}
                                {sys.hasBlackHole && <span className="text-[8px] font-mono px-1.5 py-0.5 bg-purple-950/40 text-purple-300 border border-purple-500/20">BLACK HOLE</span>}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-white/5 mt-3 flex justify-between items-center shrink-0">
                              <span className="text-[10px] font-mono text-neutral-500">WARP FUEL: <span className="text-white font-bold">15 GAL</span></span>
                              {isCurrent ? (
                                <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 uppercase">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> CURRENT
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (stats.fuel < 15) {
                                      onAddLog("HYPERDRIVE WARP REJECTED: Low fuel reserves inside tanks!", "danger");
                                      return;
                                    }
                                    audioEngine.playExplosion(); // heavy warp fold sound
                                    onWarp(sys.id);
                                    onTakeOff(); // close landed menu instantly on warp
                                  }}
                                  className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono text-[9px] tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  WARP SECURE <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* TAB 3: SHIP UPGRADES */}
              {dockedTab === "engineering" && (
                <div className="space-y-6">
                  <div className="p-3 border border-blue-500/20 bg-blue-950/15 text-xs text-blue-300 font-mono leading-relaxed">
                    [ENGINEERING LAB]: Interstellar dry-dock facilities equipped to perform physical ship modifications. Upgrading systems increases default max reserves, velocities, and payload cooldown performance.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* UPGRADE 1: ENGINE SPEED */}
                    {(() => {
                      const level = stats.upgrades.engines || 0;
                      const cost = (level + 1) * 450;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Flame className="w-4 h-4 text-orange-400" /> FUSION ENGINE COMPRESSOR
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Increases top velocity in flight modes (+35 u/s velocity per level).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | SPEED: {stats.maxSpeed} u/s</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("engines", cost, { maxSpeed: stats.maxSpeed + 35 })}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 2: BOOST COMPRESSOR */}
                    {(() => {
                      const level = stats.upgrades.hyperdrive || 0;
                      const cost = (level + 1) * 400;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Zap className="w-4 h-4 text-amber-400" /> BOOST OPTIMIZER
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Folds warp boosters to achieve higher top boost speed (+50 u/s boost per level).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | BOOST: {stats.boostSpeed} u/s</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("hyperdrive", cost, { boostSpeed: stats.boostSpeed + 50 })}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 3: SHIELDS */}
                    {(() => {
                      const level = stats.upgrades.shields || 0;
                      const cost = (level + 1) * 450;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <ShieldAlert className="w-4 h-4 text-cyan-400" /> MAGNETIC SHIELD GENERATOR
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Enhances magnetic deflector shield recharge cores (+50 shield limit).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | CAPACITY: {stats.maxShield} SHIELD</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("shields", cost, { maxShield: stats.maxShield + 50, shield: stats.shield + 50 })}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 4: LASERS */}
                    {(() => {
                      const level = stats.upgrades.lasers || 0;
                      const cost = (level + 1) * 500;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Crosshair className="w-4 h-4 text-red-400" /> TACHYON LASER AMPLIFIER
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Tubes the beam resonance for intensified laser bursts (+25% damage per level).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | POWER: {16 + level * 5} DMG</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("lasers", cost, {})}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 5: MISSILES */}
                    {(() => {
                      const level = stats.upgrades.missiles || 0;
                      const cost = (level + 1) * 600;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Target className="w-4 h-4 text-purple-400" /> MISSILE EXPLOSIVE PAYLOAD
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Enhances missile propellant & warhead core (+30% payload damage).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | PAYLOAD: {65 + level * 20} DMG</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("missiles", cost, {})}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 6: DEEP-SPACE SCANNER */}
                    {(() => {
                      const level = stats.upgrades.armor || 0;
                      const cost = (level + 1) * 350;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Eye className="w-4 h-4 text-emerald-400" /> SENSORS & DEEP SCANNER
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Improves electromagnetic scanners for discovery and analysis (+25% scan speed & range).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | INTEGRITY: {stats.maxHealth} HP</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("armor", cost, { maxHealth: stats.maxHealth + 30, health: stats.health + 30 })}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 7: RADAR PROBE */}
                    {(() => {
                      const level = stats.upgrades.radar || 0;
                      const cost = (level + 1) * 300;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <Compass className="w-4 h-4 text-indigo-400" /> SECTOR RADAR TRANSCEIVER
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Expands radar ping swept radius and tracks remote hostiles (+20% zoom range).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | ENHANCEMENT: +{level * 20}%</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("radar", cost, {})}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}

                    {/* UPGRADE 8: ENERGY CORE CAPACITY */}
                    {(() => {
                      const level = stats.upgrades.cargo || 0;
                      const cost = (level + 1) * 450;
                      const isMax = level >= 5;
                      return (
                        <div className="p-4 border border-white/5 bg-white/[0.01] flex justify-between items-center">
                          <div className="space-y-1">
                            <h4 className="font-mono text-sm font-bold text-white uppercase flex items-center gap-1">
                              <BatteryCharging className="w-4 h-4 text-yellow-400" /> REGENERATIVE ENERGY CORE
                            </h4>
                            <p className="text-[10px] text-neutral-400 leading-normal">Increases Energy Core charge capacity and automatic recovery rate (+30 capacity per level).</p>
                            <div className="text-[10px] font-mono text-blue-400">LEVEL: {level} / 5 | CAPACITY: {stats.maxFuel} EC</div>
                          </div>
                          <button
                            onClick={() => buyUpgrade("cargo", cost, { maxFuel: stats.maxFuel + 30, fuel: stats.fuel + 30 })}
                            disabled={isMax}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:bg-neutral-950 disabled:text-neutral-500 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase shrink-0 ml-3 cursor-pointer"
                          >
                            {isMax ? "MAXED" : `BUY [${cost} CR]`}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 4: MISSION COUNCIL */}
              {dockedTab === "council" && (
                <div className="space-y-6">
                  <div className="p-3 border border-amber-500/20 bg-amber-950/15 text-xs text-amber-300 font-mono leading-relaxed flex items-center gap-2">
                    <Award className="w-4 h-4" /> [SECTOR CONTRACT BOARD]: Complete local coalition jobs to secure credits bounty bonuses and faction reputations.
                  </div>

                  {stats.activeMission ? (
                    <div className="p-5 border border-blue-500/30 bg-blue-950/10 space-y-4">
                      <div>
                        <div className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">ACTIVE ASSIGNMENT COORDINATED</div>
                        <h4 className="text-base font-bold text-white mt-1 uppercase font-mono">{stats.activeMission.title}</h4>
                        <p className="text-xs text-neutral-300 leading-relaxed font-sans mt-2">{stats.activeMission.description}</p>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-white/5 font-mono text-xs">
                        <div>
                          <span className="text-neutral-500">OBJECTIVE:</span>{" "}
                          <span className="text-white font-bold">{stats.activeMission.objective}</span>
                        </div>
                        <div className="flex gap-2">
                          {stats.activeMission.title.includes("Crystal") && (
                            <button
                              onClick={deliverCrystalMission}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold font-mono text-[10px] tracking-wider transition-all"
                            >
                              SUBMIT MATERIALS ({stats.cargo.crystal}/5)
                            </button>
                          )}
                          <button
                            onClick={() => { audioEngine.playClick(); onUpdateStats({ activeMission: null }); }}
                            className="px-3 py-2 border border-red-500/30 hover:bg-red-950/30 text-red-400 font-bold font-mono text-[10px]"
                          >
                            ABANDON CONTRACT
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* MISSION 1 */}
                      <div className="p-5 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                        <div>
                          <div className="text-[9px] font-mono text-amber-400 font-bold uppercase">OUTER-RIM SYNDICATE COUPLING</div>
                          <h4 className="text-sm font-bold text-white mt-1 uppercase font-mono">Asteroid Silicate Supply Chain</h4>
                          <p className="text-xs text-neutral-400 mt-2 font-sans leading-normal">Mining operations are depleted in Kepler sectors. Retrieve 5x high-energy raw crystals from asteroids and return them to base.</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-4">
                          <span className="text-[11px] font-mono text-amber-400 font-bold">REWARD: +1,000 CR</span>
                          <button
                            onClick={() => acceptMission("Asteroid Crystal Logistics Bulk", 1000)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase cursor-pointer"
                          >
                            Accept Job
                          </button>
                        </div>
                      </div>

                      {/* MISSION 2 */}
                      <div className="p-5 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                        <div>
                          <div className="text-[9px] font-mono text-blue-400 font-bold uppercase">UNITED SPACE COMMAND SECURITY</div>
                          <h4 className="text-sm font-bold text-white mt-1 uppercase font-mono">Pirate Suppression Initiative</h4>
                          <p className="text-xs text-neutral-400 mt-2 font-sans leading-normal">Renegade pirate vessels are targeting merchant hull convoys. Patrol nearby planets orbit, search and eliminate scouts.</p>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-4">
                          <span className="text-[11px] font-mono text-blue-400 font-bold">REWARD: +750 CR</span>
                          <button
                            onClick={() => acceptMission("Pirate Scout Infiltration Deflector", 750)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono text-[9px] tracking-wider uppercase cursor-pointer"
                          >
                            Accept Job
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FACTIONS SUB-PANEL */}
                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5" /> Interstellar Faction Alignments
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-[11px]">
                      <div className="p-3 border border-white/5 bg-white/[0.01]">
                        <div className="text-neutral-400 font-bold">UNITED SPACE COMMAND</div>
                        <div className="text-xs text-blue-400 font-bold mt-1">ALIGNMENT: NEUTRAL (0 / 100)</div>
                        <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: "50%" }} />
                        </div>
                      </div>

                      <div className="p-3 border border-white/5 bg-white/[0.01]">
                        <div className="text-neutral-400 font-bold">KEPLER MINING UNION</div>
                        <div className="text-xs text-sky-400 font-bold mt-1">ALIGNMENT: SECURE (+25 / 100)</div>
                        <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: "62.5%" }} />
                        </div>
                      </div>

                      <div className="p-3 border border-white/5 bg-white/[0.01]">
                        <div className="text-neutral-400 font-bold">ZORAX SYNDICATE CARTEL</div>
                        <div className="text-xs text-amber-400 font-bold mt-1">ALIGNMENT: NEUTRAL (0 / 100)</div>
                        <div className="w-full h-1 bg-white/10 mt-2 overflow-hidden">
                          <div className="h-full bg-amber-400" style={{ width: "50%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: ASTROPHYSICS SCIENCE DATABASE */}
              {dockedTab === "database" && (
                <div className="space-y-6">
                  <div className="p-3 border border-emerald-500/20 bg-emerald-950/15 text-xs text-emerald-300 font-mono leading-relaxed">
                    [ASTROPHYSICS RESEARCH COUNCIL]: Scan rare celestial anomalies during exploration to record science logs and secure high-payout federal grants.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* DISCOVERY 1: BLACK HOLE ACCRETION */}
                    <div className="p-4 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-mono text-sm font-bold text-white uppercase">BLACK HOLE EVENT HORIZON</h4>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 ${stats.discoveries.blackHole ? "bg-emerald-950 text-emerald-400" : "bg-neutral-950 text-neutral-500"}`}>
                            {stats.discoveries.blackHole ? "LOGGED" : "LOCKED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                          Scan data regarding light bending, gravitational lensing, and extreme time dilation curves inside the Cygnus accretion disk boundary.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-white/5 mt-4 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">GRANT: +500 CR</span>
                        {stats.discoveries.blackHole ? (
                          <button
                            onClick={() => claimScienceGrant("blackHole", 500)}
                            disabled={claimedGrants.blackHole}
                            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase font-bold cursor-pointer ${
                              claimedGrants.blackHole 
                                ? "bg-neutral-900 text-neutral-600 border border-neutral-800" 
                                : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
                            }`}
                          >
                            {claimedGrants.blackHole ? "CLAIMED" : "CLAIM GRANT"}
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-500 italic uppercase">Scan near gravity core</span>
                        )}
                      </div>
                    </div>

                    {/* DISCOVERY 2: PULSAR RADIATION BEAMS */}
                    <div className="p-4 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-mono text-sm font-bold text-white uppercase">NEUTRON STAR PULSAR CORONA</h4>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 ${stats.discoveries.pulsar ? "bg-emerald-950 text-emerald-400" : "bg-neutral-950 text-neutral-500"}`}>
                            {stats.discoveries.pulsar ? "LOGGED" : "LOCKED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                          Analyze high-intensity electromagnetic cone sweeps emitting from the magnetic poles of superdense neutron star remnants.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-white/5 mt-4 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">GRANT: +400 CR</span>
                        {stats.discoveries.pulsar ? (
                          <button
                            onClick={() => claimScienceGrant("pulsar", 400)}
                            disabled={claimedGrants.pulsar}
                            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase font-bold cursor-pointer ${
                              claimedGrants.pulsar 
                                ? "bg-neutral-900 text-neutral-600 border border-neutral-800" 
                                : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
                            }`}
                          >
                            {claimedGrants.pulsar ? "CLAIMED" : "CLAIM GRANT"}
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-500 italic uppercase">Scan Neutron Star system</span>
                        )}
                      </div>
                    </div>

                    {/* DISCOVERY 3: WHITE DWARF CORES */}
                    <div className="p-4 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-mono text-sm font-bold text-white uppercase">WHITE DWARF ELECTRON DEGENERACY</h4>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 ${stats.discoveries.whiteDwarf ? "bg-emerald-950 text-emerald-400" : "bg-neutral-950 text-neutral-500"}`}>
                            {stats.discoveries.whiteDwarf ? "LOGGED" : "LOCKED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                          Record degenerate carbon and oxygen core density frequencies on dead stellar core envelopes.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-white/5 mt-4 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">GRANT: +300 CR</span>
                        {stats.discoveries.whiteDwarf ? (
                          <button
                            onClick={() => claimScienceGrant("whiteDwarf", 300)}
                            disabled={claimedGrants.whiteDwarf}
                            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase font-bold cursor-pointer ${
                              claimedGrants.whiteDwarf 
                                ? "bg-neutral-900 text-neutral-600 border border-neutral-800" 
                                : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
                            }`}
                          >
                            {claimedGrants.whiteDwarf ? "CLAIMED" : "CLAIM GRANT"}
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-500 italic uppercase">Scan White Dwarf system</span>
                        )}
                      </div>
                    </div>

                    {/* DISCOVERY 4: WORMHOLE COUPLING */}
                    <div className="p-4 border border-white/5 bg-white/[0.01] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-mono text-sm font-bold text-white uppercase">EINSTEIN-ROSEN BRIDGES</h4>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 ${stats.discoveries.wormhole ? "bg-emerald-950 text-emerald-400" : "bg-neutral-950 text-neutral-500"}`}>
                            {stats.discoveries.wormhole ? "LOGGED" : "LOCKED"}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                          Perform complete scan of space distortion curves across throat boundaries of dimensional shortcut bridges.
                        </p>
                      </div>
                      <div className="pt-3 border-t border-white/5 mt-4 flex justify-between items-center">
                        <span className="text-[10px] font-mono text-amber-400 font-bold">GRANT: +400 CR</span>
                        {stats.discoveries.wormhole ? (
                          <button
                            onClick={() => claimScienceGrant("wormhole", 400)}
                            disabled={claimedGrants.wormhole}
                            className={`px-3 py-1 font-mono text-[9px] tracking-wider uppercase font-bold cursor-pointer ${
                              claimedGrants.wormhole 
                                ? "bg-neutral-900 text-neutral-600 border border-neutral-800" 
                                : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
                            }`}
                          >
                            {claimedGrants.wormhole ? "CLAIMED" : "CLAIM GRANT"}
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-neutral-500 italic uppercase">Scan orbital wormhole gateway</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ARCHIVED SCIENTIFIC DATA LOGS */}
                  <div className="pt-6 border-t border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" /> Archived Scientific Data Logs
                      </h3>
                      <span className="text-[10px] font-mono text-neutral-400">
                        DECRYPTED: {stats.unlockedFacts?.length || 0} / 16 CODES
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                      {ALL_SCIENTIFIC_FACTS.map((item, idx) => {
                        const isUnlocked = stats.unlockedFacts?.includes(item.fact);
                        return (
                          <div 
                            key={idx} 
                            className={`p-3 border transition-all duration-200 ${
                              isUnlocked 
                                ? "border-emerald-500/20 bg-emerald-950/10 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.05)]" 
                                : "border-white/5 bg-neutral-950/40 text-neutral-600 select-none"
                            }`}
                          >
                            <div className="flex justify-between items-center text-[9px] uppercase tracking-wider font-extrabold mb-1.5">
                              <span className={isUnlocked ? "text-emerald-400" : "text-neutral-500"}>
                                {item.category} #{idx + 1}
                              </span>
                              <span className={isUnlocked ? "text-amber-400" : "text-neutral-600"}>
                                {isUnlocked ? "DECRYPTED" : "LOCKED"}
                              </span>
                            </div>
                            {isUnlocked ? (
                              <p className="text-xs text-white italic font-sans leading-relaxed">
                                "{item.fact}"
                              </p>
                            ) : (
                              <p className="text-xs text-neutral-600 tracking-wider font-mono">
                                [REDACTED DATA - EXPLORE NEW SYSTEMS TO DECRYPT]
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

          </div>
        </div>
      )}
    </div>
  )}

      {/* ================= CRITICAL SYSTEM SHUTDOWN / GAME OVER ================= */}
      {activeScreen === "gameover" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-4 z-20">
          <div className="p-8 border border-red-500/30 bg-neutral-950/90 max-w-md w-full text-center space-y-6 shadow-2xl shadow-red-500/10 pointer-events-auto">
            <div className="flex flex-col items-center gap-3">
              <AlertTriangle className="w-12 h-12 text-red-500 animate-bounce" />
              <h2 className="text-2xl font-light italic tracking-tight text-white uppercase font-mono">
                CRITICAL FAILURE
              </h2>
              <p className="text-xs font-mono text-neutral-500 uppercase">STARSHIP INTEGRITY EXHAUSTED</p>
            </div>

            <p className="text-sm text-neutral-400 leading-relaxed font-sans">
              Your starship collided with dense stellar material, asteroids, or got too close to the Sun's blistering radiation field. Pilot systems deactivated.
            </p>

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={onRestart}
                className="px-6 py-3 bg-red-500 hover:bg-red-400 text-neutral-950 font-bold font-mono text-xs tracking-wider rounded-none transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} /> RE-DEPLOY CHASSIS
              </button>
              <button
                onClick={onQuit}
                className="px-5 py-3 border border-white/10 hover:bg-white/5 text-neutral-300 font-bold font-mono text-xs tracking-wider rounded-none transition-all cursor-pointer"
              >
                RETURN TO SYSTEM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BOTTOM ROW: SPEED & BOOST PANEL ================= */}
      <div className="flex justify-between items-end w-full mt-auto z-10">
        
        {/* Left: Speed & Boost Panel */}
        {activeScreen === "flight" && (
          <div className="space-y-2 pointer-events-auto bg-black/40 backdrop-blur-md p-4 border border-white/10 w-80">
            <div className="flex items-end justify-between text-white">
              <div className="flex items-end gap-2">
                <div className="text-5xl font-light italic tracking-tight tabular-nums">{Math.round(stats.speed * 20)}</div>
                <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-2 font-mono">u/s velocity</div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2 font-mono">WEAPONS COMPILER</div>
            </div>
            
            <div className="w-full h-1 bg-white/10 overflow-hidden">
              <div
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-150"
                style={{ width: `${Math.min(100, (stats.speed / stats.maxSpeed) * 100)}%` }}
              />
            </div>
            
            <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-mono flex justify-between">
              <span>{stats.isBoosting ? "VECTOR [BOOST]" : "VECTOR [NORMAL]"}</span>
              <span className="text-neutral-400 font-bold">L-MB: LASER | R-MB: MISSILE</span>
            </div>

            {/* Weapon Cooldown sub-meters */}
            <div className="flex gap-4 items-center mt-2.5 pt-2.5 border-t border-white/5">
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[8px] font-mono uppercase text-neutral-400">
                  <span>LASER</span>
                  <span className={laserCooldown > 0 ? "text-amber-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                    {laserCooldown > 0 ? `${Math.round(laserCooldown)}%` : "READY"}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/15">
                  <div 
                    className="h-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)] transition-all duration-75" 
                    style={{ width: `${100 - laserCooldown}%` }} 
                  />
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-[8px] font-mono uppercase text-neutral-400">
                  <span>MISSILE</span>
                  <span className={missileCooldown > 0 ? "text-amber-400 font-bold animate-pulse" : "text-cyan-400 font-bold"}>
                    {missileCooldown > 0 ? "RECHARGE" : "READY"}
                  </span>
                </div>
                <div className="w-full h-1 bg-white/15">
                  <div 
                    className="h-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)] transition-all duration-75" 
                    style={{ width: `${100 - missileCooldown}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Side: Systems Panel */}
        <div className="w-64 bg-black/40 backdrop-blur-md p-5 border-t border-white/10 pointer-events-auto">
          <div className="space-y-4">
            {/* Deflector Shields */}
            <div>
              <div className="flex justify-between text-[10px] uppercase mb-1 tracking-wider text-neutral-300 font-mono">
                <span>SHIELDS [DEFLECTORS]</span>
                <span className="text-cyan-400 font-bold">
                  {Math.round(stats.shield || 0)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10">
                <div
                  className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-150"
                  style={{ width: `${((stats.shield || 0) / (stats.maxShield || 100)) * 100}%` }}
                />
              </div>
            </div>

            {/* Structural Hull integrity */}
            <div>
              <div className="flex justify-between text-[10px] uppercase mb-1 tracking-wider text-neutral-300 font-mono">
                <span>HULL INTEGRITY</span>
                <span className={stats.health < 30 ? "text-red-400 font-bold animate-pulse" : "text-emerald-400 font-bold"}>
                  {Math.round(stats.health)}%
                </span>
              </div>
              <div className="flex gap-1">
                <div className={`flex-1 h-1.5 transition-colors ${stats.health >= 15 ? "bg-emerald-500 animate-pulse" : "bg-neutral-800"}`}></div>
                <div className={`flex-1 h-1.5 transition-colors ${stats.health >= 35 ? "bg-emerald-500" : "bg-neutral-800"}`}></div>
                <div className={`flex-1 h-1.5 transition-colors ${stats.health >= 55 ? "bg-emerald-500" : "bg-neutral-800"}`}></div>
                <div className={`flex-1 h-1.5 transition-colors ${stats.health >= 75 ? "bg-emerald-500" : "bg-neutral-800"}`}></div>
                <div className={`flex-1 h-1.5 transition-colors ${stats.health >= 95 ? "bg-emerald-500" : "bg-neutral-800"}`}></div>
              </div>
            </div>

            {/* Fuel Cells */}
            <div>
              <div className="flex justify-between text-[10px] uppercase mb-1 tracking-wider text-neutral-300 font-mono">
                <span>FUEL CELLS</span>
                <span className={stats.fuel < 25 ? "text-amber-400 font-bold animate-pulse" : "text-blue-400 font-bold"}>
                  {Math.round((stats.fuel / stats.maxFuel) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10">
                <div
                  className="h-full bg-blue-400 transition-all duration-150"
                  style={{ width: `${(stats.fuel / stats.maxFuel) * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-between border-t border-white/5 items-center">
              <div className="text-[9px] uppercase tracking-tighter text-neutral-400 font-mono leading-none">
                {activeScreen === "flight" ? "W-A-S-D: Pitch/Roll | Q-E: Yaw" : "[SPACE]: LAUNCH IN ORBIT"}
              </div>
              <div className={`w-2 h-2 rounded-full ${stats.isBoosting ? "bg-blue-400 animate-pulse" : stats.fuel < 25 || stats.health < 30 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            </div>
          </div>
        </div>

      </div>

      {/* ================= TACTICAL LOGS WINDOW ================= */}
      {activeScreen === "flight" && logs.length > 0 && (
        <div className="absolute bottom-32 left-8 pointer-events-auto bg-black/45 border border-white/10 p-3 w-80 font-mono text-[9px] text-neutral-400 select-none backdrop-blur-md rounded-sm">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase">
              <Terminal className="w-3 h-3 text-blue-400 animate-pulse" /> Tactical Log Feed
            </div>
            <button
              onClick={() => {
                audioEngine.playClick();
                setIsLogCollapsed(!isLogCollapsed);
              }}
              className="text-[8px] px-1.5 py-0.5 border border-white/10 hover:border-blue-400/50 hover:text-white uppercase transition-colors rounded-sm cursor-pointer"
            >
              {isLogCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!isLogCollapsed && (
            <div className="space-y-1 max-h-20 overflow-y-auto flex flex-col-reverse transition-all duration-300">
              {logs.slice(-3).reverse().map((log) => (
                <div key={log.id} className="flex gap-2 leading-relaxed items-start">
                  <span className="text-neutral-600">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  <span className={`${
                    log.type === "danger" ? "text-red-400 font-bold" :
                    log.type === "warning" ? "text-amber-400" :
                    log.type === "success" ? "text-emerald-400 font-bold" : "text-blue-300"
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TARGET ACQUISITION SYSTEM ================= */}
      {activeScreen === "flight" && targetEnemy && (
        <div className="absolute top-44 right-8 pointer-events-auto bg-black/60 border-r-2 border-red-500 p-4 w-60 font-mono text-[10px] text-neutral-400 select-none backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-red-400 font-bold border-b border-white/5 pb-1.5 mb-2 uppercase">
            <Target className="w-4 h-4 text-red-500 animate-pulse" /> TARGET LOCKED
          </div>
          <div className="space-y-2">
            <div className="flex justify-between font-sans">
              <span className="text-white font-bold text-xs">{targetEnemy.name}</span>
              <span className="text-red-400 font-bold uppercase text-[9px]">{targetEnemy.classType}</span>
            </div>
            
            <div>
              <div className="flex justify-between text-[8px] uppercase mb-0.5">
                <span>TARGET SHIELD</span>
                <span className="text-cyan-400 font-bold">{Math.round(targetEnemy.shield)}%</span>
              </div>
              <div className="w-full h-1 bg-white/10">
                <div className="h-full bg-cyan-400" style={{ width: `${targetEnemy.shield}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[8px] uppercase mb-0.5">
                <span>TARGET HULL</span>
                <span className="text-red-400 font-bold">{Math.round(targetEnemy.health)}%</span>
              </div>
              <div className="w-full h-1 bg-white/10">
                <div className="h-full bg-red-500" style={{ width: `${targetEnemy.health}%` }} />
              </div>
            </div>

            <div className="flex justify-between border-t border-white/5 pt-1.5 text-[9px]">
              <span>DISTANCE:</span>
              <span className="text-white font-bold">{Math.round(targetEnemy.distance)} u</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= SETTINGS PANEL MODAL ================= */}
      {showSettings && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-lg flex items-center justify-center z-50 pointer-events-auto">
          <div className="border border-white/15 bg-neutral-950 p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-xs uppercase tracking-wider">
                <Settings className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} /> SYSTEM PREFERENCES
              </div>
              <button 
                onClick={() => { audioEngine.playClick(); setShowSettings(false); }} 
                className="text-neutral-500 hover:text-white font-mono text-xs cursor-pointer border border-white/10 px-1.5 py-0.5"
              >
                CLOSE [X]
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs text-left">
              {/* MASTER VOLUME */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-neutral-400 uppercase">
                  <span>MASTER VOLUME:</span>
                  <span className="text-white font-bold">{Math.round(settings.volume * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-neutral-400" />
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={settings.volume} 
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      onUpdateSettings({ ...settings, volume: vol });
                      audioEngine.setVolume(vol);
                    }}
                    className="flex-1 accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* RESOLUTION */}
              <div className="space-y-1.5">
                <div className="text-neutral-400 uppercase">SCREEN RESOLUTION PRESET:</div>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => { audioEngine.playClick(); onUpdateSettings({ ...settings, resolution: r }); }}
                      className={`flex-1 py-1.5 text-center border font-bold text-[10px] uppercase cursor-pointer ${
                        settings.resolution === r 
                          ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold" 
                          : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* GRAPHICS / POST PROCESSING EFFECTS */}
              <div className="space-y-1.5">
                <div className="text-neutral-400 uppercase">POST PROCESSING DEPTH:</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { audioEngine.playClick(); onUpdateSettings({ ...settings, postProcessing: true }); }}
                    className={`flex-1 py-1.5 text-center border font-bold text-[10px] uppercase cursor-pointer ${
                      settings.postProcessing 
                        ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold" 
                        : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    BLOOM & GLOW [ON]
                  </button>
                  <button
                    onClick={() => { audioEngine.playClick(); onUpdateSettings({ ...settings, postProcessing: false }); }}
                    className={`flex-1 py-1.5 text-center border font-bold text-[10px] uppercase cursor-pointer ${
                      !settings.postProcessing 
                        ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold" 
                        : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                    }`}
                  >
                    LOW RESOURCE [OFF]
                  </button>
                </div>
              </div>

              {/* FULLSCREEN PRESET */}
              <div className="space-y-1.5">
                <div className="text-neutral-400 uppercase">FULLSCREEN DISPLAY:</div>
                <button
                  onClick={() => {
                    audioEngine.playClick();
                    onUpdateSettings({ ...settings, fullscreen: !settings.fullscreen });
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                      document.exitFullscreen();
                    }
                  }}
                  className="w-full py-1.5 border border-white/10 bg-white/5 hover:bg-white/10 font-bold text-[10px] text-white tracking-wider cursor-pointer"
                >
                  {settings.fullscreen ? "EXIT FULLSCREEN" : "ENTER FULLSCREEN"}
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 text-center">
              <button
                onClick={() => { audioEngine.playClick(); setShowSettings(false); }}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono text-[10px] tracking-wider transition-all cursor-pointer"
              >
                APPLY PREFERENCES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= FLIGHT MANUAL MODAL ================= */}
      {showHelp && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-lg flex items-center justify-center z-50 pointer-events-auto">
          <div className="border border-white/15 bg-neutral-950 p-6 max-w-lg w-full shadow-2xl space-y-5 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 animate-bounce" /> INTERSTELLAR FLIGHT MANUAL
              </div>
              <button 
                onClick={() => { audioEngine.playClick(); setShowHelp(false); }} 
                className="text-neutral-500 hover:text-white font-mono text-xs cursor-pointer border border-white/10 px-1.5 py-0.5"
              >
                CLOSE [X]
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans text-neutral-300 leading-relaxed overflow-y-auto max-h-[60vh] pr-2">
              <div className="space-y-1.5">
                <h4 className="font-mono text-white uppercase font-bold text-[11px] border-b border-white/5 pb-0.5">🚀 Starship Flight Controls</h4>
                <p><strong>Pitch & Roll:</strong> Use <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">W / S / A / D</kbd> to adjust pitch (nose up/down) and roll the ship left or right.</p>
                <p><strong>Yaw (Steering assist):</strong> Use <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">Q / E</kbd> to steer yaw. Mouse movement also automatically aligns ship direction!</p>
                <p><strong>Hyper Thruster Boost:</strong> Hold <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">SHIFT</kbd> to initiate the main hydrogen booster for massive straight-line speed.</p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-mono text-white uppercase font-bold text-[11px] border-b border-white/5 pb-0.5">💥 Weapon Systems & Mining</h4>
                <p><strong>Lasers:</strong> Use <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">LEFT-CLICK (Mouse 1)</kbd> to fire thermal plasma pulses. Firing at asteroids will mine them, releasing mineral cargos!</p>
                <p><strong>Homing Missiles:</strong> Use <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">RIGHT-CLICK (Mouse 2)</kbd> to fire heavy target-seeking ordnance. Missiles track locked hostiles and deal huge hull fractures.</p>
                <p><strong>Ore Silos count:</strong> Harvested ores can be sold for Credits at any landed planet outposts or space station bases via the <strong>Port Services Tab</strong>.</p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-mono text-white uppercase font-bold text-[11px] border-b border-white/5 pb-0.5">🌀 Galactic Anomalies & Space Stations</h4>
                <p><strong>Orbit Docking:</strong> Approach any orbiting planet or orbital base station. Slow down inside the approach vector, and press <kbd className="bg-neutral-800 px-1 font-mono text-white border border-white/10">SPACEBAR</kbd> to engage automatic docking sequences.</p>
                <p><strong>Singularity Black Holes:</strong> Highly intense cores that pull you inside event horizons. Crossing event horizons will trigger a cinematic quantum space dilation bypass warp, ejecting you across galaxies!</p>
                <p><strong>Wormhole Toruses:</strong> Spin gateways that transport you instantly to other sectors! Fly through their centers to activate jumps.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 text-center">
              <button
                onClick={() => { audioEngine.playClick(); setShowHelp(false); }}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold font-mono text-[10px] tracking-wider transition-all cursor-pointer"
              >
                UNDERSTOOD, PILOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HUD ENHANCEMENT ENGINE AND OVERLAYS ================= */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translate(-50%, 0) scale(1.35); opacity: 1; }
          100% { transform: translate(-50%, -60px) scale(0.9); opacity: 0; }
        }
      `}</style>

      {/* ================= COMPASS HORIZONTAL TAPE ================= */}
      {activeScreen === "flight" && !isPaused && !showGalaxyMap && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 w-80 font-mono text-[10px] text-white select-none pointer-events-auto z-10 rounded-sm">
          <div className="flex items-baseline gap-1.5 font-bold">
            <span className="text-xs text-blue-400">{getCompassLabel(heading)}</span>
            <span className="text-sm font-light italic tracking-tight text-white">{heading}°</span>
          </div>
          {/* Horizontal slider strip */}
          <div className="relative w-72 h-4 overflow-hidden border-t border-b border-white/10">
            {/* Tick marks */}
            <div 
              className="absolute top-0 bottom-0 flex items-center transition-all duration-75"
              style={{
                width: "1440px", 
                left: `calc(50% - ${heading * 2}px)`, 
              }}
            >
              {[-360, 0, 360].map((wrapOffset) => (
                <div key={wrapOffset} className="absolute flex items-end h-full" style={{ left: `${wrapOffset * 2}px` }}>
                  {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((deg) => {
                    const isCardinal = deg % 90 === 0;
                    const isSubCardinal = deg % 45 === 0 && !isCardinal;
                    const directionLabel = deg === 0 ? "N" : deg === 90 ? "E" : deg === 180 ? "S" : deg === 270 ? "W" : deg === 45 ? "NE" : deg === 135 ? "SE" : deg === 225 ? "SW" : deg === 315 ? "NW" : null;
                    
                    return (
                       <div 
                        key={deg} 
                        className="absolute bottom-0 flex flex-col items-center justify-end h-full"
                        style={{ left: `${deg * 2}px`, transform: "translateX(-50%)" }}
                      >
                        {directionLabel ? (
                          <span className={`text-[9px] font-black leading-none mb-0.5 ${isCardinal ? "text-blue-400" : "text-neutral-400"}`}>
                            {directionLabel}
                          </span>
                        ) : (
                          <span className="text-[7px] text-neutral-500 leading-none mb-0.5">
                            {deg}
                          </span>
                        )}
                        <div className={`w-[1px] ${isCardinal ? "h-2.5 bg-blue-500" : isSubCardinal ? "h-2 bg-neutral-400" : "h-1 bg-neutral-600"}`} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {/* Center indicator pin */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)] z-10" />
          </div>

          {stats.activeMission && (
            <div className="mt-1.5 pt-1.5 border-t border-white/5 text-center w-full space-y-0.5">
              <span className="text-[8px] uppercase tracking-wider text-amber-400 font-extrabold flex items-center justify-center gap-1">
                <Target className="w-2.5 h-2.5 animate-pulse" /> ACTIVE CONTRACT
              </span>
              <span className="text-[9px] text-white block font-semibold truncate max-w-[260px]">
                {stats.activeMission.title}
              </span>
              <span className="text-[8px] text-neutral-400 block truncate max-w-[260px]">
                OBJ: {stats.activeMission.objective}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ================= CROSSHAIR HITMARKER ================= */}
      {activeScreen === "flight" && hitMarkerActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-10 h-10 flex items-center justify-center z-10">
          <div className="absolute w-5 h-5 border-l-2 border-t-2 border-red-500/80 -translate-x-2 -translate-y-2 rotate-45" />
          <div className="absolute w-5 h-5 border-r-2 border-t-2 border-red-500/80 translate-x-2 -translate-y-2 rotate-45" />
          <div className="absolute w-5 h-5 border-l-2 border-b-2 border-red-500/80 -translate-x-2 translate-y-2 rotate-45" />
          <div className="absolute w-5 h-5 border-r-2 border-b-2 border-red-500/80 translate-x-2 translate-y-2 rotate-45" />
        </div>
      )}

      {/* ================= FLOATING DAMAGE NUMBERS ================= */}
      {activeScreen === "flight" && damageNumbers.map((dmg) => (
        <div 
          key={dmg.id}
          className="absolute pointer-events-none font-mono text-sm font-black text-red-400 tracking-wider select-none z-30 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          style={{
            left: `${dmg.x}px`,
            top: `${dmg.y}px`,
            animation: "floatUp 0.8s ease-out forwards",
          }}
        >
          -{dmg.amount}
        </div>
      ))}

      {/* ================= ON-SCREEN BRACKETS RETICLES ================= */}
      {activeScreen === "flight" && !isPaused && !showGalaxyMap && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {/* Active Enemies on-screen Brackets */}
          {enemiesData.map((enemy) => {
            if (!enemy.isOnScreen) return null;
            return (
              <div 
                key={enemy.id} 
                className="absolute pointer-events-none font-mono text-[9px]"
                style={{ left: `${enemy.x}px`, top: `${enemy.y}px`, transform: "translate(-50%, -50%)" }}
              >
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-red-500" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-red-500" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-red-500" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-red-500" />
                  <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                </div>
                {/* Info Panel above */}
                <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-black/85 px-2 py-1.5 border border-red-500/30 text-center w-28 whitespace-nowrap rounded-sm shadow-md">
                  <div className="text-white font-extrabold uppercase tracking-tight text-[8px]">{enemy.name}</div>
                  <div className="text-neutral-400 uppercase text-[7px] font-semibold mt-0.5">{enemy.classType} | {Math.round(enemy.dist)} u</div>
                  <div className="flex gap-1 mt-1.5">
                    <div className="flex-1 h-1 bg-neutral-800 rounded-sm overflow-hidden">
                      <div className="h-full bg-cyan-400 transition-all duration-150" style={{ width: `${(enemy.shield / enemy.maxShield) * 100}%` }} />
                    </div>
                    <div className="flex-1 h-1 bg-neutral-800 rounded-sm overflow-hidden">
                      <div className="h-full bg-red-500 transition-all duration-150" style={{ width: `${(enemy.health / enemy.maxHealth) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Navigation landmarks */}
          {navTargets && (
            <>
              {navTargets.station && navTargets.station.z > 0 && (
                <div 
                  className="absolute pointer-events-none font-mono text-[9px] text-sky-400"
                  style={{ left: `${navTargets.station.x}px`, top: `${navTargets.station.y}px`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="relative w-10 h-10">
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-l border-t border-sky-400" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-r border-t border-sky-400" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l border-b border-sky-400" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r border-b border-sky-400" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-sky-400/80 animate-pulse" />
                    </div>
                  </div>
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/75 px-1.5 py-0.5 border border-sky-400/20 whitespace-nowrap text-center rounded-sm">
                    <span className="font-bold text-white block text-[8px]">ASTRAPORT-9 [BASE]</span>
                    <span className="text-sky-300 font-bold">{Math.round(navTargets.station.dist)} u</span>
                  </div>
                </div>
              )}

              {navTargets.blackHole && navTargets.blackHole.z > 0 && (
                <div 
                  className="absolute pointer-events-none font-mono text-[9px] text-purple-400"
                  style={{ left: `${navTargets.blackHole.x}px`, top: `${navTargets.blackHole.y}px`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="relative w-10 h-10">
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-l border-t border-purple-500 animate-pulse" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-r border-t border-purple-500 animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l border-b border-purple-500 animate-pulse" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r border-b border-purple-500 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-purple-400" />
                    </div>
                  </div>
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/75 px-1.5 py-0.5 border border-purple-500/20 whitespace-nowrap text-center text-purple-300 rounded-sm">
                    <span className="font-bold text-white block text-[8px]">SINGULARITY [DANGER]</span>
                    <span className="text-purple-400 font-bold">{Math.round(navTargets.blackHole.dist)} u</span>
                  </div>
                </div>
              )}

              {navTargets.wormhole && navTargets.wormhole.z > 0 && (
                <div 
                  className="absolute pointer-events-none font-mono text-[9px] text-pink-400"
                  style={{ left: `${navTargets.wormhole.x}px`, top: `${navTargets.wormhole.y}px`, transform: "translate(-50%, -50%)" }}
                >
                  <div className="relative w-10 h-10">
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-l border-t border-pink-500" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-r border-t border-pink-500" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-l border-b border-pink-500" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-r border-b border-pink-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-pink-400 animate-spin" style={{ animationDuration: '4s' }} />
                    </div>
                  </div>
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/75 px-1.5 py-0.5 border border-pink-500/20 whitespace-nowrap text-center text-pink-300 rounded-sm">
                    <span className="font-bold text-white block text-[8px]">WORMHOLE GATEWAY</span>
                    <span className="text-pink-400 font-bold">{Math.round(navTargets.wormhole.dist)} u</span>
                  </div>
                </div>
              )}

              {navTargets.planets.map((p) => {
                if (p.z <= 0) return null;
                return (
                  <div 
                    key={p.id}
                    className="absolute pointer-events-none font-mono text-[9px] text-emerald-400"
                    style={{ left: `${p.x}px`, top: `${p.y}px`, transform: "translate(-50%, -50%)" }}
                  >
                    <div className="relative w-8 h-8">
                      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-emerald-500/40" />
                      <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-emerald-500/40" />
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-emerald-500/40" />
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-emerald-500/40" />
                    </div>
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-black/70 px-1.5 py-0.5 border border-emerald-500/10 whitespace-nowrap text-center text-emerald-300 rounded-sm">
                      <span className="font-bold text-white block text-[8px]">PLANET: {p.name.toUpperCase()}</span>
                      <span className="text-emerald-400 font-bold">{Math.round(p.dist)} u</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ================= DIRECTIONAL OFF-SCREEN WARNING CHEVRONS ================= */}
      {activeScreen === "flight" && !isPaused && !showGalaxyMap && enemiesData.map((enemy) => {
        if (enemy.isOnScreen) return null;
        
        // Project onto boundaries
        const vx = enemy.projX;
        const vy = -enemy.projY; // invert 3D projection Y
        const angle = Math.atan2(vy, vx);
        
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const padding = 55;
        
        let edgeX = 0;
        let edgeY = 0;
        const aspect = screenW / screenH;
        const absVX = Math.abs(vx);
        const absVY = Math.abs(vy);
        
        if (absVX * (1/aspect) > absVY) {
          edgeX = vx > 0 ? screenW - padding : padding;
          edgeY = screenH / 2 + (vy / absVX) * (screenH / 2 - padding);
        } else {
          edgeY = vy > 0 ? screenH - padding : padding;
          edgeX = screenW / 2 + (vx / absVY) * (screenH / 2 - padding);
        }

        return (
          <div 
            key={enemy.id} 
            className="absolute pointer-events-none font-mono text-[9px] text-red-500 z-10 flex flex-col items-center justify-center animate-pulse"
            style={{ left: `${edgeX}px`, top: `${edgeY}px`, transform: "translate(-50%, -50%)" }}
          >
            <div 
              className="w-3.5 h-3.5 border-r-2 border-b-2 border-red-500 mb-0.5"
              style={{ transform: `rotate(${angle * (180 / Math.PI) - 45}deg)` }}
            />
            <div className="bg-red-950/80 border border-red-500/30 px-1.5 py-0.5 whitespace-nowrap text-center shadow-[0_0_8px_rgba(239,68,68,0.2)] rounded-sm">
              <span className="font-extrabold text-white uppercase tracking-tighter text-[7px] block">{enemy.name}</span>
              <span className="text-red-400 font-bold">{Math.round(enemy.dist)} u</span>
            </div>
          </div>
        );
      })}

      {/* ================= INTERSTELLAR GALAXY MAP ================= */}
      {showGalaxyMap && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-md flex flex-col z-50 pointer-events-auto select-none font-mono">
          <div className="flex justify-between items-center px-8 py-5 border-b border-white/10 bg-neutral-950/70 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <Map className="w-5 h-5 text-blue-400 animate-pulse" />
              <div>
                <h2 className="text-sm font-bold tracking-widest text-white uppercase">HYPERLANE NAVIGATION SYSTEM</h2>
                <p className="text-[9px] text-neutral-400 uppercase">Interactive Interstellar Sector Chart | Shortcut: 'M'</p>
              </div>
            </div>
            <div className="flex gap-4 text-[10px] items-center">
              <div className="flex gap-1.5 border border-white/10 p-0.5 bg-black/40">
                {(["Milky Way", "Andromeda", "Triangulum", "Centaurus", "Sombrero"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => { audioEngine.playClick(); setSelectedGalaxy(g); }}
                    className={`px-2.5 py-1 text-[9px] font-bold border transition-colors cursor-pointer ${
                      selectedGalaxy === g 
                        ? "border-blue-500 bg-blue-950/20 text-blue-400" 
                        : "border-transparent text-neutral-400 hover:text-white"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { audioEngine.playClick(); setShowGalaxyMap(false); }}
                className="px-3 py-1.5 border border-white/20 hover:bg-white/5 text-neutral-400 hover:text-white cursor-pointer"
              >
                EXIT CARTOGRAPHY [X]
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden min-h-0">
            <div 
              className="flex-1 h-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_0%,transparent_80%)]"
              onMouseDown={handleMapMouseDown}
              onMouseMove={handleMapMouseMove}
              onMouseUp={() => setIsDraggingMap(false)}
              onMouseLeave={() => setIsDraggingMap(false)}
              onWheel={handleMapWheel}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

              <div className="absolute bottom-6 left-6 flex gap-2 z-10 pointer-events-auto">
                <button 
                  onClick={() => { audioEngine.playClick(); setMapZoom(z => Math.min(4, z * 1.3)); }}
                  className="w-8 h-8 border border-white/15 bg-neutral-950 text-white font-bold hover:bg-neutral-900 cursor-pointer"
                >
                  +
                </button>
                <button 
                  onClick={() => { audioEngine.playClick(); setMapZoom(z => Math.max(0.4, z / 1.3)); }}
                  className="w-8 h-8 border border-white/15 bg-neutral-950 text-white font-bold hover:bg-neutral-900 cursor-pointer"
                >
                  -
                </button>
                <button 
                  onClick={() => { audioEngine.playClick(); setMapPan({ x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 }); setMapZoom(0.8); }}
                  className="px-3 py-1.5 border border-white/15 bg-neutral-950 text-[9px] text-white tracking-widest uppercase hover:bg-neutral-900 cursor-pointer"
                >
                  RE-CENTER
                </button>
              </div>

              <svg className="w-full h-full pointer-events-none">
                <g transform={`translate(${mapPan.x}, ${mapPan.y}) scale(${mapZoom})`}>
                  {(() => {
                    const systemsInGalaxy = GALAXY_SYSTEMS.filter(s => s.galaxy === selectedGalaxy);
                    return systemsInGalaxy.map((system, idx) => {
                      const sCoords = getSystemCoords(system.id, idx);
                      const targets = [
                        systemsInGalaxy[(idx + 1) % systemsInGalaxy.length],
                        systemsInGalaxy[(idx + 3) % systemsInGalaxy.length]
                      ];
                      
                      return targets.map((t, tIdx) => {
                        const tIndex = GALAXY_SYSTEMS.findIndex(s => s.id === t.id);
                        const tCoords = getSystemCoords(t.id, tIndex);
                        
                        return (
                          <line
                            key={`${system.id}-link-${t.id}`}
                            x1={sCoords.x}
                            y1={sCoords.y}
                            x2={tCoords.x}
                            y2={tCoords.y}
                            stroke="rgba(59, 130, 246, 0.15)"
                            strokeWidth="1.2"
                            strokeDasharray={system.hasBlackHole ? "4,4" : undefined}
                          />
                        );
                      });
                    });
                  })()}

                  {GALAXY_SYSTEMS.filter(s => s.galaxy === selectedGalaxy).map((system, idx) => {
                    const coords = getSystemCoords(system.id, idx);
                    const isCurrent = system.id === stats.currentSystemId;
                    const isSelected = selectedMapSystem?.id === system.id;
                    const isExplored = stats.exploredSystems?.includes(system.id) || system.id === "sol_sector";

                    return (
                      <g 
                        key={system.id} 
                        transform={`translate(${coords.x}, ${coords.y})`}
                        className="pointer-events-auto cursor-pointer"
                        onClick={() => { audioEngine.playClick(); setSelectedMapSystem(system); }}
                      >
                        {isCurrent && (
                          <circle r="22" fill="none" stroke="#eab308" strokeWidth="1.5" className="animate-pulse" strokeDasharray="3,3" />
                        )}
                        {isSelected && (
                          <circle r="26" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                        )}

                        {system.starType === "Neutron Star" && (
                          <>
                            <line x1="-30" y1="0" x2="30" y2="0" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1" />
                            <circle r="14" fill="none" stroke="#a855f7" strokeWidth="0.8" opacity="0.5" />
                          </>
                        )}

                        <circle 
                          r={system.id === "sol_sector" ? "10" : "8"} 
                          fill={system.starColor}
                          className="transition-all hover:scale-125 duration-150"
                        />

                        {system.hasSpaceStation && (
                          <circle cx="8" cy="-8" r="3.5" fill="#38bdf8" stroke="#000" strokeWidth="0.5" />
                        )}
                        {system.hasBlackHole && (
                          <circle cx="-8" cy="8" r="4.5" fill="#a855f7" stroke="#000" strokeWidth="1" />
                        )}

                        <text
                          y="20"
                          textAnchor="middle"
                          fill={isCurrent ? "#eab308" : isSelected ? "#3b82f6" : isExplored ? "#fff" : "rgba(255,255,255,0.4)"}
                          fontSize="8.5px"
                          fontWeight={isCurrent || isSelected ? "bold" : "normal"}
                          className="pointer-events-none tracking-tight font-mono"
                        >
                          {system.name}
                        </text>
                        
                        {isCurrent && (
                          <text
                            y="-18"
                            textAnchor="middle"
                            fill="#eab308"
                            fontSize="7px"
                            fontWeight="black"
                            className="pointer-events-none tracking-widest font-mono"
                          >
                            YOU
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {(() => {
              const sys = selectedMapSystem || currentSystem;
              const isCurrent = sys.id === stats.currentSystemId;
              const isExplored = stats.exploredSystems?.includes(sys.id) || sys.id === "sol_sector";
              
              return (
                <div className="w-80 border-l border-white/10 bg-neutral-950/70 p-6 flex flex-col justify-between shrink-0 overflow-y-auto pointer-events-auto">
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest">
                        SECTOR CARTOGRAPHY MODULE
                      </span>
                      <h3 className="text-lg font-black text-white mt-1 border-b border-white/5 pb-2 uppercase">
                        {sys.name}
                      </h3>
                    </div>

                    <div className="space-y-3 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">GALAXY CLUSTER:</span>
                        <span className="text-white font-bold">{sys.galaxy.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">STAR EMISSION CLASS:</span>
                        <span className="font-bold" style={{ color: sys.starColor }}>{sys.starType.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">LOCAL SECTOR ID:</span>
                        <span className="text-white font-bold font-mono text-[10px]">{sys.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">ORBITING PLANET COUNT:</span>
                        <span className="text-emerald-400 font-bold">{sys.planets.length} BODIES</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">SECTOR STATUS:</span>
                        <span className={`font-bold uppercase ${isExplored ? "text-emerald-400" : "text-neutral-500"}`}>
                          {isCurrent ? "ACTIVE DEPLOYMENT" : isExplored ? "EXPLORED" : "UNEXPLORED ANOMALY"}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed text-justify font-sans">
                      {sys.description}
                    </p>

                    <div className="space-y-2 pt-4 border-t border-white/5">
                      <h4 className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest">
                        ORBITING CELESTIAL BODIES
                      </h4>
                      <div className="space-y-1.5">
                        {sys.planets.map((planet) => (
                          <div key={planet.id} className="p-2 border border-white/5 bg-neutral-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: planet.color }} />
                              <span className="text-[11px] text-white font-bold">{planet.name}</span>
                            </div>
                            <span className="text-[9px] font-bold text-neutral-500 uppercase">{planet.biome}</span>
                          </div>
                        ))}
                        {sys.hasSpaceStation && (
                          <div className="p-2 border border-sky-500/20 bg-sky-950/15 flex items-center justify-between text-sky-300">
                            <div className="flex items-center gap-2">
                              <Globe className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold">Orbital Refuel Station</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase text-sky-400 animate-pulse">ACTIVE PORT</span>
                          </div>
                        )}
                        {sys.hasBlackHole && (
                          <div className="p-2 border border-purple-500/20 bg-purple-950/15 flex items-center justify-between text-purple-300">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold">Singularity Event Horizon</span>
                            </div>
                            <span className="text-[9px] font-bold uppercase text-purple-400">DANGER ZONE</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-2">
                    {isCurrent ? (
                      <div className="w-full text-center py-3 border border-yellow-500/30 bg-yellow-950/15 text-yellow-400 text-xs font-bold font-mono tracking-widest rounded-sm">
                        YOU ARE CURRENTLY DEPLOYED HERE
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          audioEngine.playLaser(); // warp sound
                          onWarp(sys.id);
                          setShowGalaxyMap(false);
                        }}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-neutral-950 font-black text-xs tracking-widest uppercase transition-all shadow-lg hover:shadow-blue-500/20 cursor-pointer rounded-sm"
                      >
                        ENGAGE HYPERWARP DRIVES [-15 FUEL]
                      </button>
                    )}
                    <p className="text-[8px] text-neutral-500 text-center leading-normal uppercase">
                      Hyperwarp folds space-time grid, transporting starship hull instantly across galaxy clusters.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= IMMERSIVE SYSTEM PAUSE CORE ================= */}
      {isPaused && (
        <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-lg flex items-center justify-center z-50 pointer-events-auto select-none font-mono">
          <div className="border border-white/10 bg-neutral-950 p-8 max-w-4xl w-full h-[85vh] flex flex-col justify-between shadow-2xl relative rounded-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)] pointer-events-none" />

            <div className="flex justify-between items-center pb-4 border-b border-white/10 relative shrink-0">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '8s' }} />
                <div>
                  <h2 className="text-sm font-bold tracking-widest text-white uppercase">SYSTEM FLIGHT DECK PAUSED</h2>
                  <p className="text-[9px] text-neutral-500 uppercase">Starship CPU core: SAFE CYCLE SUSPENDED</p>
                </div>
              </div>
              <button
                onClick={() => { audioEngine.playClick(); onTogglePause(); }}
                className="px-4 py-2 border border-blue-500 bg-blue-950/20 text-blue-400 hover:bg-blue-500 hover:text-neutral-950 font-bold text-xs tracking-wider transition-all duration-150 cursor-pointer rounded-sm"
              >
                START / RESUME FLIGHT [ESC]
              </button>
            </div>

            <div className="flex-1 flex gap-8 my-6 min-h-0 relative">
              <div className="w-[45%] flex flex-col justify-between overflow-y-auto space-y-4 pr-4 border-r border-white/5">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> AUDIO CHANNELS MIXER
                  </h3>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>MASTER VOLUME</span>
                      <span className="text-white font-bold">{Math.round(settings.volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={settings.volume} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings({ ...settings, volume: val });
                        audioEngine.setVolume(val);
                      }}
                      className="w-full accent-blue-500 h-1 bg-neutral-800 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>MUSIC SYNTH PAD</span>
                      <span className="text-white font-bold">{Math.round((settings.musicVolume ?? 0.5) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={settings.musicVolume ?? 0.5} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings({ ...settings, musicVolume: val });
                        audioEngine.setMusicVolume(val);
                      }}
                      className="w-full accent-blue-500 h-1 bg-neutral-800 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>TACTICAL SFX / ENG</span>
                      <span className="text-white font-bold">{Math.round((settings.sfxVolume ?? 0.5) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.05" value={settings.sfxVolume ?? 0.5} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings({ ...settings, sfxVolume: val });
                        audioEngine.setSfxVolume(val);
                      }}
                      className="w-full accent-blue-500 h-1 bg-neutral-800 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-3 border-t border-white/5">
                  <h3 className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5" /> FLIGHT DYNAMICS CONDUIT
                  </h3>

                  <div className="space-y-1.5">
                    <div className="text-[10px] text-neutral-400 uppercase">STEERING VECTOR ASSIST:</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { audioEngine.playClick(); onUpdateSettings({ ...settings, flightMode: "arcade" }); }}
                        className={`flex-1 py-1.5 text-center border font-bold text-[9px] uppercase cursor-pointer rounded-sm ${
                          settings.flightMode === "arcade" 
                            ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold" 
                            : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                        }`}
                      >
                        Arcade Mode
                      </button>
                      <button
                        onClick={() => { audioEngine.playClick(); onUpdateSettings({ ...settings, flightMode: "simulation" }); }}
                        className={`flex-1 py-1.5 text-center border font-bold text-[9px] uppercase cursor-pointer rounded-sm ${
                          settings.flightMode === "simulation" 
                            ? "border-blue-500 bg-blue-950/20 text-blue-400 font-bold" 
                            : "border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10"
                        }`}
                      >
                        Simulation
                      </button>
                    </div>
                    <p className="text-[8px] text-neutral-500 leading-normal uppercase">
                      {settings.flightMode === "arcade" 
                        ? "Arcade: Reduced inertia by 40%, tighter roll-pitch turning and immediate thruster stabilization."
                        : "Simulation: Realistic orbital mechanics with advanced inertia drift modeling."}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>STEERING MOUSE SENSITIVITY</span>
                      <span className="text-white font-bold">{Math.round((settings.mouseSensitivity ?? 1.0) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0.1" max="2.5" step="0.05" value={settings.mouseSensitivity ?? 1.0} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateSettings({ ...settings, mouseSensitivity: val });
                      }}
                      className="w-full accent-blue-500 h-1 bg-neutral-800 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/5">
                  <h3 className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest border-b border-white/5 pb-1">
                    CHASSIS DATA BANK
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { audioEngine.playClick(); onSaveGame(); }}
                      className="flex-1 py-2 px-1 bg-blue-950/40 border border-blue-500/40 text-blue-400 font-mono text-[10px] hover:bg-blue-900/50 flex items-center justify-center gap-1.5 rounded-none transition-all cursor-pointer font-bold"
                    >
                      <Save className="w-3.5 h-3.5" /> WRITE TELEMETRY
                    </button>
                    <button
                      onClick={() => { audioEngine.playClick(); onLoadGame(); }}
                      className="flex-1 py-2 px-1 bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] hover:bg-emerald-900/50 flex items-center justify-center gap-1.5 rounded-none transition-all cursor-pointer font-bold"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> RE-WRITE BACKUP
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex gap-2 border-b border-white/10 pb-2 shrink-0">
                  <button 
                    onClick={() => { audioEngine.playClick(); setDockedTab("database"); }}
                    className={`px-3 py-1.5 text-[10px] font-bold border transition-all cursor-pointer rounded-sm ${
                      dockedTab === "database" ? "border-blue-500 text-blue-400 bg-blue-950/15" : "border-transparent text-neutral-400 hover:text-white"
                    }`}
                  >
                    SCIENCE DATABASE
                  </button>
                  <button 
                    onClick={() => { audioEngine.playClick(); setDockedTab("port"); }}
                    className={`px-3 py-1.5 text-[10px] font-bold border transition-all cursor-pointer rounded-sm ${
                      dockedTab === "port" ? "border-blue-500 text-blue-400 bg-blue-950/15" : "border-transparent text-neutral-400 hover:text-white"
                    }`}
                  >
                    FLIGHT MANUAL
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1">
                  {dockedTab === "port" && (
                    <div className="space-y-4 font-sans text-xs text-neutral-300 leading-relaxed text-left">
                      <div className="space-y-1.5 font-mono">
                        <h4 className="text-white uppercase font-bold text-[10px] border-b border-white/5 pb-1 text-blue-400">🚀 STEERING CONTROLS</h4>
                        <p><strong>PITCH & ROLL:</strong> Press <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">W / S</kbd> to point the ship nose down or up, and <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">A / D</kbd> to roll the ship left or right.</p>
                        <p><strong>YAW (STEER):</strong> Press <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">Q / E</kbd> to adjust the ship heading directly. Mouse cursor position also automatically assists yaw!</p>
                        <p><strong>WARP BOOST:</strong> Hold <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">SHIFT</kbd> to activate the super boost, burning raw thruster fuel to fly at extreme space speeds.</p>
                      </div>
                      <div className="space-y-1.5 font-mono pt-2 border-t border-white/5">
                        <h4 className="text-white uppercase font-bold text-[10px] border-b border-white/5 pb-1 text-blue-400">💥 TACTICAL WEAPON MATRIX</h4>
                        <p><strong>PLASMA LASER:</strong> Click <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">LEFT MOUSE BUTTON</kbd> to discharge thermal plasma. Fires automatically at asteroid rocks to harvest raw ore crystals!</p>
                        <p><strong>HOMING MISSILES:</strong> Click <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">RIGHT MOUSE BUTTON</kbd> to fire heavy seek-and-destroy missiles at targeted hostile ships.</p>
                      </div>
                      <div className="space-y-1.5 font-mono pt-2 border-t border-white/5">
                        <h4 className="text-white uppercase font-bold text-[10px] border-b border-white/5 pb-1 text-blue-400">🌀 INTERSTELLAR ANOMALIES</h4>
                        <p><strong>DOCKING PORTS:</strong> Approach any orbital planet outposts or space ports inside 1200u distance. Slow down and press <kbd className="bg-neutral-800 px-1 border border-white/15 text-white rounded-sm">SPACEBAR</kbd> to safely auto-dock!</p>
                        <p><strong>BLACK HOLES:</strong> Extremely heavy stellar cores. Fly through event horizons to activate emergency quantum jumps across galaxy clusters.</p>
                      </div>
                    </div>
                  )}

                  {dockedTab === "database" && (
                    <div className="space-y-4">
                      <div className="p-3 border border-emerald-500/20 bg-emerald-950/15 text-[11px] text-emerald-300 font-mono leading-relaxed text-left rounded-sm">
                        [SCIENTIFIC DECRYPTION CORE]: Decrypt secret facts from deep-space anomalies. Earn credits grants from the Federal Space Council upon discovery!
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                        {ALL_SCIENTIFIC_FACTS.map((item, idx) => {
                          const isUnlocked = stats.unlockedFacts?.includes(item.fact);
                          return (
                            <div 
                              key={idx} 
                              className={`p-3 border font-mono text-[10px] transition-all duration-200 rounded-sm ${
                                isUnlocked 
                                  ? "border-emerald-500/20 bg-emerald-950/10 text-emerald-300" 
                                  : "border-white/5 bg-neutral-950/40 text-neutral-600"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[8px] uppercase tracking-wider font-extrabold mb-1.5">
                                <span className={isUnlocked ? "text-emerald-400" : "text-neutral-500"}>
                                  {item.category} #{idx + 1}
                                </span>
                                <span className={isUnlocked ? "text-amber-400" : "text-neutral-600"}>
                                  {isUnlocked ? "UNLOCKED" : "LOCKED"}
                                </span>
                              </div>
                              {isUnlocked ? (
                                <p className="text-xs text-white italic font-sans leading-relaxed">
                                  "{item.fact}"
                                </p>
                              ) : (
                                <p className="text-xs text-neutral-600 tracking-wider">
                                  [REDACTED DATA - EXPLORE TO DECRYPT]
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between items-center shrink-0">
              <span className="text-[9px] text-neutral-500 font-mono">
                VOIDFLYER SYSTEM CORE v2.8.2 | PREFERENCES SYNC
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => { audioEngine.playClick(); onRestart(); }}
                  className="px-4 py-2 border border-red-500/30 bg-red-950/15 hover:bg-red-500 hover:text-neutral-950 text-red-400 font-bold text-xs tracking-wider cursor-pointer transition-all rounded-sm"
                >
                  RESTART FLIGHT
                </button>
                <button
                  onClick={() => { audioEngine.playClick(); onQuit(); }}
                  className="px-4 py-2 border border-white/15 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs tracking-wider cursor-pointer transition-all rounded-sm"
                >
                  QUIT FLIGHT DECK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* METADATA EXCLUSIVE LOGO DECORATION */}
      <div className="absolute top-8 right-8 text-right font-mono text-[9px] opacity-40 text-neutral-400 z-10 pointer-events-none">
        VOIDFLYER_SYSTEM_v2.8.2 | 1024x768<br/>
        <span className="text-emerald-400 font-bold">{fps} FPS [ACTIVE]</span>
      </div>

    </div>
  );
};
