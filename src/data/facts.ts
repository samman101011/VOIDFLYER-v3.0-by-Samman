export interface ScientificFact {
  category: "PLANETS" | "MOONS" | "BLACK HOLES" | "NEUTRON STARS" | "PULSARS" | "NEBULAE" | "GALAXIES" | "GAS GIANTS";
  fact: string;
}

export const PLANET_FACTS = [
  "Terrestrial planets like Earth are composed of rocky materials and have solid, defined surfaces.",
  "Venus features a runaway greenhouse effect, trapping star-heat to melt surface lead plates.",
  "Liquid oceans can only persist in the circumstellar habitable orbital zones of home stars."
];

export const MOON_FACTS = [
  "Jupiter's moon Ganymede is the largest in the galaxy, generating its own magnetic envelope.",
  "Saturn's moon Enceladus contains a global sub-surface ocean venting massive water plumes.",
  "Gravitation locks most planetary moons tidally, forcing them to always face their host world."
];

export const BLACK_HOLE_FACTS = [
  "The event horizon defines the gravity boundary where escape velocity exceeds light speed.",
  "Relativistic gravity dilates local spacetime severely, slowing time relative to outer sectors.",
  "Superdense collapsed star clusters form stellar black holes after exhausting fusion elements."
];

export const NEUTRON_STAR_FACTS = [
  "One teaspoon of compressed neutron star matter would weigh billions of tons on Earth.",
  "Gravitational collapse forces electrons and protons to fuse into dense degenerate neutrons.",
  "Neutron stars possess intense gravitational fields with escape velocities up to half of light speed."
];

export const PULSAR_FACTS = [
  "Pulsars are magnetized neutron cores spinning at extreme rotational velocities.",
  "Focused beams of magnetic radiation sweeping past space sensors act as cosmic clocks.",
  "Rapid millisecond pulsars can spin over 700 times per second during matter accretion."
];

export const NEBULA_FACTS = [
  "Nebulae are giant interstellar clouds consisting of hydrogen, helium, and ionized dusts.",
  "Cold clumps of dense molecular gas inside nebulae collapse to ignite new star nurseries.",
  "Highly reflective emission nebulae glow brightly from intense ultra-violet stellar winds."
];

export const GALAXY_FACTS = [
  "The observable universe contains over two trillion galaxies clustered in massive webs.",
  "Supermassive black holes of millions of solar masses anchor the centers of large galaxies.",
  "Vast halos of invisible dark matter provide the gravitational scaffolding for galaxies."
];

export const GAS_GIANT_FACTS = [
  "Gas giants are composed mostly of hydrogen and helium, completely lacking a solid surface.",
  "Jupiter's Great Red Spot is a persistent planetary-scale hurricane over 300 years old.",
  "Immense core pressures compress hydrogen into a dense liquid state of metallic conductor."
];

export const ALL_SCIENTIFIC_FACTS: ScientificFact[] = [
  ...PLANET_FACTS.map(f => ({ category: "PLANETS" as const, fact: f })),
  ...MOON_FACTS.map(f => ({ category: "MOONS" as const, fact: f })),
  ...BLACK_HOLE_FACTS.map(f => ({ category: "BLACK HOLES" as const, fact: f })),
  ...NEUTRON_STAR_FACTS.map(f => ({ category: "NEUTRON STARS" as const, fact: f })),
  ...PULSAR_FACTS.map(f => ({ category: "PULSARS" as const, fact: f })),
  ...NEBULA_FACTS.map(f => ({ category: "NEBULAE" as const, fact: f })),
  ...GALAXY_FACTS.map(f => ({ category: "GALAXIES" as const, fact: f })),
  ...GAS_GIANT_FACTS.map(f => ({ category: "GAS GIANTS" as const, fact: f })),
];
