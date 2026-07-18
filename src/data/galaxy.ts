import { SolarSystem, PlanetConfig } from "../types";

// Seed-based random number generator for deterministic generation
export function createPRNG(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const GALAXIES: ("Milky Way" | "Andromeda" | "Triangulum" | "Centaurus" | "Sombrero")[] = [
  "Milky Way",
  "Andromeda",
  "Triangulum",
  "Centaurus",
  "Sombrero",
];

const STAR_TYPES: ("Red Dwarf" | "Yellow Star" | "Blue Giant" | "White Dwarf" | "Neutron Star")[] = [
  "Red Dwarf",
  "Yellow Star",
  "Blue Giant",
  "White Dwarf",
  "Neutron Star",
];

const STAR_COLORS = {
  "Red Dwarf": "#ef4444",   // Red
  "Yellow Star": "#eab308", // Golden Yellow
  "Blue Giant": "#3b82f6",  // Blue
  "White Dwarf": "#f8fafc",  // Bright white
  "Neutron Star": "#a855f7", // Violet pulsar glow
};

const SYSTEM_PREFIXES = ["Nova", "Cygnus", "Kepler", "Orion", "Alpha", "Sirius", "Gliese", "Zephyr", "Sol", "Vanguard", "Xylos", "Zorax", "Stellar", "Cosmo", "Astro", "Centauri", "Epsilon", "Vega", "Polaris", "Antares"];
const SYSTEM_SUFFIXES = ["Prime", "Major", "Nexus", "Void", "Reach", "Horizon", "Nebula", "Cluster", "Borealis", "Deep", "Crest", "Apex", "Minor", "X", "Y", "Z", "Core", "Spire", "Belt", "Matrix"];

const BIOMES = ["Barren Desert", "Volcanic Basalt", "Lush Forest", "Oceanic Aquatic", "Glacial Tundra", "Neon Gas", "Crystal Fields", "Magnetic Swamplands"];
const WEATHER_TYPES = ["Solar Radiation Flares", "Sulfuric acid Rain", "Gentle Breeze", "Bioluminescent Rainstorms", "Nitrogen Blizzards", "Magnetic Dust Storms", "Superheated Winds", "Methane Geyser Vapor"];

export function generateGalaxyData(): SolarSystem[] {
  const systems: SolarSystem[] = [];
  const rand = createPRNG("voidflyer_universe_seed");

  // 1. Generate the initial iconic home system: Sol (similar to previous planet configs but enhanced)
  const solPlanets: PlanetConfig[] = [
    {
      id: "aurelia",
      name: "Aurelia",
      color: "#eab308",
      atmosphereColor: "Golden Gold",
      radius: 120,
      orbitRadius: 2800,
      orbitSpeed: 0.15,
      rotationSpeed: 0.02,
      description: "An ancient golden desert planet baked by intense solar radiation. Its glittering dunes are rich in rare auric silicates.",
      features: ["Superheated Winds", "Auric Silicates dunes", "Extremely dense atmosphere"],
      hasRing: true,
      ringColor: "#ca8a04",
      ringInnerRadius: 150,
      ringOuterRadius: 260,
      biome: "Barren Desert",
      weather: "Solar Radiation Flares",
      gravity: 1.2,
      hasOceans: false,
      hasMountains: true,
      mineralDensity: { iron: 70, titanium: 45, gold: 90, crystal: 15, uranium: 30, darkMatter: 5 }
    },
    {
      id: "verdant",
      name: "Verdant",
      color: "#10b981",
      atmosphereColor: "Chlorophyll Emerald",
      radius: 160,
      orbitRadius: 5200,
      orbitSpeed: 0.1,
      rotationSpeed: 0.015,
      description: "A lush garden world rich in chlorophyll forest grids, sweeping bioluminescent oceans, and pristine organic life.",
      features: ["Bioluminescent oceans", "Arboreal canopy grid", "Selene Lunar orbit"],
      biome: "Lush Forest",
      weather: "Bioluminescent Rainstorms",
      gravity: 0.95,
      hasOceans: true,
      hasMountains: true,
      mineralDensity: { iron: 80, titanium: 60, gold: 30, crystal: 50, uranium: 10, darkMatter: 0 }
    },
    {
      id: "zephyr",
      name: "Zephyr",
      color: "#ec4899",
      atmosphereColor: "Magenta Gas",
      radius: 260,
      orbitRadius: 8500,
      orbitSpeed: 0.06,
      rotationSpeed: 0.03,
      description: "A colossal magenta gas giant covered in churning, highly magnetic crimson superstorms and crystalline clouds.",
      features: ["Supercell Vortex storms", "Crystalline clouds", "Thick neon rings"],
      hasRing: true,
      ringColor: "#f472b6",
      ringInnerRadius: 300,
      ringOuterRadius: 550,
      biome: "Neon Gas",
      weather: "Magnetic Dust Storms",
      gravity: 2.4,
      hasOceans: false,
      hasMountains: false,
      mineralDensity: { iron: 10, titanium: 20, gold: 40, crystal: 80, uranium: 5, darkMatter: 35 }
    },
    {
      id: "kryos",
      name: "Kryos",
      color: "#06b6d4",
      atmosphereColor: "Glacial Cyan",
      radius: 140,
      orbitRadius: 11800,
      orbitSpeed: 0.04,
      rotationSpeed: 0.01,
      description: "A frozen glacier world wrapped in deep reflective blue ice sheets, methane geysers, and freezing nitrogen blizzards.",
      features: ["Deep reflective glaciers", "Liquid methane geysers", "Sub-zero cold zones"],
      biome: "Glacial Tundra",
      weather: "Nitrogen Blizzards",
      gravity: 0.8,
      hasOceans: true,
      hasMountains: true,
      cloudsColor: "#cffafe",
      mineralDensity: { iron: 40, titanium: 75, gold: 10, crystal: 90, uranium: 40, darkMatter: 15 }
    },
    {
      id: "ignis",
      name: "Ignis",
      color: "#f97316",
      atmosphereColor: "Sulfuric Crimson",
      radius: 170,
      orbitRadius: 15000,
      orbitSpeed: 0.025,
      rotationSpeed: 0.025,
      description: "A hyperactive volcanic wasteland where black silicate tectonic plates float atop massive bubbling oceans of liquid basalt.",
      features: ["Active sulfur volcanic grids", "Basalt rivers", "Tectonic instability"],
      biome: "Volcanic Basalt",
      weather: "Sulfuric acid Rain",
      gravity: 1.6,
      hasOceans: true,
      hasMountains: true,
      mineralDensity: { iron: 95, titanium: 90, gold: 50, crystal: 20, uranium: 85, darkMatter: 10 }
    }
  ];

  systems.push({
    id: "sol_sector",
    name: "Sol Sector",
    galaxy: "Milky Way",
    starType: "Yellow Star",
    starColor: STAR_COLORS["Yellow Star"],
    hasBlackHole: true, // Sol sector retains our black hole at (12000, -12000)!
    hasWormhole: true,
    wormholeTargetSystemId: "kepler_prime",
    hasSpaceStation: true,
    planets: solPlanets,
    description: "The home sector of humanity, containing a yellow main sequence star, rich mining belts, an active military space station, a quantum wormhole, and a dangerous black hole on its outer fringe.",
  });

  // 2. Generate another 104 solar systems procedurally
  for (let i = 1; i <= 104; i++) {
    const galaxy = GALAXIES[Math.floor(rand() * GALAXIES.length)];
    const starType = STAR_TYPES[Math.floor(rand() * STAR_TYPES.length)];
    
    const prefix = SYSTEM_PREFIXES[Math.floor(rand() * SYSTEM_PREFIXES.length)];
    const suffix = SYSTEM_SUFFIXES[Math.floor(rand() * SYSTEM_SUFFIXES.length)];
    const id = `${prefix.toLowerCase()}_${suffix.toLowerCase()}_${i}`;
    const name = `${prefix} ${suffix} ${String.fromCharCode(65 + (i % 26))}-${i}`;

    // Decide special astronomical structures in the system
    const hasBlackHole = rand() < 0.15; // 15% chance of black hole
    const hasWormhole = rand() < 0.25;  // 25% chance of wormhole
    const hasSpaceStation = rand() < 0.70; // 70% of systems have space stations

    // Generate 1 to 4 planets for this system
    const planetCount = 1 + Math.floor(rand() * 4);
    const planets: PlanetConfig[] = [];
    
    for (let p = 1; p <= planetCount; p++) {
      const pColorRand = rand();
      const pColor = pColorRand < 0.15 ? "#10b981" : // emerald
                     pColorRand < 0.30 ? "#3b82f6" : // blue
                     pColorRand < 0.45 ? "#ec4899" : // pink
                     pColorRand < 0.60 ? "#ef4444" : // red
                     pColorRand < 0.75 ? "#0ea5e9" : // cyan
                     pColorRand < 0.90 ? "#eab308" : "#8b5cf6"; // gold or purple

      const pRadius = 80 + Math.floor(rand() * 140);
      const orbitRadius = 2500 + p * (2000 + Math.floor(rand() * 1500));
      const pName = `${prefix} ${String.fromCharCode(97 + p)}_${p}`;

      const biome = BIOMES[Math.floor(rand() * BIOMES.length)];
      const weather = WEATHER_TYPES[Math.floor(rand() * WEATHER_TYPES.length)];

      planets.push({
        id: `${id}_planet_${p}`,
        name: pName,
        color: pColor,
        atmosphereColor: `${pColorRand < 0.5 ? "Neon" : "Etheric"} ${pColor === "#3b82f6" ? "Sapphire" : "Aura"}`,
        radius: pRadius,
        orbitRadius,
        orbitSpeed: 0.05 + rand() * 0.15,
        rotationSpeed: 0.005 + rand() * 0.03,
        description: `A unique ${biome.toLowerCase()} planetary body. Local atmospheric sensors indicate active ${weather.toLowerCase()} weather profiles.`,
        features: [`Atmosphere Density: ${((pRadius / 100) * 1.1).toFixed(1)} atm`, `${biome} landscape`, `${weather}`],
        biome,
        weather,
        gravity: Number(((pRadius / 130) + 0.1).toFixed(2)),
        hasOceans: rand() < 0.5,
        hasMountains: rand() < 0.8,
        mineralDensity: {
          iron: Math.floor(rand() * 100),
          titanium: Math.floor(rand() * 100),
          gold: Math.floor(rand() * 100),
          crystal: Math.floor(rand() * 100),
          uranium: Math.floor(rand() * 100),
          darkMatter: starType === "Neutron Star" || hasBlackHole ? Math.floor(rand() * 100) : Math.floor(rand() * 15),
        }
      });
    }

    systems.push({
      id,
      name,
      galaxy,
      starType,
      starColor: STAR_COLORS[starType],
      hasBlackHole,
      hasWormhole,
      hasSpaceStation,
      planets,
      description: `A stellar solar system resting within the ${galaxy} galaxy. Driven by a powerful ${starType} core, with ${planets.length} orbiting planetary bodies.`,
    });
  }

  // Backlink wormholes so they actually teleport the player somewhere real!
  for (let i = 0; i < systems.length; i++) {
    if (systems[i].hasWormhole) {
      const targetIdx = (i + 17) % systems.length;
      systems[i].wormholeTargetSystemId = systems[targetIdx].id;
    }
  }

  return systems;
}

export const GALAXY_SYSTEMS = generateGalaxyData();
