import React, { useState } from "react";
import { Rocket, Volume2, VolumeX, Shield, Zap, Compass, Info, ArrowRight } from "lucide-react";
import { audioEngine } from "./AudioEngine";

interface IntroScreenProps {
  onStartGame: (selectedShip: {
    name: string;
    hullColor: string;
    maxSpeed: number;
    maxFuel: number;
    handling: number;
  }) => void;
  isMobile?: boolean;
}

const SHIP_PRESETS = [
  {
    name: "Icarus Scout",
    description: "Light exploration scout with swift handling and high-efficiency thrusters.",
    hullColor: "#38bdf8", // Cyan
    maxSpeed: 180,
    maxFuel: 100,
    handling: 1.5,
    icon: Rocket,
  },
  {
    name: "Aegis Vanguard",
    description: "Heavy reinforced vessel. Extremely durable hull with massive fuel capacity.",
    hullColor: "#fbbf24", // Gold
    maxSpeed: 120,
    maxFuel: 180,
    handling: 0.9,
    icon: Shield,
  },
  {
    name: "Hyperion Swift",
    description: "High-velocity racing interceptor. Extreme speed, but burns fuel rapidly.",
    hullColor: "#ef4444", // Red
    maxSpeed: 250,
    maxFuel: 80,
    handling: 1.2,
    icon: Zap,
  }
];

