
export const Sound = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  isMuted: false,
  musicInterval: null as ReturnType<typeof setTimeout> | null,
  noteIndex: 0,
  currentMode: 'menu' as 'menu' | 'game',
  noiseBuffer: null as AudioBuffer | null,
  
  // נתיבים לקבצים מקומיים - יש להניח את הקבצים ליד index.html
  MENU_MUSIC_URL: './menu.mp3', 
  GAME_MUSIC_URL: './game.mp3',
  
  buffers: {} as Record<string, AudioBuffer>,
  currentSource: null as AudioBufferSourceNode | null,
  currentMusicGain: null as GainNode | null,

  init: function() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.createNoiseBuffer();
        
        // טעינה מראש של קבצי מוזיקה אם קיימים
        this.loadExternalSound('menu', this.MENU_MUSIC_URL);
        this.loadExternalSound('game', this.GAME_MUSIC_URL);
      }
    } catch (e) {
      console.warn("Sound init failed:", e);
    }
  },

  async loadExternalSound(key: string, url: string) {
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("File not found");
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[key] = audioBuffer;
      // אם המוזיקה אמורה להתנגן עכשיו, נתחיל אותה
      if (this.currentMode === key && !this.isMuted && !this.currentSource) {
        this.startMusic(key as any);
      }
    } catch (e) {
      console.log(`Note: Local music file ${url} not found, using fallback tones.`);
    }
  },

  createNoiseBuffer: function() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1; // 1 second of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  },

  resume: function() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute: function() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    } else {
      this.startMusic(this.currentMode);
    }
    return this.isMuted;
  },

  playTone: function(freq: number, type: OscillatorType, duration: number, volume: number, decayType: 'exp' | 'lin' = 'exp') {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.01);
    if (decayType === 'exp') {
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    } else {
      g.gain.linearRampToValueAtTime(0, now + duration);
    }
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
    return osc;
  },

  play: function(type: 'shoot' | 'hit' | 'coin' | 'bomb' | 'explosion' | 'powerup' | 'ui_click' | 'boss_hit') {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (type === 'shoot') {
      // ירי משופר: ירידה מהירה בתדר (Laser fire)
      const osc = this.playTone(800, 'square', 0.15, 0.12);
      if (osc) osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      
      // תוספת קליק חזק להתחלה
      this.playTone(150, 'triangle', 0.1, 0.2);
    } else if (type === 'ui_click') {
      this.playTone(1000, 'sine', 0.05, 0.05);
    } else if (type === 'hit') {
      // פגיעה: רעש נמוך ומחוספס
      this.playTone(60, 'sawtooth', 0.3, 0.2, 'lin');
      if (this.noiseBuffer) {
        this.playNoise(200, 0.2, 0.1);
      }
    } else if (type === 'explosion' || type === 'bomb') {
      // פיצוץ משופר: שילוב של תדר נמוך מאוד ורעש לבן מסונן
      this.playTone(40, 'sine', 1.2, 0.6, 'lin');
      this.playTone(80, 'triangle', 0.8, 0.4, 'lin');
      
      if (this.noiseBuffer) {
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 1.0);
        filter.Q.setValueAtTime(10, now);
        
        source.buffer = this.noiseBuffer;
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        
        source.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        source.start(now);
      }
    } else if (type === 'coin' || type === 'powerup') {
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.3, 0.08), i * 50);
      });
    } else if (type === 'boss_hit') {
      // פגיעה מתכתית בבוס
      const osc = this.playTone(400, 'sawtooth', 0.1, 0.15);
      if (osc) osc.frequency.linearRampToValueAtTime(50, now + 0.1);
    }
  },

  playNoise: function(filterFreq: number, duration: number, volume: number) {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    source.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    source.start(now);
  },

  stopMusic: function() {
    if (this.currentSource) {
      const now = this.ctx?.currentTime || 0;
      if (this.currentMusicGain) {
        this.currentMusicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      }
      const src = this.currentSource;
      setTimeout(() => { try { src.stop(); } catch(e){} }, 600);
      this.currentSource = null;
    }
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  },

  startMusic: function(mode: 'menu' | 'game' = 'menu') {
    this.init();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.currentMode === mode && this.currentSource) return;

    this.stopMusic();
    this.currentMode = mode;
    this.noteIndex = 0;

    const now = this.ctx.currentTime;

    // אם הקובץ נטען בהצלחה
    if (this.buffers[mode]) {
      const source = this.ctx.createBufferSource();
      const musicGain = this.ctx.createGain();
      source.buffer = this.buffers[mode];
      source.loop = true;
      musicGain.gain.setValueAtTime(0, now);
      musicGain.gain.linearRampToValueAtTime(0.35, now + 1.5);
      source.connect(musicGain);
      musicGain.connect(this.masterGain);
      source.start(0);
      this.currentSource = source;
      this.currentMusicGain = musicGain;
    } else {
      // גיבוי: מוזיקה סינתטית אם אין קובץ
      this.playMusicLoop();
    }
  },

  playMusicLoop: function() {
    if (this.isMuted || !this.ctx || !this.masterGain || this.currentSource) return;
    if (this.musicInterval) clearTimeout(this.musicInterval);

    try {
      const now = this.ctx.currentTime;
      if (this.currentMode === 'menu') {
        const scale = [220, 261.63, 293.66, 329.63, 392];
        const freq = scale[this.noteIndex % scale.length];
        this.playTone(freq, 'triangle', 2.0, 0.04, 'exp');
        this.playTone(freq / 2, 'sine', 2.5, 0.08, 'exp');
        this.noteIndex++;
        this.musicInterval = setTimeout(() => this.playMusicLoop(), 1200);
      } else {
        const duration = 0.4;
        const freqs = [110, 110, 130, 146];
        const freq = freqs[this.noteIndex % freqs.length];
        this.playTone(freq, 'square', duration, 0.04, 'exp');
        this.noteIndex++;
        this.musicInterval = setTimeout(() => this.playMusicLoop(), duration * 1000);
      }
    } catch (e) {}
  }
};
