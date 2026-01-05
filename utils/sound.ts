
export const Sound = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  isMuted: false,
  musicInterval: null as ReturnType<typeof setTimeout> | null,
  noteIndex: 0,
  currentMode: 'menu' as 'menu' | 'game',
  noiseBuffer: null as AudioBuffer | null,
  
  // נגן HTML5 עבור הזרמת מוזיקה (עוקף בעיות CORS)
  bgMusicElement: null as HTMLAudioElement | null,

  MENU_MUSIC_URL: 'https://drive.google.com/uc?export=download&id=19nZady7yxEI7vvNvoaUOPj_5vxZPgUHy', 
  GAME_MUSIC_URL: '', 
  
  buffers: {} as Record<string, AudioBuffer>,
  currentSource: null as AudioBufferSourceNode | null, // משמש רק לסינתיסייזר כרגע

  melodies: {
    menu: [
      {f: 220.00, d: 0.4}, {f: 246.94, d: 0.4}, {f: 261.63, d: 0.4}, 
      {f: 220.00, d: 0.4}, {f: 174.61, d: 0.4}, {f: 164.81, d: 0.8}, 
      {f: 220.00, d: 0.4}, {f: 261.63, d: 0.4}, {f: 293.66, d: 0.4}, 
      {f: 329.63, d: 1.2}, 
      {f: 293.66, d: 0.4}, {f: 261.63, d: 0.4}, {f: 246.94, d: 0.4}, 
      {f: 220.00, d: 0.8}, {f: 196.00, d: 0.4}, {f: 220.00, d: 1.2}  
    ],
    game: [
      {f: 110.00, d: 0.2}, {f: 110.00, d: 0.2}, {f: 164.81, d: 0.2}, {f: 110.00, d: 0.2},
      {f: 196.00, d: 0.2}, {f: 174.61, d: 0.2}, {f: 164.81, d: 0.2}, {f: 130.81, d: 0.2},
      {f: 110.00, d: 0.2}, {f: 110.00, d: 0.2}, {f: 220.00, d: 0.2}, {f: 110.00, d: 0.2},
      {f: 196.00, d: 0.2}, {f: 220.00, d: 0.2}, {f: 261.63, d: 0.2}, {f: 246.94, d: 0.2} 
    ]
  },

  fixUrl: function(url: string): string {
    if (!url) return '';
    if (url.includes('dropbox.com')) {
      return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    }
    // המרה לקישור הורדה ישיר של גוגל
    if (url.includes('drive.google.com') && !url.includes('export=download')) {
      const idMatch = url.match(/\/d\/(.*?)\/|id=(.*?)(&|$)/);
      const id = idMatch ? (idMatch[1] || idMatch[2]) : null;
      if (id) {
        return `https://docs.google.com/uc?export=download&id=${id}`;
      }
    }
    return url;
  },

  init: function() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.createNoiseBuffer();
      }
    } catch (e) {
      console.warn("Sound init failed:", e);
    }
  },

  resume: function() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("Audio resume failed", e));
    }
    // ניסיון לנגן אם האלמנט קיים אך מושהה
    if (this.bgMusicElement && this.bgMusicElement.paused && !this.isMuted) {
        this.bgMusicElement.play().catch(e => console.log("Waiting for interaction to play music"));
    }
  },

  createNoiseBuffer: function() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
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
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.02); 
    if (decayType === 'exp') {
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    } else {
      g.gain.linearRampToValueAtTime(0, now + duration);
    }
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);
    return osc;
  },

  play: function(type: 'shoot' | 'hit' | 'coin' | 'bomb' | 'explosion' | 'powerup' | 'ui_click' | 'boss_hit') {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    this.resume(); 
    const now = this.ctx.currentTime;
    
    // קוד האפקטים נשאר זהה
    if (type === 'shoot') {
      const osc = this.playTone(800, 'square', 0.15, 0.08);
      if (osc) osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      this.playTone(150, 'triangle', 0.1, 0.15);
    } else if (type === 'ui_click') {
      this.playTone(1200, 'sine', 0.05, 0.05);
    } else if (type === 'hit') {
      this.playTone(60, 'sawtooth', 0.3, 0.2, 'lin');
      if (this.noiseBuffer) this.playNoise(200, 0.2, 0.1);
    } else if (type === 'explosion' || type === 'bomb') {
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
        setTimeout(() => this.playTone(f, 'sine', 0.3, 0.08), i * 60);
      });
    } else if (type === 'boss_hit') {
      const osc = this.playTone(300, 'sawtooth', 0.1, 0.15);
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
    // עצירת נגן ה-HTML5
    if (this.bgMusicElement) {
        this.bgMusicElement.pause();
        this.bgMusicElement.currentTime = 0;
        this.bgMusicElement = null;
    }

    // עצירת הסינתיסייזר
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch(e){}
      this.currentSource = null;
    }
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
  },

  startMusic: function(mode: 'menu' | 'game' = 'menu') {
    this.init();
    if (this.isMuted) return;
    
    // מניעת הפעלה מחדש אם כבר מנגן את המצב הזה
    if (this.currentMode === mode && (this.bgMusicElement || this.musicInterval)) return;

    this.stopMusic();
    this.currentMode = mode;
    this.noteIndex = 0;

    const url = mode === 'menu' ? this.MENU_MUSIC_URL : this.GAME_MUSIC_URL;
    const fixedUrl = this.fixUrl(url);

    // ניסיון לנגן באמצעות HTML5 Audio (עוקף CORS)
    if (fixedUrl) {
        const audio = new Audio(fixedUrl);
        audio.loop = true;
        audio.volume = 0.4;
        audio.crossOrigin = "anonymous"; // ניסיון, אבל HTML5 פחות קפדן מ-Web Audio
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Playing external music via HTML5 Audio");
                this.bgMusicElement = audio;
            }).catch(error => {
                console.warn("HTML5 Audio autoplay blocked or failed, falling back to Synth:", error);
                // במקרה של כישלון (למשל חסימת דפדפן או קישור שבור), עוברים לסינתיסייזר
                this.bgMusicElement = null;
                this.playMusicLoop();
            });
        }
    } else {
        // אין קישור, נגן סינתיסייזר
        this.playMusicLoop();
    }
  },

  playMusicLoop: function() {
    // פונקציית הגיבוי של הסינתיסייזר
    if (this.isMuted || !this.ctx || !this.masterGain || this.bgMusicElement) return;
    if (this.musicInterval) clearTimeout(this.musicInterval);

    try {
      const mode = this.currentMode;
      const melody = this.melodies[mode] || this.melodies['menu'];
      const note = melody[this.noteIndex % melody.length];
      
      const oscType: OscillatorType = mode === 'menu' ? 'triangle' : 'square';
      const volume = mode === 'menu' ? 0.15 : 0.08;
      const decay = mode === 'menu' ? 'lin' : 'exp';

      this.playTone(note.f, oscType, note.d * 0.9, volume, decay);
      
      if (mode === 'menu') {
         this.playTone(note.f / 2, 'sine', note.d * 1.5, 0.1, 'lin');
      }
      
      if (mode === 'game' && this.noteIndex % 2 === 0) {
         this.playTone(55, 'sawtooth', 0.1, 0.15, 'exp');
      }

      this.noteIndex++;
      this.musicInterval = setTimeout(() => this.playMusicLoop(), note.d * 1000);
      
    } catch (e) {
      console.warn("Synth loop error", e);
    }
  }
};
