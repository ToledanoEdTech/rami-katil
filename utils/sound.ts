
export const Sound = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  isMuted: false,
  musicInterval: null as ReturnType<typeof setTimeout> | null,
  noteIndex: 0,
  currentMode: 'menu' as 'menu' | 'game',
  noiseBuffer: null as AudioBuffer | null,
  
  // כאן אתה יכול להדביק קישור ישיר לקובץ ה-MP3 שאתה רוצה
  // לדוגמה: 'https://www.mysite.com/menu-music.mp3'
  MENU_MUSIC_URL: '', 
  GAME_MUSIC_URL: '',
  
  buffers: {} as Record<string, AudioBuffer>,
  currentSource: null as AudioBufferSourceNode | null,
  currentMusicGain: null as GainNode | null,

  init: function() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        this.createNoiseBuffer();
        
        // טעינת קבצים חיצוניים אם קיימים
        if (this.MENU_MUSIC_URL) this.loadExternalSound('menu', this.MENU_MUSIC_URL);
        if (this.GAME_MUSIC_URL) this.loadExternalSound('game', this.GAME_MUSIC_URL);
      }
    } catch (e) {
      console.warn("Sound init failed:", e);
    }
  },

  async loadExternalSound(key: string, url: string) {
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[key] = audioBuffer;
      // אם אנחנו כבר במוד הזה, נתחיל לנגן מיד
      if (this.currentMode === key && !this.isMuted) {
        this.startMusic(key as any);
      }
    } catch (e) {
      console.error(`Failed to load sound: ${key}`, e);
    }
  },

  createNoiseBuffer: function() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
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
      // צליל ירי "פאנצ'י"
      this.playTone(200, 'triangle', 0.15, 0.15);
      const osc = this.playTone(800, 'sine', 0.1, 0.05);
      if (osc) osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    } else if (type === 'ui_click') {
      this.playTone(1000, 'sine', 0.05, 0.05);
    } else if (type === 'hit') {
      this.playTone(60, 'sawtooth', 0.3, 0.2);
    } else if (type === 'explosion' || type === 'bomb') {
      // פיצוץ עמוק וסינמטי
      this.playTone(40, 'sine', 1.2, 0.6, 'lin');
      if (this.noiseBuffer) {
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        source.buffer = this.noiseBuffer;
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        source.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        source.start(now);
      }
    } else if (type === 'coin' || type === 'powerup') {
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.4, 0.05), i * 50);
      });
    } else if (type === 'boss_hit') {
      this.playTone(100, 'square', 0.15, 0.1);
    }
  },

  stopMusic: function() {
    if (this.currentSource) {
      const now = this.ctx?.currentTime || 0;
      // Fade out עדין לפני עצירה
      if (this.currentMusicGain) {
        this.currentMusicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      }
      const src = this.currentSource;
      setTimeout(() => { try { src.stop(); } catch(e){} }, 500);
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
    
    // אם אנחנו כבר מנגנים את המוד הנכון, אל תתחיל מחדש
    if (this.currentMode === mode && this.currentSource) return;

    this.stopMusic();
    this.currentMode = mode;
    this.noteIndex = 0;

    const now = this.ctx.currentTime;

    // אם יש קובץ טעון ב-Buffer, נשתמש בו
    if (this.buffers[mode]) {
      const source = this.ctx.createBufferSource();
      const musicGain = this.ctx.createGain();
      
      source.buffer = this.buffers[mode];
      source.loop = true;
      
      musicGain.gain.setValueAtTime(0, now);
      musicGain.gain.linearRampToValueAtTime(0.4, now + 1.0); // Fade in
      
      source.connect(musicGain);
      musicGain.connect(this.masterGain);
      
      source.start(0);
      this.currentSource = source;
      this.currentMusicGain = musicGain;
    } else {
      // Fallback למוזיקה סינתטית אם אין קובץ חיצוני
      this.playMusicLoop();
    }
  },

  playMusicLoop: function() {
    if (this.isMuted || !this.ctx || !this.masterGain || this.currentSource) return;
    if (this.musicInterval) clearTimeout(this.musicInterval);

    try {
      const now = this.ctx.currentTime;
      if (this.currentMode === 'menu') {
        // מוזיקת תפריט סינתטית - דרמטית יותר (תופים וכינורות)
        const scale = [220, 261.63, 293.66, 329.63, 392]; // Am
        const freq = scale[this.noteIndex % scale.length];
        
        // "נבל" דרמטי
        this.playTone(freq, 'triangle', 2.0, 0.05, 'exp');
        this.playTone(freq / 2, 'sine', 2.0, 0.1, 'exp');
        
        this.noteIndex++;
        this.musicInterval = setTimeout(() => this.playMusicLoop(), 1000);
      } else {
        // מוזיקת משחק - קצבית
        const tempo = 140;
        const duration = 60 / tempo;
        const freq = (this.noteIndex % 4 === 0) ? 55 : 110;
        this.playTone(freq, 'square', duration, 0.05, 'exp');
        this.noteIndex++;
        this.musicInterval = setTimeout(() => this.playMusicLoop(), duration * 500);
      }
    } catch (e) {}
  }
};
