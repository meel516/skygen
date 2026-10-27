// ============================================================================
// WHATSAPP MESSAGE SOUNDS - Realistic Pre-Generated Sounds
// ============================================================================

/**
 * Sound configuration for WhatsApp chat
 * Uses pre-generated WAV sounds that mimic real WhatsApp notification tones
 */

export interface SoundConfig {
  enabled: boolean;
  volume: number; // 0 to 1
}

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  enabled: true,
  volume: 0.5,
};

// ============================================================================
// WAV FILE GENERATION UTILITIES
// ============================================================================

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generate a complex tone with multiple harmonics for richer sound
 */
function generateComplexTone(
  baseFrequency: number,
  durationMs: number,
  volume: number,
  harmonics: number[] = [1, 2, 3, 4], // Harmonic ratios
  harmonicVolumes: number[] = [1, 0.5, 0.25, 0.125] // Volume for each harmonic
): Int16Array {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const samples = new Int16Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    
    // ADSR envelope
    let envelope: number;
    const attackEnd = 0.05;
    const decayEnd = 0.15;
    const sustainEnd = 0.7;
    
    if (progress < attackEnd) {
      // Attack - quick rise
      envelope = Math.sin((progress / attackEnd) * Math.PI * 0.5);
    } else if (progress < decayEnd) {
      // Decay - slight drop
      const decayProgress = (progress - attackEnd) / (decayEnd - attackEnd);
      envelope = 1 - (decayProgress * 0.3);
    } else if (progress < sustainEnd) {
      // Sustain - steady
      envelope = 0.7;
    } else {
      // Release - fade out
      const releaseProgress = (progress - sustainEnd) / (1 - sustainEnd);
      envelope = 0.7 * (1 - Math.pow(releaseProgress, 2));
    }
    
    // Sum harmonics
    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const freq = baseFrequency * harmonics[h];
      const harmonicVolume = harmonicVolumes[h] || 0.1;
      sample += Math.sin(2 * Math.PI * freq * t) * harmonicVolume;
    }
    
    // Normalize and apply envelope
    sample = (sample / harmonics.length) * envelope * volume * 32767;
    samples[i] = Math.max(-32767, Math.min(32767, Math.floor(sample)));
  }
  
  return samples;
}

/**
 * Generate WhatsApp-like "sent" message sound
 * A short, soft "pop" sound - subtle confirmation
 */
function generateSentSound(): Int16Array {
  const sampleRate = 44100;
  const durationMs = 100;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const samples = new Int16Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    
    // Quick attack, fast decay - like a soft pop
    const envelope = Math.sin(Math.PI * progress) * Math.exp(-progress * 4);
    
    // Mix of frequencies for a pleasant "pop"
    const freq1 = Math.sin(2 * Math.PI * 1400 * t);  // Higher
    const freq2 = Math.sin(2 * Math.PI * 800 * t);   // Mid
    const freq3 = Math.sin(2 * Math.PI * 400 * t);   // Lower
    
    // Frequency sweep down for "pop" effect
    const sweep = Math.sin(2 * Math.PI * (1200 - progress * 800) * t);
    
    const sample = ((freq1 * 0.3 + freq2 * 0.4 + freq3 * 0.2 + sweep * 0.1) * envelope * 0.4 * 32767);
    samples[i] = Math.floor(Math.max(-32767, Math.min(32767, sample)));
  }
  
  return samples;
}

/**
 * Generate WhatsApp-like "received" message sound
 * The classic "ding-ding" notification - two-tone musical chime
 */
