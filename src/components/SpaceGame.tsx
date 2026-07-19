import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GameState, PlanetConfig, PlayerStats, GameLog, GameSettings, SolarSystem } from "../types";
import { GameHUD } from "./GameHUD";
import { MainMenuScreen } from "./MainMenuScreen";
import { VirtualJoystick } from "./VirtualJoystick";
import { PlanetSurface } from "./PlanetSurface";
import { audioEngine } from "./AudioEngine";
import { GALAXY_SYSTEMS } from "../data/galaxy";
import {
  PLANET_FACTS,
  MOON_FACTS,
  BLACK_HOLE_FACTS,
  NEUTRON_STAR_FACTS,
  PULSAR_FACTS,
  NEBULA_FACTS,
  GALAXY_FACTS,
  GAS_GIANT_FACTS,
  ALL_SCIENTIFIC_FACTS
} from "../data/facts";

export const SpaceGame: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("MainMenu");
  const [webglError, setWebglError] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [shipName, setShipName] = useState<string>("Icarus Scout");
  const [hullColor, setHullColor] = useState<string>("#38bdf8");

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [mobileWeapon, setMobileWeapon] = useState<"laser" | "missile">("laser");
  const mobileWeaponRef = useRef<"laser" | "missile">("laser");
  mobileWeaponRef.current = mobileWeapon;
  const hitMarkerTimeoutRef = useRef<any>(null);

  // Touch inputs refs to safely feed directly to RequestAnimationFrame thread
  const leftJoystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rightJoystickRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchShootRef = useRef<boolean>(false);
  const touchBoostRef = useRef<boolean>(false);
  const touchBrakeRef = useRef<boolean>(false);

  // Auto-detect player's device (Desktop vs Mobile/Touch-screen)
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsMobile(isMobileDevice);

    const checkOrientation = () => {
      if (isMobileDevice) {
        setIsPortrait(window.innerHeight > window.innerWidth);
      } else {
        setIsPortrait(false);
      }
    };

    checkOrientation();

    // Auto-lock landscape orientation when possible on Android/mobile browsers
    if (isMobileDevice) {
      try {
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock("landscape").catch((err: any) => {
            console.log("Landscape lock requires full screen or is unsupported:", err);
          });
        }
      } catch (err) {
        console.warn("Screen orientation error:", err);
      }
    }

    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);
  
  // Tactical logs rolling feed
  const [logs, setLogs] = useState<GameLog[]>([
    { id: "1", message: "Flight computer initialized.", type: "info", timestamp: Date.now() },
  ]);

  // Player live stats (with shields & credits populated)
  const [stats, setStats] = useState<PlayerStats>({
    health: 100,
    maxHealth: 100,
    shield: 100,
    maxShield: 100,
    fuel: 100,
    maxFuel: 100,
    speed: 0,
    maxSpeed: 180,
    boostSpeed: 270,
    isBoosting: false,
    isLanded: false,
    isWalking: false,
    isExploring: false,
    currentPlanetId: null,
    landingProgress: 0,
    score: 0,
    credits: 300, // Starts with standard pilot fund
    currentSystemId: "sol_sector",
    cargo: { iron: 0, titanium: 0, gold: 0, crystal: 0, uranium: 0, darkMatter: 0 },
    maxCargo: 50,
    upgrades: { engines: 1, shields: 1, armor: 1, cargo: 1, radar: 1, lasers: 1, missiles: 1, hyperdrive: 1 },
    factionRep: { terranVanguard: 0, xylosSwarm: 0, zoraxSyndicate: 0 },
    discoveries: { blackHole: false, neutronStar: false, pulsar: false, whiteDwarf: false, supernova: false, wormhole: false },
    activeMission: null,
    unlockedFacts: [],
    discoveredObjects: [],
  });

  const currentSystem = GALAXY_SYSTEMS.find(s => s.id === stats.currentSystemId) || GALAXY_SYSTEMS[0];
  const currentSystemRef = useRef<SolarSystem>(currentSystem);
  currentSystemRef.current = currentSystem;

  const [discoveryNotification, setDiscoveryNotification] = useState<{
    title: string;
    description: string;
    fact?: string;
  } | null>(null);

  const [damageNumbers, setDamageNumbers] = useState<{ id: string; amount: number; x: number; y: number }[]>([]);
  const [hitMarkerActive, setHitMarkerActive] = useState<boolean>(false);

  // --- Planetary Exploration (Phase 2 Expanded States) ---
  const [landingStage, setLandingStage] = useState<"space" | "descent" | "landed" | "takeoff">("space");
  const landingStageRef = useRef<"space" | "descent" | "landed" | "takeoff">("space");
  landingStageRef.current = landingStage;

  const [takeoffProgress, setTakeoffProgress] = useState<number>(0);
  const takeoffProgressRef = useRef<number>(0);
  takeoffProgressRef.current = takeoffProgress;

  const [reentryIntensity, setReentryIntensity] = useState<number>(0);
  const reentryIntensityRef = useRef<number>(0);
  reentryIntensityRef.current = reentryIntensity;

  const [planetWeather, setPlanetWeather] = useState<string>("Calm");
  const [dayNightProgress, setDayNightProgress] = useState<number>(0.25); // 0 to 1

  const [scanTargets, setScanTargets] = useState<{
    id: string;
    name: string;
    type: string;
    localPos: [number, number, number];
    scanned: boolean;
    fact: string;
    bonusCredits: number;
  }[]>([]);
  const scanTargetsRef = useRef<any[]>([]);
  scanTargetsRef.current = scanTargets;

  const [activeScanTargetId, setActiveScanTargetId] = useState<string | null>(null);
  const activeScanTargetIdRef = useRef<string | null>(null);
  activeScanTargetIdRef.current = activeScanTargetId;

  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const isScanningRef = useRef<boolean>(false);
  isScanningRef.current = isScanning;

  const [scannedCount, setScannedCount] = useState<number>(0);

  // Three.js groups and references for Phase 2
  const planetaryGroupRef = useRef<THREE.Group | null>(null);
  const weatherParticlesRef = useRef<THREE.Points | null>(null);
  const weatherVelocityRef = useRef<Float32Array | null>(null);
  const scanBeamMeshRef = useRef<THREE.Mesh | null>(null);
  const scanTargetMeshesRef = useRef<{ id: string; mesh: THREE.Group }[]>([]);
  const landingEntryNormalRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const destroyPlanetaryEnvironmentRef = useRef<() => void>(() => {});

  const getTerrainHeight = (x: number, z: number, biomeStr: string): number => {
    const biome = biomeStr.toLowerCase();
    if (biome.includes("forest") || biome.includes("lush")) {
      return Math.sin(x * 0.003) * Math.cos(z * 0.003) * 70 + Math.sin(x * 0.01) * 15;
    } else if (biome.includes("desert") || biome.includes("barren")) {
      return Math.sin(x * 0.002) * 20 + Math.sin(z * 0.004) * 10;
    } else if (biome.includes("volcanic") || biome.includes("basalt")) {
      const d = Math.sqrt(x*x + z*z);
      let y = Math.sin(x * 0.004) * Math.cos(z * 0.004) * 90;
      if (d > 200 && d < 600) y += Math.sin((d - 200) * 0.01) * 80;
      return y;
    } else if (biome.includes("glacial") || biome.includes("tundra")) {
      return Math.sin(x * 0.005) * Math.cos(z * 0.005) * 45 + (Math.sin(x * 0.02) > 0.8 ? 50 : 0);
    } else if (biome.includes("crystal")) {
      let y = Math.sin(x * 0.003) * Math.cos(z * 0.003) * 55;
      if (Math.sin(x * 0.04) * Math.cos(z * 0.04) > 0.65) y += 120;
      return y;
    } else if (biome.includes("swamp") || biome.includes("magnetic")) {
      return Math.sin(x * 0.0025) * Math.cos(z * 0.0025) * 25 + Math.sin(x * 0.01) * 5;
    } else {
      return Math.sin(x * 0.003) * Math.cos(z * 0.003) * 40;
    }
  };

  const initScanTargets = (planet: PlanetConfig) => {
    const biome = planet.biome.toLowerCase();
    let facts = {
      plant: "Unidentified Flora",
      mineral: "Crystalline Deposit",
      rock: "Volcanic Rock Slabs",
      animal: "Anomalous Lifeform",
      ruin: "Xeno Obelisk",
    };
    
    if (biome.includes("forest") || biome.includes("lush")) {
      facts = {
        plant: "Phyto-Luminescent Fern. Emits high-energy glucose vapor during nocturnal cycles.",
        mineral: "Chlorophyl Crystals. High-conductivity mineral loaded with bio-titanium.",
        rock: "Aerosolized Pumice. Deeply porous basalt sheets covered in moss.",
        animal: "Nebula Glider. Hovering cephalopod that feeds on static electricity.",
        ruin: "Precursor Archway. Ancient structures emitting low-frequency graviton signals.",
      };
    } else if (biome.includes("desert") || biome.includes("barren")) {
      facts = {
        plant: "Silicate Cacti. Stores rich heavy-water compounds inside rubberized cellular membranes.",
        mineral: "Pyrite Sand Cluster. Pure gold crystallization in hyper-pressurized pockets.",
        rock: "Eolian Obsidian Slabs. Extremely sharp volcanic glass sheets.",
        animal: "Dune Burrower. Insectoid life with iron-reinforced chitin plates.",
        ruin: "Fossilized Outpost. Pre-warp signal relay station dating back 3 million years.",
      };
    } else if (biome.includes("volcanic") || biome.includes("basalt")) {
      facts = {
        plant: "Pyrophilic Coral-Fern. Sustained by magma-vent heat, stores volatile liquid hydrogen.",
        mineral: "Blazing Sulfur Shards. Saturated with radioactive raw uranium clusters.",
        rock: "Porphyritic Basalt. Loaded with iron-silicate alloys.",
        animal: "Magma Crawler. Microscopic colonial organisms forming a moving silicon shell.",
        ruin: "Volcanic Forge Core. Obsidian pedestal vibrating with magnetic distortion.",
      };
    } else if (biome.includes("glacial") || biome.includes("tundra")) {
      facts = {
        plant: "Cryo-Boreal Lichen. Survives down to -140C, contains trace liquid dark matter.",
        mineral: "Deuterium Ice-Geodes. Compressed heavy-water crystal structures.",
        rock: "Permafrost Gravel conglomerate.",
        animal: "Frost-Beast Swarm. Miniature floating crystals acting as a collective hive-mind.",
        ruin: "Glacial Crypt Pillar. Highly conductive hyper-alloy rod of unknown origin.",
      };
    } else if (biome.includes("crystal")) {
      facts = {
        plant: "Bioluminescent Glass-Weed. Conducts raw electromagnetic charges through stems.",
        mineral: "Amethyst Quartz Spire. High-purity crystal refracting solar radiation.",
        rock: "Crystalline Slate blocks.",
        animal: "Prismatic Glimmer-Fly. Living crystal refracting light to blind predators.",
        ruin: "Crystalline Obelisk. Emits ancient audio resonance frequencies when scanned.",
      };
    } else if (biome.includes("swamp") || biome.includes("magnetic")) {
      facts = {
        plant: "Spore-Spewing Pod. Emits toxic swamp gases upon structural vibration.",
        mineral: "Magnetic Mud Geode. Concentrated dark matter grains suspended in sludge.",
        rock: "Mossy Swampland Clay boulders.",
        animal: "Acid-Weaver Lurker. Carnivorous slug with glowing bio-acid glands.",
        ruin: "Sunken Monolith. Submerged stone pillar engraved with high-frequency telemetry keys.",
      };
    } else {
      facts = {
        plant: "Hardy Rock Lichen. Consumes solar rays, synthesizes titanium composites.",
        mineral: "Raw Quartz Clump. Compressed silicon dioxide structures.",
        rock: "Standard Asteroid Impact fragment.",
        animal: "Silicon-based Spore. Floating spore cell reflecting starlight.",
        ruin: "Ancient Beacon Pillar. Emits weak rescue coordinates in standard RF frequency.",
      };
    }

    const targets = [
      {
        id: "plant",
        name: biome.includes("forest") ? "Xenoflora Fern" : "Bioluminescent Plant",
        type: "Plant",
        localPos: [45, getTerrainHeight(45, 35, planet.biome), 35] as [number, number, number],
        scanned: false,
        fact: facts.plant,
        bonusCredits: 400,
      },
      {
        id: "mineral",
        name: "Luminescent Mineral Geode",
        type: "Mineral",
        localPos: [-35, getTerrainHeight(-35, 45, planet.biome), 45] as [number, number, number],
        scanned: false,
        fact: facts.mineral,
        bonusCredits: 600,
      },
      {
        id: "rock",
        name: "Fractured Obsidian Boulder",
        type: "Rock",
        localPos: [15, getTerrainHeight(15, -60, planet.biome), -60] as [number, number, number],
        scanned: false,
        fact: facts.rock,
        bonusCredits: 250,
      },
      {
        id: "animal",
        name: "Xeno-Wildlife Specimen",
        type: "Animal",
        localPos: [65, getTerrainHeight(65, -30, planet.biome), -30] as [number, number, number],
        scanned: false,
        fact: facts.animal,
        bonusCredits: 800,
      },
      {
        id: "ruin",
        name: "Precursor Archway Ruins",
        type: "Ancient Ruins",
        localPos: [-60, getTerrainHeight(-60, -10, planet.biome), -10] as [number, number, number],
        scanned: false,
        fact: facts.ruin,
        bonusCredits: 1200,
      },
    ];

    setScanTargets(targets);
  };

  const triggerActiveScan = (targetId?: string) => {
    if (isScanningRef.current || !statsRef.current.isLanded || statsRef.current.currentPlanetId === "station") return;

    // Find closest unscanned target or specific target
    let targetToScan = scanTargetsRef.current.find(t => t.id === targetId);
    if (!targetToScan) {
      // Find closest unscanned target
      const unscanned = scanTargetsRef.current.filter(t => !t.scanned);
      if (unscanned.length === 0) {
        addLog("SCANNER CHECK: All planetary surface bio-anomalies and structures fully scanned.", "success");
        return;
      }
      targetToScan = unscanned[0];
    }

    if (targetToScan) {
      setActiveScanTargetId(targetToScan.id);
      setIsScanning(true);
      setScanProgress(0);
      addLog(`SCANNER INITIALIZED: Analyzing ${targetToScan.name}...`, "warning");
      audioEngine.playScanLaser();
    }
  };

  const triggerDiscovery = (id: string, title: string, description: string, objectType: string) => {
    // Prevent double triggering
    const currentDiscovered = statsRef.current.discoveredObjects || [];
    if (currentDiscovered.includes(id)) return;

    // Pick a fact that hasn't been unlocked yet
    let factsList = PLANET_FACTS;
    if (objectType === "moon") factsList = MOON_FACTS;
    else if (objectType === "black_hole") factsList = BLACK_HOLE_FACTS;
    else if (objectType === "neutron_star") factsList = NEUTRON_STAR_FACTS;
    else if (objectType === "pulsar") factsList = PULSAR_FACTS;
    else if (objectType === "nebula") factsList = NEBULA_FACTS;
    else if (objectType === "galaxy") factsList = GALAXY_FACTS;
    else if (objectType === "gas_giant") factsList = GAS_GIANT_FACTS;

    let unlockedFact: string | undefined;

    const currentUnlocked = statsRef.current.unlockedFacts || [];
    const remainingFacts = factsList.filter(f => !currentUnlocked.includes(f));
    
    if (remainingFacts.length > 0) {
      unlockedFact = remainingFacts[0]; // Unlock next sequential fact
    } else {
      // fallback
      const otherList = ALL_SCIENTIFIC_FACTS.map(f => f.fact);
      const remainingOther = otherList.filter(f => !currentUnlocked.includes(f));
      if (remainingOther.length > 0) {
        unlockedFact = remainingOther[0];
      }
    }

    // Play discovery sound
    audioEngine.playDiscovery();

    // Add log feed entry
    addLog(`NEW DISCOVERY: ${title}! ${unlockedFact ? `Archived fact in Science Database.` : ""}`, "success");

    // Update player live stats and legacy discoveries mapping for Science grants
    setStats((prev) => {
      const updatedDiscovered = [...(prev.discoveredObjects || []), id];
      const updatedFacts = unlockedFact ? [...(prev.unlockedFacts || []), unlockedFact] : (prev.unlockedFacts || []);
      
      const discoveries = { ...prev.discoveries };
      if (id === "black_hole") discoveries.blackHole = true;
      if (id === "wormhole") discoveries.wormhole = true;
      if (id === "pulsar") { discoveries.pulsar = true; discoveries.neutronStar = true; }
      if (id === "white_dwarf") discoveries.whiteDwarf = true;

      return {
        ...prev,
        discoveredObjects: updatedDiscovered,
        unlockedFacts: updatedFacts,
        discoveries
      };
    });

    // Set notification details
    setDiscoveryNotification({
      title,
      description,
      fact: unlockedFact
    });
  };

  const createPlanetaryEnvironment = (planet: PlanetConfig) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up any existing environment first just in case
    if (destroyPlanetaryEnvironmentRef.current) {
      destroyPlanetaryEnvironmentRef.current();
    }

    const group = new THREE.Group();
    planetaryGroupRef.current = group;
    scene.add(group);

    // Save current landing normal
    landingEntryNormalRef.current.set(0, 1, 0);

    // 1. Generate Procedural Terrain Mesh
    const segments = 150;
    const size = 3200;
    const terrainGeom = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Displace vertices based on coordinates and planet biome
    const posAttr = terrainGeom.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getY(i); // PlaneGeometry uses Y for 2D plane coordinate
      const height = getTerrainHeight(vx, vz, planet.biome);
      posAttr.setZ(i, height); // Displace vertical axis
    }
    terrainGeom.computeVertexNormals();

    // Rotate plane so Z-displaced represents Y-up
    terrainGeom.rotateX(-Math.PI / 2);

    // Define color palette based on planet biome
    let terrainColor = 0x1e3f20; // Default Lush Green
    let roughness = 0.9;
    let metalness = 0.15;
    const biome = planet.biome.toLowerCase();
    
    if (biome.includes("forest") || biome.includes("lush")) {
      terrainColor = 0x224c26; // deep emerald
    } else if (biome.includes("desert") || biome.includes("barren")) {
      terrainColor = 0xcda26b; // golden sands
    } else if (biome.includes("volcanic") || biome.includes("basalt")) {
      terrainColor = 0x1a1212; // deep black basalt
      roughness = 0.95;
    } else if (biome.includes("glacial") || biome.includes("tundra")) {
      terrainColor = 0xe0f2fe; // icy white blue
      roughness = 0.3;
      metalness = 0.25;
    } else if (biome.includes("crystal")) {
      terrainColor = 0x3b0764; // deep purple
      roughness = 0.6;
      metalness = 0.45;
    } else if (biome.includes("swamp") || biome.includes("magnetic")) {
      terrainColor = 0x115e59; // dark swampy teal
      roughness = 0.95;
    }

    const terrainMat = new THREE.MeshStandardMaterial({
      color: terrainColor,
      roughness: roughness,
      metalness: metalness,
      flatShading: true,
      side: THREE.DoubleSide
    });

    const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
    terrainMesh.receiveShadow = true;
    group.add(terrainMesh);

    // 2. Generate Atmospheric Weather Particles
    const pCount = 2500;
    const pGeom = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pVel = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      pPos[i*3] = (Math.random() - 0.5) * 1600;
      pPos[i*3+1] = Math.random() * 180 + 5;
      pPos[i*3+2] = (Math.random() - 0.5) * 1600;

      // Define velocity based on weather
      if (planet.weather?.includes("Blizzard") || planet.weather?.includes("Snow")) {
        pVel[i*3] = (Math.random() - 0.5) * 15 - 5; // blowing left
        pVel[i*3+1] = -(Math.random() * 10 + 10);   // falling down
        pVel[i*3+2] = (Math.random() - 0.5) * 10;
      } else if (planet.weather?.includes("Acid") || planet.weather?.includes("Rain") || planet.weather?.includes("Storm")) {
        pVel[i*3] = (Math.random() - 0.5) * 5;
        pVel[i*3+1] = -(Math.random() * 30 + 35);   // rapid rain sheets
        pVel[i*3+2] = (Math.random() - 0.5) * 5;
      } else if (planet.weather?.includes("Ash") || planet.weather?.includes("Eruption")) {
        pVel[i*3] = (Math.random() - 0.5) * 8;
        pVel[i*3+1] = Math.random() * 5 + 4;        // hot sparks float up
        pVel[i*3+2] = (Math.random() - 0.5) * 8;
      } else if (planet.weather?.includes("Sandstorm")) {
        pVel[i*3] = -40 - Math.random() * 20;       // horizontal sand blast
        pVel[i*3+1] = (Math.random() - 0.5) * 3;
        pVel[i*3+2] = (Math.random() - 0.5) * 15;
      } else {
        // Calm/ambient stardust
        pVel[i*3] = (Math.random() - 0.5) * 2;
        pVel[i*3+1] = -(Math.random() * 2 + 1);
        pVel[i*3+2] = (Math.random() - 0.5) * 2;
      }
    }

    pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    weatherVelocityRef.current = pVel;

    let pColor = 0xffffff; // white snow
    let pSize = 12;
    if (planet.weather?.includes("Acid") || planet.weather?.includes("Rain")) {
      pColor = 0xa3e635; // neon green rain
      pSize = 10;
    } else if (planet.weather?.includes("Ash")) {
      pColor = 0xf97316; // glowing ember orange
      pSize = 15;
    } else if (planet.weather?.includes("Sandstorm")) {
      pColor = 0xeab308; // yellow sand dust
      pSize = 18;
    }

    const pMat = new THREE.PointsMaterial({
      color: pColor,
      size: pSize,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pPoints = new THREE.Points(pGeom, pMat);
    group.add(pPoints);
    weatherParticlesRef.current = pPoints;

    // 3. Spawning 3D Physical Models for Scientific Targets
    scanTargetMeshesRef.current = [];
    
    scanTargetsRef.current.forEach((target) => {
      const targetGroup = new THREE.Group();
      targetGroup.position.set(target.localPos[0], target.localPos[1], target.localPos[2]);
      group.add(targetGroup);

      // Save a reference to anim/update
      scanTargetMeshesRef.current.push({ id: target.id, mesh: targetGroup });

      if (target.id === "plant") {
        // Neon tree trunk
        const trunkGeom = new THREE.CylinderGeometry(1.5, 3, 20, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 10;
        targetGroup.add(trunk);

        // Neon leaves
        const leafGeom = new THREE.SphereGeometry(12, 8, 8);
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x22c55e,
          emissive: 0x15803d,
          emissiveIntensity: 0.8,
          roughness: 0.6
        });
        const leaves = new THREE.Mesh(leafGeom, leafMat);
        leaves.position.y = 22;
        targetGroup.add(leaves);

        // Glowing nodes
        const nodeGeom = new THREE.BoxGeometry(2, 2, 2);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const node = new THREE.Mesh(nodeGeom, nodeMat);
        node.position.set(0, 24, 0);
        targetGroup.add(node);

      } else if (target.id === "mineral") {
        // Jagged Purple/Cyan Crystal Spire
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0x6b21a8,
          emissiveIntensity: 1.2,
          roughness: 0.2,
          metalness: 0.9,
          flatShading: true
        });

        for (let j = 0; j < 5; j++) {
          const crystalGeom = new THREE.ConeGeometry(2 + Math.random()*2, 10 + Math.random()*15, 5);
          const crystal = new THREE.Mesh(crystalGeom, crystalMat);
          crystal.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
          crystal.rotation.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6);
          targetGroup.add(crystal);
        }

      } else if (target.id === "rock") {
        // Rugged Boulders
        const boulderGeom = new THREE.DodecahedronGeometry(12, 1);
        const boulderMat = new THREE.MeshStandardMaterial({
          color: 0x3f3f46,
          roughness: 0.95,
          flatShading: true
        });
        const boulder = new THREE.Mesh(boulderGeom, boulderMat);
        boulder.position.y = 6;
        boulder.scale.set(1.2, 0.9, 1.1);
        targetGroup.add(boulder);

      } else if (target.id === "animal") {
        // Glowing floating biological jellyfish pod
        const bodyGeom = new THREE.SphereGeometry(7, 16, 16);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x0891b2,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.85
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 15;
        targetGroup.add(body);

        // Ring
        const ringGeom = new THREE.TorusGeometry(8.5, 0.8, 8, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 15;
        ring.rotation.x = Math.PI / 2;
        targetGroup.add(ring);

      } else if (target.id === "ruin") {
        // Ancient Obelisk Ruins
        const pyramidGeom = new THREE.CylinderGeometry(1, 4, 35, 4);
        const pyramidMat = new THREE.MeshStandardMaterial({
          color: 0x09090b,
          roughness: 0.2,
          metalness: 0.9,
          flatShading: true
        });
        const obelisk = new THREE.Mesh(pyramidGeom, pyramidMat);
        obelisk.position.y = 17.5;
        obelisk.rotation.y = Math.PI / 4;
        targetGroup.add(obelisk);

        // Glowing runic lines
        const runicGeom = new THREE.BoxGeometry(0.5, 25, 4.2);
        const runicMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Orange runes
        const runes = new THREE.Mesh(runicGeom, runicMat);
        runes.position.set(0, 15, 0);
        targetGroup.add(runes);
      }
    });

    // 4. Set up custom environmental lighting
    let ambientHex = 0x2e1065; // deep purple lush
    let hemiHex = 0x38bdf8;    // cyan sky
    if (biome.includes("volcanic")) {
      ambientHex = 0x450a0a;   // blood red
      hemiHex = 0xf97316;      // fiery orange
    } else if (biome.includes("desert")) {
      ambientHex = 0x422006;   // sunset clay
      hemiHex = 0xfef08a;      // yellow sands
    } else if (biome.includes("glacial")) {
      ambientHex = 0x0c4a6e;   // arctic dark blue
      hemiHex = 0xffffff;      // pure glacier white
    }

    const envLight1 = new THREE.AmbientLight(ambientHex, 1.5);
    const envLight2 = new THREE.HemisphereLight(hemiHex, 0x0f172a, 2.0);
    group.add(envLight1);
    group.add(envLight2);

    // Save dynamic cleanup closure
    destroyPlanetaryEnvironmentRef.current = () => {
      if (planetaryGroupRef.current) {
        scene.remove(planetaryGroupRef.current);
        planetaryGroupRef.current = null;
      }
      terrainGeom.dispose();
      terrainMat.dispose();
      pGeom.dispose();
      pMat.dispose();
      envLight1.dispose();
      envLight2.dispose();
      scanTargetMeshesRef.current = [];
      weatherParticlesRef.current = null;
      weatherVelocityRef.current = null;
    };
  };

  const [playerPos, setPlayerPos] = useState<[number, number, number]>([0, 0, 4800]);
  const [playerRot, setPlayerRot] = useState<number>(0);

  // Weapon cooldown timers
  const [laserCooldown, setLaserCooldown] = useState<number>(0);
  const [missileCooldown, setMissileCooldown] = useState<number>(0);

  // Targeted Enemy contact state
  const [targetEnemy, setTargetEnemy] = useState<{
    name: string;
    classType: string;
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    distance: number;
  } | null>(null);

  // Black hole proximity tracker
  const [blackHoleDistance, setBlackHoleDistance] = useState<number>(100000);

  // Game Settings preset state
  const [settings, setSettings] = useState<GameSettings>({
    resolution: "medium",
    fullscreen: false,
    volume: 0.5,
    musicVolume: 0.5,
    sfxVolume: 0.5,
    mouseSensitivity: 1.0,
    graphics: "medium",
    vsync: true,
    flightMode: "arcade",
    postProcessing: true,
    uiScale: 1.0,
    touchSensitivity: 1.0,
    joystickSize: 96,
    colorblindMode: false,
  });

  // Track live coordinates of active enemies for 2D radar display
  const [enemyPositions, setEnemyPositions] = useState<{ x: number; z: number; id: string }[]>([]);
  const [enemiesData, setEnemiesData] = useState<any[]>([]);
  const [navTargets, setNavTargets] = useState<any>(null);

  // References to safely share React state values with WebGL requestAnimationFrame thread
  const statsRef = useRef<PlayerStats>(stats);
  statsRef.current = stats;
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;
  const settingsRef = useRef<GameSettings>(settings);
  settingsRef.current = settings;

  const laserCooldownRef = useRef<number>(0);
  laserCooldownRef.current = laserCooldown;
  const missileCooldownRef = useRef<number>(0);
  missileCooldownRef.current = missileCooldown;

  const targetEnemyRef = useRef<{ id: string } | null>(null);

  // Damage immunity timer tracking for Shield auto-regeneration
  const lastDamageTimeRef = useRef<number>(0);

  // Keyboard state map
  const keysRef = useRef<{ [key: string]: boolean }>({});
  // Mouse position reference
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ship group reference for teleportation and upgrades
  const shipGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Add a tactical log helper
  const addLog = (message: string, type: "info" | "warning" | "success" | "danger" = "info") => {
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(), message, type, timestamp: Date.now() },
    ].slice(-40)); // limit log overhead
  };

  // Keyboard & Mouse Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      keysRef.current[e.code.toLowerCase()] = true;

      // Escape key pause toggling
      if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        if (gameStateRef.current === "Playing") {
          setGameState("Pause");
        } else if (gameStateRef.current === "Pause") {
          setGameState("Playing");
        }
      }

      // E key landing/takeoff triggers
      if (e.key === "e" || e.key === "E" || e.code === "KeyE") {
        e.preventDefault();
        if (gameStateRef.current === "Playing" && !statsRef.current.isLanded && statsRef.current.currentPlanetId && statsRef.current.landingProgress === 0) {
          setStats((prev) => ({ ...prev, landingProgress: 0.01 }));
          const planetName = currentSystemRef.current.planets.find(p => p.id === statsRef.current.currentPlanetId)?.name || "planet";
          addLog(`Initiated orbital descent coupling with ${planetName}...`, "info");
          audioEngine.playLanding();
        } else if (gameStateRef.current === "Playing" && statsRef.current.isLanded) {
          handleTakeOff();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleStartGame = (selectedShip: {
    name: string;
    hullColor: string;
    maxSpeed: number;
    maxFuel: number;
    handling: number;
  }) => {
    setShipName(selectedShip.name);
    setHullColor(selectedShip.hullColor);
    setStats((prev) => ({
      ...prev,
      maxSpeed: selectedShip.maxSpeed,
      boostSpeed: selectedShip.maxSpeed * 1.5,
      maxFuel: selectedShip.maxFuel,
      fuel: selectedShip.maxFuel,
      health: 100,
      shield: 100,
      maxShield: 100,
      credits: 300,
      isLanded: false,
      currentPlanetId: null,
      landingProgress: 0,
    }));
    setGameState("Playing");
    audioEngine.setMusicZone("exploration");
    addLog(`Cockpit synced. Starship Class: ${selectedShip.name}. deflectors: ONLINE.`, "success");
    addLog("Check Sector Map. Move: W-A-S-D | Boost: Shift | Fire: Mouse Buttons.", "info");
  };

  const handleRefuel = () => {
    audioEngine.playRefuel();
    setStats((prev) => ({ ...prev, fuel: prev.maxFuel }));
    addLog("Refueled fusion thrusters to 100%.", "success");
  };

  const handleRepair = () => {
    audioEngine.playRefuel();
    setStats((prev) => ({ ...prev, health: prev.maxHealth, shield: prev.maxShield }));
    addLog("Exterior hull plates and shields restored to maximum.", "success");
  };

  const handleTakeOff = () => {
    audioEngine.playLanding();
    audioEngine.setMusicZone("exploration");
    setStats((prev) => ({
      ...prev,
      isLanded: false,
      currentPlanetId: null,
      speed: 15,
    }));
    addLog("Ignition successful. Leaving planet orbit and re-entering outer space flight vector.", "info");
  };

  const handleRestart = () => {
    audioEngine.playClick();
    setStats((prev) => ({
      ...prev,
      health: 100,
      shield: 100,
      fuel: prev.maxFuel,
      speed: 0,
      isLanded: false,
      currentPlanetId: null,
      landingProgress: 0,
    }));
    setGameState("Playing");
    audioEngine.setMusicZone("exploration");
    if (shipGroupRef.current) {
      shipGroupRef.current.position.set(0, 0, 4800);
      shipGroupRef.current.quaternion.set(0, 0, 0, 1);
    }
    addLog("Starship chassis re-deployed. Pilot HUD re-engaged.", "success");
  };

  const handleQuit = () => {
    audioEngine.playClick();
    setGameState("MainMenu");
    audioEngine.setMusicZone("menu");
  };

  // Telemetries save & load
  const handleSaveGame = () => {
    const saveData = {
      stats: statsRef.current,
      playerPos: [playerPos[0], playerPos[1], playerPos[2]],
      shipName,
      hullColor,
      logs: logs.slice(-6),
    };
    localStorage.setItem("voidflyer_save", JSON.stringify(saveData));
    addLog("SYSTEM CORE: Starship telemetry backup synced successfully.", "success");
  };

  const handleLoadGame = () => {
    const raw = localStorage.getItem("voidflyer_save");
    if (!raw) {
      addLog("LOAD ERROR: No backup telemetry found in system memory.", "danger");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setStats(parsed.stats);
      setShipName(parsed.shipName);
      setHullColor(parsed.hullColor);
      setPlayerPos(parsed.playerPos);
      if (parsed.logs) {
        setLogs(parsed.logs);
      }
      if (shipGroupRef.current) {
        shipGroupRef.current.position.set(parsed.playerPos[0], parsed.playerPos[1], parsed.playerPos[2]);
      }
      addLog("SYSTEM CORE: Backup telemetry restored. Re-orienting flight deck.", "success");
    } catch {
      addLog("LOAD ERROR: Backup telemetry data corrupted.", "danger");
    }
  };

  // Automated Save when docking at stations
  useEffect(() => {
    if (stats.isLanded) {
      handleSaveGame();
    }
  }, [stats.isLanded]);

  // Periodic 2-minute auto-save
  useEffect(() => {
    if (gameState !== "Playing") return;
    const interval = setInterval(() => {
      handleSaveGame();
      addLog("SYSTEM CORE: Automatic background telemetry backup saved.", "info");
    }, 120000); // 120000 ms = 2 minutes
    return () => clearInterval(interval);
  }, [gameState]);

  // ================= WEBGL ENGINE & THREE.JS SCENE =================
  useEffect(() => {
    // Skip gameplay WebGL setup if we are in MainMenu state to prevent dual rendering and resource overhead
    if (gameState === "MainMenu") {
      return;
    }

    // 1. Create Scene & Dark Atmosphere
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2("#020205", 0.00004);

    // 2. High-Precision Follow Camera
    const initialWidth = window.innerWidth || 800;
    const initialHeight = window.innerHeight || 600;
    const camera = new THREE.PerspectiveCamera(65, initialWidth / initialHeight, 0.1, 50000);
    
    // 3. WebGL Renderer with graceful fallbacks
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("Could not initialize WebGLRenderer with antialias, trying standard...", e);
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      } catch (err) {
        console.error("WebGL is unsupported or disabled:", err);
        setWebglError(true);
        return;
      }
    }

    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // 4. Lights Setup
    const ambientLight = new THREE.AmbientLight(0x131320);
    scene.add(ambientLight);

    const starColorHex = currentSystem.starColor || "#fff5e0";
    const sunLight = new THREE.PointLight(new THREE.Color(starColorHex), 3.5, 25000, 0.35);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // 5. Starfield Particle Grid (5000 Stars with Depth)
    const starsCount = 5000;
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    const starsColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
      const r = 24000 + Math.random() * 16000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starsPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starsPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPositions[i * 3 + 2] = r * Math.cos(phi);

      const colorVal = Math.random();
      if (colorVal < 0.6) {
        starsColors[i * 3] = 1.0; starsColors[i * 3 + 1] = 1.0; starsColors[i * 3 + 2] = 1.0; // White
      } else if (colorVal < 0.85) {
        starsColors[i * 3] = 0.5; starsColors[i * 3 + 1] = 0.8; starsColors[i * 3 + 2] = 1.0; // Ice Cyan Blue
      } else {
        starsColors[i * 3] = 1.0; starsColors[i * 3 + 1] = 0.7; starsColors[i * 3 + 2] = 0.4; // Sun Amber
      }
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute("color", new THREE.BufferAttribute(starsColors, 3));

    const starCanvas = document.createElement("canvas");
    starCanvas.width = 16;
    starCanvas.height = 16;
    const starCtx = starCanvas.getContext("2d");
    if (starCtx) {
      const grad = starCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      starCtx.fillStyle = grad;
      starCtx.fillRect(0, 0, 16, 16);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starsMaterial = new THREE.PointsMaterial({
      size: 40,
      map: starTexture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // 6. Accretion Swirling Nebulae clouds
    const nebulaGroup = new THREE.Group();
    const nebulaColors = [0x4c1d95, 0x1d4ed8, 0x9f1239, 0xca8a04];
    nebulaColors.forEach((color, idx) => {
      const geometry = new THREE.BoxGeometry(4500, 300, 4500);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.04,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const cloud = new THREE.Mesh(geometry, material);
      cloud.position.set(
        (idx - 1.5) * 8500 + (Math.random() - 0.5) * 3000,
        (Math.random() - 0.5) * 1500,
        (idx - 1.5) * 7000 + (Math.random() - 0.5) * 3000
      );
      cloud.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      nebulaGroup.add(cloud);
    });
    scene.add(nebulaGroup);

    // 7. Central Body: Glowing SUN / NEUTRON / GIANT / DWARF
    let sunRadius = 450;
    if (currentSystem.starType === "Red Dwarf") sunRadius = 250;
    else if (currentSystem.starType === "Blue Giant") sunRadius = 800;
    else if (currentSystem.starType === "White Dwarf") sunRadius = 100;
    else if (currentSystem.starType === "Neutron Star") sunRadius = 140;

    const sunGeom = new THREE.SphereGeometry(sunRadius, 64, 64);
    const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(starColorHex) });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);

    // Sun Plasma Corona
    const coronaGeom = new THREE.SphereGeometry(sunRadius * 1.45, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(starColorHex),
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const corona = new THREE.Mesh(coronaGeom, coronaMat);
    scene.add(corona);

    // Spinning Pulsar Beams for Neutron Stars
    let pulsarLeftBeam: THREE.Mesh | undefined;
    let pulsarRightBeam: THREE.Mesh | undefined;
    if (currentSystem.starType === "Neutron Star") {
      const beamGeom = new THREE.CylinderGeometry(20, 95, 14000, 16);
      beamGeom.translate(0, 7000, 0); // translate pivot to base
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      pulsarLeftBeam = new THREE.Mesh(beamGeom, beamMat);
      pulsarLeftBeam.position.set(0, 0, 0);
      scene.add(pulsarLeftBeam);

      pulsarRightBeam = pulsarLeftBeam.clone();
      pulsarRightBeam.rotation.z = Math.PI; // point opposite
      scene.add(pulsarRightBeam);
    }

    // 8. Planets & Moon Setup
    const planetMeshes: {
      id: string;
      mesh: THREE.Mesh;
      config: PlanetConfig;
      ring?: THREE.Mesh;
    }[] = [];

    const orbitLinesGroup = new THREE.Group();
    scene.add(orbitLinesGroup);

    currentSystem.planets.forEach((config) => {
      const geom = new THREE.SphereGeometry(config.radius, 64, 64);
      
      const planetCanvas = document.createElement("canvas");
      planetCanvas.width = 512;
      planetCanvas.height = 256;
      const pCtx = planetCanvas.getContext("2d");
      if (pCtx) {
        const grad = pCtx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, config.color);
        grad.addColorStop(0.3, "#090d16"); // rich dark band
        grad.addColorStop(0.5, config.color);
        grad.addColorStop(0.7, "#1f2937");
        grad.addColorStop(1, config.color);
        pCtx.fillStyle = grad;
        pCtx.fillRect(0, 0, 512, 256);

        // Noise surface details
        pCtx.fillStyle = "rgba(255,255,255,0.06)";
        for (let j = 0; j < 50; j++) {
          pCtx.fillRect(0, Math.random() * 256, 512, Math.random() * 8);
        }
      }
      const planetTexture = new THREE.CanvasTexture(planetCanvas);

      const mat = new THREE.MeshStandardMaterial({
        map: planetTexture,
        roughness: 0.6,
        metalness: 0.1,
        emissive: new THREE.Color(config.color),
        emissiveIntensity: 0.2,
      });

      const planetMesh = new THREE.Mesh(geom, mat);
      planetMesh.castShadow = true;
      planetMesh.receiveShadow = true;

      // Atmospheric Glow Ring
      const atmGeom = new THREE.SphereGeometry(config.radius * 1.15, 32, 32);
      const atmMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(config.color),
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      });
      const atmMesh = new THREE.Mesh(atmGeom, atmMat);
      planetMesh.add(atmMesh);

      // Rings
      let ringMesh: THREE.Mesh | undefined;
      if (config.hasRing && config.ringInnerRadius && config.ringOuterRadius) {
        const ringGeom = new THREE.RingGeometry(config.ringInnerRadius, config.ringOuterRadius, 64);
        
        const ringCanvas = document.createElement("canvas");
        ringCanvas.width = 256;
        ringCanvas.height = 16;
        const rCtx = ringCanvas.getContext("2d");
        if (rCtx) {
          const grad = rCtx.createLinearGradient(0, 0, 256, 0);
          grad.addColorStop(0, "rgba(255, 255, 255, 0)");
          grad.addColorStop(0.3, config.ringColor || "#ffffff");
          grad.addColorStop(0.7, "rgba(255, 255, 255, 0.35)");
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
          rCtx.fillStyle = grad;
          rCtx.fillRect(0, 0, 256, 16);
        }
        const ringTex = new THREE.CanvasTexture(ringCanvas);

        const ringMat = new THREE.MeshStandardMaterial({
          map: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
          roughness: 0.9,
        });

        ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 2.2;
        planetMesh.add(ringMesh);
      }

      scene.add(planetMesh);
      planetMeshes.push({ id: config.id, mesh: planetMesh, config, ring: ringMesh });

      // Orbit tracks
      const orbitPoints: THREE.Vector3[] = [];
      const orbitSegments = 128;
      for (let j = 0; j <= orbitSegments; j++) {
        const angle = (j / orbitSegments) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(Math.cos(angle) * config.orbitRadius, 0, Math.sin(angle) * config.orbitRadius));
      }
      const orbitTrackGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitTrackMat = new THREE.LineBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.18,
      });
      const orbitTrack = new THREE.Line(orbitTrackGeom, orbitTrackMat);
      orbitLinesGroup.add(orbitTrack);
    });

    // Selene Moon orbiting Verdant
    const moonGeom = new THREE.SphereGeometry(30, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.95 });
    const moonMesh = new THREE.Mesh(moonGeom, moonMat);
    scene.add(moonMesh);

    // 9. Floating Space Dust Particles
    const dustCount = 350;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i++) {
      dustPositions[i] = (Math.random() - 0.5) * 1500;
    }
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x0ea5e9,
      size: 5,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spaceDustPoints = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(spaceDustPoints);

    // 10. Asteroid Belt (InstancedMesh, 800 chunks)
    const asteroidCount = 800;
    const asteroidMinRadius = 6600;
    const asteroidMaxRadius = 7900;

    const asteroidGeom = new THREE.DodecahedronGeometry(25, 1);
    const posAttribute = asteroidGeom.attributes.position;
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < posAttribute.count; i++) {
      tempVec.fromBufferAttribute(posAttribute, i);
      tempVec.multiplyScalar(0.7 + Math.random() * 0.55); // deform rock chunks
      posAttribute.setXYZ(i, tempVec.x, tempVec.y, tempVec.z);
    }
    asteroidGeom.computeVertexNormals();

    const asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.95,
      metalness: 0.15,
    });

    const asteroidBeltMesh = new THREE.InstancedMesh(asteroidGeom, asteroidMat, asteroidCount);
    scene.add(asteroidBeltMesh);

    const asteroidData: {
      orbitRadius: number;
      speed: number;
      angle: number;
      rotX: number;
      rotY: number;
      rotZ: number;
      scale: number;
      size: number;
      destroyed: boolean;
    }[] = [];

    const dummyMatrix = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const dummyRot = new THREE.Euler();
    const dummyScale = new THREE.Vector3();

    for (let i = 0; i < asteroidCount; i++) {
      const radius = asteroidMinRadius + Math.random() * (asteroidMaxRadius - asteroidMinRadius);
      const speed = 0.015 + Math.random() * 0.025;
      const angle = Math.random() * Math.PI * 2;
      const rotX = Math.random() * 0.015;
      const rotY = Math.random() * 0.015;
      const rotZ = Math.random() * 0.015;
      const scale = 0.35 + Math.random() * 0.85;

      asteroidData.push({
        orbitRadius: radius,
        speed,
        angle,
        rotX,
        rotY,
        rotZ,
        scale,
        size: 25 * scale,
        destroyed: false,
      });

      dummyPos.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 110, Math.sin(angle) * radius);
      dummyRot.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      dummyScale.set(scale, scale, scale);

      dummyMatrix.compose(dummyPos, new THREE.Quaternion().setFromEuler(dummyRot), dummyScale);
      asteroidBeltMesh.setMatrixAt(i, dummyMatrix);
    }
    asteroidBeltMesh.instanceMatrix.needsUpdate = true;

    // 11. CELESTIAL ANOMALIES & STRUCTURES
    const bhPosition = new THREE.Vector3(12000, 0, -12000);
    let diskMesh: THREE.Mesh | undefined;
    let diskMesh2: THREE.Mesh | undefined;
    
    // Conditionally spawn Black Hole
    if (currentSystem.hasBlackHole) {
      // Singular core (absolute matte black)
      const bhCoreGeom = new THREE.SphereGeometry(150, 32, 32);
      const bhCoreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const bhCoreMesh = new THREE.Mesh(bhCoreGeom, bhCoreMat);
      bhCoreMesh.position.copy(bhPosition);
      scene.add(bhCoreMesh);

      // Glowing accretion disk
      const diskGeom = new THREE.RingGeometry(160, 480, 64);
      const diskCanvas = document.createElement("canvas");
      diskCanvas.width = 256;
      diskCanvas.height = 16;
      const dCtx = diskCanvas.getContext("2d");
      if (dCtx) {
        const grad = dCtx.createLinearGradient(0, 0, 256, 0);
        grad.addColorStop(0, "rgba(139, 92, 246, 0.95)"); // violet event horizon
        grad.addColorStop(0.35, "rgba(244, 63, 94, 0.75)"); // pink
        grad.addColorStop(0.7, "rgba(249, 115, 22, 0.45)"); // orange
        grad.addColorStop(1, "rgba(0,0,0,0)");
        dCtx.fillStyle = grad;
        dCtx.fillRect(0, 0, 256, 16);
      }
      const diskTex = new THREE.CanvasTexture(diskCanvas);
      const diskMat = new THREE.MeshBasicMaterial({
        map: diskTex,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      diskMesh = new THREE.Mesh(diskGeom, diskMat);
      diskMesh.position.copy(bhPosition);
      diskMesh.rotation.x = Math.PI / 2;
      scene.add(diskMesh);

      // Tilted secondary accretion ring for iconic 3D spherical gravitational lensing wrapping
      diskMesh2 = new THREE.Mesh(diskGeom, diskMat);
      diskMesh2.position.copy(bhPosition);
      diskMesh2.rotation.x = Math.PI / 4;
      diskMesh2.rotation.y = Math.PI / 6;
      scene.add(diskMesh2);

      // Intense light cast near Black Hole singularity
      const bhLight = new THREE.PointLight(0x8b5cf6, 4.0, 5000, 0.4);
      bhLight.position.copy(bhPosition);
      scene.add(bhLight);
    }

    // Conditionally spawn Wormholes
    let wormholeMesh: THREE.Mesh | undefined;
    if (currentSystem.hasWormhole) {
      const whGeom = new THREE.TorusGeometry(180, 25, 16, 64);
      const whCanvas = document.createElement("canvas");
      whCanvas.width = 128;
      whCanvas.height = 16;
      const whCtx = whCanvas.getContext("2d");
      if (whCtx) {
        const grad = whCtx.createLinearGradient(0, 0, 128, 0);
        grad.addColorStop(0, "rgba(236, 72, 153, 0.95)"); // pink-500
        grad.addColorStop(0.5, "rgba(168, 85, 247, 0.75)"); // purple-500
        grad.addColorStop(1, "rgba(236, 72, 153, 0)");
        whCtx.fillStyle = grad;
        whCtx.fillRect(0, 0, 128, 16);
      }
      const whTex = new THREE.CanvasTexture(whCanvas);
      const whMat = new THREE.MeshBasicMaterial({
        map: whTex,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      wormholeMesh = new THREE.Mesh(whGeom, whMat);
      wormholeMesh.position.set(0, 300, -9000);
      scene.add(wormholeMesh);

      // Light source
      const whLight = new THREE.PointLight(0xec4899, 2.5, 3000, 0.25);
      whLight.position.set(0, 300, -9000);
      scene.add(whLight);
    }

    // Conditionally spawn orbital Space Outposts / Stations
    let stationGroup: THREE.Group | undefined;
    let stationHabitatRing: THREE.Mesh | undefined;
    if (currentSystem.hasSpaceStation) {
      stationGroup = new THREE.Group();
      stationGroup.position.set(3000, 150, 3000);

      // Central core
      const stCoreGeom = new THREE.CylinderGeometry(45, 45, 300, 16);
      stCoreGeom.rotateX(Math.PI / 2);
      const stCoreMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.25 });
      const stCoreMesh = new THREE.Mesh(stCoreGeom, stCoreMat);
      stationGroup.add(stCoreMesh);

      // Rotating habitat ring
      const stRingGeom = new THREE.TorusGeometry(170, 16, 16, 64);
      const stRingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.15 });
      stationHabitatRing = new THREE.Mesh(stRingGeom, stRingMat);
      stationGroup.add(stationHabitatRing);

      // Cross trusses
      for (let i = 0; i < 4; i++) {
        const trussGeom = new THREE.CylinderGeometry(6, 6, 170, 8);
        trussGeom.rotateZ((i * Math.PI) / 4);
        const trussMesh = new THREE.Mesh(trussGeom, stCoreMat);
        stationGroup.add(trussMesh);
      }

      // Solar arrays
      const panelGeom = new THREE.BoxGeometry(220, 1, 45);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0369a1, metalness: 0.9, roughness: 0.1 });
      const panel1 = new THREE.Mesh(panelGeom, panelMat);
      panel1.position.set(0, 120, 0);
      stationGroup.add(panel1);

      const panel2 = panel1.clone();
      panel2.position.set(0, -120, 0);
      stationGroup.add(panel2);

      // Beacon lights
      const beaconGeom = new THREE.SphereGeometry(6, 8, 8);
      const beaconMatRed = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const beaconMatGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e });

      const beaconR = new THREE.Mesh(beaconGeom, beaconMatRed);
      beaconR.position.set(-60, 0, 160);
      stationGroup.add(beaconR);

      const beaconG = new THREE.Mesh(beaconGeom, beaconMatGreen);
      beaconG.position.set(60, 0, 160);
      stationGroup.add(beaconG);

      scene.add(stationGroup);
    }

    // 11.5 CINEMATIC MAIN MENU BACKGROUND ASSETS
    const galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(-6000, -2000, -15000);
    scene.add(galaxyGroup);
    
    const galaxyParticlesCount = 1800;
    const galaxyGeometry = new THREE.BufferGeometry();
    const galaxyPositions = new Float32Array(galaxyParticlesCount * 3);
    const galaxyColors = new Float32Array(galaxyParticlesCount * 3);
    
    for (let i = 0; i < galaxyParticlesCount; i++) {
      const arm = i % 2 === 0 ? 0 : Math.PI;
      const r = Math.random() * 4500 + 100;
      const theta = (r / 4500) * 2.8 * Math.PI + arm + (Math.random() - 0.5) * 0.45;
      
      galaxyPositions[i * 3] = r * Math.cos(theta);
      galaxyPositions[i * 3 + 1] = (Math.random() - 0.5) * 400;
      galaxyPositions[i * 3 + 2] = r * Math.sin(theta);
      
      const coreFactor = r / 4500;
      if (coreFactor < 0.22) {
        galaxyColors[i * 3] = 1.0;
        galaxyColors[i * 3 + 1] = 0.95;
        galaxyColors[i * 3 + 2] = 0.8;
      } else if (coreFactor < 0.65) {
        galaxyColors[i * 3] = 0.35;
        galaxyColors[i * 3 + 1] = 0.7;
        galaxyColors[i * 3 + 2] = 1.0;
      } else {
        galaxyColors[i * 3] = 0.75;
        galaxyColors[i * 3 + 1] = 0.3;
        galaxyColors[i * 3 + 2] = 1.0;
      }
    }
    galaxyGeometry.setAttribute("position", new THREE.BufferAttribute(galaxyPositions, 3));
    galaxyGeometry.setAttribute("color", new THREE.BufferAttribute(galaxyColors, 3));
    
    const galaxyMaterial = new THREE.PointsMaterial({
      size: 55,
      map: starTexture,
      transparent: true,
      opacity: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const galaxyPoints = new THREE.Points(galaxyGeometry, galaxyMaterial);
    galaxyGroup.add(galaxyPoints);

    const distantSunGroup = new THREE.Group();
    distantSunGroup.position.set(-18000, 3500, -22000);
    const distantSunGeom = new THREE.SphereGeometry(60, 16, 16);
    const distantSunMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const distantSun = new THREE.Mesh(distantSunGeom, distantSunMat);
    distantSunGroup.add(distantSun);
    
    const distantSunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(180, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.BackSide })
    );
    distantSunGroup.add(distantSunGlow);
    scene.add(distantSunGroup);

    const satelliteMeshes: {
      mesh: THREE.Group;
      planetId: string;
      angle: number;
      radius: number;
      speed: number;
    }[] = [];
    
    planetMeshes.forEach((pm) => {
      const satGroup = new THREE.Group();
      
      const satBody = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
      );
      satBody.rotation.x = Math.PI / 2;
      satGroup.add(satBody);
      
      const wingGeom = new THREE.BoxGeometry(9, 0.25, 2.5);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0369a1, metalness: 0.85, roughness: 0.1 });
      const wing = new THREE.Mesh(wingGeom, wingMat);
      satGroup.add(wing);
      
      scene.add(satGroup);
      
      satelliteMeshes.push({
        mesh: satGroup,
        planetId: pm.id,
        angle: Math.random() * Math.PI * 2,
        radius: pm.config.radius * 1.45,
        speed: 0.12 + Math.random() * 0.08,
      });
    });

    const cinematicShip = new THREE.Group();
    const cBody = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.2 })
    );
    cBody.rotateX(Math.PI / 2);
    cinematicShip.add(cBody);
    
    const cFlame = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 5, 8),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    cFlame.rotateX(-Math.PI / 2);
    cFlame.position.set(0, 0, 7.5);
    cinematicShip.add(cFlame);
    scene.add(cinematicShip);
    
    let cinematicShipTimer = 0;
    let cinematicShipActive = false;
    const cinematicShipStart = new THREE.Vector3();
    const cinematicShipEnd = new THREE.Vector3();
    let cinematicShipProgress = 0;

    const shootingStarGeom = new THREE.BufferGeometry();
    const shootingStarPos = new Float32Array([0, 0, 0, -25, -12, -25]);
    shootingStarGeom.setAttribute("position", new THREE.BufferAttribute(shootingStarPos, 3));
    const shootingStarMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const shootingStarLine = new THREE.Line(shootingStarGeom, shootingStarMat);
    scene.add(shootingStarLine);
    
    let shootingStarTimer = 0;
    let shootingStarActive = false;
    const shootingStarStart = new THREE.Vector3();
    const shootingStarDir = new THREE.Vector3();
    const shootingStarSpeed = 3800;
    let shootingStarDuration = 0;

    const menuAsteroidsGroup = new THREE.Group();
    scene.add(menuAsteroidsGroup);
    const menuAsteroidMeshes: THREE.Mesh[] = [];
    const menuAsteroidSpeeds: THREE.Vector3[] = [];
    const menuAsteroidRots: THREE.Vector3[] = [];
    
    for (let i = 0; i < 12; i++) {
      const rockGeom = new THREE.DodecahedronGeometry(7 + Math.random() * 10, 1);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        roughness: 0.9,
        metalness: 0.15,
      });
      const rock = new THREE.Mesh(rockGeom, rockMat);
      
      rock.position.set(
        3400 + (Math.random() - 0.5) * 2400,
        180 + (Math.random() - 0.5) * 350,
        4000 + (Math.random() - 0.5) * 2400
      );
      menuAsteroidsGroup.add(rock);
      menuAsteroidMeshes.push(rock);
      
      menuAsteroidSpeeds.push(new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 8
      ));
      menuAsteroidRots.push(new THREE.Vector3(
        Math.random() * 0.18,
        Math.random() * 0.18,
        Math.random() * 0.18
      ));
    }

    const sunGlowGeom = new THREE.SphereGeometry(450, 32, 32);
    const sunGlowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(starColorHex),
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sunGlow = new THREE.Mesh(sunGlowGeom, sunGlowMat);
    scene.add(sunGlow);

    // 12. STARSHIP visual components
    const shipGroup = new THREE.Group();
    scene.add(shipGroup);
    shipGroupRef.current = shipGroup;

    // Custom hull material
    const hullMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hullColor),
      metalness: 0.85,
      roughness: 0.18,
    });

    const engineMat = new THREE.MeshStandardMaterial({ color: 0x24252a, metalness: 0.9, roughness: 0.1 });
    const canopyMat = new THREE.MeshPhysicalMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.65, roughness: 0.05, transmission: 0.85 });

    // Cockpit cabin cone
    const cabinGeom = new THREE.ConeGeometry(8, 28, 8);
    cabinGeom.rotateX(Math.PI / 2);
    const cabinMesh = new THREE.Mesh(cabinGeom, hullMat);
    shipGroup.add(cabinMesh);

    // Strong outline / rim light mesh using BackSide material for extreme visibility
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.45
    });

    const cabinOutline = new THREE.Mesh(cabinGeom, outlineMat);
    cabinOutline.scale.set(1.05, 1.05, 1.05);
    shipGroup.add(cabinOutline);

    // Windscreens
    const glassGeom = new THREE.SphereGeometry(5.2, 16, 16);
    glassGeom.scale(1, 0.7, 1.8);
    const glassMesh = new THREE.Mesh(glassGeom, canopyMat);
    glassMesh.position.set(0, 2.5, -4.5);
    shipGroup.add(glassMesh);

    // Wing arrays
    const leftWingGeom = new THREE.BoxGeometry(16, 1, 11);
    const leftWingMesh = new THREE.Mesh(leftWingGeom, hullMat);
    leftWingMesh.position.set(-10, -0.6, 2.5);
    leftWingMesh.rotation.z = 0.12;
    leftWingMesh.rotation.y = -0.12;
    shipGroup.add(leftWingMesh);

    const leftWingOutline = new THREE.Mesh(leftWingGeom, outlineMat);
    leftWingOutline.position.set(-10, -0.6, 2.5);
    leftWingOutline.rotation.z = 0.12;
    leftWingOutline.rotation.y = -0.12;
    leftWingOutline.scale.set(1.04, 1.04, 1.04);
    shipGroup.add(leftWingOutline);

    const rightWingMesh = leftWingMesh.clone();
    rightWingMesh.position.x = 10;
    rightWingMesh.rotation.z = -0.12;
    rightWingMesh.rotation.y = 0.12;
    shipGroup.add(rightWingMesh);

    const rightWingOutline = leftWingOutline.clone();
    rightWingOutline.position.x = 10;
    rightWingOutline.rotation.z = -0.12;
    rightWingOutline.rotation.y = 0.12;
    shipGroup.add(rightWingOutline);

    // Exhaust thrust tubes
    const tubeL = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 9, 8), engineMat);
    tubeL.rotateX(Math.PI / 2);
    tubeL.position.set(-4, -0.8, 12);
    shipGroup.add(tubeL);

    const tubeR = tubeL.clone();
    tubeR.position.x = 4;
    shipGroup.add(tubeR);

    // Glowing flame basic cones - cyan blue neon
    const exhaustGeom = new THREE.ConeGeometry(2.4, 10, 8);
    exhaustGeom.rotateX(-Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    
    const flameL = new THREE.Mesh(exhaustGeom, exhaustMat);
    flameL.position.set(-4, -0.8, 16.5);
    shipGroup.add(flameL);

    const flameR = new THREE.Mesh(exhaustGeom, exhaustMat);
    flameR.position.set(4, -0.8, 16.5);
    shipGroup.add(flameR);

    // Engine point light
    const engineLight = new THREE.PointLight(0x0ea5e9, 6.0, 50, 0.4);
    engineLight.position.set(0, -0.8, 13);
    shipGroup.add(engineLight);

    // Set loaded or start position of spaceship
    shipGroup.position.set(playerPos[0], playerPos[1], playerPos[2]);

    const velocity = new THREE.Vector3(0, 0, -25);
    const direction = new THREE.Vector3(0, 0, -1);

    // 13. HOSTILE CONTACTS (Enemies)
    const enemies: {
      id: string;
      name: string;
      classType: "Scout" | "Fighter" | "Heavy Cruiser";
      health: number;
      maxHealth: number;
      shield: number;
      maxShield: number;
      position: THREE.Vector3;
      mesh: THREE.Group;
      patrolPlanetId: string;
      patrolAngle: number;
      patrolRadius: number;
      fireCooldown: number;
      isDamagedFlash: number; // timer for damage hits
    }[] = [];

    const createEnemyVisualMesh = (classType: "Scout" | "Fighter" | "Heavy Cruiser", coreColor: number) => {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: coreColor, metalness: 0.85, roughness: 0.22 });
      
      // Let's make a super vibrant, emissive red engine material for the enemy
      const engineMat = new THREE.MeshBasicMaterial({ color: 0xff1e56, transparent: true, opacity: 0.95 });

      // Create a gorgeous glowing red outline material using BackSide
      const redOutlineMat = new THREE.MeshBasicMaterial({
        color: 0xff1e56,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.45
      });

      if (classType === "Scout") {
        // Swift Scout Needleship
        const body = new THREE.Mesh(new THREE.ConeGeometry(5, 17, 4), bodyMat);
        body.rotateX(Math.PI / 2);
        group.add(body);

        const bodyOutline = new THREE.Mesh(new THREE.ConeGeometry(5, 17, 4), redOutlineMat);
        bodyOutline.rotateX(Math.PI / 2);
        bodyOutline.scale.set(1.08, 1.08, 1.08);
        group.add(bodyOutline);

        const wingL = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 4.5), bodyMat);
        wingL.position.set(-6, -0.2, 1);
        group.add(wingL);
        const wingR = wingL.clone();
        wingR.position.x = 6;
        group.add(wingR);

        // Glowing Engine Flame
        const flameGeom = new THREE.ConeGeometry(1.6, 7, 8);
        flameGeom.rotateX(-Math.PI / 2);
        const eFlame = new THREE.Mesh(flameGeom, new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
        eFlame.position.set(0, 0, 9.5);
        group.add(eFlame);

        // Scale up silhouette
        group.scale.set(1.22, 1.22, 1.22);

      } else if (classType === "Fighter") {
        // Standard Strike Fighter
        const cabin = new THREE.Mesh(new THREE.ConeGeometry(6, 21, 6), bodyMat);
        cabin.rotateX(Math.PI / 2);
        group.add(cabin);

        const cabinOutline = new THREE.Mesh(new THREE.ConeGeometry(6, 21, 6), redOutlineMat);
        cabinOutline.rotateX(Math.PI / 2);
        cabinOutline.scale.set(1.07, 1.07, 1.07);
        group.add(cabinOutline);

        const wingL = new THREE.Mesh(new THREE.BoxGeometry(15, 0.8, 7.5), bodyMat);
        wingL.position.set(-8.5, 0, 1.5);
        wingL.rotation.y = -0.15;
        group.add(wingL);
        const wingR = wingL.clone();
        wingR.position.x = 8.5;
        wingR.rotation.y = 0.15;
        group.add(wingR);

        const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 8), engineMat);
        jet.rotateX(Math.PI / 2);
        jet.position.set(0, 0, 10);
        group.add(jet);

        // Glowing Engine Flame
        const flameGeom = new THREE.ConeGeometry(2.2, 9, 8);
        flameGeom.rotateX(-Math.PI / 2);
        const eFlame = new THREE.Mesh(flameGeom, new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
        eFlame.position.set(0, 0, 14.5);
        group.add(eFlame);

        // Scale up silhouette
        group.scale.set(1.25, 1.25, 1.25);

      } else {
        // Large Heavy Dreadnought Cruiser
        const body = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 48), bodyMat);
        group.add(body);

        const bodyOutline = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 48), redOutlineMat);
        bodyOutline.scale.set(1.05, 1.05, 1.05);
        group.add(bodyOutline);

        const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16), new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.9 }));
        dome.position.set(0, 9, 3);
        group.add(dome);

        const podL = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 25), bodyMat);
        podL.position.set(-13, -2, -4);
        group.add(podL);

        const podR = podL.clone();
        podR.position.x = 13;
        group.add(podR);

        const jetL = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), engineMat);
        jetL.position.set(-6, 0, 24.5);
        group.add(jetL);
        const jetR = jetL.clone();
        jetR.position.x = 6;
        group.add(jetR);

        // Glowing Engine Flames
        const flameGeom = new THREE.ConeGeometry(3.0, 13, 8);
        flameGeom.rotateX(-Math.PI / 2);
        
        const eFlameL = new THREE.Mesh(flameGeom, new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
        eFlameL.position.set(-6, 0, 31);
        group.add(eFlameL);

        const eFlameR = eFlameL.clone();
        eFlameR.position.x = 6;
        group.add(eFlameR);

        // Scale up silhouette
        group.scale.set(1.3, 1.3, 1.3);
      }

      // Add a PointLight inside each enemy to cast a red engine glow
      const redLight = new THREE.PointLight(0xff1e56, 4.5, 45, 0.4);
      redLight.position.set(0, 0, 12);
      group.add(redLight);

      return group;
    };

    // Spawn 5 persistent star patrols orbiting different sectors
    const enemiesConfiguration = [
      { id: "e1", name: "Outlaw Raider Scout", type: "Scout" as const, planetId: "aurelia", radius: 800, color: 0xe11d48 },
      { id: "e2", name: "Eclipse Syndicate Fighter", type: "Fighter" as const, planetId: "verdant", radius: 1100, color: 0x9d174d },
      { id: "e3", name: "Rogue Marauder Interceptor", type: "Fighter" as const, planetId: "zephyr", radius: 1400, color: 0x701a75 },
      { id: "e4", name: "Apex Hegemony dreadnought", type: "Heavy Cruiser" as const, planetId: "kryos", radius: 1700, color: 0x1e3a8a },
      { id: "e5", name: "Void-Fire capital Cruiser", type: "Heavy Cruiser" as const, planetId: "ignis", radius: 1800, color: 0x7c2d12 },
    ];

    enemiesConfiguration.forEach((cfg) => {
      const eMesh = createEnemyVisualMesh(cfg.type, cfg.color);
      scene.add(eMesh);
      
      const planetObj = planetMeshes.find(p => p.id === cfg.planetId);
      const startPos = new THREE.Vector3(0, 100, 0);
      if (planetObj) {
        startPos.copy(planetObj.mesh.position).add(new THREE.Vector3(cfg.radius, 100, 0));
      }

      enemies.push({
        id: cfg.id,
        name: cfg.name,
        classType: cfg.type,
        health: cfg.type === "Scout" ? 50 : cfg.type === "Fighter" ? 100 : 250,
        maxHealth: cfg.type === "Scout" ? 50 : cfg.type === "Fighter" ? 100 : 250,
        shield: cfg.type === "Scout" ? 30 : cfg.type === "Fighter" ? 70 : 180,
        maxShield: cfg.type === "Scout" ? 30 : cfg.type === "Fighter" ? 70 : 180,
        position: startPos,
        mesh: eMesh,
        patrolPlanetId: cfg.planetId,
        patrolAngle: Math.random() * Math.PI * 2,
        patrolRadius: cfg.radius,
        fireCooldown: 0,
        isDamagedFlash: 0,
      });
    });

    // 14. PLAYER COMBAT PROJECTILES
    // Active flying missiles list
    const activeMissiles: {
      mesh: THREE.Mesh;
      position: THREE.Vector3;
      direction: THREE.Vector3;
      lifetime: number;
      targetEnemyId: string | null;
    }[] = [];

    // Particle explosions pool
    const particlesPool: {
      points: THREE.Points;
      positions: Float32Array;
      velocities: Float32Array;
      lifetime: number;
    }[] = [];

    const createExplosion = (pos: THREE.Vector3, color: number, count = 45, size = 15) => {
      const pGeom = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);

      for (let j = 0; j < count; j++) {
        positions[j * 3] = pos.x;
        positions[j * 3 + 1] = pos.y;
        positions[j * 3 + 2] = pos.z;

        // Spherical explosion vector
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 150 + Math.random() * 280;

        velocities[j * 3] = speed * Math.sin(phi) * Math.cos(theta);
        velocities[j * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
        velocities[j * 3 + 2] = speed * Math.cos(phi);
      }

      pGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pMat = new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(pGeom, pMat);
      scene.add(points);

      particlesPool.push({ points, positions, velocities, lifetime: 0.65 });
    };

    // 15. COLLECTIBLE FLOATING PICKUPS
    const pickups: {
      id: string;
      type: "shield" | "health" | "fuel" | "credits";
      mesh: THREE.Mesh;
      position: THREE.Vector3;
    }[] = [];

    const spawnPickup = (pos: THREE.Vector3) => {
      const types = ["shield", "health", "fuel", "credits"] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      
      const geom = new THREE.DodecahedronGeometry(10);
      const color = type === "shield" ? 0x06b6d4 : // cyan
                    type === "health" ? 0x10b981 : // emerald
                    type === "fuel" ? 0xec4899 : 0xeab308; // pink Energy Cell, gold credits
                    
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, wireframe: true });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      
      pickups.push({ id: Math.random().toString(), type, mesh, position: new THREE.Vector3().copy(pos) });
    };

    // 16. MOUSE CLICK COMBAT TRIGGERS
    const handleMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== "Playing" || statsRef.current.isLanded) return;
      if (e.button === 0) {
        fireLaser();
      } else if (e.button === 2) {
        fireMissile();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // prevent default browser right click menu
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("contextmenu", handleContextMenu);

    const addFloatingDamage = (enemyPos: THREE.Vector3, amount: number) => {
      if (!camera) return;
      const temp = new THREE.Vector3().copy(enemyPos).project(camera);
      const x = (temp.x * (window.innerWidth / 2)) + (window.innerWidth / 2);
      const y = -(temp.y * (window.innerHeight / 2)) + (window.innerHeight / 2);
      
      setHitMarkerActive(true);
      if (hitMarkerTimeoutRef.current) clearTimeout(hitMarkerTimeoutRef.current);
      hitMarkerTimeoutRef.current = setTimeout(() => {
        setHitMarkerActive(false);
      }, 120);

      const newDmg = {
        id: Math.random().toString(),
        amount: Math.round(amount),
        x: x + (Math.random() - 0.5) * 45,
        y: y + (Math.random() - 0.5) * 45
      };
      setDamageNumbers(prev => [...prev, newDmg]);
      setTimeout(() => {
        setDamageNumbers(prev => prev.filter(d => d.id !== newDmg.id));
      }, 750);
    };

    const damageEnemy = (enemy: typeof enemies[0], amount: number) => {
      enemy.isDamagedFlash = 0.12; // trigger rapid red hit flash
      
      // Project the damage text
      addFloatingDamage(enemy.position, amount);

      // Damage shields first
      if (enemy.shield > 0) {
        enemy.shield = Math.max(0, enemy.shield - amount);
        createExplosion(enemy.position, 0x06b6d4, 15, 6); // cyan hit particles
        audioEngine.playShieldHit();
      } else {
        enemy.health = Math.max(0, enemy.health - amount);
        createExplosion(enemy.position, 0xf97316, 20, 8); // orange fiery hit particles
        audioEngine.playCollision();
      }

      if (enemy.health <= 0) {
        // Contact completely eliminated!
        createExplosion(enemy.position, 0xff3f00, 50, 20); // massive orange blast
        audioEngine.playExplosion();
        scene.remove(enemy.mesh);

        // Spawn gold/health pickups at wreck site
        spawnPickup(enemy.position);
        if (Math.random() < 0.5) spawnPickup(enemy.position);

        addLog(`CONTACT VAPORIZED: ${enemy.name} destroyed. Received salvages!`, "success");

        // Reward Pilot XP / Credits
        const earned = enemy.classType === "Scout" ? 150 : enemy.classType === "Fighter" ? 300 : 750;
        setStats((prev) => {
          let nextCredits = prev.credits + earned;
          let nextScore = prev.score + earned * 1.5;
          let nextMission = prev.activeMission;

          if (nextMission && nextMission.type === "pirate_hunt") {
            const currentKills = Math.round(nextMission.progress * 3) + 1;
            const newProgress = currentKills / 3;
            
            if (currentKills >= 3) {
              nextCredits += nextMission.rewardCredits;
              nextScore += nextMission.rewardScore;
              nextMission = null;
              setTimeout(() => {
                audioEngine.playRefuel();
                addLog("MISSION COMPLETED: 3x Zorax Cartel scouts neutralized. Coalition bounty received!", "success");
              }, 100);
            } else {
              nextMission = {
                ...nextMission,
                progress: newProgress,
                objective: `Eliminate 3 pirate vessels (Progress: ${currentKills} / 3)`
              };
              setTimeout(() => {
                addLog(`MISSION PROGRESS UPDATE: Pirate hunt: ${currentKills}/3. Scan local coordinates.`, "warning");
              }, 100);
            }
          }

          return {
            ...prev,
            credits: nextCredits,
            score: nextScore,
            activeMission: nextMission
          };
        });

        // Remove from list
        const idx = enemies.findIndex(e => e.id === enemy.id);
        if (idx !== -1) enemies.splice(idx, 1);
      }
    };

    const fireLaser = () => {
      if (laserCooldownRef.current > 0) return;
      
      // Energy Core Check
      if (statsRef.current.fuel < 5) {
        audioEngine.playRefuel(); // error sound
        addLog("WEAPONS WARNING: Energy Core fully depleted! Lasers offline.", "danger");
        return;
      }

      // Deduct energy
      setStats((prev) => ({ ...prev, fuel: Math.max(0, prev.fuel - 5) }));

      audioEngine.playLaser();
      setLaserCooldown(30);

      // 1. Calculate hit enemy FIRST within a 15-degree cone (0.26 radians) of flight direction
      let hitEnemy: typeof enemies[0] | null = null;
      let minHitDist = 2000;

      enemies.forEach((enemy) => {
        const toEnemy = new THREE.Vector3().subVectors(enemy.position, shipGroup.position);
        const dist = toEnemy.length();
        if (dist < 2000) {
          const angle = direction.angleTo(toEnemy.normalize());
          if (angle < 0.26) { // 15-degree cone
            if (dist < minHitDist) {
              minHitDist = dist;
              hitEnemy = enemy;
            }
          }
        }
      });

      // 2. Render dynamic cyan cylinder laser beam lines
      const beamLength = hitEnemy ? minHitDist : 1500;
      const beamGeom = new THREE.CylinderGeometry(0.8, 0.8, beamLength, 8);
      beamGeom.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
      const beamMesh = new THREE.Mesh(beamGeom, beamMat);
      
      if (hitEnemy) {
        // Bend laser line visually directly onto target enemy contact
        const midPoint = new THREE.Vector3().addVectors(shipGroup.position, hitEnemy.position).multiplyScalar(0.5);
        beamMesh.position.copy(midPoint);
        beamMesh.lookAt(hitEnemy.position);
      } else {
        // Laser fires straight along nose forward direction
        beamMesh.position.copy(shipGroup.position).addScaledVector(direction, 750);
        beamMesh.quaternion.copy(shipGroup.quaternion);
      }
      scene.add(beamMesh);

      setTimeout(() => {
        scene.remove(beamMesh);
        beamGeom.dispose();
        beamMat.dispose();
      }, 90);

      if (hitEnemy) {
        const laserLvl = statsRef.current.upgrades.lasers || 0;
        const damage = 16 + laserLvl * 5;
        damageEnemy(hitEnemy, damage);
      }
    };

    const fireMissile = () => {
      if (missileCooldownRef.current > 0) return;

      // Energy Core Check
      if (statsRef.current.fuel < 18) {
        audioEngine.playRefuel(); // error sound
        addLog("WEAPONS WARNING: Insufficient Energy Core charge to cycle missiles!", "danger");
        return;
      }

      // Deduct energy
      setStats((prev) => ({ ...prev, fuel: Math.max(0, prev.fuel - 18) }));

      audioEngine.playMissile();
      setMissileCooldown(100);

      const mGeom = new THREE.CylinderGeometry(1.2, 1.2, 12, 8);
      mGeom.rotateX(Math.PI / 2);
      const mMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.1 });
      const mMesh = new THREE.Mesh(mGeom, mMat);
      mMesh.position.copy(shipGroup.position).addScaledVector(direction, 15);
      mMesh.quaternion.copy(shipGroup.quaternion);
      scene.add(mMesh);

      activeMissiles.push({
        mesh: mMesh,
        position: new THREE.Vector3().copy(mMesh.position),
        direction: new THREE.Vector3().copy(direction),
        lifetime: 3.5,
        targetEnemyId: targetEnemyRef.current?.id || null,
      });
    };

    const takeDamage = (amount: number) => {
      const now = performance.now();
      lastDamageTimeRef.current = now;

      setStats((prev) => {
        let currentShield = prev.shield;
        let currentHealth = prev.health;

        if (currentShield > 0) {
          currentShield = Math.max(0, currentShield - amount);
          audioEngine.playShieldHit();
        } else {
          currentHealth = Math.max(0, currentHealth - amount);
          audioEngine.playCollision();
        }

        if (currentHealth <= 0) {
          setGameState("GameOver");
          audioEngine.setMusicZone("gameover");
          addLog("CRITICAL COLLISION FAILURE: Spaceship structure compromised.", "danger");
        }
        return { ...prev, shield: currentShield, health: currentHealth };
      });
    };

    // Handle container resize
    const handleResize = () => {
      if (!renderer || !camera) return;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Active engine trail particles
    const activeTrails: {
      mesh: THREE.Mesh;
      lifetime: number;
      maxLifetime: number;
    }[] = [];

    // Smoothed steering values for responsive, buttery-smooth flight controls
    let smoothRoll = 0;
    let smoothPitch = 0;
    let smoothYaw = 0;

    // 17. MAIN ANIMATION LOOP
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsInterval = lastTime;
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const isPaused = gameStateRef.current === "Pause";
      const delta = isPaused ? 0 : Math.min((now - lastTime) / 1000, 0.1); // clamp delta to prevent giant steps
      lastTime = now;

      // Frame Rate Tracker
      frameCount++;
      if (now > fpsInterval + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsInterval)));
        frameCount = 0;
        fpsInterval = now;
      }

      // ---------------- Cooldown update ticks ----------------
      if (laserCooldownRef.current > 0) {
        setLaserCooldown((c) => Math.max(0, c - delta * 120)); // recharges in 0.3s
      }
      if (missileCooldownRef.current > 0) {
        setMissileCooldown((c) => Math.max(0, c - delta * 33)); // recharges in 3s
      }

      // ---------------- Shield Auto-Regen loop ----------------
      if (now - lastDamageTimeRef.current > 5000) {
        if (statsRef.current.shield < statsRef.current.maxShield) {
          setStats((prev) => ({
            ...prev,
            shield: Math.min(prev.maxShield, prev.shield + delta * 15), // +15% shield per sec
          }));
        }
      }

      // ---------------- Accretion Disk Swirl ----------------
      if (diskMesh) {
        diskMesh.rotation.z += 0.8 * delta;
      }
      if (diskMesh2) {
        diskMesh2.rotation.z -= 0.6 * delta; // counter-rotating accretion lens
      }

      // ---------------- Stellar Twinkling Shimmer & Ambient Field Rotation ----------------
      if (starsMaterial) {
        starsMaterial.size = 35 + Math.sin(now * 0.0025) * 6; // slow organic twinkling glow
      }
      if (starField) {
        starField.rotation.y += 0.002 * delta;
        starField.rotation.x += 0.0007 * delta;
      }
      if (galaxyGroup) {
        galaxyGroup.rotation.y += 0.04 * delta; // rotate distant slowly rotating galaxy
      }
      if (nebulaGroup) {
        nebulaGroup.rotation.y += 0.012 * delta; // drifting swirling gas nebulae
        nebulaGroup.rotation.x -= 0.004 * delta;
      }

      // ---------------- Planet Orbits & Rotations ----------------
      planetMeshes.forEach((item) => {
        const angleFactor = now * 0.00005 * item.config.orbitSpeed;
        const px = Math.cos(angleFactor) * item.config.orbitRadius;
        const pz = Math.sin(angleFactor) * item.config.orbitRadius;

        item.mesh.position.set(px, 0, pz);
        item.mesh.rotation.y += item.config.rotationSpeed * delta * 15;

        if (item.ring) {
          item.ring.rotation.z -= 0.005 * delta;
        }
      });

      // Orbit Moon Selene
      const verdantPlanet = planetMeshes.find(p => p.id === "verdant");
      if (verdantPlanet) {
        const mTime = now * 0.0005;
        const radius = 380;
        moonMesh.position.set(
          verdantPlanet.mesh.position.x + Math.cos(mTime) * radius,
          25,
          verdantPlanet.mesh.position.z + Math.sin(mTime) * radius
        );
        moonMesh.rotation.y += 0.02;
      }

      // Rotate Sun core
      sunMesh.rotation.y += 0.001 * delta;

      // ---------------- Asteroid Belt updates ----------------
      for (let i = 0; i < asteroidCount; i++) {
        const data = asteroidData[i];
        if (data.destroyed) continue;

        data.angle += data.speed * delta * 0.15;
        const ax = Math.cos(data.angle) * data.orbitRadius;
        const az = Math.sin(data.angle) * data.orbitRadius;

        dummyPos.set(ax, Math.sin(data.angle * 2.2) * 45, az);
        dummyRot.set(dummyRot.x + data.rotX, dummyRot.y + data.rotY, dummyRot.z + data.rotZ);
        dummyScale.set(data.scale, data.scale, data.scale);

        dummyMatrix.compose(dummyPos, new THREE.Quaternion().setFromEuler(dummyRot), dummyScale);
        asteroidBeltMesh.setMatrixAt(i, dummyMatrix);
      }
      asteroidBeltMesh.instanceMatrix.needsUpdate = true;

      // ---------------- FLIGHT CONTROLS & PHYSICS ----------------
      if (gameStateRef.current === "Playing" && !statsRef.current.isLanded) {
        
        // --- ENERGY CORE SYSTEM REGENERATION & BOOST ---
        const sunDist = shipGroup.position.distanceTo(new THREE.Vector3(0, 0, 0));
        const nearStar = sunDist < 3500;
        
        // Base regen rate enhanced by Cargo/Energy Core upgrade level
        const energyLvl = statsRef.current.upgrades.cargo || 0;
        let coreRegen = 8.0 + energyLvl * 2.5; // +10.5 to +20.5 EC per second
        
        if (nearStar) {
          coreRegen *= 2.5; // solar energy absorption multiplier!
        }

        let energyChange = coreRegen * delta;
        let isBoosting = keysRef.current["shift"] || keysRef.current["left_shift"] || touchBoostRef.current;
        const flightMode = settingsRef.current.flightMode || "arcade";
        
        // Boost/accel feel punchier with exponential lerp factoring (framerate-independent)
        const accelFactor = flightMode === "arcade" ? (1 - Math.exp(-6.5 * delta)) : (1 - Math.exp(-3.5 * delta));
        const boostFactor = flightMode === "arcade" ? (1 - Math.exp(-8.0 * delta)) : (1 - Math.exp(-4.5 * delta));

        if (isBoosting && statsRef.current.fuel > 12) {
          velocity.z = THREE.MathUtils.lerp(velocity.z, -statsRef.current.boostSpeed, boostFactor);
          energyChange -= 26.0 * delta; // consumes 26 EC/sec, net depletion depending on upgrades
          statsRef.current.isBoosting = true;
          audioEngine.setBoosting(true);

          flameL.scale.set(1.4, 1.4, 2.5);
          flameR.scale.set(1.4, 1.4, 2.5);
        } else {
          const isBraking = keysRef.current["control"] || keysRef.current["left_control"] || touchBrakeRef.current;
          const speedZ = isBraking ? -15 : -statsRef.current.maxSpeed;
          velocity.z = THREE.MathUtils.lerp(velocity.z, speedZ, accelFactor);
          statsRef.current.isBoosting = false;
          audioEngine.setBoosting(false);

          flameL.scale.set(1.0, 1.0, 1.0);
          flameR.scale.set(1.0, 1.0, 1.0);
        }

        // Spawn colored engine trail particles
        if (Math.random() < 0.45) {
          const trailGeom = new THREE.SphereGeometry(1.2, 6, 6);
          const trailMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
          });

          const spawnTrailAt = (pos: THREE.Vector3) => {
            const tMesh = new THREE.Mesh(trailGeom, trailMat);
            tMesh.position.copy(pos);
            scene.add(tMesh);
            activeTrails.push({
              mesh: tMesh,
              lifetime: 0.55,
              maxLifetime: 0.55
            });
          };

          const posL = new THREE.Vector3(-4, -0.8, 14).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
          const posR = new THREE.Vector3(4, -0.8, 14).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);

          spawnTrailAt(posL);
          spawnTrailAt(posR);
        }

        // Update active engine trail particles
        for (let tIdx = activeTrails.length - 1; tIdx >= 0; tIdx--) {
          const trail = activeTrails[tIdx];
          trail.lifetime -= delta;
          if (trail.lifetime <= 0) {
            scene.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            (trail.mesh.material as any).dispose();
            activeTrails.splice(tIdx, 1);
          } else {
            const pct = trail.lifetime / trail.maxLifetime;
            trail.mesh.scale.set(pct, pct, pct);
            (trail.mesh.material as any).opacity = pct * 0.75;
          }
        }

        // Active Shield Recharge powered by the Energy Core
        let shieldRecharge = 0;
        if (statsRef.current.shield < statsRef.current.maxShield && statsRef.current.fuel > 15) {
          const shieldRate = 8.0 * delta; // recharge 8 shield per sec
          shieldRecharge = shieldRate;
          energyChange -= shieldRate * 1.3; // shield recharge drains core energy
        }

        // Update stats smoothly in loop
        setStats((prev) => {
          const nextFuel = Math.max(0, Math.min(prev.maxFuel, prev.fuel + energyChange));
          const nextShield = Math.max(0, Math.min(prev.maxShield, prev.shield + shieldRecharge));
          return {
            ...prev,
            fuel: nextFuel,
            shield: nextShield,
            isBoosting: statsRef.current.isBoosting
          };
        });

        // Steering rates multiplier and sensitivity adjustments
        const steerMult = flightMode === "arcade" ? 1.85 : 1.0;
        const sensitivity = settingsRef.current.touchSensitivity || 1.0;
        const mSensitivity = settingsRef.current.mouseSensitivity || 1.0;

        // Target Steer inputs
        let targetRoll = 0;
        let targetPitch = 0;
        let targetYaw = 0;

        // Beginner friendly: A/D (and Left/Right Arrow) maps directly to steering (Yaw) with automatic banking (Roll)!
        if (keysRef.current["a"] || keysRef.current["arrowleft"]) {
          targetYaw = 2.15 * steerMult;
          targetRoll = 1.95 * steerMult; // beautiful banking roll
        }
        if (keysRef.current["d"] || keysRef.current["arrowright"]) {
          targetYaw = -2.15 * steerMult;
          targetRoll = -1.95 * steerMult; // beautiful banking roll
        }

        if (keysRef.current["w"] || keysRef.current["arrowup"]) targetPitch = -2.1 * steerMult;
        if (keysRef.current["s"] || keysRef.current["arrowdown"]) targetPitch = 2.1 * steerMult;

        // Q/E can still be used for manual, pure high-speed barrel rolls and spins
        if (keysRef.current["q"]) targetRoll = 2.6 * steerMult;
        if (keysRef.current["e"]) targetRoll = -2.6 * steerMult;

        // Mouse assist (Disable entirely on mobile to prevent stuck cursor spinning bugs)
        if (!isMobile) {
          if (Math.abs(mouseRef.current.x) > 0.05) targetYaw += -mouseRef.current.x * 1.85 * steerMult * mSensitivity;
          if (Math.abs(mouseRef.current.y) > 0.05) targetPitch += mouseRef.current.y * 1.85 * steerMult * mSensitivity;
        }

        // --- AUTO-AIM / GUIDANCE LIGHT LOCK ---
        // Adjusts yaw/pitch slightly if an enemy is close and within a 30-degree cone (0.52 radians)
        let aimAssistYaw = 0;
        let aimAssistPitch = 0;
        let nearestEnemyForAssist = null;
        let minAssistDist = 3500;
        const assistConeRadians = 30 * Math.PI / 180; // 30 degrees

        enemies.forEach((enemy) => {
          const toEnemy = new THREE.Vector3().subVectors(enemy.position, shipGroup.position);
          const dist = toEnemy.length();
          if (dist < minAssistDist) {
            const toEnemyNorm = toEnemy.clone().normalize();
            const angle = direction.angleTo(toEnemyNorm);
            if (angle < assistConeRadians) {
              minAssistDist = dist;
              nearestEnemyForAssist = enemy;
            }
          }
        });

        if (nearestEnemyForAssist) {
          const toEnemy = new THREE.Vector3().subVectors((nearestEnemyForAssist as any).position, shipGroup.position).normalize();
          // Project to local spaceship space to calculate precise corrections
          const localTarget = toEnemy.applyQuaternion(shipGroup.quaternion.clone().invert());
          
          // Apply strong satisfying correction pull toward the enemy core
          const assistStrength = 2.35;
          aimAssistYaw = -localTarget.x * assistStrength;
          aimAssistPitch = localTarget.y * assistStrength;
        }

        targetYaw += aimAssistYaw;
        targetPitch += aimAssistPitch;

        // Mobile touch joystick inputs (additive or direct override)
        if (isMobile) {
          if (Math.abs(leftJoystickRef.current.y) > 0.01) {
            targetPitch += -leftJoystickRef.current.y * 1.85 * steerMult * sensitivity;
          }
          if (Math.abs(leftJoystickRef.current.x) > 0.01) {
            targetYaw += -leftJoystickRef.current.x * 1.85 * steerMult * sensitivity;
          }
          if (Math.abs(rightJoystickRef.current.x) > 0.01) {
            targetRoll += -rightJoystickRef.current.x * 2.5 * steerMult * sensitivity;
          }

          // Mobile weapon trigger firing
          if (touchShootRef.current) {
            if (mobileWeaponRef.current === "laser") {
              fireLaser();
            } else {
              fireMissile();
            }
          }
        }

        // Apply smooth exponential decay interpolation for responsive, silky-smooth steering feel
        const lerpFactor = 1 - Math.exp(-25 * delta); // 25Hz decay rate for buttery action
        smoothRoll = THREE.MathUtils.lerp(smoothRoll, targetRoll, lerpFactor);
        smoothPitch = THREE.MathUtils.lerp(smoothPitch, targetPitch, lerpFactor);
        smoothYaw = THREE.MathUtils.lerp(smoothYaw, targetYaw, lerpFactor);

        const rollVal = smoothRoll * delta;
        const pitchVal = smoothPitch * delta;
        const yawVal = smoothYaw * delta;

        const localRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollVal);
        const localPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitchVal);
        const localYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawVal);

        shipGroup.quaternion.multiply(localRoll).multiply(localPitch).multiply(localYaw);

        direction.set(0, 0, -1).applyQuaternion(shipGroup.quaternion);

        const currentSpeed = Math.abs(velocity.z);
        shipGroup.position.addScaledVector(direction, currentSpeed * delta);

        // Sync rumble
        audioEngine.setSpeed(currentSpeed / statsRef.current.boostSpeed);

        setPlayerPos([shipGroup.position.x, shipGroup.position.y, shipGroup.position.z]);
        const eulerY = new THREE.Euler().setFromQuaternion(shipGroup.quaternion, "YXZ");
        setPlayerRot(eulerY.y);

        // Dust recycling
        spaceDustPoints.position.copy(shipGroup.position);
        const dustPos = spaceDustPoints.geometry.attributes.position;
        const localV = new THREE.Vector3();
        for (let i = 0; i < dustCount; i++) {
          localV.fromBufferAttribute(dustPos, i);
          if (localV.z > 750) {
            localV.z = -750;
            localV.x = (Math.random() - 0.5) * 1200;
            localV.y = (Math.random() - 0.5) * 1200;
          } else {
            localV.z += currentSpeed * delta * 0.95;
          }
          dustPos.setXYZ(i, localV.x, localV.y, localV.z);
        }
        dustPos.needsUpdate = true;

        // ---------------- Gravitational pull Cygnus X-1 Black Hole ----------------
        const bhDist = currentSystemRef.current.hasBlackHole ? shipGroup.position.distanceTo(bhPosition) : 100000;
        setBlackHoleDistance(bhDist);

        if (currentSystemRef.current.hasBlackHole && bhDist < 5500) {
          // exponential gravity vacuum
          const bhPullDir = new THREE.Vector3().subVectors(bhPosition, shipGroup.position).normalize();
          const pullIntensity = Math.min(230, (5500 - bhDist) * 0.08);
          shipGroup.position.addScaledVector(bhPullDir, pullIntensity * delta);

          // Camera lensing FOV distortion
          const distortionFOV = 65 + Math.min(45, (5500 - bhDist) * 0.013);
          camera.fov = distortionFOV;
          camera.updateProjectionMatrix();

          if (bhDist < 1600) {
            audioEngine.setAlarm(true);
          } else {
            audioEngine.setAlarm(false);
          }

          // Discover Black Hole
          if (bhDist < 2500 && !statsRef.current.discoveries.blackHole) {
            triggerDiscovery(
              "black_hole",
              `${currentSystemRef.current.name} Singularity`,
              "A massive gravitational singularity formed from a collapsed hyperstar. Light and time warp dramatically around its event horizon, creating severe lensing distortions in navigation sensors.",
              "black_hole"
            );
          }

          // Singular event horizon death crossed -> AMAZING WARP BYPASS!
          if (bhDist < 170) {
            shipGroup.scale.set(0.01, 0.01, 40.0); // spaghettify starship mesh
            
            // Warp to a random system with damage!
            const otherSystems = GALAXY_SYSTEMS.filter(s => s.id !== statsRef.current.currentSystemId);
            const randomSystem = otherSystems[Math.floor(Math.random() * otherSystems.length)] || GALAXY_SYSTEMS[0];
            
            setStats((prev) => ({
              ...prev,
              health: 12, // emergency reserve
              shield: 0,
              currentSystemId: randomSystem.id,
              discoveries: { ...prev.discoveries, blackHole: true }
            }));
            setPlayerPos([0, 0, 4800]);
            shipGroup.position.set(0, 0, 4800);
            shipGroup.scale.set(1, 1, 1);
            
            addLog("CRITICAL SINGULARITY OVERLOAD: Event Horizon crossed! Bypass warp engaged!", "danger");
            addLog(`SINGULARITY EXTRACTION: Quantum tunnel spit your starship out in: ${randomSystem.name}!`, "success");
          }
        } else {
          if (camera.fov !== 65) {
            camera.fov = 65;
            camera.updateProjectionMatrix();
          }
          audioEngine.setAlarm(false);
        }

        // ---------------- Pulsar Beams Rotation ----------------
        if (pulsarLeftBeam && pulsarRightBeam) {
          pulsarLeftBeam.rotation.y += delta * 1.6;
          pulsarRightBeam.rotation.y += delta * 1.6;
        }

        // ---------------- Space Station Rotation & Docking Proximity ----------------
        if (stationHabitatRing) {
          stationHabitatRing.rotation.z += delta * 0.22;
        }

        if (stationGroup) {
          const stationDist = shipGroup.position.distanceTo(stationGroup.position);
          if (stationDist < 1200) {
            // Re-use currentPlanetId = "station" to trigger docking prompts on HUD
            if (statsRef.current.currentPlanetId !== "station") {
              setStats((prev) => ({ ...prev, currentPlanetId: "station" }));
              addLog("STATION APPROACH: Orbital outpost approach vector locked. Press E to dock.", "warning");
            }
            if (keysRef.current["e"] || keysRef.current["keye"]) {
              setStats((prev) => ({ ...prev, isExploring: true, isLanded: true }));
              audioEngine.setMusicZone("station");
              addLog("LANDED: Exploration mode engaged. Press F to return to ship.", "success");
              keysRef.current["e"] = false;
              keysRef.current["keye"] = false;
            }
          } else if (statsRef.current.currentPlanetId === "station") {
            setStats((prev) => ({ ...prev, currentPlanetId: null }));
            addLog("Exited orbital station docking field.", "info");
          }
        }

        // ---------------- Wormhole Physics & Warping ----------------
        if (wormholeMesh) {
          wormholeMesh.rotation.z += delta * 0.8;
          const whDist = shipGroup.position.distanceTo(wormholeMesh.position);
          
          if (whDist < 1000 && !statsRef.current.discoveries.wormhole) {
            triggerDiscovery(
              "wormhole",
              `${currentSystemRef.current.name} Einstein-Rosen Bridge`,
              "An active Einstein-Rosen space bridge connecting distant sectors of the galaxy. Entering its central throat allows pilots to bypass normal light-travel boundaries.",
              "nebula"
            );
          }

          if (whDist < 250) {
            const nextSystemId = currentSystemRef.current.wormholeTargetSystemId || "kepler_sector";
            setStats((prev) => ({
              ...prev,
              discoveries: { ...prev.discoveries, wormhole: true }
            }));
            handleWarp(nextSystemId);
          }
        }

        // Discoveries around Neutron / Pulsar / Dwarf star cores
        const sunDistance = shipGroup.position.distanceTo(new THREE.Vector3(0,0,0));
        if (currentSystemRef.current.starType === "Neutron Star" && sunDistance < 3200 && !statsRef.current.discoveries.pulsar) {
          triggerDiscovery(
            "pulsar",
            `${currentSystemRef.current.name} Pulsar Core`,
            "A superdense collapsed stellar core rotating at extreme speeds. Intense twin beams of electromagnetic energy sweep outward from its poles, creating high-frequency neutron radiation waves.",
            "pulsar"
          );
        }
        if (currentSystemRef.current.starType === "White Dwarf" && sunDistance < 3200 && !statsRef.current.discoveries.whiteDwarf) {
          triggerDiscovery(
            "white_dwarf",
            `${currentSystemRef.current.name} Degenerate Core`,
            "The hot, dense core leftover from low-mass star exhaustion. Sustained entirely by electron degeneracy pressure, its carbon-oxygen envelope glimmers with extreme heat and gravity.",
            "neutron_star"
          );
        }

        // ---------------- Atmospheric Gravity Coupling ----------------
        let nearestPlanetId: string | null = null;
        let minPlanetDist = Infinity;

        planetMeshes.forEach((item) => {
          const dist = shipGroup.position.distanceTo(item.mesh.position);
          if (dist < minPlanetDist) {
            minPlanetDist = dist;
            nearestPlanetId = item.id;
          }
        });

        // Space flight updates are active if we are not exploring on-foot
        if (statsRef.current.isExploring) {
          // Skip updating space physics to freeze space state while exploring
        }

        if (nearestPlanetId && minPlanetDist < 1550) {
          const planetObj = planetMeshes.find(p => p.id === nearestPlanetId);
          if (planetObj) {
            if (statsRef.current.currentPlanetId !== nearestPlanetId && statsRef.current.currentPlanetId !== "station") {
              setStats((prev) => ({ ...prev, currentPlanetId: nearestPlanetId }));
              addLog(`Gravity well locked: ${planetObj.config.name}. Press E to initiate base docking!`, "warning");
            }

            // Discover Planet
            if (!statsRef.current.discoveredObjects?.includes(nearestPlanetId)) {
              triggerDiscovery(
                nearestPlanetId,
                `Planet ${planetObj.config.name}`,
                `A major celestial body located in the ${currentSystemRef.current.name}. It features a ${planetObj.config.biome.toLowerCase()} biosphere, ${planetObj.config.weather.toLowerCase()} atmospheric conditions, and has a local surface gravity of ${planetObj.config.gravity}G.`,
                planetObj.config.biome.toLowerCase().includes("gas") ? "gas_giant" : "planet"
              );
            }

            // Atmospheric haze
            const hazePct = THREE.MathUtils.clamp((1550 - minPlanetDist) / 1000, 0, 0.85);
            const pColor = new THREE.Color(planetObj.config.color);
            scene.fog.color.lerpColors(new THREE.Color("#020205"), pColor, hazePct);
            renderer.setClearColor(scene.fog.color);
          }
        } else {
          if (statsRef.current.currentPlanetId !== null && statsRef.current.currentPlanetId !== "station") {
            setStats((prev) => ({ ...prev, currentPlanetId: null }));
            addLog("Exited planet atmosphere, stabilization jets re-aligned.", "info");
          }
          if (statsRef.current.currentPlanetId !== "station") {
            scene.fog.color.set("#020205");
            renderer.setClearColor(0x020205);
          }
        }

        // ---------------- Thermal Solar hazard ----------------
        if (sunDistance < 500) {
          takeDamage(100); // direct vaporizing
          addLog("CRITICAL COLLISION: Starship hull melted by sun core corona!", "danger");
        } else if (sunDistance < 2600) {
          takeDamage(delta * 20); // progressive heat damage
          audioEngine.setAlarm(true);
        }

        // ---------------- Planet Surface Crash ----------------
        if (nearestPlanetId && minPlanetDist < (planetMeshes.find(p => p.id === nearestPlanetId)?.config.radius || 100)) {
          if (statsRef.current.landingProgress === 0) {
            takeDamage(35);
            addLog("SURFACE CRASH DETECTED: Thermal shield deflection absorbs hit!", "danger");
            const pushBack = new THREE.Vector3().subVectors(shipGroup.position, planetMeshes.find(p => p.id === nearestPlanetId)!.mesh.position).normalize();
            shipGroup.position.addScaledVector(pushBack, 150);
          }
        }

        // ---------------- Asteroids crash & mining collisions ----------------
        const shipOrbitDist = Math.sqrt(shipGroup.position.x * shipGroup.position.x + shipGroup.position.z * shipGroup.position.z);
        if (shipOrbitDist >= asteroidMinRadius - 250 && shipOrbitDist <= asteroidMaxRadius + 250 && Math.abs(shipGroup.position.y) < 160) {
          for (let i = 0; i < asteroidCount; i += 6) { // step loop slightly to preserve 60 FPS
            const ast = asteroidData[i];
            if (ast.destroyed) continue;

            const ax = Math.cos(ast.angle) * ast.orbitRadius;
            const az = Math.sin(ast.angle) * ast.orbitRadius;
            const astPos = new THREE.Vector3(ax, Math.sin(ast.angle * 2.2) * 45, az);

            const collisionRange = ast.size + 15;
            if (shipGroup.position.distanceTo(astPos) < collisionRange) {
              takeDamage(15);
              addLog("COLLISION ALERT: Deflector shield impacted by asteroid cluster!", "danger");

              // bounce ship
              const bounceVec = new THREE.Vector3().subVectors(shipGroup.position, astPos).normalize();
              shipGroup.position.addScaledVector(bounceVec, 65);

              // Explode small asteroid
              if (ast.scale < 0.6) {
                createExplosion(astPos, 0x4b5563, 20, 10);
                ast.destroyed = true;
                // drop salvage pickup!
                spawnPickup(astPos);
              }
              break;
            }
          }
        }

        // ---------------- Homing Missiles flight physics ----------------
        for (let j = activeMissiles.length - 1; j >= 0; j--) {
          const missile = activeMissiles[j];
          missile.lifetime -= delta;

          let targetedEnemyNode = enemies.find(e => e.id === missile.targetEnemyId);
          if (targetedEnemyNode) {
            // steer and home in towards enemy
            const steerDir = new THREE.Vector3().subVectors(targetedEnemyNode.position, missile.position).normalize();
            missile.direction.lerp(steerDir, 0.09).normalize();
          }

          missile.position.addScaledVector(missile.direction, 550 * delta);
          missile.mesh.position.copy(missile.position);
          missile.mesh.lookAt(new THREE.Vector3().copy(missile.position).add(missile.direction));

          // Check hit
          let hitMade = false;
          const missileLvl = statsRef.current.upgrades.missiles || 0;
          const missileDmg = 65 + missileLvl * 20;

          if (targetedEnemyNode) {
            if (missile.position.distanceTo(targetedEnemyNode.position) < 45) {
              damageEnemy(targetedEnemyNode, missileDmg); // huge explosive damage
              hitMade = true;
            }
          } else {
            // Check closeness to any enemy
            for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
              const enemy = enemies[eIdx];
              if (missile.position.distanceTo(enemy.position) < 45) {
                damageEnemy(enemy, missileDmg);
                hitMade = true;
                break;
              }
            }
          }

          if (hitMade || missile.lifetime <= 0) {
            createExplosion(missile.position, 0xff5100, 35, 15);
            audioEngine.playExplosion();
            scene.remove(missile.mesh);
            activeMissiles.splice(j, 1);
          }
        }

        // ---------------- Pickups vacuum magnet ----------------
        for (let pIdx = pickups.length - 1; pIdx >= 0; pIdx--) {
          const pickup = pickups[pIdx];
          pickup.mesh.rotation.y += 1.8 * delta;
          pickup.mesh.rotation.z += 1.0 * delta;

          const dist = pickup.position.distanceTo(shipGroup.position);
          if (dist < 400) {
            // pull to starship
            const pullDir = new THREE.Vector3().subVectors(shipGroup.position, pickup.position).normalize();
            pickup.position.addScaledVector(pullDir, 350 * delta);
            pickup.mesh.position.copy(pickup.position);
          }

          if (dist < 45) {
            // collected!
            scene.remove(pickup.mesh);
            audioEngine.playRefuel(); // play pickup sound
            
            if (pickup.type === "shield") {
              setStats(prev => ({ ...prev, shield: Math.min(prev.maxShield, prev.shield + 35) }));
              addLog("SCOOPED: Deflector shield battery aligned (+35% shields)", "success");
            } else if (pickup.type === "health") {
              setStats(prev => ({ ...prev, health: Math.min(prev.maxHealth, prev.health + 25) }));
              addLog("SCOOPED: Exterior hull nanite repair capsule (+25% hull)", "success");
            } else if (pickup.type === "fuel") {
              setStats(prev => ({ ...prev, fuel: Math.min(prev.maxFuel, prev.fuel + 40) }));
              addLog("SCOOPED: High-yield Energy Cell loaded (+40% Core Energy)", "success");
            } else {
              setStats(prev => ({ ...prev, credits: prev.credits + 100 }));
              addLog("SCOOPED: Gold silicate container recovered (+100 CR)", "success");
            }

            pickups.splice(pIdx, 1);
          }
        }

        // ---------------- Hostile AI Enemy patrols & chases ----------------
        const radarBlips: { x: number; z: number; id: string }[] = [];

        enemies.forEach((enemy) => {
          radarBlips.push({ x: enemy.position.x, z: enemy.position.z, id: enemy.id });

          if (enemy.isDamagedFlash > 0) {
            enemy.isDamagedFlash -= delta;
            // set flash color
            enemy.mesh.children.forEach((c) => {
              if (c instanceof THREE.Mesh && c.material) {
                (c.material as any).color?.set(0xff0000); // red flash
              }
            });
          } else {
            // restore standard colors
            enemy.mesh.children.forEach((c) => {
              if (c instanceof THREE.Mesh && c.material) {
                if (c.geometry instanceof THREE.ConeGeometry && enemy.classType === "Scout") {
                  (c.material as any).color?.set(0xe11d48);
                } else {
                  (c.material as any).color?.set(0x3f3f46);
                }
              }
            });
          }

          const distToPlayer = enemy.position.distanceTo(shipGroup.position);
          if (distToPlayer < 2400) {
            // Aggro Chasing Mode with smooth orientation steering slerp
            if (!(enemy as any).currentQuat) {
              (enemy as any).currentQuat = enemy.mesh.quaternion.clone();
            }

            const prevQuat = (enemy as any).currentQuat.clone();
            enemy.mesh.lookAt(shipGroup.position);
            const targetQuat = enemy.mesh.quaternion.clone();
            enemy.mesh.quaternion.copy(prevQuat); // restore to interpolate

            // Smoothly slerp towards looking directly at player
            const turnRate = enemy.classType === "Scout" ? 3.2 : enemy.classType === "Fighter" ? 1.85 : 0.75;
            (enemy as any).currentQuat.slerp(targetQuat, turnRate * delta);
            enemy.mesh.quaternion.copy((enemy as any).currentQuat);

            // Fly forward along their actual local nose heading (creates spectacular cinematic overshooting on quick turns!)
            const enemyForward = new THREE.Vector3(0, 0, -1).applyQuaternion((enemy as any).currentQuat);
            const chaseSpeed = enemy.classType === "Scout" ? 112 : enemy.classType === "Fighter" ? 82 : 48;
            enemy.position.addScaledVector(enemyForward, chaseSpeed * delta);

            // Enemy Shooting weapon cooldowns
            enemy.fireCooldown -= delta;
            if (enemy.fireCooldown <= 0 && distToPlayer < 1800) {
              enemy.fireCooldown = enemy.classType === "Scout" ? 1.45 : enemy.classType === "Fighter" ? 1.15 : 1.95;
              
              // Verify if enemy is actually pointing within a reasonable 15-degree cone (0.26 radians) of the player before hitting
              const toPlayerNorm = new THREE.Vector3().subVectors(shipGroup.position, enemy.position).normalize();
              const angleToPlayer = enemyForward.angleTo(toPlayerNorm);

              if (angleToPlayer < 0.26) {
                // Point-blank HIT! Draw direct laser line to player
                const enemyLaserGeom = new THREE.CylinderGeometry(0.7, 0.7, distToPlayer, 8);
                enemyLaserGeom.rotateX(Math.PI / 2);
                const enemyLaserMat = new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
                const enemyLaserMesh = new THREE.Mesh(enemyLaserGeom, enemyLaserMat);
                
                const midPoint = new THREE.Vector3().addVectors(enemy.position, shipGroup.position).multiplyScalar(0.5);
                enemyLaserMesh.position.copy(midPoint);
                enemyLaserMesh.lookAt(shipGroup.position);
                scene.add(enemyLaserMesh);

                setTimeout(() => {
                  scene.remove(enemyLaserMesh);
                  enemyLaserGeom.dispose();
                  enemyLaserMat.dispose();
                }, 110);

                // Deal damage to player
                const dmg = enemy.classType === "Scout" ? 7 : enemy.classType === "Fighter" ? 13 : 25;
                takeDamage(dmg);
                addLog(`THREAT INCOMING: Starship hit by ${enemy.name} laser blast!`, "danger");
              } else {
                // Cinematic MISS! Enemy fires red lasers forward along their current heading into empty space!
                const laserRange = 1600;
                const enemyLaserGeom = new THREE.CylinderGeometry(0.6, 0.6, laserRange, 8);
                enemyLaserGeom.rotateX(Math.PI / 2);
                const enemyLaserMat = new THREE.MeshBasicMaterial({ color: 0xff003c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
                const enemyLaserMesh = new THREE.Mesh(enemyLaserGeom, enemyLaserMat);
                
                enemyLaserMesh.position.copy(enemy.position).addScaledVector(enemyForward, laserRange / 2);
                enemyLaserMesh.quaternion.copy(enemy.mesh.quaternion);
                scene.add(enemyLaserMesh);

                setTimeout(() => {
                  scene.remove(enemyLaserMesh);
                  enemyLaserGeom.dispose();
                  enemyLaserMat.dispose();
                }, 110);
              }
            }
          } else {
            // standard orbital patrol loop
            const planet = planetMeshes.find(p => p.id === enemy.patrolPlanetId);
            if (planet) {
              enemy.patrolAngle += 0.2 * delta; // patrol speed
              const px = planet.mesh.position.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
              const pz = planet.mesh.position.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;
              enemy.position.set(px, 100 + Math.sin(enemy.patrolAngle * 2.5) * 45, pz);
              
              // align heading along orbit tangent
              const orbitTangent = new THREE.Vector3(-Math.sin(enemy.patrolAngle), 0, Math.cos(enemy.patrolAngle));
              const lookTarget = new THREE.Vector3().copy(enemy.position).add(orbitTangent);
              enemy.mesh.lookAt(lookTarget);
              
              // Sync currentQuat with standard patrol orientation so there are no sudden snaps when aggroing
              (enemy as any).currentQuat = enemy.mesh.quaternion.clone();
            }
          }

          // Update actual Three mesh positions
          enemy.mesh.position.copy(enemy.position);
        });

        setEnemyPositions(radarBlips);

        // Calculate projected coordinates for nav targets and active enemies
        const widthHalf = window.innerWidth / 2;
        const heightHalf = window.innerHeight / 2;

        const enemiesProj = enemies.map(enemy => {
          const temp = new THREE.Vector3().copy(enemy.position).project(camera);
          const screenX = (temp.x * widthHalf) + widthHalf;
          const screenY = -(temp.y * heightHalf) + heightHalf;
          // An object is on-screen if it is in front of the camera (temp.z < 1) and within normalized screen bounds
          const isOnScreen = temp.z < 1 && Math.abs(temp.x) < 1.05 && Math.abs(temp.y) < 1.05;

          return {
            id: enemy.id,
            name: enemy.name,
            classType: enemy.classType,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            shield: enemy.shield,
            maxShield: enemy.maxShield,
            dist: enemy.position.distanceTo(shipGroup.position),
            isOnScreen,
            x: screenX,
            y: screenY,
            projX: temp.x,
            projY: temp.y,
          };
        });
        setEnemiesData(enemiesProj);

        const projectCoord = (pos: THREE.Vector3) => {
          const temp = new THREE.Vector3().copy(pos).project(camera);
          return {
            x: (temp.x * widthHalf) + widthHalf,
            y: -(temp.y * heightHalf) + heightHalf,
            z: temp.z
          };
        };

        const stationProj = stationGroup ? {
          ...projectCoord(stationGroup.position),
          dist: shipGroup.position.distanceTo(stationGroup.position)
        } : null;

        const blackHoleProj = currentSystemRef.current.hasBlackHole && bhPosition ? {
          ...projectCoord(bhPosition),
          dist: shipGroup.position.distanceTo(bhPosition)
        } : null;

        const wormholeProj = wormholeMesh ? {
          ...projectCoord(wormholeMesh.position),
          dist: shipGroup.position.distanceTo(wormholeMesh.position)
        } : null;

        const planetsProj = planetMeshes.map(p => ({
          id: p.id,
          name: p.config.name,
          ...projectCoord(p.mesh.position),
          dist: shipGroup.position.distanceTo(p.mesh.position)
        }));

        setNavTargets({
          station: stationProj,
          blackHole: blackHoleProj,
          wormhole: wormholeProj,
          planets: planetsProj,
          mission: statsRef.current.activeMission ? {
            x: widthHalf,
            y: heightHalf,
            z: 1,
            dist: 1200,
            label: statsRef.current.activeMission.title
          } : null
        });

        // Find closest target to display locked indicators in target HUD
        let closestTarget: typeof enemies[0] | null = null;
        let minLockDist = 3200;

        enemies.forEach((enemy) => {
          const d = enemy.position.distanceTo(shipGroup.position);
          if (d < minLockDist) {
            minLockDist = d;
            closestTarget = enemy;
          }
        });

        if (closestTarget) {
          const targetNode = closestTarget as any;
          setTargetEnemy({
            name: targetNode.name,
            classType: targetNode.classType,
            health: targetNode.health,
            maxHealth: targetNode.maxHealth,
            shield: targetNode.shield,
            maxShield: targetNode.maxShield,
            distance: minLockDist,
          });
          targetEnemyRef.current = targetNode;
        } else {
          setTargetEnemy(null);
          targetEnemyRef.current = null;
        }

        // ---------------- Landing Descent sequence ----------------
        if (statsRef.current.landingProgress > 0 && !statsRef.current.isLanded) {
          setStats((prev) => {
            const nextLanding = prev.landingProgress + delta * 0.35;
            if (nextLanding >= 1.0) {
              const planetName = currentSystemRef.current.planets.find(p => p.id === prev.currentPlanetId)?.name || "planet";
              addLog(`Spaceship docked at ${planetName} outpost hangar. Energy Core instantly restored to 100%!`, "success");
              audioEngine.setMusicZone("planet");
              return { ...prev, landingProgress: 0, isLanded: true, speed: 0, fuel: prev.maxFuel };
            }
            return { ...prev, landingProgress: nextLanding };
          });
        }
      }

      // ---------------- Particle explosions lifespan updates ----------------
      for (let pIdx = particlesPool.length - 1; pIdx >= 0; pIdx--) {
        const p = particlesPool[pIdx];
        p.lifetime -= delta;

        const posAttr = p.points.geometry.attributes.position;
        for (let idx = 0; idx < posAttr.count; idx++) {
          p.positions[idx * 3] += p.velocities[idx * 3] * delta;
          p.positions[idx * 3 + 1] += p.velocities[idx * 3 + 1] * delta;
          p.positions[idx * 3 + 2] += p.velocities[idx * 3 + 2] * delta;
        }
        posAttr.needsUpdate = true;

        if (p.lifetime <= 0) {
          scene.remove(p.points);
          p.points.geometry.dispose();
          (p.points.material as any).dispose();
          particlesPool.splice(pIdx, 1);
        }
      }

      // ---------------- Twinkle Stars material size ----------------
      if (starsMaterial) {
        starsMaterial.size = 35 + Math.sin(now * 0.002) * 15;
      }

      // ---------------- Rotate Galaxy group ----------------
      if (galaxyGroup) {
        galaxyGroup.rotation.y += 0.018 * delta;
      }

      // ---------------- Rotate Nebulae clouds group ----------------
      if (nebulaGroup) {
        nebulaGroup.rotation.y += 0.008 * delta;
      }

      // ---------------- Satellites orbiting planets ----------------
      satelliteMeshes.forEach((sat) => {
        const planet = planetMeshes.find(p => p.id === sat.planetId);
        if (planet) {
          sat.angle += sat.speed * delta;
          const sx = planet.mesh.position.x + Math.cos(sat.angle) * sat.radius;
          const sz = planet.mesh.position.z + Math.sin(sat.angle) * sat.radius;
          sat.mesh.position.set(sx, planet.mesh.position.y + Math.sin(sat.angle * 2) * 12, sz);
          sat.mesh.rotation.y += 1.5 * delta;
        }
      });

      // ---------------- Cinematic spaceship flybys ----------------
      if (cinematicShip) {
        if (!cinematicShipActive) {
          cinematicShipTimer += delta;
          if (cinematicShipTimer > 18) {
            cinematicShipActive = true;
            cinematicShipProgress = 0;
            const side = Math.random() > 0.5 ? 1 : -1;
            cinematicShipStart.set(camera.position.x - 1200 * side, camera.position.y + 150, camera.position.z - 1800);
            cinematicShipEnd.set(camera.position.x + 1500 * side, camera.position.y - 100, camera.position.z + 1800);
          }
          cinematicShip.position.set(99999, 99999, 99999);
        } else {
          cinematicShipProgress += delta * 0.16; // takes ~6 seconds
          if (cinematicShipProgress >= 1.0) {
            cinematicShipActive = false;
            cinematicShipTimer = 0;
          } else {
            cinematicShip.position.lerpVectors(cinematicShipStart, cinematicShipEnd, cinematicShipProgress);
            cinematicShip.lookAt(cinematicShipEnd);
          }
        }
      }

      // ---------------- Shooting stars ----------------
      if (shootingStarLine) {
        if (!shootingStarActive) {
          shootingStarTimer += delta;
          if (shootingStarTimer > 6) {
            shootingStarActive = true;
            shootingStarDuration = 0.45 + Math.random() * 0.4;
            const startX = camera.position.x + (Math.random() - 0.5) * 3000;
            const startY = camera.position.y + 800 + Math.random() * 400;
            const startZ = camera.position.z - 2500 + (Math.random() - 0.5) * 1000;
            shootingStarStart.set(startX, startY, startZ);
            shootingStarDir.set(-1.0, -0.45, 0.4).normalize();
            shootingStarLine.position.copy(shootingStarStart);
            (shootingStarLine.material as THREE.LineBasicMaterial).opacity = 1.0;
          }
        } else {
          shootingStarDuration -= delta;
          if (shootingStarDuration <= 0) {
            shootingStarActive = false;
            shootingStarTimer = 0;
            (shootingStarLine.material as THREE.LineBasicMaterial).opacity = 0;
          } else {
            shootingStarLine.position.addScaledVector(shootingStarDir, shootingStarSpeed * delta);
          }
        }
      }

      // ---------------- Moving menu asteroids ----------------
      for (let i = 0; i < menuAsteroidMeshes.length; i++) {
        const rock = menuAsteroidMeshes[i];
        const speed = menuAsteroidSpeeds[i];
        const rot = menuAsteroidRots[i];
        
        rock.position.addScaledVector(speed, delta);
        rock.rotation.x += rot.x * delta;
        rock.rotation.y += rot.y * delta;
        rock.rotation.z += rot.z * delta;
        
        if (rock.position.distanceTo(new THREE.Vector3(3400, 180, 4000)) > 3000) {
          rock.position.set(
            3400 + (Math.random() - 0.5) * 2000,
            180 + (Math.random() - 0.5) * 300,
            4000 + (Math.random() - 0.5) * 2000
          );
        }
      }

      // ---------------- Third person smooth camera follow ----------------
      if ((gameStateRef.current === "Playing" || gameStateRef.current === "Pause") && !statsRef.current.isLanded) {
        const currentSpeed = Math.abs(velocity.z);
        const maxSpd = statsRef.current.boostSpeed || 60;
        const speedPct = THREE.MathUtils.clamp(currentSpeed / maxSpd, 0, 1);

        // Dynamic camera pull-back and FOV expansion based on speed percentage
        const dynamicZ = 38 + speedPct * 11; // pull back further at high speeds
        const dynamicY = 8.5 + speedPct * 2.2; // raise slightly
        const targetFOV = 65 + speedPct * 12; // expand field of view for high-speed warping sensation

        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 1 - Math.exp(-6 * delta));
        camera.updateProjectionMatrix();

        const backVec = new THREE.Vector3(0, dynamicY, dynamicZ).applyQuaternion(shipGroup.quaternion);
        const targetCam = new THREE.Vector3().copy(shipGroup.position).add(backVec);

        // Framerate-independent camera lerp for gorgeous, silky smooth lag
        const camLerpFactor = 1 - Math.exp(-8 * delta); // 8Hz follow rate
        camera.position.lerp(targetCam, camLerpFactor);
        
        // Dynamic target gaze
        const lookTarget = new THREE.Vector3().copy(shipGroup.position).addScaledVector(direction, 25);
        camera.lookAt(lookTarget);
      } else if ((gameStateRef.current === "Playing" || gameStateRef.current === "Pause") && statsRef.current.isLanded) {
        // dynamic rotating orbital base camera
        const activePlanet = planetMeshes.find(p => p.id === statsRef.current.currentPlanetId);
        const lookAngle = now * 0.00012;
        if (activePlanet) {
          camera.position.set(
            activePlanet.mesh.position.x + Math.cos(lookAngle) * 520,
            110,
            activePlanet.mesh.position.z + Math.sin(lookAngle) * 520
          );
          camera.lookAt(activePlanet.mesh.position);
        } else if (statsRef.current.currentPlanetId === "station") {
          // Rotate camera around Space Station at (3000, 150, 3000)
          const stPos = new THREE.Vector3(3000, 150, 3000);
          camera.position.set(
            stPos.x + Math.cos(lookAngle) * 600,
            240,
            stPos.z + Math.sin(lookAngle) * 600
          );
          camera.lookAt(stPos);
        }
      } else if (gameStateRef.current === "MainMenu") {
        // Slowly fly camera through space with a circular cinematic sector flyby
        const menuTime = now * 0.00003;
        const orbitRadius = 4500;
        
        // Base flying camera path
        const baseCamX = Math.cos(menuTime) * orbitRadius + 1500;
        const baseCamY = 250 + Math.sin(menuTime * 1.5) * 120;
        const baseCamZ = Math.sin(menuTime) * orbitRadius + 2000;

        // Weightless breathing hand-held camera float (using overlapping sine wave nodes)
        const breatheX = Math.sin(now * 0.00095) * 12.0;
        const breatheY = Math.cos(now * 0.00078) * 8.5;
        const breatheZ = Math.sin(now * 0.00115) * 12.0;

        camera.position.set(baseCamX + breatheX, baseCamY + breatheY, baseCamZ + breatheZ);

        // Cinematic lookAt: dynamic point shifting between the Sun (0, 100, 0) and local sectors
        const focalX = Math.sin(menuTime * 0.5) * 600;
        const focalY = 100 + Math.cos(menuTime) * 80;
        const focalZ = 1500 + Math.cos(menuTime * 0.5) * 800;
        camera.lookAt(new THREE.Vector3(focalX, focalY, focalZ));
      }

      if (!statsRef.current.isExploring) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Cleanup WebGL elements
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }
      scene.clear();
      renderer.dispose();
    };
  }, [stats.currentSystemId, hullColor, gameState === "MainMenu"]);

  const handleWarp = (targetSystemId: string) => {
    setStats((prev) => ({
      ...prev,
      currentSystemId: targetSystemId,
      fuel: Math.max(0, prev.fuel - 15),
    }));
    setPlayerPos([0, 0, 4800]);
    if (shipGroupRef.current) {
      shipGroupRef.current.position.set(0, 0, 4800);
    }
    const targetSystemObj = GALAXY_SYSTEMS.find(s => s.id === targetSystemId);
    const targetName = targetSystemObj?.name || targetSystemId;
    addLog(`HYPERDRIVE CORE: Quantum fold-drive warp successful. Entering star system: ${targetName}.`, "success");

    // Discover new star system procedurally after a brief delay
    setTimeout(() => {
      if (targetSystemObj) {
        triggerDiscovery(
          targetSystemId,
          `${targetName} System`,
          `A newly charted sector in the ${targetSystemObj.galaxy} galaxy. It is centered around a glowing ${targetSystemObj.starType} and contains ${targetSystemObj.planets.length} orbiting planets.`,
          "galaxy"
        );
      }
    }, 1500);
  };

  const handleUpdateStats = (newStats: Partial<PlayerStats>) => {
    setStats((prev) => ({ ...prev, ...newStats }));
  };

  if (webglError) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-neutral-950 flex flex-col items-center justify-center p-8 text-white text-center font-sans">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.08)_0%,transparent_100%)]" />
        <div className="max-w-xl w-full border border-red-500/20 bg-neutral-900/60 p-8 backdrop-blur-md rounded-none text-center space-y-6">
          <div className="text-red-500 font-mono text-xs uppercase tracking-widest animate-pulse font-extrabold">
            ⚠️ SYSTEM INGRESS ERROR // GRAPHICS INTERFACE COUPLING FAILURE
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white uppercase font-sans">
            WebGL Context <span className="text-red-500 font-bold">Blocked</span>
          </h1>
          <p className="text-neutral-400 text-sm leading-relaxed font-medium font-sans">
            The application is unable to initialize a WebGL graphics context. This usually happens when hardware acceleration is disabled in your browser settings, or when running within an iframe that restricts WebGL.
          </p>
          <div className="bg-black/40 p-4 border border-white/5 text-left font-mono text-xs space-y-2">
            <div className="text-blue-400 font-bold">// TROUBLESHOOTING CHECKLIST:</div>
            <div className="text-neutral-400">• Open this application in a <span className="text-blue-400">new tab</span> to bypass sandbox limits.</div>
            <div className="text-neutral-400">• Enable <span className="text-blue-400">Use graphics acceleration when available</span> in browser settings.</div>
            <div className="text-neutral-400">• Verify WebGL support at <a href="https://get.webgl.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-400">get.webgl.org</a>.</div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-red-500 hover:bg-red-400 text-neutral-950 font-bold font-mono tracking-widest text-xs uppercase rounded-none transition-all shadow-md shadow-red-500/10 cursor-pointer"
          >
            RECOUPLE GRAPHICS ENGINE
          </button>
        </div>
      </div>
    );
  }

  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-[9999] bg-neutral-950 flex flex-col items-center justify-center p-6 text-white text-center select-none font-sans">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.06)_0%,transparent_100%)] animate-pulse" />
        
        <div className="max-w-md w-full p-8 border border-blue-500/15 bg-neutral-900/50 backdrop-blur-xl rounded-lg shadow-2xl flex flex-col items-center space-y-6 text-center">
          {/* Animated rotation phone icon */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-ping opacity-75" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-0 rounded-full bg-blue-500/5 animate-pulse" />
            <svg 
              className="w-12 h-12 text-blue-400 animate-bounce" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="1.5"
              style={{ animationDuration: '2.5s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 15h9" />
            </svg>
            <div className="absolute -right-1 top-4 text-blue-500 font-bold animate-pulse text-xs">➔</div>
          </div>

          <div className="space-y-2">
            <div className="text-blue-500 font-mono text-xs uppercase tracking-widest font-extrabold">
              ⚓ DETECTING DEVICE ROTATION
            </div>
            <h1 className="text-2xl font-light tracking-tight text-white uppercase">
              Landscape Mode <span className="text-blue-400 font-bold">Required</span>
            </h1>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Please rotate your device to landscape orientation. VOIDFLYER requires a wide combat view screen to operate the flight deck.
            </p>
          </div>

          <div className="w-full bg-black/40 border border-white/5 rounded p-3.5 text-left font-mono text-[11px] text-neutral-400 flex flex-col gap-1.5">
            <div className="text-blue-400 font-semibold uppercase tracking-wider">// BRIDGE PROTOCOL:</div>
            <div>• Toggle <span className="text-white font-medium">Auto-Rotate</span> on in your phone controls.</div>
            <div>• Turn your phone 90° sideways to unlock cockpit.</div>
          </div>
        </div>
      </div>
    );
  }

  // Map GameState to GameHUD's activeScreen format
  const getActiveScreenForHUD = (): "flight" | "landing" | "landed" | "gameover" | "about" | "docked" => {
    if (gameState === "GameOver") return "gameover";
    if (gameState === "Playing" || gameState === "Pause") {
      if (stats.isLanded) return "landed";
      if (stats.landingProgress > 0) return "landing";
      return "flight";
    }
    return "flight";
  };

  if (gameState === "MainMenu") {
    return (
      <MainMenuScreen
        onStartGame={handleStartGame}
        isMobile={isMobile}
      />
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-950">
      {/* Three.js canvas node */}
      <div ref={mountRef} className={`absolute inset-0 w-full h-full ${stats.isExploring ? "hidden pointer-events-none" : ""}`} id="flight_canvas" />

      {/* Surface Exploration Overlay */}
      {stats.isExploring && (
        <div className="absolute inset-0 z-40 bg-neutral-950">
          <PlanetSurface
            planetConfig={currentSystem.planets.find(p => p.id === stats.currentPlanetId) || currentSystem.planets[0]}
            onExit={() => {
              setStats((prev) => ({ ...prev, isExploring: false }));
              addLog("Boarded starship cockpit. Orbital flight controls re-engaged.", "success");
              audioEngine.setMusicZone("exploration");
            }}
            stats={stats}
            onUpdateStats={handleUpdateStats}
          />
        </div>
      )}

      {/* Interactive HUD Layer */}
      <GameHUD
        stats={stats}
        logs={logs}
        planets={currentSystem.planets}
        shipName={shipName}
        hullColor={hullColor}
        fps={fps}
        playerPos={playerPos}
        playerRot={playerRot}
        laserCooldown={laserCooldown}
        missileCooldown={missileCooldown}
        targetEnemy={targetEnemy}
        blackHoleDistance={blackHoleDistance}
        settings={settings}
        enemyPositions={enemyPositions}
        enemiesData={enemiesData}
        navTargets={navTargets}
        damageNumbers={damageNumbers}
        hitMarkerActive={hitMarkerActive}
        onUpdateSettings={setSettings}
        onSaveGame={handleSaveGame}
        onLoadGame={handleLoadGame}
        onRefuel={handleRefuel}
        onRepair={handleRepair}
        onTakeOff={handleTakeOff}
        onRestart={handleRestart}
        onQuit={handleQuit}
        activeScreen={getActiveScreenForHUD()}
        isPaused={gameState === "Pause"}
        onTogglePause={() => {
          if (gameState === "Playing") {
            setGameState("Pause");
          } else if (gameState === "Pause") {
            setGameState("Playing");
          }
        }}
        onWarp={handleWarp}
        onUpdateStats={handleUpdateStats}
        onAddLog={addLog}
        landingStage={landingStage}
        scanTargets={scanTargets}
        activeScanTargetId={activeScanTargetId}
        scanProgress={scanProgress}
        isScanning={isScanning}
        onInitiateScan={triggerActiveScan}
        reentryIntensity={reentryIntensity}
        weather={planetWeather}
      />

      {/* Mobile Touch Overlay HUD */}
      {isMobile && gameState === "Playing" && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 md:p-6 font-mono select-none">
          {/* Top panel buttons: Pause, Weapon Switch, Dock */}
          <div className="w-full flex justify-between items-center pointer-events-auto">
            {/* Left side: Pause */}
            <button
              onClick={() => {
                audioEngine.playClick();
                setGameState("Pause");
              }}
              className="px-4 py-2 bg-neutral-950/80 border border-blue-500/20 text-blue-400 font-bold text-xs uppercase cursor-pointer backdrop-blur-md rounded-sm active:scale-95 transition-transform"
            >
              PAUSE
            </button>
            
            {/* Center: Docking coupling button if active */}
            {stats.currentPlanetId && (
              <button
                onClick={() => {
                  audioEngine.playClick();
                  keysRef.current["e"] = true;
                  keysRef.current["keye"] = true;
                  setTimeout(() => { 
                    keysRef.current["e"] = false; 
                    keysRef.current["keye"] = false; 
                  }, 50);
                }}
                className="px-6 py-3 bg-green-500 hover:bg-green-400 active:bg-green-600 text-neutral-950 font-black text-xs tracking-wider uppercase cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.45)] animate-pulse rounded-sm active:scale-95 transition-transform"
              >
                {stats.isLanded ? "LAUNCH / TAKE OFF" : "ENGAGE COUPLER DOCK"}
              </button>
            )}

            {/* Right side: Weapon Switcher */}
            <button
              onClick={() => {
                audioEngine.playClick();
                setMobileWeapon((prev) => (prev === "laser" ? "missile" : "laser"));
              }}
              className="px-4 py-2 bg-neutral-950/80 border border-red-500/20 text-red-400 font-bold text-xs uppercase cursor-pointer backdrop-blur-md flex items-center gap-1.5 rounded-sm active:scale-95 transition-transform"
            >
              WEAPON: <span className="text-white font-black">{mobileWeapon.toUpperCase()}</span>
            </button>
          </div>

          {/* Bottom joysticks and action buttons */}
          <div className="w-full flex justify-between items-end px-4 md:px-8 pb-4">
            {/* Left Zone: Joystick + Speed controls */}
            <div className="flex items-end gap-6 pointer-events-auto pl-4">
              <VirtualJoystick
                title="STEER // FLIGHT"
                size={settings.joystickSize || 108}
                onMove={(x, y) => {
                  leftJoystickRef.current = { x, y };
                }}
              />
              <div className="flex flex-col gap-3">
                {/* Boost Button */}
                <button
                  onTouchStart={() => {
                    touchBoostRef.current = true;
                  }}
                  onTouchEnd={() => {
                    touchBoostRef.current = false;
                  }}
                  onMouseDown={() => {
                    touchBoostRef.current = true;
                  }}
                  onMouseUp={() => {
                    touchBoostRef.current = false;
                  }}
                  className="w-16 h-16 rounded-full border border-orange-500/50 bg-gradient-to-br from-orange-600/30 to-red-600/30 active:from-orange-500 active:to-red-600 flex flex-col items-center justify-center text-[10px] text-orange-200 font-extrabold uppercase shadow-[0_0_20px_rgba(249,115,22,0.25)] cursor-pointer select-none transition-all duration-100 active:scale-95 border-b-2 border-b-orange-500/80"
                >
                  <span className="text-[8px] opacity-75">BOOST</span>
                  <span className="text-xs font-black">THRUST</span>
                </button>

                {/* Brake Button */}
                <button
                  onTouchStart={() => {
                    touchBrakeRef.current = true;
                  }}
                  onTouchEnd={() => {
                    touchBrakeRef.current = false;
                  }}
                  onMouseDown={() => {
                    touchBrakeRef.current = true;
                  }}
                  onMouseUp={() => {
                    touchBrakeRef.current = false;
                  }}
                  className="w-16 h-16 rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900/40 active:from-cyan-500/40 active:to-slate-800/40 flex flex-col items-center justify-center text-[10px] text-cyan-300 font-extrabold uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer select-none transition-all duration-100 active:scale-95 border-b-2 border-b-cyan-500/50"
                >
                  <span className="text-[8px] opacity-75">REVERSE</span>
                  <span className="text-xs font-black">BRAKE</span>
                </button>
              </div>
            </div>

            {/* Right Zone: Roll joystick + Firing control */}
            <div className="flex items-end gap-6 pointer-events-auto pr-4">
              <VirtualJoystick
                title="SPIN // ROLL"
                size={settings.joystickSize || 108}
                onMove={(x, y) => {
                  rightJoystickRef.current = { x, y };
                }}
              />
              
              {/* Massive firing trigger */}
              <button
                onTouchStart={() => {
                  touchShootRef.current = true;
                }}
                onTouchEnd={() => {
                  touchShootRef.current = false;
                }}
                onMouseDown={() => {
                  touchShootRef.current = true;
                }}
                onMouseUp={() => {
                  touchShootRef.current = false;
                }}
                className="w-24 h-24 rounded-full border-2 border-red-500/60 bg-gradient-to-br from-red-600/30 to-rose-700/30 active:from-red-600 active:to-rose-700 flex flex-col items-center justify-center text-red-100 font-black tracking-widest uppercase cursor-pointer select-none transition-all duration-100 active:scale-90 shadow-[0_0_35px_rgba(239,68,68,0.35)] active:shadow-[0_0_55px_rgba(239,68,68,0.75)] border-b-4 border-b-red-500/90 relative overflow-hidden group"
              >
                {/* Decorative inner targeting overlay */}
                <div className="absolute inset-2 rounded-full border border-dashed border-red-500/20 pointer-events-none group-active:border-red-400/40" />
                <div className="absolute w-1 h-3 bg-red-400/30 top-1.5 left-1/2 -translate-x-1/2" />
                <div className="absolute w-1 h-3 bg-red-400/30 bottom-1.5 left-1/2 -translate-x-1/2" />
                <div className="absolute h-1 w-3 bg-red-400/30 left-1.5 top-1/2 -translate-y-1/2" />
                <div className="absolute h-1 w-3 bg-red-400/30 right-1.5 top-1/2 -translate-y-1/2" />
                
                <span className="text-[8px] text-red-400 font-bold tracking-normal z-10">WEAPONS</span>
                <span className="text-sm font-extrabold tracking-wider z-10">FIRE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discovery Overlay Pop-up */}
      {discoveryNotification && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto">
          <div className="relative border border-emerald-500/30 bg-neutral-950/95 p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center space-y-5 font-mono select-none rounded-sm border-t-4 border-t-emerald-500">
            {/* Ambient grid glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative text-emerald-400 text-xs font-bold uppercase tracking-widest animate-pulse flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              🛸 NEW CELESTIAL DISCOVERY
            </div>
            
            <h2 className="relative text-2xl font-black tracking-tight text-white uppercase border-b border-neutral-800 pb-3">
              {discoveryNotification.title}
            </h2>
            
            <p className="relative text-xs text-neutral-400 font-sans leading-relaxed text-justify">
              {discoveryNotification.description}
            </p>
            
            {discoveryNotification.fact && (
              <div className="relative p-4 border border-emerald-500/20 bg-emerald-950/10 text-emerald-300 text-xs text-left leading-relaxed rounded-sm space-y-1">
                <span className="font-extrabold text-amber-400 uppercase tracking-wider text-[10px] block">
                  📖 UNLOCKED SCIENTIFIC FACT
                </span>
                <p className="italic text-emerald-100 font-sans">"{discoveryNotification.fact}"</p>
              </div>
            )}

            <button
              onClick={() => {
                audioEngine.playClick();
                setDiscoveryNotification(null);
              }}
              className="relative w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-neutral-950 font-black text-xs tracking-widest uppercase transition-all duration-150 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
            >
              RECORD TO FLIGHT LOGS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
