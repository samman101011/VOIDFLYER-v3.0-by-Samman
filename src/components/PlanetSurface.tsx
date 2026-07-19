import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Globe, ArrowLeft, Target, Shield, Zap, Activity, Award } from "lucide-react";
import { PlayerStats, CargoHold } from "../types";

interface PlanetSurfaceProps {
  planetConfig: {
    id: string;
    name: string;
    color: string;
    atmosphereColor: string;
    radius: number;
    biome: string;
    weather: string;
    gravity: number;
    hasOceans: boolean;
    hasMountains: boolean;
    mineralDensity: {
      iron: number;
      titanium: number;
      gold: number;
      crystal: number;
      uranium: number;
      darkMatter: number;
    };
  };
  onExit: () => void;
  stats: PlayerStats;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
}

// ================= COGNITIVE NOISE ENGINE (Procedural fBm heightmap) =================
const hash2D = (x: number, y: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return h - Math.floor(h);
};

const noise2D = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uy
  );
};

const fbm2D = (x: number, y: number, octaves = 4) => {
  let value = 0.0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    frequency *= 2.1;
    amplitude *= 0.48;
  }
  return value;
};

// Procedural sound synthesizer using Web Audio API
class MiniSynth {
  private ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playStep() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(45 + Math.random() * 15, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  playJump() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.21);
  }

  playLaser() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(680, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(340, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.start();
    osc2.start();
    osc.stop(this.ctx.currentTime + 0.16);
    osc2.stop(this.ctx.currentTime + 0.16);
  }

  playHarvest() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(1320, this.ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  playHurt() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.31);
  }
}

const sfx = new MiniSynth();

// ================= INTERNALS FOR PROCEDURAL GEOMETRY GENERATION =================
interface MineralResource {
  id: string;
  type: keyof CargoHold;
  position: THREE.Vector3;
  size: number;
  color: string;
  mined: boolean;
  maxHealth: number;
  health: number;
}

interface AlienCreature {
  id: string;
  type: "peaceful" | "timid" | "hostile" | "flying";
  name: string;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  speed: number;
  health: number;
  maxHealth: number;
  color: string;
  scale: number;
  bobOffset: number;
  rotationY: number;
}

