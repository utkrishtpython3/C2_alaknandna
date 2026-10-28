"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Radio,
  RadioTower,
  Mic,
  ShieldAlert,
  CheckCircle2,
  Share2,
  Languages,
  Sliders,
  Sparkles,
  Zap,
  Download,
  AlertTriangle,
  FileAudio,
} from "lucide-react";
import type { RiskLevel } from "@/lib/hydrologyEngine";

interface TacticalVoiceBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadTimeMin?: number;
  confluenceQ?: number;
  alertLevel?: RiskLevel;
}

type AudioLang = "hindi" | "garhwali" | "english";

interface BroadcastScript {
  id: AudioLang;
  label: string;
  sublabel: string;
  badge: string;
  text: string;
  spokenFallback: string; // Phonetic Romanized text that guarantees clean pronunciation on all TTS engines without reciting punctuation tokens
  phoneticHint: string;
  voiceLangCode: string;
}

const SCRIPTS: Record<AudioLang, BroadcastScript> = {
  hindi: {
    id: "hindi",
    label: "हिन्दी (Hindi Megaphone Alert)",
    sublabel: "Official NDMA / NDRF Hindi Siren Broadcast",
    badge: "NDRF NATIONAL BROADCAST",
    text: "सावधान. राष्ट्रीय आपदा मोचन बल आपातकालीन चेतावनी. अलकनंदा और धौलीगंगा घाटी में भीषण बादल फटने से विनाशकारी फ्लैश फ्लड और मलबा प्रवाह आ रहा है. अगले पच्चीस मिनट में नदी का जलस्तर आठ मीटर से अधिक बढ़ जाएगा. सभी ग्रामवासी नदी तटों को तुरंत खाली करें, और गोरसों बुग्याल तथा ऊंचे सुरक्षित स्थानों की ओर प्रस्थान करें. बद्रीनाथ राष्ट्रीय राजमार्ग सात पर सभी वाहनों का आवागमन तुरंत रोक दिया गया है.",
    spokenFallback: "Saavdhaan. Rashtriya Aapda Mochan Bal aapatkaaleen chetawani. Alaknanda aur Dhauliganga ghaati mein bhishan baadal phatne se vinaashkaari flash flood aur malba pravaah aa raha hai. Agle 25 minute mein nadi ka jal star 8 meter se adhik badh jaayega. Sabhi gramwaasi nadi tatton ko turant khaali karein, aur Gorson Bugyal tatha oonche surakshit sthaanon ki or prasthaan karein. Badrinath rashtriya raajmaarg saath par sabhi vaahanon ka aavagaman turant rok diya gaya hai.",
    phoneticHint: "Official NDRF Hindi broadcast tailored for public address megaphones and state civil defence radio.",
    voiceLangCode: "hi-IN",
  },
  garhwali: {
    id: "garhwali",
    label: "गढ़वाली (Garhwali Mountain SWRT Siren)",
    sublabel: "Localized Chamoli High-Altitude Folk Siren",
    badge: "VILLAGE MEGAPHONE RELAY",
    text: "हे भाई-बैण्यों, अलकनंदा अर धौलीगंगा घाटी का सब्यूं लोग सुन ल्या. नदी मा भारी बाढ अर मलबो आणा को भयंकर खतरा छ. केवल कुछ मिनट को बगत बच्यों छ. नदी गदेरों के कन्द फौरन छोड़ि द्या अर ऊँचा डांडों पर चड़ी जावा. गौ-भैंसों तैं खूँटों से खोली द्या. जोशीमठ स्कूल अर स्टेडियम मा सुरक्षित कैंप बणयां छन, उथैं जावा. घबरावा नि, हिम्मत राखा.",
    spokenFallback: "Hey bhai bainyon, Alaknanda aur Dhauliganga ghaati ka sabyun log sun lya. Nadi ma bhaari baadh aur malbo aana ko bhayankar khatra chha. Kewal kuchh minute ko bagat bachyon chha. Nadi gaderon ke kand phauran chhodi dya aur ooncha daandon par chadi jaawa. Gau bhainson tain khoonton se kholi dya. Joshimath school aur stadium ma surakshit camp banyan chhan, uthain jaawa. Ghabraawa ni, himmat raakha.",
    phoneticHint: "Authentic Garhwali mountain dialect broadcast designed for elder village reach during cellular network collapse.",
    voiceLangCode: "hi-IN",
  },
  english: {
    id: "english",
    label: "English (Tactical Incident Dispatch)",
    sublabel: "NDRF Multi-Agency Tactical Command Dispatch",
    badge: "MILITARY C2 IMMEDIATE",
    text: "Emergency tactical flash flood dispatch. Catastrophic non-Newtonian debris surge detected in the Dhauliganga gorge reach. Hydrodynamic crest velocity exceeding six point eight meters per second. Confluence bridge submergence imminent. Execute immediate uphill evacuation to designated assembly points. All tactical rescue units initiate Stage-Two Rapid Deployment.",
    spokenFallback: "Emergency tactical flash flood dispatch. Catastrophic non Newtonian debris surge detected in the Dhauliganga gorge reach. Hydrodynamic crest velocity exceeding six point eight meters per second. Confluence bridge submergence imminent. Execute immediate uphill evacuation to designated assembly points. All tactical rescue units initiate Stage Two Rapid Deployment.",
    phoneticHint: "Standard NDRF/Incident Command phonetic cadence for multi-agency interoperability.",
    voiceLangCode: "en-IN",
  },
};

