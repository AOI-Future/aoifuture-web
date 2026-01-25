import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioNodes {
  context: AudioContext;
  masterGain: GainNode;
  drone1: OscillatorNode;
  drone2: OscillatorNode;
  drone3: OscillatorNode;
  filter: BiquadFilterNode;
  reverb: ConvolverNode;
  reverbGain: GainNode;
  pulseGain: GainNode;
}

// Base frequencies for C minor chord
const BASE_FREQ = {
  drone1: 65.41,  // C2
  drone2: 98.00,  // G2
  drone3: 130.81, // C3
};

// Create impulse response for reverb
function createReverb(context: AudioContext, duration: number, decay: number): ConvolverNode {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }

  const convolver = context.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

export default function AmbientSound() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<AudioNodes | null>(null);
  const densityRef = useRef(0);
  const lastPulseRef = useRef(0);

  const initAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const context = new AudioContext();

    // Master gain
    const masterGain = context.createGain();
    masterGain.gain.value = 0;

    // Reverb
    const reverb = createReverb(context, 4, 2.5);
    const reverbGain = context.createGain();
    reverbGain.gain.value = 0.5;

    // Filter - will be modulated by cell density
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;

    // Drone oscillators
    const drone1 = context.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = BASE_FREQ.drone1;

    const drone2 = context.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = BASE_FREQ.drone2;

    const drone3 = context.createOscillator();
    drone3.type = 'triangle';
    drone3.frequency.value = BASE_FREQ.drone3;

    // Individual gains
    const gain1 = context.createGain();
    gain1.gain.value = 0.25;
    const gain2 = context.createGain();
    gain2.gain.value = 0.15;
    const gain3 = context.createGain();
    gain3.gain.value = 0.1;

    // Pulse oscillator for interaction feedback
    const pulseGain = context.createGain();
    pulseGain.gain.value = 0;

    // Connect drone chain
    drone1.connect(gain1);
    drone2.connect(gain2);
    drone3.connect(gain3);

    gain1.connect(filter);
    gain2.connect(filter);
    gain3.connect(filter);

    // Dry + Wet paths
    filter.connect(masterGain);
    filter.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Pulse path
    pulseGain.connect(reverb);

    masterGain.connect(context.destination);

    // Start oscillators
    drone1.start();
    drone2.start();
    drone3.start();

    const nodes: AudioNodes = {
      context,
      masterGain,
      drone1,
      drone2,
      drone3,
      filter,
      reverb,
      reverbGain,
      pulseGain,
    };

    audioRef.current = nodes;
    return nodes;
  }, []);

  // Play a short pulse tone based on density
  const playPulse = useCallback((density: number) => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    const now = audio.context.currentTime;

    // Throttle pulses
    if (now - lastPulseRef.current < 0.1) return;
    lastPulseRef.current = now;

    // Create pulse oscillator
    const pulse = audio.context.createOscillator();
    const pulseEnv = audio.context.createGain();

    // Higher density = higher pitch
    pulse.type = 'sine';
    pulse.frequency.value = 200 + density * 800;

    pulseEnv.gain.value = 0;
    pulseEnv.gain.setValueAtTime(0, now);
    pulseEnv.gain.linearRampToValueAtTime(0.03 + density * 0.05, now + 0.02);
    pulseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    pulse.connect(pulseEnv);
    pulseEnv.connect(audio.filter);

    pulse.start(now);
    pulse.stop(now + 0.4);
  }, [isPlaying]);

  // Handle density updates from LifeGame
  useEffect(() => {
    const handleDensity = (e: CustomEvent<{ density: number; cellCount: number }>) => {
      const { density } = e.detail;
      const audio = audioRef.current;

      if (!audio || !isPlaying) return;

      const time = audio.context.currentTime;

      // Map density (0-0.3 typical range) to audio parameters
      const normalizedDensity = Math.min(density * 4, 1); // Scale up for more range

      // Filter frequency: 300Hz (empty) to 1500Hz (dense)
      const targetFreq = 300 + normalizedDensity * 1200;
      audio.filter.frequency.setTargetAtTime(targetFreq, time, 0.3);

      // Drone pitch shift: subtle rise with density
      const pitchShift = normalizedDensity * 50; // cents
      audio.drone2.detune.setTargetAtTime(pitchShift, time, 0.5);
      audio.drone3.detune.setTargetAtTime(pitchShift * 1.5, time, 0.5);

      // Volume swell with density
      const targetGain = 0.1 + normalizedDensity * 0.1;
      audio.masterGain.gain.setTargetAtTime(targetGain, time, 0.3);

      // Reverb increases with density
      audio.reverbGain.gain.setTargetAtTime(0.3 + normalizedDensity * 0.4, time, 0.5);

      // Trigger pulse on significant density change
      const densityDelta = Math.abs(density - densityRef.current);
      if (densityDelta > 0.01) {
        playPulse(normalizedDensity);
      }

      densityRef.current = density;
    };

    window.addEventListener('lifegame-density', handleDensity as EventListener);
    return () => window.removeEventListener('lifegame-density', handleDensity as EventListener);
  }, [isPlaying, playPulse]);

  const startAudio = useCallback(() => {
    const audio = initAudio();

    if (audio.context.state === 'suspended') {
      audio.context.resume();
    }

    // Fade in
    const time = audio.context.currentTime;
    audio.masterGain.gain.cancelScheduledValues(time);
    audio.masterGain.gain.setValueAtTime(0, time);
    audio.masterGain.gain.linearRampToValueAtTime(0.1, time + 2);

    setIsPlaying(true);
  }, [initAudio]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.context.currentTime;
    audio.masterGain.gain.cancelScheduledValues(time);
    audio.masterGain.gain.setValueAtTime(audio.masterGain.gain.value, time);
    audio.masterGain.gain.linearRampToValueAtTime(0, time + 1);

    setIsPlaying(false);
  }, []);

  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  }, [isPlaying, startAudio, stopAudio]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.context.close();
      }
    };
  }, []);

  return (
    <button
      onClick={toggleAudio}
      className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50
                 px-3 py-2 text-xs
                 border border-cyan-400/50 bg-black/70
                 text-cyan-400 font-mono tracking-wider
                 hover:bg-cyan-400/10 hover:border-cyan-400
                 transition-all duration-300
                 flex items-center gap-2"
      aria-label={isPlaying ? 'Mute ambient sound' : 'Play ambient sound'}
    >
      {isPlaying ? (
        <>
          <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          SOUND: ON
        </>
      ) : (
        <>
          <span className="inline-block w-2 h-2 border border-cyan-400/50 rounded-full" />
          SOUND: OFF
        </>
      )}
    </button>
  );
}
