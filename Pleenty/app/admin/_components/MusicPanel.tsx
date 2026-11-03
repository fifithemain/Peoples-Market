'use client';

import { useState } from 'react';
import { saveMusicSettings } from '../actions';
import type { Act } from '../_lib/types';

type Props = { initial: { enabled?: boolean; tracks?: string[] }; busy: boolean; act: Act };
const NEWLINE = String.fromCharCode(10);

export default function MusicPanel({ initial, busy, act }: Props) {
  // Edited locally so live refreshes never overwrite unsaved changes.
  const [tracks, setTracks] = useState(Array.isArray(initial.tracks) ? initial.tracks.join(NEWLINE) : '');
  const [enabled, setEnabled] = useState(Boolean(initial.enabled));
  const [uploading, setUploading] = useState(false);
  const trackList = () => tracks.split(/\r?\n/).map(track => track.trim()).filter(Boolean);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const picked = Array.from(files);
    await act(async credential => {
      const uploaded: string[] = [];
      for (const file of picked) {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/admin/api/music-upload', { method: 'POST', headers: { Authorization: 'Bearer ' + credential }, body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not upload ' + file.name + '.');
        uploaded.push(data.url as string);
      }
      setTracks(current => [...current.split(NEWLINE).map(t => t.trim()).filter(Boolean), ...uploaded].join(NEWLINE));
      setEnabled(true);
    }, picked.length + ' song(s) uploaded. Click Save music settings to publish the playlist.');
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await act(async credential => {
      const result = await saveMusicSettings(credential, trackList(), enabled);
      setTracks(result.tracks.join(NEWLINE));
      setEnabled(result.enabled);
    }, 'Music settings saved.');
  };

  return <section className="admin-dashboard-content"><div className="panel">
    <h2>Storefront music</h2>
    <p className="panel-intro">Add direct HTTPS links to audio files (such as MP3 or OGG), one URL per line. Most streaming-page URLs are not direct audio files. Browsers may block sound autoplay until the visitor presses Play.</p>
    <form className="admin-form" onSubmit={save}>
      <label>Upload song files<input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.aac,.webm" multiple disabled={uploading || busy} onChange={e => { void upload(e.currentTarget.files); e.currentTarget.value = ''; }} /><small>Choose MP3, OGG, WAV, M4A, AAC or WEBM files. Maximum 15 MB per song. Uploaded songs are stored in FreshCart’s music library.</small></label>
      <label>Or add direct song URLs<textarea rows={5} placeholder={'https://your-domain.com/music/song-one.mp3' + NEWLINE + 'https://your-domain.com/music/song-two.mp3'} value={tracks} onChange={e => setTracks(e.target.value)} /><small>Up to 30 songs total. Use audio files you own or are licensed to play.</small></label>
      {uploading && <p className="admin-message">Uploading songs… please keep this page open.</p>}
      <label className="admin-checkbox-label"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enable music on the storefront</label>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save music settings'}</button>
    </form>
    <div className="admin-music-preview"><b>Current playlist</b><p>{trackList().length} track(s) · {enabled ? 'Enabled' : 'Disabled'}</p></div>
  </div></section>;
}
