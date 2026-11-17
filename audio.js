/**
 * School Bell Audio Synthesizer (Web Audio API)
 * Автентични училищни камбани и звънци без външни файлове и без синтезиран говор.
 */

class SchoolBellAudio {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.volume = 0.85;
    this.isMuted = localStorage.getItem('school_bell_muted') === 'true';
    this.vibrationEnabled = localStorage.getItem('school_bell_vibration_enabled') !== 'false';

    // Map of available ringtone MP3 files (relative to project root)
  // Map of available ringtone MP3 files (relative to project root)
  this.ringtoneMap = {
    default: 'Soundspace Sound Effects (128k).mp3',
    chime: 'ringtones/chime.mp3',
    alert: 'ringtones/alert.mp3',
    tone1: 'ringtones/tone1.mp3'
  };
  // Cache for loaded ringtone Audio objects
  this.ringtoneCache = {};

  // Return appropriate ringtone key based on alarm name
  this.getRingtoneForAlarm = (alarmName) => {
    const name = (alarmName || '').toLowerCase();
    if (name.includes('контролно') || name.includes('exam') || name.includes('изпит')) return 'alert';
    if (name.includes('ваканция') || name.includes('vacation')) return 'chime';
    // custom alarms fallback to tone1
    if (name) return 'tone1';
    return 'default';
  };

