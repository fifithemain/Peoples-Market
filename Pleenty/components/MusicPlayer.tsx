'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

function isYouTubePage(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch { return false; }
}

export default function MusicPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  const [needsTap, setNeedsTap] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [playbackError, setPlaybackError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/music', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error('Music settings unavailable.'); return response.json(); }).then(data => {
      if (!active) return;
      const list = Array.isArray(data.tracks) ? data.tracks.filter((track: unknown): track is string => typeof track === 'string') : [];
      setTracks(list);
      setEnabled(Boolean(data.enabled) && list.length > 0);
    }).catch(() => { if (active) setLoadError('Store music could not be loaded. Please refresh the page.'); });
    return () => { active = false; };
  }, []);

  const tryPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !enabled || !tracks.length) return;
    setPlaybackError('');
    try {
      audio.muted = false;
      await audio.play();
      setIsPlaying(true);
      setNeedsTap(false);
    } catch {
      // Audible autoplay is commonly blocked until a visitor interacts with the page.
      setNeedsTap(true);
      setIsPlaying(false);
      setPlaybackError(audio.error ? 'This track could not be loaded. Check that its URL points to a public audio file.' : 'Your browser needs a tap before music can start. Use Play to begin.');
    }
  }, [enabled, tracks.length, index]);

  useEffect(() => {
    if (enabled && tracks.length) {
      const id = window.setTimeout(() => { void tryPlay(); }, 250);
      return () => window.clearTimeout(id);
    }
  }, [enabled, tracks, index, tryPlay]);

  // Browsers block audible autoplay, so start on the visitor's first interaction with the page.
  useEffect(() => {
    if (!enabled || !needsTap) return;
    const events = ['pointerdown', 'click', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const start = () => {
      events.forEach(name => window.removeEventListener(name, start));
      void tryPlay();
    };
    events.forEach(name => window.addEventListener(name, start, { passive: true }));
    return () => events.forEach(name => window.removeEventListener(name, start));
  }, [enabled, needsTap, tryPlay]);

  if (pathname.startsWith('/admin')) return null;
  if ((!enabled || !tracks.length) && !loadError) return null;
  const next = () => { setPlaybackError(''); setIndex(current => (current + 1) % tracks.length); };
  if (loadError) return <aside className="store-music-player" aria-label="Store music status"><div className="music-player-heading"><span className="music-player-label">♫ FRESHCART RADIO</span></div><p className="music-player-error" role="status">{loadError}</p></aside>;
  if (isYouTubePage(tracks[index])) return <aside className="store-music-player" aria-label="Store music status"><div className="music-player-heading"><span className="music-player-label">♫ FRESHCART RADIO</span><span className="music-track-label">Track {index + 1} of {tracks.length}</span></div><p className="music-player-error" role="status">This is a YouTube Music page, not a direct audio file, so it can’t play in the store player. In Admin → Storefront music, upload an audio file or add a direct audio-file URL.</p>{tracks.length > 1 && <button type="button" onClick={next} aria-label="Play next song">Next song →</button>}</aside>;
  return <aside className="store-music-player" aria-label="FreshCart store music">
    <div className="music-player-heading"><span className="music-player-label">♫ FRESHCART RADIO</span><span className="music-track-label">Track {index + 1} of {tracks.length}</span></div>
    <audio ref={audioRef} key={tracks[index]} controls autoPlay preload="auto" src={tracks[index]} onPlay={() => { setIsPlaying(true); setNeedsTap(false); setPlaybackError(''); }} onPause={() => setIsPlaying(false)} onError={() => { setIsPlaying(false); setNeedsTap(true); setPlaybackError('This track could not be loaded. Check that its URL points to a public audio file.'); }} onEnded={next} aria-label="FreshCart background music" />
    {playbackError && <p className="music-player-error" role="status">{playbackError}</p>}
    {needsTap && <button type="button" className="music-enable-button" onClick={() => void tryPlay()}>▶ Tap to play music</button>}
    {!needsTap && <button type="button" className="music-enable-button" onClick={() => { const audio = audioRef.current; if (!audio) return; if (audio.paused) void tryPlay(); else { audio.pause(); setIsPlaying(false); } }}>{isPlaying ? 'Pause music' : 'Play music'}</button>}
    {tracks.length > 1 && <button type="button" onClick={next} aria-label="Play next song">Next song →</button>}
  </aside>;
}
