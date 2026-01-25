import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioNodes {
  context: AudioContext;
  masterGain: GainNode;
  drone1: OscillatorNode;
  drone2: OscillatorNode;
  drone3: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  reverb: ConvolverNode;
}

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
  const [isInitialized, setIsInitialized] = useState(false);
  const audioRef = useRef<AudioNodes | null>(null);
  const animationRef = useRef<number>(0);

  const initAudio = useCallback(() => {
    if (audioRef.current) return;

    const context = new AudioContext();

    // Master gain
    const masterGain = context.createGain();
    masterGain.gain.value = 0;

    // Reverb
    const reverb = createReverb(context, 3, 2);
    const reverbGain = context.createGain();
    reverbGain.gain.value = 0.4;

    // Filter for warmth
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;

    // LFO for subtle movement
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Drone oscillators (C minor ambient chord)
    const drone1 = context.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 65.41; // C2

    const drone2 = context.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 98.00; // G2

    const drone3 = context.createOscillator();
    drone3.type = 'triangle';
    drone3.frequency.value = 130.81; // C3

    // Individual gains for mixing
    const gain1 = context.createGain();
    gain1.gain.value = 0.3;
    const gain2 = context.createGain();
    gain2.gain.value = 0.2;
    const gain3 = context.createGain();
    gain3.gain.value = 0.15;

    // Connect drone chain
    drone1.connect(gain1);
    drone2.connect(gain2);
    drone3.connect(gain3);

    gain1.connect(filter);
    gain2.connect(filter);
    gain3.connect(filter);

    // Dry path
    filter.connect(masterGain);

    // Wet path (reverb)
    filter.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(context.destination);

    // Start oscillators
    drone1.start();
    drone2.start();
    drone3.start();

    audioRef.current = {
      context,
      masterGain,
      drone1,
      drone2,
      drone3,
      lfo,
      lfoGain,
      filter,
      reverb,
    };

    setIsInitialized(true);
  }, []);

  const startAudio = useCallback(() => {
    if (!audioRef.current) {
      initAudio();
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (audio.context.state === 'suspended') {
      audio.context.resume();
    }

    // Fade in
    audio.masterGain.gain.cancelScheduledValues(audio.context.currentTime);
    audio.masterGain.gain.setValueAtTime(audio.masterGain.gain.value, audio.context.currentTime);
    audio.masterGain.gain.linearRampToValueAtTime(0.15, audio.context.currentTime + 2);

    setIsPlaying(true);

    // Subtle random modulation
    const modulate = () => {
      if (!audioRef.current || !isPlaying) return;

      const audio = audioRef.current;
      const time = audio.context.currentTime;

      // Slowly shift filter frequency
      const newFreq = 600 + Math.sin(time * 0.05) * 200 + Math.random() * 100;
      audio.filter.frequency.setTargetAtTime(newFreq, time, 2);

      // Slight detune for organic feel
      audio.drone2.detune.setTargetAtTime(Math.sin(time * 0.1) * 10, time, 1);
      audio.drone3.detune.setTargetAtTime(Math.cos(time * 0.08) * 15, time, 1);

      animationRef.current = requestAnimationFrame(modulate);
    };

    modulate();
  }, [initAudio, isPlaying]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Fade out
    audio.masterGain.gain.cancelScheduledValues(audio.context.currentTime);
    audio.masterGain.gain.setValueAtTime(audio.masterGain.gain.value, audio.context.currentTime);
    audio.masterGain.gain.linearRampToValueAtTime(0, audio.context.currentTime + 1);

    cancelAnimationFrame(animationRef.current);
    setIsPlaying(false);
  }, []);

  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  }, [isPlaying, startAudio, stopAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
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