function generateReceivedSound(): Int16Array {
  const sampleRate = 44100;
  const durationMs = 350;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const samples = new Int16Array(numSamples);
  
  // Musical notes: G#6 (1568 Hz) and E6 (1319 Hz) - a pleasant interval
  const note1Freq = 1568;  // G#6
  const note2Freq = 1319;  // E6
  const note1Start = 0;    // Immediate
  const note2Start = 0.12; // 120ms delay for second note
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    
    let sample = 0;
    
    // First "ding" - G#6
    if (t < 0.18) {
      const note1Progress = t / 0.18;
      const env1 = Math.exp(-note1Progress * 8) * Math.sin(Math.PI * note1Progress * 0.5);
      sample += Math.sin(2 * Math.PI * note1Freq * t) * env1 * 0.5;
      // Add octave harmonic for richness
      sample += Math.sin(2 * Math.PI * note1Freq * 2 * t) * env1 * 0.15;
    }
    
    // Second "ding" - E6 (starts after first)
    if (t >= note2Start) {
      const note2Time = t - note2Start;
      const note2Progress = note2Time / 0.22;
      if (note2Progress < 1) {
        const env2 = Math.exp(-note2Progress * 6) * Math.sin(Math.PI * note2Progress * 0.5);
        sample += Math.sin(2 * Math.PI * note2Freq * (t - note2Start)) * env2 * 0.45;
        // Add fifth harmonic for richness
        sample += Math.sin(2 * Math.PI * note2Freq * 1.5 * (t - note2Start)) * env2 * 0.1;
      }
    }
    
    samples[i] = Math.floor(Math.max(-32767, Math.min(32767, sample * 32767)));
  }
  
  return samples;
}

/**
 * Generate typing indicator sound
 * Very subtle, soft click
 */
function generateTypingSound(): Int16Array {
  const sampleRate = 44100;
  const durationMs = 40;
  const numSamples = Math.floor(sampleRate * (durationMs / 1000));
  const samples = new Int16Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    
    // Very quick envelope
    const envelope = Math.sin(Math.PI * progress) * Math.exp(-progress * 6);
    
    // Soft click sound
    const freq = 600 - progress * 400; // Frequency sweep
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.15 * 32767;
    samples[i] = Math.floor(sample);
  }
  
  return samples;
}

/**
 * Convert samples to WAV file as base64 data URI
 */
function samplesToWav(samples: Int16Array): string {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = samples.length * 2;
  const fileSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  
  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Chunk size
  view.setUint16(20, 1, true);  // Audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // Byte rate
  view.setUint16(32, numChannels * 2, true); // Block align
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

// ============================================================================
// PRE-GENERATED SOUNDS (ready for immediate use)
// ============================================================================

/**
 * WhatsApp-style sent message sound
 * A soft "pop" confirmation sound
 */
export const MESSAGE_SENT_SOUND = samplesToWav(generateSentSound());

/**
 * WhatsApp-style received message sound
 * The classic "ding-ding" notification chime
 */
export const MESSAGE_RECEIVED_SOUND = samplesToWav(generateReceivedSound());

/**
 * Typing indicator sound
 * A subtle click
 */
export const TYPING_SOUND = samplesToWav(generateTypingSound());

// ============================================================================
// SOUND EFFECTS (optional enhancements)
// ============================================================================

/**
 * Additional sound variations
 */
export const SOUND_VARIATIONS = {
  // Alternative sent sounds (different tones)
  sentSoft: samplesToWav(generateComplexTone(1000, 80, 0.3, [1, 1.5], [1, 0.3])),
  sentConfirm: samplesToWav(generateComplexTone(1200, 100, 0.35, [1, 2], [1, 0.4])),
  
  // Alternative received sounds
  receivedBright: samplesToWav(generateComplexTone(1650, 300, 0.45, [1, 1.26, 2], [1, 0.6, 0.3])),
  receivedSoft: samplesToWav(generateComplexTone(1400, 250, 0.35, [1, 1.5], [1, 0.5])),
};

/**
 * Get a random sound variation to avoid repetitive sounds
 */
export function getRandomSentSound(): string {
  const sounds = [MESSAGE_SENT_SOUND, SOUND_VARIATIONS.sentSoft, SOUND_VARIATIONS.sentConfirm];
  return sounds[Math.floor(Math.random() * sounds.length)];
}

export function getRandomReceivedSound(): string {
  const sounds = [MESSAGE_RECEIVED_SOUND, SOUND_VARIATIONS.receivedBright, SOUND_VARIATIONS.receivedSoft];
  return sounds[Math.floor(Math.random() * sounds.length)];
}
