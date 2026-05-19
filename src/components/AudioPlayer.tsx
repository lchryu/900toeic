import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, FastForward } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    // Reset player states when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1.0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.error('Audio play failed:', e);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleSpeedChange = () => {
    if (!audioRef.current) return;
    let nextRate = 1.0;
    if (playbackRate === 1.0) nextRate = 1.2;
    else if (playbackRate === 1.2) nextRate = 1.5;
    else nextRate = 1.0;

    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player-bar">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <button className="audio-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? <Pause size={20} fill="#000" /> : <Play size={20} fill="#000" style={{ marginLeft: '2px' }} />}
      </button>

      <div className="audio-progress-container">
        <span className="time-label">{formatTime(currentTime)}</span>
        <div className="progress-track" onClick={handleSeek}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="time-label">{formatTime(duration)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Playback speed toggle */}
        <button
          className="secondary-btn"
          style={{
            padding: '6px 12px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: playbackRate > 1.0 ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
            borderColor: playbackRate > 1.0 ? 'hsl(var(--primary))' : 'hsl(var(--panel-border))',
            color: playbackRate > 1.0 ? 'hsl(var(--primary))' : 'hsl(var(--text-primary))'
          }}
          onClick={handleSpeedChange}
          title="Toggle speed: 1.0x -> 1.2x -> 1.5x"
        >
          <FastForward size={14} />
          <span>{playbackRate.toFixed(1)}x</span>
        </button>

        <Volume2 size={18} className="text-slate-400" />
      </div>
    </div>
  );
};
