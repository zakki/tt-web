/*
 * $Id: sound.d,v 1.1.1.1 2004/11/10 13:45:22 kenta Exp $
 *
 * Copyright 2004 Kenta Cho. Some rights reserved.
 */

import { SDLException, SDLInitFailedException } from "./sdlexception";

/**
 * Initialize and close SDL_mixer.
 */
export class SoundManager {
  public static noSound = false;
  private static audioContext: AudioContext | null = null;
  private static unlocked = false;
  private static unlockHandlersBound = false;

  public static init(): void {
    if (SoundManager.noSound) return;
    if (typeof AudioContext === "undefined") return;
    try {
      if (!SoundManager.audioContext) SoundManager.audioContext = new AudioContext();
      SoundManager.bindUnlockHandlers();
    } catch {
      SoundManager.noSound = true;
      throw new SDLInitFailedException("Unable to initialize audio");
    }
  }

  public static close(): void {
    if (SoundManager.noSound) return;
    if (!SoundManager.audioContext) return;
    void SoundManager.audioContext.suspend();
  }

  public static getContext(): AudioContext | null {
    return SoundManager.audioContext;
  }

  public static unlock(): void {
    if (!SoundManager.audioContext || SoundManager.unlocked) return;
    void SoundManager.audioContext.resume();
    SoundManager.unlocked = SoundManager.audioContext.state === "running";
  }

  private static bindUnlockHandlers(): void {
    if (SoundManager.unlockHandlersBound || typeof window === "undefined") return;
    SoundManager.unlockHandlersBound = true;
    const unlock = (): void => {
      SoundManager.unlock();
      if (SoundManager.unlocked) {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }
}

/**
 * Music / Chunk.
 */
export interface Sound {
  load(name: string): void;
  load(name: string, ch: number): void;
  free(): void;
  play(): void;
  fade(): void;
  halt(): void;
}

export class Music implements Sound {
  public static fadeOutSpeed = 1280;
  public static dir = "sounds/musics";
  private static active = new Set<Music>();
  private audio: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private music: string | null = null;

  public load(name: string): void;
  public load(name: string, _ch: number): void;
  public load(name: string): void {
    if (SoundManager.noSound) return;
    const fileName = `${Music.dir}/${name}`;
    this.music = fileName;
    if (typeof Audio !== "undefined") {
      this.audio = new Audio(fileName);
      this.audio.preload = "auto";
      this.audio.loop = true;
      const ctx = SoundManager.getContext();
      if (ctx) {
        this.source = ctx.createMediaElementSource(this.audio);
        this.gain = ctx.createGain();
        this.gain.gain.value = 1;
        this.source.connect(this.gain);
        this.gain.connect(ctx.destination);
      }
    } else if (!this.music) {
      throw new SDLException(`Couldn't load: ${fileName}`);
    }
  }

  public free(): void {
    this.halt();
    this.source?.disconnect();
    this.gain?.disconnect();
    this.source = null;
    this.gain = null;
    this.audio = null;
    this.music = null;
  }

  public play(): void {
    if (SoundManager.noSound) return;
    SoundManager.unlock();
    if (!this.audio) return;
    this.audio.loop = true;
    this.audio.currentTime = 0;
    void this.audio.play().catch(() => {
      // Missing/unsupported audio source should not break gameplay loop.
    });
    Music.active.add(this);
  }

  public playOnce(): void {
    if (SoundManager.noSound) return;
    SoundManager.unlock();
    if (!this.audio) return;
    this.audio.loop = false;
    this.audio.currentTime = 0;
    void this.audio.play().catch(() => {
      // Missing/unsupported audio source should not break gameplay loop.
    });
    Music.active.add(this);
  }

  public fade(): void {
    Music.fadeMusic();
  }

  public halt(): void {
    Music.haltMusic();
  }

  public static fadeMusic(): void {
    if (SoundManager.noSound) return;
    const ctx = SoundManager.getContext();
    if (ctx) {
      const now = ctx.currentTime;
      for (const m of Music.active) {
        if (!m.gain) continue;
        m.gain.gain.cancelScheduledValues(now);
        m.gain.gain.setValueAtTime(m.gain.gain.value, now);
        m.gain.gain.linearRampToValueAtTime(0, now + 0.4);
      }
      return;
    }
    for (const m of Music.active) {
      if (!m.audio) continue;
      m.audio.volume = Math.max(0, m.audio.volume - 0.3);
    }
  }

  public static haltMusic(): void {
    if (SoundManager.noSound) return;
    for (const m of Music.active) {
      if (!m.audio) continue;
      m.audio.pause();
      m.audio.currentTime = 0;
      m.audio.volume = 1;
      if (m.gain) m.gain.gain.value = 1;
    }
    Music.active.clear();
  }
}

export class Chunk implements Sound {
  public static dir = "sounds/chunks";
  private chunk: string | null = null;
  private chunkAudio: HTMLAudioElement | null = null;
  private playing: HTMLAudioElement[] = [];
  private chunkChannel = 0;

  public load(name: string): void;
  public load(name: string, ch: number): void;
  public load(name: string, ch = 0): void {
    if (SoundManager.noSound) return;
    const fileName = `${Chunk.dir}/${name}`;
    this.chunk = fileName;
    if (typeof Audio !== "undefined") this.chunkAudio = new Audio(fileName);
    else if (!this.chunk) throw new SDLException(`Couldn't load: ${fileName}`);
    this.chunkChannel = ch;
  }

  public free(): void {
    if (this.chunk) {
      this.halt();
      this.chunk = null;
      this.chunkAudio = null;
    }
  }

  public play(): void {
    if (SoundManager.noSound) return;
    SoundManager.unlock();
    if (!this.chunkAudio) return;
    const a = this.chunkAudio.cloneNode() as HTMLAudioElement;
    a.currentTime = 0;
    void a.play().catch(() => {
      // Missing/unsupported audio source should not break gameplay loop.
    });
    this.playing.push(a);
    this.playing = this.playing.filter((x) => !x.ended);
    void this.chunkChannel;
  }

  public halt(): void {
    if (SoundManager.noSound) return;
    for (const a of this.playing) {
      a.pause();
      a.currentTime = 0;
    }
    this.playing = [];
  }

  public fade(): void {
    this.halt();
  }
}