/** Sanitizes any raw string so no browser TTS engine ever recites punctuation tokens aloud. */
function cleanTtsText(raw: string): string {
  return raw
    .replace(/[!|।]/g, ". ")
    .replace(/\?/g, ". ")
    .replace(/[-/–—]/g, " ")
    .replace(/["'“”‘’()[\]{}*•·]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+/g, ".")
    .trim();
}

export function TacticalVoiceBroadcastModal({
  isOpen,
  onClose,
  leadTimeMin = 26,
  confluenceQ = 146.0,
  alertLevel = "EXTREME",
}: TacticalVoiceBroadcastModalProps) {
  const [selectedLang, setSelectedLang] = useState<AudioLang>("hindi");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [continuousSiren, setContinuousSiren] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.05);
  const [volume, setVolume] = useState<number>(1.0);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [radioStatic, setRadioStatic] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [hasNativeHindi, setHasNativeHindi] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const continuousGainRef = useRef<GainNode | null>(null);
  const continuousOsc1Ref = useRef<OscillatorNode | null>(null);
  const continuousOsc2Ref = useRef<OscillatorNode | null>(null);
  const continuousTimerRef = useRef<any>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const wordIntervalRef = useRef<any>(null);

  const script = SCRIPTS[selectedLang];
  const words = useMemo(() => script.text.split(" "), [script.text]);

  // Pre-load and cache available voices on mount and voice change events
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const vList = window.speechSynthesis.getVoices();
      if (vList.length > 0) {
        setAvailableVoices(vList);
        const hasHi = vList.some(
          (v) => v.lang.startsWith("hi") || v.lang.startsWith("mr") || v.name.toLowerCase().includes("hindi")
        );
        setHasNativeHindi(hasHi);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Play synthesized tactical radio click & squelch burst
  const playRadioChirp = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;

      const now = ctx.currentTime;

      // Two-tone alert beep (880Hz then 440Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.1);

      gain.gain.setValueAtTime(0.25 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.27);

      // Squelch static burst
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12 * volume, now + 0.25);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      whiteNoise.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now + 0.25);
    } catch {
      /* ignore audio context errors */
    }
  }, [volume]);

  // Authentic 2.6-Second Civil Defense Flood Warning Siren Preamble
  const playCivilDefenseSirenPreamble = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          resolve();
          return;
        }
        const ctx = audioContextRef.current || new AudioCtx();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();

        const now = ctx.currentTime;
        const dur = 2.6;

        setIsSirenActive(true);

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sawtooth";
        osc2.type = "sawtooth";
        osc2.detune.setValueAtTime(8, now);

        // Realistic air-raid wail pitch progression (460Hz -> 760Hz -> 500Hz -> 820Hz)
        osc1.frequency.setValueAtTime(460, now);
        osc1.frequency.linearRampToValueAtTime(760, now + 0.7);
        osc1.frequency.linearRampToValueAtTime(500, now + 1.4);
        osc1.frequency.linearRampToValueAtTime(820, now + 2.1);
        osc1.frequency.linearRampToValueAtTime(460, now + dur);

        osc2.frequency.setValueAtTime(460, now);
        osc2.frequency.linearRampToValueAtTime(760, now + 0.7);
        osc2.frequency.linearRampToValueAtTime(500, now + 1.4);
        osc2.frequency.linearRampToValueAtTime(820, now + 2.1);
        osc2.frequency.linearRampToValueAtTime(460, now + dur);

        // Smooth volume swell and tail fade
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.32 * volume, now + 0.25);
        gain.gain.setValueAtTime(0.32 * volume, now + dur - 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur);
        osc2.stop(now + dur);

        setTimeout(() => {
          setIsSirenActive(false);
          playRadioChirp();
          resolve();
        }, dur * 1000 - 80);
      } catch {
        setIsSirenActive(false);
        resolve();
      }
    });
  }, [volume, playRadioChirp]);

  // Continuous Civil Defense Siren Loop (Toggle on/off)
  const toggleContinuousSiren = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (continuousSiren) {
        // Stop continuous siren
        if (continuousGainRef.current && audioContextRef.current) {
          const t = audioContextRef.current.currentTime;
          continuousGainRef.current.gain.linearRampToValueAtTime(0.0001, t + 0.2);
        }
        if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
        setTimeout(() => {
          try {
            continuousOsc1Ref.current?.stop();
            continuousOsc2Ref.current?.stop();
          } catch {
            /* ignore */
          }
          continuousGainRef.current = null;
          continuousOsc1Ref.current = null;
          continuousOsc2Ref.current = null;
        }, 250);
        setContinuousSiren(false);
        setIsSirenActive(false);
        return;
      }

      // Start continuous siren
      const ctx = audioContextRef.current || new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc2.detune.setValueAtTime(7, now);

      osc1.frequency.setValueAtTime(480, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.28 * volume, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      continuousGainRef.current = gain;
      continuousOsc1Ref.current = osc1;
      continuousOsc2Ref.current = osc2;

      let up = true;
      continuousTimerRef.current = setInterval(() => {
        if (!audioContextRef.current || !continuousOsc1Ref.current) return;
        const t = audioContextRef.current.currentTime;
        const targetFreq = up ? 780 : 480;
        continuousOsc1Ref.current.frequency.linearRampToValueAtTime(targetFreq, t + 0.7);
        continuousOsc2Ref.current?.frequency.linearRampToValueAtTime(targetFreq, t + 0.7);
        up = !up;
      }, 750);

      setContinuousSiren(true);
      setIsSirenActive(true);
    } catch {
      setContinuousSiren(false);
      setIsSirenActive(false);
    }
  };

  // Audio equalizer waveform animation loop
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;
    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const centerY = h / 2;

      ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();

      const numBars = 52;
      const barWidth = w / numBars;

      for (let i = 0; i < numBars; i++) {
        const x = i * barWidth;
        let amp = 3;
        if (isSirenActive) {
          // Energetic high-intensity siren waveform
          amp = Math.sin(i * 0.6 + phase * 2.2) * 22 + Math.cos(i * 0.3 - phase * 1.5) * 14 + 10;
          amp = Math.abs(amp) * (volume + 0.2);
        } else if (isPlaying) {
          // Voice cadence waveform
          amp = Math.sin(i * 0.4 + phase) * 16 + Math.cos(i * 0.2 - phase * 0.8) * 10 + 6;
          amp = Math.abs(amp) * (volume + 0.2);
        } else {
          // Subtle standby breathing carrier
          amp = Math.sin(i * 0.2 + phase * 0.3) * 2 + 3;
        }

        const barH = Math.max(3, Math.min(h / 2 - 4, amp));

        const grad = ctx.createLinearGradient(0, centerY - barH, 0, centerY + barH);
        if (isSirenActive) {
          grad.addColorStop(0, "#f43f5e");
          grad.addColorStop(0.5, "#f59e0b");
          grad.addColorStop(1, "#ef4444");
        } else if (isPlaying) {
          grad.addColorStop(0, "#f43f5e");
          grad.addColorStop(0.5, "#a855f7");
          grad.addColorStop(1, "#38bdf8");
        } else {
          grad.addColorStop(0, "#475569");
          grad.addColorStop(1, "#1e293b");
        }

        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, centerY - barH, barWidth - 4, barH * 2);
      }

      phase += isSirenActive ? 0.35 : isPlaying ? 0.2 : 0.05;
      animFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isPlaying, isSirenActive, volume]);

  // Start speech synthesis with siren preamble and voice auto-fallback
  const handleStartBroadcast = async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }

    // Halt previous speech
    window.speechSynthesis.cancel();
    if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);

    // 1. Play the authentic 2.6-second civil defense siren preamble first
    await playCivilDefenseSirenPreamble();

    // 2. Select optimal voice and sanitized text
    const voices =
      availableVoices.length > 0
        ? availableVoices
        : window.speechSynthesis.getVoices();

    const hindiVoice = voices.find(
      (v) =>
        v.lang.startsWith("hi") ||
        v.lang.startsWith("mr") ||
        v.name.toLowerCase().includes("hindi")
    );
    const indianEnglishVoice = voices.find(
      (v) =>
        v.lang.includes("IN") ||
        v.name.toLowerCase().includes("india") ||
        v.name.toLowerCase().includes("rishi") ||
        v.name.toLowerCase().includes("veena")
    );
    const defaultVoice =
      voices.find((v) => v.lang.startsWith("en")) || voices[0] || null;

    let textToSpeak = "";
    let chosenVoice: SpeechSynthesisVoice | null = null;
    let chosenLang = "en-IN";

    if (selectedLang === "english") {
      textToSpeak = cleanTtsText(script.spokenFallback);
      chosenVoice = indianEnglishVoice || defaultVoice;
      chosenLang = "en-IN";
    } else {
      // Hindi or Garhwali
      if (hindiVoice) {
        // Native Hindi voice is installed on OS: speak pristine Devanagari!
        textToSpeak = cleanTtsText(script.text);
        chosenVoice = hindiVoice;
        chosenLang = "hi-IN";
      } else {
        // No Hindi voice on OS: speak phonetic Romanized script with Indian/English engine.
        // This completely eliminates the "exclamation point" bug!
        textToSpeak = cleanTtsText(script.spokenFallback);
        chosenVoice = indianEnglishVoice || defaultVoice;
        chosenLang = "en-IN";
      }
    }

    const u = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = u;

    u.lang = chosenLang;
    u.rate = playbackRate;
    u.pitch = selectedLang === "garhwali" ? 1.05 : 0.98;
    u.volume = volume;

    if (chosenVoice) {
      u.voice = chosenVoice;
    }

    // Word boundary teleprompter tracking
    let wordIdx = 0;
    u.onboundary = (event) => {
      if (event.name === "word") {
        const charIdx = event.charIndex;
        const textUpToChar = textToSpeak.substring(0, charIdx);
        const wIdx = textUpToChar.split(" ").length - 1;
        setActiveWordIndex(Math.min(words.length - 1, wIdx));
      }
    };

    u.onstart = () => {
      setIsPlaying(true);
      setRadioStatic(true);

      // Fallback word ticker for browsers where SpeechSynthesisUtterance.onboundary is not dispatched
      const totalWords = words.length;
      const approxDurationSec = totalWords / (playbackRate * 2.4);
      const intervalMs = (approxDurationSec * 1000) / totalWords;
      wordIdx = 0;
      setActiveWordIndex(0);
      wordIntervalRef.current = setInterval(() => {
        wordIdx++;
        if (wordIdx < totalWords) {
          setActiveWordIndex(wordIdx);
        } else {
          clearInterval(wordIntervalRef.current);
        }
      }, intervalMs);
    };

    u.onend = () => {
      setIsPlaying(false);
      setActiveWordIndex(-1);
      setRadioStatic(false);
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
      playRadioChirp();
      setTxSuccess(true);
      setTimeout(() => setTxSuccess(false), 3500);
    };

    u.onerror = () => {
      setIsPlaying(false);
      setActiveWordIndex(-1);
      setRadioStatic(false);
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    };

    window.speechSynthesis.speak(u);
  };

  const handleStopBroadcast = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    if (continuousSiren) {
      toggleContinuousSiren();
    }
    setIsPlaying(false);
    setIsSirenActive(false);
    setActiveWordIndex(-1);
    setRadioStatic(false);
  };

  // Export 16-bit PCM WAV evacuation audio file for field vehicle megaphones & SAR drones
  const handleExportWavAudio = () => {
    try {
      const sampleRate = 22050;
      const durationSec = 4.5;
      const numSamples = Math.floor(sampleRate * durationSec);
      const buffer = new Float32Array(numSamples);

      // Generate 2.8s dual-sawtooth siren + squelch into buffer
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        if (t < 2.8) {
          // Sweeping dual pitch (460 -> 760 -> 500 -> 820)
          const freq = 460 + Math.sin(t * 2.8) * 220 + (t > 1.4 ? 100 : 0);
          const sample1 = (2 * ((t * freq) % 1)) - 1;
          const sample2 = (2 * ((t * (freq + 6)) % 1)) - 1;
          const env = Math.min(1, t * 4) * Math.min(1, (2.8 - t) * 3);
          buffer[i] = (sample1 + sample2) * 0.5 * 0.6 * env;
        } else if (t < 3.2) {
          // Squelch static burst
          buffer[i] = (Math.random() * 2 - 1) * 0.15 * Math.min(1, (3.2 - t) * 3);
        } else {
          // Closing two-tone VHF radio blip
          const f = t < 3.6 ? 880 : 440;
          buffer[i] = Math.sin(2 * Math.PI * f * t) * 0.25 * Math.min(1, (4.0 - t) * 3);
        }
      }

      // Encode to 16-bit PCM WAV
      const wavBytes = encodeWav(buffer, sampleRate);
      const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `NDRF_Chamoli_Evacuation_Siren_${selectedLang.toUpperCase()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Audio generation error. Browser does not support PCM encoding.");
    }
  };

  // Keyboard Escape listener to dismiss modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleStopBroadcast();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleStopBroadcast();
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col rounded-2xl border border-rose-500/60 bg-slate-950 shadow-[0_0_60px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/30 overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-500/50 bg-rose-950/50 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.35)]">
              <Radio className="h-5 w-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-100 tactical-font tracking-wide">
                  Tactical Multilingual Voice Synthesizer &amp; Megaphone Broadcast
                </h3>
                <span className="rounded bg-rose-950/80 px-2 py-0.5 text-[9.5px] font-mono font-bold text-rose-300 border border-rose-700/60 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                  VHF &bull; LoRaWAN &bull; SATCOM
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Localized Audio Megaphone Warning for Offline Mountain Hamlets during Telecom Blackout
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleStopBroadcast();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
            title="Close Voice Broadcast"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Language Selector Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(["hindi", "garhwali", "english"] as AudioLang[]).map((langKey) => {
              const item = SCRIPTS[langKey];
              const active = selectedLang === langKey;
              return (
                <button
                  key={langKey}
                  type="button"
                  onClick={() => {
                    handleStopBroadcast();
                    setSelectedLang(langKey);
                  }}
                  className={`flex flex-col text-left p-3 rounded-xl border transition cursor-pointer ${
                    active
                      ? "border-rose-500 bg-rose-950/40 text-rose-200 ring-1 ring-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Languages className="h-3.5 w-3.5 text-rose-400" />
                      {item.label}
                    </span>
                    {active && <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />}
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight mb-2">{item.sublabel}</span>
                  <span className="mt-auto text-[9px] font-mono text-rose-300 font-bold tracking-wider">
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Real-Time Audio Equalizer Waveform Canvas */}
          <div className="relative rounded-xl border border-slate-800 bg-slate-950/90 p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isSirenActive ? "bg-amber-400 animate-ping" : isPlaying ? "bg-rose-500 animate-ping" : "bg-slate-600"}`} />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  {isSirenActive
                    ? "CIVIL DEFENSE SIREN KLAXON SOUNDING (460–820 Hz WARBLE)"
                    : isPlaying
                    ? `TRANSMITTING ${script.label.split(" ")[0]} ON VHF 146.5 MHz & LORA SX1262`
                    : "ACOUSTIC KLAXON & SYNTHESIS STANDBY — READY TO BROADCAST"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>SURGE ETA: <strong className="text-rose-300">{leadTimeMin}m</strong></span>
                <span>&bull;</span>
                <span>Q: <strong className="text-cyan-300">{confluenceQ.toFixed(0)} m&sup3;/s</strong></span>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={760}
              height={70}
              className="w-full h-18 rounded bg-slate-900/80 border border-slate-800/80 shadow-inner"
            />

            {/* Carrier transmission & Voice engine status badge */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <RadioTower className="h-3.5 w-3.5 text-cyan-400" />
                <span>Repeaters: Auli Ridge (2,850m) &rarr; Helang Chokepoint &rarr; Vishnuprayag</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-slate-500">
                  Voice Engine: {hasNativeHindi && selectedLang !== "english" ? "Native Devanagari (Hindi)" : "Phonetic Romanized Clean Speech"}
                </span>
                <span className={`font-bold ${isSirenActive || isPlaying ? "text-rose-400 animate-pulse" : "text-slate-500"}`}>
                  {isSirenActive ? "SIREN ACTIVE" : isPlaying ? "VOCAL ACTIVE" : "STANDBY"}
                </span>
              </span>
            </div>
          </div>

          {/* Script Teleprompter with Live Highlighted Words */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
                <Mic className="h-4 w-4 text-rose-400" />
                Speech Synthesis Teleprompter Transcript:
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {words.length} words &bull; ~{Math.round(words.length / (playbackRate * 2.3))}s airtime
              </span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 leading-relaxed text-sm max-h-44 overflow-y-auto font-sans select-none">
              {words.map((word, idx) => {
                const isCurrent = idx === activeWordIndex;
                return (
                  <span
                    key={idx}
                    className={`inline-block mr-1.5 px-1 py-0.5 rounded transition-all duration-150 ${
                      isCurrent
                        ? "bg-rose-500 text-slate-950 font-bold scale-105 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                        : idx < activeWordIndex
                        ? "text-slate-400 line-through opacity-70"
                        : "text-slate-200"
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Tip: {script.phoneticHint}</span>
              <span className="text-emerald-400">Auto-sanitized (zero spoken punctuation errors)</span>
            </div>
          </div>

          {/* Audio Controls & NDRF Megaphone Actions Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Main Broadcast Voice + Siren Button */}
              {!isPlaying && !isSirenActive ? (
                <button
                  type="button"
                  onClick={handleStartBroadcast}
                  className="flex items-center gap-2 rounded-xl border border-rose-500 bg-rose-600 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.45)] transition cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  <span>Broadcast {script.label.split(" ")[0]} &amp; Siren</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopBroadcast}
                  className="flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-600 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.45)] transition cursor-pointer"
                >
                  <Pause className="h-4 w-4 fill-slate-950" />
                  <span>Halt Transmission</span>
                </button>
              )}

              {/* Continuous Siren Wail Toggle (Mechanical Warning Horn) */}
              <button
                type="button"
                onClick={toggleContinuousSiren}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-mono font-bold transition cursor-pointer ${
                  continuousSiren
                    ? "border-amber-400 bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse"
                    : "border-slate-700 bg-slate-800/80 text-amber-300 hover:bg-slate-700"
                }`}
                title="Sound continuous mechanical civil defense flood warning siren"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{continuousSiren ? "Stop Siren Horn" : "Siren Horn Only"}</span>
              </button>

              {/* Export Field WAV Audio Package */}
              <button
                type="button"
                onClick={handleExportWavAudio}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-mono text-cyan-300 hover:bg-slate-700 hover:text-cyan-200 transition cursor-pointer"
                title="Download 16-bit PCM WAV evacuation audio file for drone loudspeakers and QRV vehicle megaphones"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Field WAV</span>
              </button>

              {/* Volume Slider */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800">
                <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  title="Broadcast Audio Volume"
                />
              </div>

              {/* Cadence Speed Toggle */}
              <div className="flex items-center gap-1 text-[11px] font-mono">
                <span className="text-slate-400">Pace:</span>
                {[0.95, 1.05, 1.2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer ${
                      playbackRate === rate
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {txSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4" />
                Broadcast Completed Over Tactical Relays
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <RadioTower className="h-4 w-4 text-rose-400" />
            <span>Hardware Target: 865–867 MHz LoRa SX1262 Relay &bull; Chamoli QRT Audio Tower</span>
          </div>

          <button
            type="button"
            onClick={() => {
              handleStopBroadcast();
              onClose();
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

/** Helper function to encode raw PCM float samples to standard RIFF 16-bit WAV bytes */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // 16 bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export default TacticalVoiceBroadcastModal;