  this.cleanAudio = null; // placeholder for the default clean sound


  }



  async initContext() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return true;
    } catch (err) {
      console.warn('AudioContext init error:', err);
      return false;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  setVibrationEnabled(enabled) {
    this.vibrationEnabled = !!enabled;
    localStorage.setItem('school_bell_vibration_enabled', this.vibrationEnabled);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('school_bell_muted', this.isMuted);
    if (this.masterGain && this.audioCtx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
    }
    return this.isMuted;
  }

  vibrate(pattern = [400, 200, 400, 200, 800]) {
    if (!this.vibrationEnabled) return;
    if ('navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  /**
   * Възпроизвежда избран модел на училищен звънец
   * @param {string} type
   */
  async playBell(type = 'authentic', duration = 3.5, ringtoneKey = null) {
    const key = ringtoneKey || type || this.soundType || 'default';
    try {
      if (key === 'mp3') {
        const audio = this.ringtoneCache.mp3 || (this.ringtoneCache.mp3 = new Audio(encodeURI('Soundspace Sound Effects (128k).mp3')));
        audio.volume = this.volume;
        audio.currentTime = 0;
        await this.initContext();
        if (this.isMuted) return false;
        this.vibrate([300, 150, 300]);
        await audio.play();
        return true;
      }
      await this.initContext();
      if (this.isMuted || !this.audioCtx) return false;
      this.vibrate([300, 150, 300]);
      const ctx = this.audioCtx;
      const now = ctx.currentTime + 0.03;
      const presets = {
        default: [880, 1175, 880, 1175], classic: [880, 1175, 880, 1175],
        chime: [659, 784, 988, 1319], modern: [1047, 1319, 1568, 1319],
        retro: [784, 784, 988, 784], double: [1319, 1568, 1319, 1568],
        ship: [523, 784, 523, 784], jingle: [659, 784, 988, 784, 988],
        harp: [523, 659, 784, 988, 1175], alert: [1047, 784, 1047, 784], tone1: [784, 988, 784, 659]
      };
      const notes = presets[key] || presets.default;
      const noteLength = Math.max(0.18, Math.min(0.8, duration / notes.length));
      notes.forEach((freq, index) => {
        const at = now + index * noteLength;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = ['alert', 'modern', 'retro'].includes(key) ? 'square' : 'sine';
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.22 * this.volume, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + noteLength * 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + noteLength);
      });
      return true;
    } catch (err) {
      console.warn('Audio play error:', err);
      return false;
    }
  }
  /**
   * Предупредителен сигнал (2 мин преди края на междучасието)
   * Чист двутонен камбанен звън
   */
  async playPreWarning() {
    return this.playBell(window.app?.soundType || 'classic', 2.2);
  }
  /**
   * Специален тритонен камбанен сигнал за Контролно / Изпит
   */
  async playExamAlert() {
    return this.playBell(window.app?.soundType || 'classic', 3.2);
  }

  // 1. АВТЕНТИЧНА УЧИЛИЩНА КАМБАНА (Богат метален звън с резонанс и вибрация)
  async playAuthenticSchoolBell(duration = 3.5) {
    const ctx = this.audioCtx;
    const startTime = ctx.currentTime;
    const stopTime = startTime + duration;

    // Резонантни камбанни хармоници
    const partials = [1200, 1580, 2090, 2840, 3420];

    const masterBell = ctx.createGain();
    masterBell.gain.setValueAtTime(0, startTime);
    masterBell.gain.linearRampToValueAtTime(0.9, startTime + 0.04);
    masterBell.gain.setValueAtTime(0.9, stopTime - 0.2);
    masterBell.gain.exponentialRampToValueAtTime(0.0001, stopTime + 1.2); // метален затихващ хвост
    masterBell.connect(this.masterGain);

    // Бърз звънен чук (~24 удара в секунда)
    const hammer = ctx.createOscillator();
    const hammerGain = ctx.createGain();
    hammer.type = 'square';
    hammer.frequency.setValueAtTime(24, startTime);
    hammerGain.gain.setValueAtTime(0.42, startTime);
    hammer.connect(hammerGain);

    partials.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() * 6 - 3), startTime);

      const amp = 0.55 / (idx + 1);
      oscGain.gain.setValueAtTime(amp, startTime);

      hammerGain.connect(oscGain.gain);
      osc.connect(oscGain);
      oscGain.connect(masterBell);

      osc.start(startTime);
      osc.stop(stopTime + 1.2);
    });

    hammer.start(startTime);
    hammer.stop(stopTime);

    return new Promise(r => setTimeout(r, (duration + 1.2) * 1000));
  }

  // 2. БРОНЗОВА УЧИЛИЩНА КАМБАНА (Ударен гонг с дълъг отзвук)
  async playBronzeBell() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const duration = 3.8;

    // Истински камбанни хармоници (Hum, Prime, Tierce, Quint, Nominal)
    const freqs = [
      { f: 440, gain: 0.6, decay: 3.5 },  // Hum
      { f: 880, gain: 0.8, decay: 3.0 },  // Prime
      { f: 1056, gain: 0.5, decay: 2.5 }, // Minor 3rd
      { f: 1320, gain: 0.45, decay: 2.2 },// 5th
      { f: 1760, gain: 0.4, decay: 1.8 }, // Octave
      { f: 2640, gain: 0.25, decay: 1.2 } // Upper
    ];

    freqs.forEach(item => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(item.f, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(item.gain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + item.decay);
    });

    return new Promise(r => setTimeout(r, duration * 1000));
  }

  // 3. МЕЛОДИЧНА КАМБАНА ВЕСТМИНСТЪР (4 камбанни тона)
  async playWestminsterChime() {
    const ctx = this.audioCtx;
    const sequence = [
      { freq: 329.63, timeOffset: 0.0, dur: 0.9 }, // E4
      { freq: 415.30, timeOffset: 0.7, dur: 0.9 }, // G#4
      { freq: 369.99, timeOffset: 1.4, dur: 0.9 }, // F#4
      { freq: 246.94, timeOffset: 2.1, dur: 1.5 }, // B3
    ];
    const totalDur = 3.8;
    const now = ctx.currentTime;

    sequence.forEach(note => {
      const noteTime = now + note.timeOffset;
      [1, 2.76, 5.4].forEach((harmonic, hIdx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq * harmonic, noteTime);

        const baseGain = 0.65 / (hIdx + 1);
        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(baseGain, noteTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + note.dur);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + note.dur);
      });
    });

    return new Promise(r => setTimeout(r, totalDur * 1000));
  }

  // 4. РЕТРО МЕХАНИЧЕН ЗВЪНЕЦ С ЧУКЧЕ
  async playMechanicalHammerBell(duration = 2.8) {
    const ctx = this.audioCtx;
    const startTime = ctx.currentTime;
    const stopTime = startTime + duration;

    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(0, startTime);
    bellGain.gain.linearRampToValueAtTime(0.9, startTime + 0.04);
    bellGain.gain.setValueAtTime(0.9, stopTime - 0.1);
    bellGain.gain.exponentialRampToValueAtTime(0.001, stopTime + 0.9);
    bellGain.connect(this.masterGain);

    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    tremolo.type = 'sawtooth';
    tremolo.frequency.setValueAtTime(22, startTime);
    tremoloGain.gain.setValueAtTime(0.45, startTime);
    tremolo.connect(tremoloGain);

    const partials = [890, 1420, 2190, 3120, 4800];
    partials.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(f, startTime);
      g.gain.setValueAtTime(0.4 / (i + 1), startTime);
      tremoloGain.connect(g.gain);
      osc.connect(g);
      g.connect(bellGain);
      osc.start(startTime);
      osc.stop(stopTime + 0.9);
    });

    tremolo.start(startTime);
    tremolo.stop(stopTime);

    return new Promise(r => setTimeout(r, (duration + 0.9) * 1000));
  }

  // 5. ДВОЕН КРИСТАЛЕН ЗВЪН (Динг-Донг)
  async playDoubleCrystalChime() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const notes = [
      { f: 1046.5, t: 0, d: 1.2 },    // C6
      { f: 783.99, t: 0.35, d: 1.6 }  // G5
    ];
    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0, now + n.t);
      gain.gain.linearRampToValueAtTime(0.8, now + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
    return new Promise(r => setTimeout(r, 2000));
  }

  // 6. КОРАБНА БРОНЗОВА КАМБАНА (Двоен удар)
  async playShipBronzeBell() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    [0, 0.3].forEach(offset => {
      const t = now + offset;
      [523.25, 1046.5, 1568, 2093].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, t);
        const v = 0.65 / (idx + 1);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(v, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + 1.8);
      });
    });
    return new Promise(r => setTimeout(r, 2200));
  }

  // 7. МОДЕРЕН ДИГИТАЛЕН ТОН
  async playModernDigitalChime() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const tones = [
      { freq: 784, time: 0 },
      { freq: 1046.5, time: 0.25 },
      { freq: 1318.5, time: 0.5 },
      { freq: 1568, time: 0.75 }
    ];
    tones.forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, now + t.time);
      gain.gain.setValueAtTime(0, now + t.time);
      gain.gain.linearRampToValueAtTime(0.7, now + t.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.time + 0.8);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + t.time);
      osc.stop(now + t.time + 0.8);
    });
    return new Promise(r => setTimeout(r, 1600));
  }

  // 8. ВЕСЕЛ УЧИЛИЩЕН ДЖИНГЪЛ (бърз, ярък и приятелски)
  async playSchoolJingle() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.00, d: 0.22 }, // C5
      { f: 659.25, t: 0.18, d: 0.22 }, // E5
      { f: 783.99, t: 0.36, d: 0.24 }, // G5
      { f: 1046.5, t: 0.56, d: 0.55 }, // C6
      { f: 783.99, t: 0.82, d: 0.20 }, // G5
      { f: 1046.5, t: 1.00, d: 0.75 }  // C6
    ];

    melody.forEach(note => {
      const t = now + note.t;
      [1, 2].forEach((harmonic, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(note.f * harmonic, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.55 / (idx + 1), t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + note.d);
      });
    });

    return new Promise(r => setTimeout(r, 2000));
  }

  // 9. МАГИЧЕСКО АРПЕЖИО (арфа, дълъг кристален отзвук)
  async playHarpArpeggio() {
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.5]; // C4–C6

    notes.forEach((freq, i) => {
      const t = now + i * 0.11;
      const decay = 2.4 - i * 0.12;

      [1, 2, 3].forEach((harmonic, h) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = h === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq * harmonic, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5 / (h + 1), t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + decay);
      });
    });

    return new Promise(r => setTimeout(r, 3000));
  }
}

window.bellAudio = new SchoolBellAudio();

// Unlock on first touch/click
const autoUnlockAudio = async () => {
  if (window.bellAudio) {
    await window.bellAudio.initContext();
  }
  document.removeEventListener('click', autoUnlockAudio);
  document.removeEventListener('touchstart', autoUnlockAudio);
};
document.addEventListener('click', autoUnlockAudio, { once: true });
document.addEventListener('touchstart', autoUnlockAudio, { once: true });