export const IntroScreen: React.FC<IntroScreenProps> = ({ onStartGame, isMobile = false }) => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [muted, setMuted] = useState(false);

  const handleMuteToggle = () => {
    const isMuted = audioEngine.toggleMute();
    setMuted(isMuted);
    audioEngine.playClick();
  };

  const handleStart = () => {
    audioEngine.playClick();
    audioEngine.init(); // Make sure Web Audio activates
    onStartGame({
      name: SHIP_PRESETS[selectedPreset].name,
      hullColor: SHIP_PRESETS[selectedPreset].hullColor,
      maxSpeed: SHIP_PRESETS[selectedPreset].maxSpeed,
      maxFuel: SHIP_PRESETS[selectedPreset].maxFuel,
      handling: SHIP_PRESETS[selectedPreset].handling,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-neutral-950/25 backdrop-blur-[2px] text-white font-sans p-8 overflow-y-auto select-none">
      
      {/* SCREEN VIGNETTE BACKGROUND EFFECT */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.95)] z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.2)_0%,rgba(5,5,8,0.75)_100%)]" />

      {/* Top Bar */}
      <div className="w-full max-w-6xl flex justify-between items-center pb-4 border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-blue-500 animate-pulse" />
          <span className="font-mono text-xs tracking-widest text-blue-400 font-bold uppercase">
            VOIDFLYER v3.0 // {isMobile ? "ANDROID PLATFORM DETECTION ACTIVE" : "DESKTOP INTEL COUPLER ACTIVE"}
          </span>
        </div>
        <button
          onClick={handleMuteToggle}
          className="p-2.5 rounded-none border border-white/10 bg-white/5 hover:bg-white/10 transition-colors pointer-events-auto"
          title="Toggle Audio Engine"
        >
          {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
        </button>
      </div>

      {/* Main Content Box */}
      <div className="w-full max-w-6xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 z-10">
        
        {/* Left Side: Game Title & Ship Selection */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-blue-500 font-mono font-bold">Orbital Newtonian Flight Simulator</div>
            <h1 className="text-5xl md:text-7xl font-light italic tracking-tight text-white uppercase font-sans">
              VoidFlyer <span className="text-blue-500 font-bold not-italic">3D</span>
            </h1>
            <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-xl font-medium">
              Explore a highly polished, procedurally simulated solar system featuring a roaring sun, dense asteroid belts, five unique landing-ready planets, and authentic 3D spaceship flight.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-mono text-xs tracking-wider text-neutral-400 uppercase font-bold">SELECT STARSHIP CHASSIS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SHIP_PRESETS.map((ship, idx) => {
                const Icon = ship.icon;
                const isSelected = selectedPreset === idx;
                return (
                  <div
                    key={ship.name}
                    onClick={() => {
                      audioEngine.playClick();
                      setSelectedPreset(idx);
                    }}
                    className={`p-5 rounded-none border cursor-pointer transition-all flex flex-col justify-between h-48 pointer-events-auto ${
                      isSelected
                        ? "border-blue-500 bg-blue-950/25 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                        : "border-white/5 bg-black/40 backdrop-blur-md hover:border-white/10 hover:bg-neutral-900/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4" style={{ color: ship.hullColor }} />
                        <h4 className="font-mono text-xs font-bold tracking-wider text-white uppercase">{ship.name}</h4>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-normal line-clamp-3 font-sans font-medium">{ship.description}</p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-white/5 flex gap-2 justify-between items-center text-[9px] font-mono">
                      <div className="flex flex-col">
                        <span className="text-neutral-500">VELOCITY</span>
                        <span className="font-bold text-blue-400">{ship.maxSpeed} u/s</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-neutral-500">FUEL CELL</span>
                        <span className="font-bold text-amber-400">{ship.maxFuel}L</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-neutral-500">CONTROL</span>
                        <span className="font-bold text-emerald-400">x{ship.handling}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full md:w-fit px-8 py-4 bg-blue-500 hover:bg-blue-400 text-neutral-950 font-bold font-mono tracking-wider text-xs uppercase rounded-none transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-3 group pointer-events-auto cursor-pointer"
          >
            Launch Starship Control
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Right Side: Flight Controls & Planets Guide */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-center">
          {/* Controls */}
          <div className="p-6 rounded-none border border-white/5 bg-black/50 backdrop-blur-md">
            <h3 className="font-mono text-xs tracking-wider text-blue-400 font-bold uppercase mb-4 flex items-center gap-2">
              <Compass className="w-4 h-4" /> {isMobile ? "TOUCH FLIGHT DECK LAYOUT" : "FLIGHT DECK LAYOUT"}
            </h3>
            <div className="grid grid-cols-1 gap-y-1.5 text-xs font-mono">
              {isMobile ? (
                <>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Steer (Pitch & Yaw)</span>
                    <span className="text-blue-400 font-bold">LEFT JOYSTICK</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Roll (Spin Ship)</span>
                    <span className="text-blue-400 font-bold">RIGHT JOYSTICK X</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Fire Weapon (Laser/Missile)</span>
                    <span className="px-2 py-0.5 bg-red-950/40 border border-red-500/20 text-[10px] text-red-400 font-bold uppercase rounded-sm">TAP SHOOT</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Fusion Engine Boost</span>
                    <span className="px-2 py-0.5 bg-orange-950/40 border border-orange-500/20 text-[10px] text-orange-400 font-bold uppercase rounded-sm">HOLD BOOST</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Atmospheric Brake</span>
                    <span className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white uppercase rounded-sm">HOLD BRAKE</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Outpost Docking Coupling</span>
                    <span className="px-2 py-0.5 bg-green-950/40 border border-green-500/20 text-[10px] text-green-400 font-bold uppercase rounded-sm">TAP DOCK</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Pitch (Up/Down)</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">W / S</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Roll (Left/Right)</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">A / D</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Yaw (Rotate)</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">Q / E</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Engine Boost</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">L_Shift</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Engine Brake</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">L_Ctrl</kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-neutral-400">Docking Descent Pad</span>
                    <kbd className="px-2 py-0.5 bg-neutral-900 border border-white/10 text-[10px] text-white">Spacebar</kbd>
                  </div>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2.5 items-start text-[11px] text-neutral-400 leading-normal bg-white/5 p-3 rounded-none border border-white/5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span className="font-sans font-medium">
                {isMobile 
                  ? "Drag left stick to adjust direction, right stick to spin. Approach planetary outposts and maintain zero velocities to engage docking locks!" 
                  : "Slightly adjust your Mouse cursor to steer. Slow down and maintain visual landing pad alignment to dock smoothly!"}
              </span>
            </div>
          </div>

          {/* Planets Preview list */}
          <div className="p-6 rounded-none border border-white/5 bg-black/50 backdrop-blur-md space-y-4">
            <h3 className="font-mono text-xs tracking-wider text-blue-400 font-bold uppercase flex items-center gap-2">
              <Info className="w-4 h-4" /> LOCAL SOLAR SYSTEM
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center text-[9px] font-mono">
              <div className="p-2.5 bg-yellow-500/5 border border-yellow-500/10 rounded-none">
                <div className="w-3.5 h-3.5 bg-amber-500 rounded-full mx-auto mb-1.5 shadow-md shadow-amber-500/30" />
                <span className="text-amber-300 block font-bold truncate">Aurelia</span>
              </div>
              <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-none">
                <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full mx-auto mb-1.5 shadow-md shadow-emerald-500/30" />
                <span className="text-emerald-300 block font-bold truncate">Verdant</span>
              </div>
              <div className="p-2.5 bg-pink-500/5 border border-pink-500/10 rounded-none">
                <div className="w-3.5 h-3.5 bg-pink-500 rounded-full mx-auto mb-1.5 shadow-md shadow-pink-500/30" />
                <span className="text-pink-300 block font-bold truncate">Zephyr</span>
              </div>
              <div className="p-2.5 bg-blue-500/5 border border-blue-500/10 rounded-none">
                <div className="w-3.5 h-3.5 bg-blue-500 rounded-full mx-auto mb-1.5 shadow-md shadow-blue-500/30" />
                <span className="text-blue-300 block font-bold truncate">Kryos</span>
              </div>
              <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-none">
                <div className="w-3.5 h-3.5 bg-red-500 rounded-full mx-auto mb-1.5 shadow-md shadow-red-500/30" />
                <span className="text-red-300 block font-bold truncate">Ignis</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer copyright */}
      <div className="w-full max-w-6xl pt-4 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-neutral-500 font-mono gap-2 z-10">
        <span>STABLE 60 FPS WEBGL GRAPHICS ACCELERATION DETECTED</span>
        <span>PILOT STARSHIP ENGAGEMENT COUPLER MANDATED // 2026</span>
      </div>
    </div>
  );
};
