// Synthesized sound for Solmar: every sound is made with WebAudio oscillators and
// filtered noise, so the game needs no audio files at all. All calls are safe before
// the audio context exists or when the browser blocks audio (headless screenshots).
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicOn = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseHit(dur, vol, filterFreq, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  // A lazy bass-and-hat loop in A minor, stepped by a timer while music is on.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];
  function musicTick() {
    if (!ctx || !musicOn) return;
    const step = musicStep % 16;
    const bass = BASS[step];
    if (bass) blip(bass, 0.22, 'triangle', 0.16);
    if (step % 4 === 2) blip(880, 0.08, 'sine', 0.05);
    if (step % 2 === 0) noiseHit(0.03, 0.05, 6000);
    musicStep++;
  }

  return {
    // Call on the first user gesture; also safe to call from a staged screenshot.
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    setMusic(on) {
      if (on === musicOn) return;
      musicOn = on;
      if (on) {
        ensure();
        if (!ctx) return;
        this.unlock();
        if (!musicTimer) musicTimer = setInterval(musicTick, 190);
      } else if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    engine(on, speed01) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc2 = ctx.createOscillator();
        engineFilter = ctx.createBiquadFilter();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc2.type = 'square';
        engineOsc.frequency.value = 60;
        engineOsc2.frequency.value = 30;
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 500;
        engineGain.gain.value = 0;
        engineOsc.connect(engineFilter);
        engineOsc2.connect(engineFilter);
        engineFilter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        engineOsc2.start();
      }
      if (!on && engineOsc) {
        try {
          engineOsc.stop();
          engineOsc2.stop();
        } catch {
          // Already stopped.
        }
        engineOsc = null;
        engineOsc2 = null;
        engineGain = null;
        engineFilter = null;
        return;
      }
      if (engineOsc) {
        const s = Math.max(0, Math.min(1, speed01 || 0));
        engineOsc.frequency.setTargetAtTime(55 + s * 160, ctx.currentTime, 0.08);
        engineOsc2.frequency.setTargetAtTime(28 + s * 80, ctx.currentTime, 0.08);
        engineFilter.frequency.setTargetAtTime(400 + s * 1400, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.05 + s * 0.05, ctx.currentTime, 0.08);
      }
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 240;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc._lfo.stop();
          sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    gunshot() {
      if (!ensure()) return;
      noiseHit(0.14, 0.5, 2800);
      blip(160, 0.1, 'square', 0.25, 0, 50);
    },
    punch() {
      if (!ensure()) return;
      noiseHit(0.08, 0.3, 900);
    },
    pickup() {
      if (!ensure()) return;
      blip(660, 0.09, 'sine', 0.2);
      blip(880, 0.12, 'sine', 0.2, 0.09);
    },
    crash() {
      if (!ensure()) return;
      noiseHit(0.35, 0.5, 500);
      blip(90, 0.25, 'sine', 0.3, 0, 40);
    },
    cash() {
      if (!ensure()) return;
      [880, 1108, 1318, 1760].forEach((f, i) => blip(f, 0.14, 'sine', 0.18, i * 0.07));
    },
    missionDone() {
      if (!ensure()) return;
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.18, 'triangle', 0.18, i * 0.09));
    },
    click() {
      if (!ensure()) return;
      blip(1200, 0.04, 'square', 0.08);
    },
    reload() {
      if (!ensure()) return;
      blip(300, 0.05, 'square', 0.12);
      blip(420, 0.05, 'square', 0.12, 0.12);
    },
    hurt() {
      if (!ensure()) return;
      blip(220, 0.15, 'sawtooth', 0.2, 0, 110);
    },
  };
}
