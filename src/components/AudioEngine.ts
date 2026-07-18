class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private musicVolumeNode: GainNode | null = null;
  private sfxVolumeNode: GainNode | null = null;

  // SFX nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private boostGain: GainNode | null = null;
  private warningGain: GainNode | null = null;
  private warningOsc: OscillatorNode | null = null;

  // Music / Ambient nodes
  private ambientGain: GainNode | null = null;
  private ambientOscs: { osc: OscillatorNode; lfo: OscillatorNode; oscGain: GainNode }[] = [];
  private currentZone: string = "none";

  private isMuted: boolean = false;
  private initialized: boolean = false;

  private activeMusicVolume: number = 0.5;
  private activeSfxVolume: number = 0.5;
  private activeMasterVolume: number = 0.5;

  constructor() {
    // Lazy initialize on first interaction
  }

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      
      // Master volume
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(this.activeMasterVolume * 0.25, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);

      // Music sub-bus
      this.musicVolumeNode = this.ctx.createGain();
      this.musicVolumeNode.gain.setValueAtTime(this.activeMusicVolume, this.ctx.currentTime);
      this.musicVolumeNode.connect(this.masterVolume);

      // SFX sub-bus
      this.sfxVolumeNode = this.ctx.createGain();
      this.sfxVolumeNode.gain.setValueAtTime(this.activeSfxVolume, this.ctx.currentTime);
      this.sfxVolumeNode.connect(this.masterVolume);

      this.setupEngine();
      this.setupBoost();
      this.setupAmbient();
      this.setupWarning();

      this.initialized = true;
      // Start with default main menu music
      this.setMusicZone("menu");
    } catch (e) {
      console.error("Audio Engine failed to initialize:", e);
    }
  }

  private setupEngine() {
    if (!this.ctx || !this.sfxVolumeNode) return;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineFilter = this.ctx.createBiquadFilter();

    this.engineOsc1.type = "sawtooth";
    this.engineOsc2.type = "triangle";

    this.engineOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.setValueAtTime(150, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxVolumeNode);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupBoost() {
    if (!this.ctx || !this.sfxVolumeNode) return;

    this.boostGain = this.ctx.createGain();
    this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.boostGain);
    this.boostGain.connect(this.sfxVolumeNode);

    whiteNoise.start();
  }

  private setupAmbient() {
    if (!this.ctx || !this.musicVolumeNode) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.ambientGain.connect(this.musicVolumeNode);

    // Create 5 persistent ambient chord voices
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const oscGain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);

      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.08 + Math.random() * 0.08, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(15, this.ctx.currentTime);

      oscGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // initially silent

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      
      osc.connect(oscGain);
      oscGain.connect(this.ambientGain);

      osc.start();
      lfo.start();

      this.ambientOscs.push({ osc, lfo, oscGain });
    }
  }

  private setupWarning() {
    if (!this.ctx || !this.sfxVolumeNode) return;

    this.warningGain = this.ctx.createGain();
    this.warningGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.warningGain.connect(this.sfxVolumeNode);

    this.warningOsc = this.ctx.createOscillator();
    this.warningOsc.type = "sawtooth";
    this.warningOsc.frequency.setValueAtTime(880, this.ctx.currentTime);

    this.warningOsc.connect(this.warningGain);
    this.warningOsc.start();
  }

  public setMusicZone(zone: "menu" | "exploration" | "combat" | "blackhole" | "station" | "planet" | "victory" | "gameover") {
    this.init();
    if (!this.initialized || !this.ctx || this.isMuted) return;

    if (this.currentZone === zone) return;
    this.currentZone = zone;

    const t = this.ctx.currentTime;

    // Define beautiful, cinematic dynamic chord maps
    let freqs: number[] = [110, 164.81, 220, 277.18, 329.63]; // Default
    let waveforms: OscillatorType[] = ["sine", "sine", "sine", "sine", "sine"];
    let voiceGains: number[] = [0.15, 0.15, 0.12, 0.1, 0.08];

    switch (zone) {
      case "menu":
        // Majestic Cmaj7 / Amin9 feel (C2, G2, C3, E3, G3, B3)
        freqs = [130.81, 196.00, 261.63, 329.63, 493.88];
        waveforms = ["sine", "triangle", "sine", "sine", "sine"];
        voiceGains = [0.18, 0.06, 0.12, 0.1, 0.07];
        break;
      case "exploration":
        // Serene suspended space chord (D2, A2, E3, A3, D4)
        freqs = [73.42, 110.00, 164.81, 220.00, 293.66];
        waveforms = ["sine", "sine", "sine", "sine", "sine"];
        voiceGains = [0.22, 0.15, 0.12, 0.1, 0.08];
        break;
      case "combat":
        // High-tension minor/dissonant saw pad (A1, E2, G2, Bb2, C#3)
        freqs = [55.00, 82.41, 98.00, 116.54, 138.59];
        waveforms = ["sawtooth", "triangle", "sawtooth", "sine", "sine"];
        voiceGains = [0.08, 0.14, 0.06, 0.12, 0.1];
        break;
      case "blackhole":
        // Spooky deep gravity drone (C1, Gb1, C2, Db2, F#2)
        freqs = [32.70, 46.25, 65.41, 69.30, 92.50];
        waveforms = ["sine", "sine", "triangle", "sine", "sine"];
        voiceGains = [0.35, 0.18, 0.1, 0.12, 0.05];
        break;
      case "station":
        // High tech welcoming major pad (G2, D3, G3, B3, D4)
        freqs = [98.00, 146.83, 196.00, 246.94, 293.66];
        waveforms = ["sine", "sine", "triangle", "sine", "sine"];
        voiceGains = [0.18, 0.14, 0.06, 0.15, 0.1];
        break;
      case "planet":
        // Mystical open major chord (F2, C3, F3, A3, C4)
        freqs = [87.31, 130.81, 174.61, 220.00, 261.63];
        waveforms = ["sine", "sine", "sine", "triangle", "sine"];
        voiceGains = [0.2, 0.15, 0.12, 0.05, 0.1];
        break;
      case "victory":
        // Majestic bright major chord (C3, G3, C4, E4, G4)
        freqs = [130.81, 196.00, 261.63, 329.63, 392.00];
        waveforms = ["triangle", "sine", "triangle", "sine", "sine"];
        voiceGains = [0.15, 0.15, 0.1, 0.12, 0.1];
        break;
      case "gameover":
        // Fading melancholy minor chords (Bb1, F2, Bb2, Db3, F3)
        freqs = [58.27, 87.31, 116.54, 138.59, 174.61];
        waveforms = ["sine", "sine", "sine", "sine", "sine"];
        voiceGains = [0.25, 0.15, 0.1, 0.08, 0.04];
        break;
    }

    // Smoothly interpolate current chord voice properties
    this.ambientOscs.forEach((voice, idx) => {
      const freq = freqs[idx] || 220;
      const type = waveforms[idx] || "sine";
      const targetGain = voiceGains[idx] || 0.1;

      // Smoothly ramp down, shift type/freq, ramp up to avoid clicks
      voice.oscGain.gain.setTargetAtTime(0, t, 0.15);
      
      setTimeout(() => {
        if (!this.ctx) return;
        const nowTime = this.ctx.currentTime;
        voice.osc.type = type;
        voice.osc.frequency.setTargetAtTime(freq, nowTime, 0.3);
        voice.oscGain.gain.setTargetAtTime(targetGain, nowTime, 0.5);
      }, 200);
    });
  }

  public setSpeed(speedRatio: number) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const baseFreq = 45 + speedRatio * 90;
    const filterFreq = 120 + speedRatio * 750;
    const gainVal = 0.04 + speedRatio * 0.18;

    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.08);
    this.engineFilter?.frequency.setTargetAtTime(filterFreq, t, 0.12);
    this.engineGain?.gain.setTargetAtTime(gainVal, t, 0.08);
  }

  public setBoosting(isBoosting: boolean) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const targetGain = isBoosting ? 0.35 : 0;
    this.boostGain?.gain.setTargetAtTime(targetGain, t, 0.15);
  }

  public setAlarm(isTriggered: boolean) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    this.warningGain?.gain.setTargetAtTime(isTriggered ? 0.2 : 0, t, 0.1);
  }

  public playCollision() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.5);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(10, t + 0.5);

    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 0.5);
  }

  public playLaser() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    
    // Core high futuristic sweep
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(1400, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.14);
    gain1.gain.setValueAtTime(0.14, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc1.connect(gain1);
    gain1.connect(this.sfxVolumeNode);

    // Heavy punch oscillator for impact feeling
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(280, t);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.08);
    gain2.gain.setValueAtTime(0.18, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc2.connect(gain2);
    gain2.connect(this.sfxVolumeNode);

    osc1.start(t);
    osc1.stop(t + 0.15);
    osc2.start(t);
    osc2.stop(t + 0.09);
  }

  public playMissile() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(550, t + 0.32);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(350, t);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 0.35);
  }

  public playExplosion() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    
    // Sub-bass thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(90, t);
    subOsc.frequency.exponentialRampToValueAtTime(10, t + 0.6);
    subGain.gain.setValueAtTime(0.65, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    subOsc.connect(subGain);
    subGain.connect(this.sfxVolumeNode);
    subOsc.start(t);
    subOsc.stop(t + 0.7);

    // Mid-frequency saw crash rumble
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(110, t);
    osc1.frequency.linearRampToValueAtTime(10, t + 1.1);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(60, t);
    osc2.frequency.linearRampToValueAtTime(10, t + 1.3);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(15, t + 1.1);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 1.3);
    osc2.stop(t + 1.3);

    // Procedural white noise burst for sparks
    try {
      const bufferSize = this.ctx.sampleRate * 1.2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(550, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(120, t + 1.0);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxVolumeNode);
      noiseNode.start(t);
      noiseNode.stop(t + 1.2);
    } catch (e) {
      // ignore
    }
  }

  public playShieldHit() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.25);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 0.3);
  }

  public setVolume(volume: number) {
    this.activeMasterVolume = volume;
    if (this.masterVolume) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      this.masterVolume.gain.setTargetAtTime(volume * 0.25, t, 0.1);
    }
  }

  public setMusicVolume(volume: number) {
    this.activeMusicVolume = volume;
    if (this.musicVolumeNode) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      this.musicVolumeNode.gain.setTargetAtTime(volume, t, 0.1);
    }
  }

  public setSfxVolume(volume: number) {
    this.activeSfxVolume = volume;
    if (this.sfxVolumeNode) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      this.sfxVolumeNode.gain.setTargetAtTime(volume, t, 0.1);
    }
  }

  public playRefuel() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.setValueAtTime(880, t + 0.1);
    osc.frequency.setValueAtTime(1320, t + 0.2);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 0.4);
  }

  public playLanding() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 1.2);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 1.5);
  }

  public playClick() {
    this.init();
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, t);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);

    osc.start();
    osc.stop(t + 0.1);
  }

  public playDiscovery() {
    this.init();
    if (!this.initialized || !this.ctx || this.isMuted || !this.musicVolumeNode) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.musicVolumeNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2200, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.95);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolumeNode);

      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 1.0);
    });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterVolume) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      this.masterVolume.gain.setValueAtTime(this.isMuted ? 0 : this.activeMasterVolume * 0.25, t);
    }
    return this.isMuted;
  }

  public playScanLaser() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.15);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxVolumeNode);
    osc.start();
    osc.stop(t + 0.15);
  }

  public playScanSuccess() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      if (!this.ctx || !this.sfxVolumeNode) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t + i * 0.08);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.5);
      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.55);
    });
  }

  public playReentry() {
    if (!this.initialized || !this.ctx || this.isMuted || !this.sfxVolumeNode) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(45, t);
    osc.frequency.linearRampToValueAtTime(30, t + 1.0);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(90, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.001, t + 1.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolumeNode);
    osc.start();
    osc.stop(t + 1.2);
  }
}

export const audioEngine = new AudioEngine();