export const PlanetSurface: React.FC<PlanetSurfaceProps> = ({
  planetConfig,
  onExit,
  stats,
  onUpdateStats,
}) => {
  const [playerHP, setPlayerHP] = useState(100);
  const [playerMaxHP] = useState(100);
  const [cargoFeed, setCargoFeed] = useState<string[]>([]);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"exploration" | "records">("exploration");

  // Local state references for real-time 60FPS thread access
  const keys = useRef<{ [key: string]: boolean }>({});
  const mouse = useRef({ x: 0, y: 0, dragStartX: 0, dragStartY: 0, isDragging: false });
  const cameraRotation = useRef({ yaw: 0, pitch: 0 });
  const playerPosition = useRef(new THREE.Vector3(0, 15, 30));
  const playerVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const minDistanceToShipForBoarding = 12.0;

  // Resource & Entity lists (created once and maintained in ref)
  const resourcesRef = useRef<MineralResource[]>([]);
  const aliensRef = useRef<AlienCreature[]>([]);
  const lastStepTimeRef = useRef(0);
  const laserRef = useRef<{ active: boolean; targetPos: THREE.Vector3 | null; duration: number }>({
    active: false,
    targetPos: null,
    duration: 0,
  });

  const gravityConstant = 9.8 * (planetConfig.gravity || 1.0);
  const jumpHeightConstant = 11.0 / Math.sqrt(planetConfig.gravity || 1.0);

  // fBm height evaluation function for terrain evaluation
  const getTerrainHeight = (x: number, z: number) => {
    // Keep a safe landing circle perfectly flat around (0,0) for the spaceship landing gear
    const distFromCenter = Math.sqrt(x * x + z * z);
    const flatScaleFactor = THREE.MathUtils.clamp((distFromCenter - 32) / 75, 0, 1);

    // Dynamic amplitude based on planet mountainous flag
    const baseHeightScale = planetConfig.hasMountains ? 85.0 : 20.0;
    const sampleVal = fbm2D(x * 0.0035, z * 0.0035, 4);

    return (sampleVal - 0.45) * baseHeightScale * flatScaleFactor;
  };

  // Seed resources & alien entities once on mount
  useEffect(() => {
    // 1. Setup Minable Mineral Crystals
    const mineralTypes: (keyof CargoHold)[] = ["iron", "titanium", "gold", "crystal", "uranium", "darkMatter"];
    const resourceList: MineralResource[] = [];

    // Dense crystal clusters spread randomly around
    for (let i = 0; i < 42; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 550;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      // Select mineral based on density weight
      let selectedType: keyof CargoHold = "iron";
      const roll = Math.random();
      if (roll < 0.35) selectedType = "iron";
      else if (roll < 0.6) selectedType = "titanium";
      else if (roll < 0.78) selectedType = "gold";
      else if (roll < 0.9) selectedType = "crystal";
      else if (roll < 0.97) selectedType = "uranium";
      else selectedType = "darkMatter";

      // Match colors beautifully to the element type
      let color = "#ef4444";
      if (selectedType === "iron") color = "#f97316";
      else if (selectedType === "titanium") color = "#cbd5e1";
      else if (selectedType === "gold") color = "#fbbf24";
      else if (selectedType === "crystal") color = "#06b6d4";
      else if (selectedType === "uranium") color = "#22c55e";
      else if (selectedType === "darkMatter") color = "#a855f7";

      resourceList.push({
        id: `mineral_${i}`,
        type: selectedType,
        position: new THREE.Vector3(x, y, z),
        size: 1.5 + Math.random() * 2.5,
        color,
        mined: false,
        maxHealth: 100,
        health: 100,
      });
    }
    resourcesRef.current = resourceList;

    // 2. Setup Procedural Alien Creatures
    const alienList: AlienCreature[] = [];
    const speciesNames = {
      desert: ["Dune Crawler", "Silt Skitterer", "Sun Scrapper"],
      frozen: ["Frost Leviathan", "Ice Strider", "Glacial Wisp"],
      jungle: ["Spore Hopper", "Vine Lurker", "Neon Jelly"],
      ocean: ["Abyssal Lurker", "Tide Glider", "Kelporoid"],
      volcanic: ["Magma Behemoth", "Pyroclaw", "Ash Weaver"],
      barren: ["Regolith Roach", "Dust Drifter", "Crater Arachnid"],
    };

    const biomeKey = (planetConfig.biome?.toLowerCase() || "barren") as keyof typeof speciesNames;
    const names = speciesNames[biomeKey] || speciesNames.barren;

    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 450;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z) + 0.5;

      const roll = Math.random();
      let type: "peaceful" | "timid" | "hostile" | "flying" = "peaceful";
      if (roll < 0.4) type = "peaceful";
      else if (roll < 0.7) type = "timid";
      else if (roll < 0.9) type = "hostile";
      else type = "flying";

      const name = names[Math.floor(Math.random() * names.length)] + ` #${i + 1}`;
      const scale = type === "flying" ? 1.0 + Math.random() * 1.5 : 0.8 + Math.random() * 1.8;

      alienList.push({
        id: `alien_${i}`,
        type,
        name,
        position: new THREE.Vector3(x, y + (type === "flying" ? 15 : 0), z),
        targetPosition: new THREE.Vector3(x, y, z),
        speed: type === "hostile" ? 4.5 : type === "timid" ? 6.0 : 2.5,
        health: 100,
        maxHealth: 100,
        color: type === "hostile" ? "#ef4444" : type === "timid" ? "#fbbf24" : type === "flying" ? "#06b6d4" : "#a855f7",
        scale,
        bobOffset: Math.random() * 100,
        rotationY: Math.random() * Math.PI * 2,
      });
    }
    aliensRef.current = alienList;

    // 3. Document keyboard/mouse hooks
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === "f" || e.key === "F") {
        const distToShip = playerPosition.current.distanceTo(new THREE.Vector3(0, 0, 0));
        if (distToShip < minDistanceToShipForBoarding) {
          onExit();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        const sens = 0.0022;
        cameraRotation.current.yaw -= e.movementX * sens;
        cameraRotation.current.pitch -= e.movementY * sens;
        // Clamp vertical look to prevent full flips
        cameraRotation.current.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraRotation.current.pitch));
      } else if (mouse.current.isDragging) {
        const sens = 0.0035;
        const deltaX = e.clientX - mouse.current.dragStartX;
        const deltaY = e.clientY - mouse.current.dragStartY;
        mouse.current.dragStartX = e.clientX;
        mouse.current.dragStartY = e.clientY;

        cameraRotation.current.yaw -= deltaX * sens;
        cameraRotation.current.pitch -= deltaY * sens;
        cameraRotation.current.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, cameraRotation.current.pitch));
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        mouse.current.isDragging = true;
        mouse.current.dragStartX = e.clientX;
        mouse.current.dragStartY = e.clientY;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouse.current.isDragging = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [planetConfig]);

  // Handle pointer lock state listener
  useEffect(() => {
    const handleLockChange = () => {
      setIsPointerLocked(document.pointerLockElement !== null);
    };
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => {
      document.removeEventListener("pointerlockchange", handleLockChange);
    };
  }, []);

  // Feed logs fadeout
  useEffect(() => {
    if (cargoFeed.length > 5) {
      setCargoFeed((prev) => prev.slice(1));
    }
  }, [cargoFeed]);

  const addCargoLog = (text: string) => {
    setCargoFeed((prev) => [...prev, text]);
  };

  // Trigger mining laser shot
  const shootMiningLaser = () => {
    sfx.playLaser();
    
    // Evaluate where the player is looking
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraRotation.current.pitch);
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.current.yaw);
    direction.normalize();

    const origin = playerPosition.current.clone();
    let hitSomething = false;

    // Check Minerals collision
    for (const res of resourcesRef.current) {
      if (res.mined) continue;
      const resPos = res.position.clone().add(new THREE.Vector3(0, res.size / 2, 0));
      const dist = origin.distanceTo(resPos);

      if (dist < 45.0) {
        // Evaluate Raycast bounding sphere check
        const toRes = resPos.clone().sub(origin);
        const projection = toRes.dot(direction);
        if (projection > 0) {
          const closestPoint = origin.clone().add(direction.clone().multiplyScalar(projection));
          const perpDist = closestPoint.distanceTo(resPos);

          if (perpDist < res.size * 1.5) {
            // HIT!
            hitSomething = true;
            laserRef.current = {
              active: true,
              targetPos: resPos,
              duration: 0.1,
            };

            res.health -= 25;
            if (res.health <= 0) {
              res.mined = true;
              sfx.playHarvest();
              
              // Calculate yield based on stats density
              const quantity = Math.floor(1 + Math.random() * 4 * (planetConfig.mineralDensity[res.type] || 1));
              
              // Add to player stats cargo hold
              const updatedCargo = { ...stats.cargo };
              updatedCargo[res.type] = (updatedCargo[res.type] || 0) + quantity;
              
              onUpdateStats({
                cargo: updatedCargo,
                credits: stats.credits + 20, // science scanning bounty
              });

              addCargoLog(`⛏️ HARVESTED: +${quantity} units of [${res.type.toUpperCase()}]`);
              onUpdateStats({
                score: stats.score + 50,
              });
            }
            break;
          }
        }
      }
    }

    // Check Aliens collision if not mineral hit
    if (!hitSomething) {
      for (const ali of aliensRef.current) {
        if (ali.health <= 0) continue;
        const aliPos = ali.position.clone();
        const dist = origin.distanceTo(aliPos);

        if (dist < 45.0) {
          const toAli = aliPos.clone().sub(origin);
          const projection = toAli.dot(direction);
          if (projection > 0) {
            const closestPoint = origin.clone().add(direction.clone().multiplyScalar(projection));
            const perpDist = closestPoint.distanceTo(aliPos);

            if (perpDist < ali.scale * 2.2) {
              hitSomething = true;
              laserRef.current = {
                active: true,
                targetPos: aliPos,
                duration: 0.1,
              };

              ali.health -= 35;
              if (ali.health <= 0) {
                sfx.playHarvest();
                addCargoLog(`💥 ELIMINATED: ${ali.name}. Science bounty bonus +75 Credits!`);
                onUpdateStats({
                  credits: stats.credits + 75,
                  score: stats.score + 150,
                });
                
                // Spawn minor resources on defeated hostile
                if (ali.type === "hostile") {
                  const types: (keyof CargoHold)[] = ["darkMatter", "uranium", "crystal"];
                  const selectedType = types[Math.floor(Math.random() * types.length)];
                  const updatedCargo = { ...stats.cargo };
                  updatedCargo[selectedType] = (updatedCargo[selectedType] || 0) + 1;
                  onUpdateStats({ cargo: updatedCargo });
                  addCargoLog(`💎 RECOVERED: +1 unit of [${selectedType.toUpperCase()}]`);
                }
              } else {
                sfx.playHurt();
                // Alert hostile
                if (ali.type !== "hostile") {
                  ali.type = "hostile"; // enrage them!
                  ali.speed *= 1.5;
                  ali.color = "#dc2626";
                }
              }
              break;
            }
          }
        }
      }
    }

    // If nothing hit, fire laser beam out into space
    if (!hitSomething) {
      const farPos = origin.clone().add(direction.clone().multiplyScalar(40.0));
      laserRef.current = {
        active: true,
        targetPos: farPos,
        duration: 0.1,
      };
    }
  };

  // Pointer lock trigger helper
  const handleLockPointer = () => {
    const canvas = document.getElementById("surface_canvas_mesh");
    if (canvas) {
      canvas.requestPointerLock();
    }
  };

  // Calculate cargo hold utilization percentage
  const totalCargo = Object.values(stats.cargo || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="relative w-full h-full select-none overflow-hidden font-mono text-white">
      {/* 3D RENDER ENGINE PORTAL */}
      <div id="surface_canvas_mesh" className="absolute inset-0 w-full h-full cursor-crosshair">
        <Canvas
          shadows
          camera={{ fov: 70, near: 0.1, far: 1800 }}
          onPointerDown={(e) => {
            if (e.button === 0) {
              shootMiningLaser();
            }
          }}
        >
          {/* Real-time scene elements */}
          <SceneEngine
            planetConfig={planetConfig}
            keys={keys}
            cameraRotation={cameraRotation}
            playerPosition={playerPosition}
            playerVelocity={playerVelocity}
            gravityConstant={gravityConstant}
            jumpHeightConstant={jumpHeightConstant}
            getTerrainHeight={getTerrainHeight}
            resourcesRef={resourcesRef}
            aliensRef={aliensRef}
            laserRef={laserRef}
            lastStepTimeRef={lastStepTimeRef}
            playerHP={playerHP}
            setPlayerHP={setPlayerHP}
            sfx={sfx}
            addCargoLog={addCargoLog}
          />
        </Canvas>
      </div>

      {/* COMPASS DIRECTION INDICATOR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 bg-neutral-950/80 border border-white/10 px-6 py-2 backdrop-blur-md z-30 pointer-events-none rounded-none shadow-xl">
        <span className="text-[10px] text-neutral-400 tracking-widest uppercase">NAV COMPASS</span>
        <div className="flex items-center gap-8 text-xs font-bold font-mono">
          <span className="text-neutral-500">W</span>
          <span className="text-emerald-400 border-x border-emerald-500/20 px-4">N</span>
          <span className="text-neutral-500">E</span>
          <span className="text-neutral-500">S</span>
        </div>
      </div>

      {/* LEFT UPPER PANEL: SCI-FI SCIENTIFIC CONSOLE HUD */}
      <div className="absolute top-4 left-4 w-76 bg-neutral-950/85 border border-emerald-500/20 p-4 backdrop-blur-md z-30 pointer-events-none space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.06)] flex flex-col justify-between">
        <div className="border-b border-emerald-500/20 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
            <h1 className="text-xs font-extrabold tracking-wider uppercase text-emerald-400">SURFACE TELEMETRY</h1>
          </div>
          <span className="text-[8px] bg-emerald-950 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 font-bold uppercase animate-pulse">On-Foot</span>
        </div>

        <div className="space-y-3 text-[11px]">
          <div>
            <span className="text-neutral-500 text-[8px] block uppercase">CURRENT PLANET:</span>
            <span className="font-bold text-white text-xs">{planetConfig.name}</span>
          </div>
          <div>
            <span className="text-neutral-500 text-[8px] block uppercase">ATMOSPHERE & BIOME:</span>
            <span className="font-semibold text-emerald-300">{planetConfig.biome} Surface</span>
          </div>
          <div>
            <span className="text-neutral-500 text-[8px] block uppercase">WEATHER PATTERNS:</span>
            <span className="font-semibold text-cyan-300 uppercase">{planetConfig.weather}</span>
          </div>
          <div>
            <span className="text-neutral-500 text-[8px] block uppercase">LOCAL GRAVITY FIELD:</span>
            <span className="font-bold text-white">{planetConfig.gravity || 1.0} G</span>
          </div>
          <div className="pt-2.5 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between items-center text-[9px] text-neutral-400">
              <span>HULL VITAL SIGNALS</span>
              <span className="text-emerald-400 font-bold">{playerHP}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-900 border border-white/5 rounded-none overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${playerHP}%` }} />
            </div>
          </div>
        </div>

        <div className="text-[9px] text-neutral-500 italic pt-1 border-t border-white/5 leading-relaxed">
          [CONTROL HINT]: Walk up to the parked spaceship and press <span className="text-emerald-400 font-bold font-mono">F</span> to board.
        </div>
      </div>

      {/* RIGHT UPPER PANEL: REAL-TIME HARVEST FEED PANEL */}
      <div className="absolute top-4 right-4 w-76 z-30 pointer-events-none flex flex-col gap-2">
        {/* Pointer lock assistance prompt if not locked */}
        {!isPointerLocked && (
          <button
            onClick={handleLockPointer}
            className="pointer-events-auto w-full px-4 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all rounded-none text-center shadow-lg border border-amber-600/50 flex items-center justify-center gap-2 select-none animate-pulse"
          >
            <Activity className="w-4 h-4 animate-bounce" /> CLICK HERE TO LOCK MOUSE LOOK
          </button>
        )}

        {/* Real-time resource looting logger */}
        <div className="bg-neutral-950/85 border border-white/10 p-4 backdrop-blur-md space-y-3 flex flex-col shadow-2xl">
          <div className="border-b border-white/15 pb-2 flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-neutral-300">
            <span>🔬 EXPEDITION LOG FEED</span>
            <span className="text-[8px] text-neutral-500">AUTO-SAVING</span>
          </div>
          <div className="min-h-24 max-h-36 overflow-y-auto space-y-1.5 pr-1 flex flex-col-reverse">
            {cargoFeed.length === 0 ? (
              <span className="text-neutral-600 text-[10px] italic leading-relaxed">Multi-Tool mining laser active. Fire at glowing resource crystals to mine minerals.</span>
            ) : (
              [...cargoFeed].reverse().map((log, idx) => (
                <div key={idx} className="text-[10px] bg-white/[0.02] border border-white/5 px-2.5 py-1.5 animate-fadeIn leading-relaxed">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROL DASHBOARD */}
      <div className="absolute bottom-4 left-4 right-4 bg-neutral-950/85 border border-white/10 p-4 backdrop-blur-md z-30 shadow-2xl flex flex-col md:flex-row justify-between items-stretch gap-4 select-none">
        {/* Key controls helper */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex gap-1.5">
            <span className="bg-neutral-800 border border-white/20 px-1.5 py-0.5 font-bold">W/A/S/D</span>
            <span className="text-neutral-400">Move</span>
          </div>
          <div className="flex gap-1.5">
            <span className="bg-neutral-800 border border-white/20 px-1.5 py-0.5 font-bold">SHIFT</span>
            <span className="text-neutral-400">Sprint</span>
          </div>
          <div className="flex gap-1.5">
            <span className="bg-neutral-800 border border-white/20 px-1.5 py-0.5 font-bold">SPACE</span>
            <span className="text-neutral-400">Jump</span>
          </div>
          <div className="flex gap-1.5">
            <span className="bg-neutral-800 border border-white/20 px-1.5 py-0.5 font-bold">LEFT CLICK</span>
            <span className="text-neutral-400">Fire Mining Laser</span>
          </div>
        </div>

        {/* Cargo capacity metric */}
        <div className="flex items-center gap-4">
          <div className="text-right text-xs">
            <span className="text-neutral-500 text-[9px] block">CARGO COMPARTMENT CAPABILITY</span>
            <span className="font-bold text-white">{totalCargo} / {stats.maxCargo} UNITS UTILIZED</span>
          </div>
          <button
            onClick={onExit}
            className="pointer-events-auto px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-xs font-bold transition-all flex items-center gap-2 rounded-none cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BOARD SHIP
          </button>
        </div>
      </div>
    </div>
  );
};

// ================= SceneEngine: MANAGES MULTIPLE ENTITIES & UPDATES =================
interface SceneEngineProps {
  planetConfig: any;
  keys: React.MutableRefObject<{ [key: string]: boolean }>;
  cameraRotation: React.MutableRefObject<{ yaw: number; pitch: number }>;
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  playerVelocity: React.MutableRefObject<THREE.Vector3>;
  gravityConstant: number;
  jumpHeightConstant: number;
  getTerrainHeight: (x: number, z: number) => number;
  resourcesRef: React.MutableRefObject<MineralResource[]>;
  aliensRef: React.MutableRefObject<AlienCreature[]>;
  laserRef: React.MutableRefObject<{ active: boolean; targetPos: THREE.Vector3 | null; duration: number }>;
  lastStepTimeRef: React.MutableRefObject<number>;
  playerHP: number;
  setPlayerHP: React.Dispatch<React.SetStateAction<number>>;
  sfx: MiniSynth;
  addCargoLog: (text: string) => void;
}

const SceneEngine: React.FC<SceneEngineProps> = ({
  planetConfig,
  keys,
  cameraRotation,
  playerPosition,
  playerVelocity,
  gravityConstant,
  jumpHeightConstant,
  getTerrainHeight,
  resourcesRef,
  aliensRef,
  laserRef,
  lastStepTimeRef,
  playerHP,
  setPlayerHP,
  sfx,
  addCargoLog,
}) => {
  const { camera, gl, scene } = useThree();

  // Create standard Three.js Line object using useMemo to avoid JSX type conflicts
  const laserLine = React.useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 0]), 3));
    const mat = new THREE.LineBasicMaterial({ color: "#22d3ee", linewidth: 4.5, fog: false });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    return line;
  }, []);

  // Mesh refs for animated models
  const shipMeshRef = useRef<THREE.Group>(null);
  const resourcesGroupRef = useRef<THREE.Group>(null);
  const aliensGroupRef = useRef<THREE.Group>(null);
  const skyDomeRef = useRef<THREE.Mesh>(null);

  // Re-configure scene attributes on mount
  useEffect(() => {
    // Enable fog dynamically to matches atmosphere Color
    scene.fog = new THREE.FogExp2(planetConfig.atmosphereColor || "#1e1b4b", 0.0035);
    gl.setClearColor(planetConfig.atmosphereColor || "#1e1b4b");
  }, [planetConfig, scene, gl]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // 1. Process 60FPS Player Movement
    const speed = keys.current["shift"] ? 17.5 : 9.5;
    const dir = new THREE.Vector3(0, 0, 0);

    // WASD projection relative to camera direction
    if (keys.current["w"] || keys.current["arrowup"]) dir.z -= 1;
    if (keys.current["s"] || keys.current["arrowdown"]) dir.z += 1;
    if (keys.current["a"] || keys.current["arrowleft"]) dir.x -= 1;
    if (keys.current["d"] || keys.current["arrowright"]) dir.x += 1;

    dir.normalize();
    // Rotate movement vector matching look orientation yaw
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.current.yaw);
    dir.multiplyScalar(speed * delta);

    // Apply basic horizontal movement
    playerPosition.current.add(dir);

    // Process footsteps SFX
    if (dir.length() > 0 && playerPosition.current.y <= getTerrainHeight(playerPosition.current.x, playerPosition.current.z) + 1.82) {
      if (time - lastStepTimeRef.current > (keys.current["shift"] ? 0.28 : 0.45)) {
        sfx.playStep();
        lastStepTimeRef.current = time;
      }
    }

    // Apply gravity
    playerVelocity.current.y -= gravityConstant * delta;
    playerPosition.current.y += playerVelocity.current.y * delta;

    // Check terrain boundary height collision (keep player locked to terrain elevation)
    const terrainHeight = getTerrainHeight(playerPosition.current.x, playerPosition.current.z);
    const eyeHeight = 1.8; // First-person viewpoint altitude
    if (playerPosition.current.y < terrainHeight + eyeHeight) {
      playerPosition.current.y = terrainHeight + eyeHeight;
      playerVelocity.current.y = 0;

      // Jump Trigger
      if (keys.current[" "] || keys.current["spacebar"]) {
        playerVelocity.current.y = jumpHeightConstant;
        sfx.playJump();
      }
    }

    // Apply pointer lock rotations to the camera matrix
    camera.quaternion.setFromEuler(new THREE.Euler(cameraRotation.current.pitch, cameraRotation.current.yaw, 0, "YXZ"));
    camera.position.copy(playerPosition.current);

    // 2. Animate Laser multi-tool beam
    if (laserLine && laserRef.current.active && laserRef.current.targetPos) {
      laserRef.current.duration -= delta;
      if (laserRef.current.duration <= 0) {
        laserRef.current.active = false;
        laserLine.visible = false;
      } else {
        // Laser starts from slightly below-right of the player camera (tool nozzle)
        const offset = new THREE.Vector3(0.4, -0.4, -0.5);
        offset.applyQuaternion(camera.quaternion);
        const startPoint = camera.position.clone().add(offset);

        const geom = laserLine.geometry;
        const posAttr = geom.attributes.position;
        posAttr.setXYZ(0, startPoint.x, startPoint.y, startPoint.z);
        posAttr.setXYZ(1, laserRef.current.targetPos.x, laserRef.current.targetPos.y, laserRef.current.targetPos.z);
        posAttr.needsUpdate = true;
        laserLine.visible = true;
      }
    }

    // 3. Update Alien Creature AI positions & behaviors
    if (aliensGroupRef.current) {
      aliensRef.current.forEach((ali, idx) => {
        const mesh = aliensGroupRef.current?.children[idx];
        if (!mesh || ali.health <= 0) {
          if (mesh) mesh.visible = false;
          return;
        }

        // Animate body parts procedurally based on biome
        const body = mesh.getObjectByName("body");
        const limbs = mesh.getObjectByName("limbs");
        if (body) {
          body.position.y = Math.sin(time * 3 + ali.bobOffset) * 0.15;
          body.rotation.z = Math.sin(time * 1.5 + ali.bobOffset) * 0.08;
        }
        if (limbs) {
          limbs.children.forEach((limb, limbIdx) => {
            limb.rotation.x = Math.sin(time * 6 + ali.bobOffset + limbIdx * Math.PI) * 0.45;
          });
        }

        // Run AI Behavior Logic
        const distToPlayer = ali.position.distanceTo(playerPosition.current);

        if (ali.type === "hostile" && distToPlayer < 32.0) {
          // CHARGE! Red glow charging towards the player
          const dirToPlayer = playerPosition.current.clone().sub(ali.position);
          dirToPlayer.y = 0;
          dirToPlayer.normalize();

          // Face the player
          ali.rotationY = Math.atan2(dirToPlayer.x, dirToPlayer.z);
          mesh.rotation.y = ali.rotationY;

          ali.position.add(dirToPlayer.multiplyScalar(ali.speed * delta));
          ali.position.y = getTerrainHeight(ali.position.x, ali.position.z) + 0.5;

          // Attack player if very close
          if (distToPlayer < 3.0) {
            sfx.playHurt();
            setPlayerHP((prev) => {
              const nextHP = Math.max(0, prev - Math.floor(10 + Math.random() * 8));
              if (nextHP === 0) {
                addCargoLog("⚠️ EXOSUIT SHIELD FAILURE: Evacuating immediately to ship medical bay!");
                playerPosition.current.set(0, 15, 30);
                setTimeout(() => setPlayerHP(100), 2000);
              }
              return nextHP;
            });
            // Bounce creature back a bit
            ali.position.sub(dirToPlayer.multiplyScalar(4.0));
          }
        } else {
          // Normal Idle / Roaming Walk state
          const distToTarget = ali.position.distanceTo(ali.targetPosition);
          if (distToTarget < 4.0 || Math.random() < 0.005) {
            // Pick a new random nearby waypoint
            const randAngle = Math.random() * Math.PI * 2;
            const randDist = 20 + Math.random() * 60;
            const nextX = ali.position.x + Math.cos(randAngle) * randDist;
            const nextZ = ali.position.z + Math.sin(randAngle) * randDist;
            const nextY = getTerrainHeight(nextX, nextZ);

            ali.targetPosition.set(nextX, nextY + (ali.type === "flying" ? 12 : 0.5), nextZ);
          }

          const moveDir = ali.targetPosition.clone().sub(ali.position).normalize();
          ali.rotationY = Math.atan2(moveDir.x, moveDir.z);
          mesh.rotation.y = ali.rotationY;

          ali.position.add(moveDir.multiplyScalar(ali.speed * delta));
          ali.position.y = getTerrainHeight(ali.position.x, ali.position.z) + (ali.type === "flying" ? 12 : 0.5);
        }

        mesh.position.copy(ali.position);
      });
    }

    // 4. Update Minable Crystal geometry animations (pulsing emission)
    if (resourcesGroupRef.current) {
      resourcesRef.current.forEach((res, idx) => {
        const mesh = resourcesGroupRef.current?.children[idx];
        if (!mesh || res.mined) {
          if (mesh) mesh.visible = false;
          return;
        }
        mesh.rotation.y += delta * 0.4;
        // Minor hover bobbing
        mesh.position.y = res.position.y + Math.sin(time * 1.5 + idx) * 0.08;
      });
    }

    // 5. Ambient cloud dome scrolling
    if (skyDomeRef.current) {
      skyDomeRef.current.rotation.y += delta * 0.008;
    }
  });

  return (
    <group>
      {/* 1. ATMOSPHERIC SKYDOME FRAME */}
      <mesh ref={skyDomeRef} rotation={[-Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[950, 32, 15]} />
        <meshBasicMaterial
          color={planetConfig.atmosphereColor || "#131320"}
          side={THREE.BackSide}
          fog={false}
        />
      </mesh>

      {/* 2. PROCEDURAL SOLAR LIGHT SYSTEMS */}
      <ambientLight intensity={0.65} color={planetConfig.atmosphereColor} />
      <directionalLight
        position={[250, 450, 150]}
        intensity={2.8}
        color={planetConfig.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={2000}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
      />
      <pointLight position={[0, 40, 0]} intensity={1.5} color="#06b6d4" distance={120} />

      {/* 3. TERRAIN LANDSCAPE MESH */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600, 160, 160]} />
        <TerrainMaterial planetConfig={planetConfig} getTerrainHeight={getTerrainHeight} />
      </mesh>

      {/* 4. PARKED SPACE SHIP CRADLE */}
      <group ref={shipMeshRef} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        {/* Sleek landing structural columns */}
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[4, 6, 2.5, 5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Cockpit canopy capsule */}
        <mesh position={[0, 4.0, 3.5]}>
          <sphereGeometry args={[4.2, 16, 16]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.6} transparent opacity={0.65} />
        </mesh>
        {/* Left thruster column */}
        <mesh position={[-6.8, 1.8, -4.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.5, 2.8, 10, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        {/* Right thruster column */}
        <mesh position={[6.8, 1.8, -4.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.5, 2.8, 10, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        {/* Sleek carbon sweeping wings */}
        <mesh position={[0, 2.8, -2.5]} rotation={[0, 0, 0]}>
          <boxGeometry args={[18, 1.2, 5]} />
          <meshStandardMaterial color={planetConfig.color || "#10b981"} roughness={0.3} />
        </mesh>
        {/* Glowing engine plasma flare */}
        <mesh position={[0, 1.8, -9.0]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3.2, 7.5, 12]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* 5. GALAXY CELESTIAL ENVIRONMENT SCENERY */}
      <group ref={resourcesGroupRef}>
        {resourcesRef.current.map((res, idx) => (
          <group key={res.id} position={[res.position.x, res.position.y, res.position.z]}>
            {/* Crystalline core structure */}
            <mesh castShadow receiveShadow position={[0, res.size / 2, 0]}>
              <octahedronGeometry args={[res.size, 1]} />
              <meshStandardMaterial
                color={res.color}
                emissive={res.color}
                emissiveIntensity={1.4}
                metalness={0.9}
                roughness={0.1}
                flatShading
              />
            </mesh>
            {/* Rock cluster base */}
            <mesh position={[0, 0.1, 0]}>
              <dodecahedronGeometry args={[res.size * 0.9, 0]} />
              <meshStandardMaterial color="#334155" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 6. ALIEN BIOLOGICALS */}
      <group ref={aliensGroupRef}>
        {aliensRef.current.map((ali) => (
          <group key={ali.id} position={[ali.position.x, ali.position.y, ali.position.z]}>
            <group name="body" scale={ali.scale}>
              {/* Biological Main Core */}
              <mesh name="mesh" castShadow>
                {ali.type === "flying" ? (
                  <sphereGeometry args={[1.5, 8, 8]} />
                ) : ali.type === "hostile" ? (
                  <boxGeometry args={[1.6, 1.2, 2.2]} />
                ) : (
                  <cylinderGeometry args={[1.2, 1.6, 2.5, 6]} />
                )}
                <meshStandardMaterial
                  color={ali.color}
                  emissive={ali.color}
                  emissiveIntensity={ali.type === "hostile" ? 1.5 : 0.6}
                  roughness={0.4}
                />
              </mesh>

              {/* Multi-sensory feelers / antenna */}
              <mesh position={[0, 1.5, 0.5]}>
                <boxGeometry args={[0.2, 1.2, 0.2]} />
                <meshBasicMaterial color="#fbbf24" />
              </mesh>

              {/* Procedural Limbs Leg Joints */}
              <group name="limbs">
                {ali.type !== "flying" && (
                  <>
                    <mesh position={[-0.8, -1.2, 0.8]}>
                      <boxGeometry args={[0.3, 1.2, 0.3]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[0.8, -1.2, 0.8]}>
                      <boxGeometry args={[0.3, 1.2, 0.3]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[-0.8, -1.2, -0.8]}>
                      <boxGeometry args={[0.3, 1.2, 0.3]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[0.8, -1.2, -0.8]}>
                      <boxGeometry args={[0.3, 1.2, 0.3]} />
                      <meshStandardMaterial color="#1e293b" />
                    </mesh>
                  </>
                )}
                {ali.type === "flying" && (
                  <>
                    {/* Flapping Wings */}
                    <mesh position={[-1.8, 0.2, 0]} rotation={[0, 0, Math.sin((performance.now() * 0.001) * 8) * 0.5]}>
                      <boxGeometry args={[2.5, 0.1, 1.5]} />
                      <meshStandardMaterial color="#0284c7" transparent opacity={0.8} />
                    </mesh>
                    <mesh position={[1.8, 0.2, 0]} rotation={[0, 0, -Math.sin((performance.now() * 0.001) * 8) * 0.5]}>
                      <boxGeometry args={[2.5, 0.1, 1.5]} />
                      <meshStandardMaterial color="#0284c7" transparent opacity={0.8} />
                    </mesh>
                  </>
                )}
              </group>
            </group>
          </group>
        ))}
      </group>

      {/* 7. SCATTERED FLORA & ANCIENT RUINS ROCKS */}
      <group>
        {(() => {
          const elements: React.ReactNode[] = [];
          for (let k = 0; k < 60; k++) {
            const seedAngle = (k * 22.3) % (Math.PI * 2);
            const seedDist = 45 + ((k * 87.1) % 450);
            const px = Math.cos(seedAngle) * seedDist;
            const pz = Math.sin(seedAngle) * seedDist;
            const py = getTerrainHeight(px, pz);

            if (k % 4 === 0) {
              // Giant glowing spore mushroom
              elements.push(
                <group key={`foliage_${k}`} position={[px, py, pz]}>
                  <mesh castShadow position={[0, 2.5, 0]}>
                    <cylinderGeometry args={[0.4, 0.8, 5, 5]} />
                    <meshStandardMaterial color="#475569" roughness={0.95} />
                  </mesh>
                  <mesh castShadow position={[0, 4.8, 0]}>
                    <sphereGeometry args={[2.8, 8, 8]} />
                    <meshStandardMaterial color="#fb7185" emissive="#e11d48" emissiveIntensity={1.1} />
                  </mesh>
                </group>
              );
            } else if (k % 4 === 1) {
              // Shard rock obelisks
              elements.push(
                <mesh
                  key={`foliage_${k}`}
                  position={[px, py + 1.5, pz]}
                  rotation={[0.1, (k * 0.5) % Math.PI, 0.25]}
                  castShadow
                  receiveShadow
                >
                  <coneGeometry args={[2.0, 7.5, 4]} />
                  <meshStandardMaterial color="#451a03" roughness={0.85} flatShading />
                </mesh>
              );
            } else if (k % 4 === 2) {
              // Giant basalt columns
              elements.push(
                <mesh
                  key={`foliage_${k}`}
                  position={[px, py + 3.0, pz]}
                  rotation={[0, (k * 1.5) % Math.PI, 0]}
                  castShadow
                  receiveShadow
                >
                  <cylinderGeometry args={[2.2, 2.2, 8.5, 6]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.9} flatShading />
                </mesh>
              );
            } else {
              // Floating ancient alien cube monolith relic
              elements.push(
                <group key={`foliage_${k}`} position={[px, py + 6.0 + Math.sin(k) * 2, pz]}>
                  <mesh castShadow rotation={[0.4, (performance.now() * 0.001) * 0.4 + k, 0.5]}>
                    <boxGeometry args={[1.8, 1.8, 1.8]} />
                    <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.9} metalness={0.9} roughness={0.05} />
                  </mesh>
                  <pointLight intensity={0.8} distance={15} color="#10b981" />
                </group>
              );
            }
          }
          return elements;
        })()}
      </group>

      {/* 8. ACTIVE MINING LASER LINE */}
      <primitive object={laserLine} />
    </group>
  );
};

// ================= Custom Procedural Shaded Terrain Material =================
interface TerrainMaterialProps {
  planetConfig: any;
  getTerrainHeight: (x: number, z: number) => number;
}

const TerrainMaterial: React.FC<TerrainMaterialProps> = ({ planetConfig, getTerrainHeight }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Re-map elevation heights to flat plane mesh coordinates
  useEffect(() => {
    if (meshRef.current) {
      const geom = meshRef.current.geometry;
      const posAttr = geom.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const zHeight = getTerrainHeight(x, y);
        posAttr.setZ(i, zHeight);
      }
      geom.computeVertexNormals();
      posAttr.needsUpdate = true;
    }
  }, [getTerrainHeight]);

  return (
    <mesh ref={meshRef} receiveShadow castShadow>
      <planeGeometry args={[1600, 1600, 160, 160]} />
      <meshStandardMaterial
        color={planetConfig.color || "#047857"}
        roughness={0.9}
        metalness={0.05}
        flatShading
      />
    </mesh>
  );
};
