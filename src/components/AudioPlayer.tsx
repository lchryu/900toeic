import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, FastForward, Youtube, ExternalLink, SkipBack, SkipForward } from 'lucide-react';
import { AudioControlState, AudioSegment } from '../types';

interface AudioPlayerProps {
  src?: string;
  youtubeUrl?: string;
  onControlStateChange?: (state: AudioControlState) => void;
}

type AudioSource = 'local' | 'youtube';
type YoutubePlayer = {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  setPlaybackRate?: (rate: number) => void;
  destroy?: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          height?: string;
          width?: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YoutubePlayer;
      PlayerState?: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const getYoutubeVideoId = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('youtu.be')
      ? parsed.pathname.slice(1)
      : parsed.searchParams.get('v') || '';
  } catch {
    return '';
  }
};

const loadYoutubeApi = () =>
  new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    }
  });

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, youtubeUrl, onControlStateChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<YoutubePlayer | null>(null);
  const activeSegmentRef = useRef<{ segment: AudioSegment; loop: boolean } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [source, setSource] = useState<AudioSource>(src ? 'local' : 'youtube');
  const [isYoutubeReady, setIsYoutubeReady] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);

  // Mobile long-press scrubber states and handlers
  const [showMobileScrubber, setShowMobileScrubber] = useState(false);
  const pressTimerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowMobileScrubber(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    if (isLongPressRef.current) {
      e.preventDefault();
    }
  };

  const handleMouseDown = () => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowMobileScrubber(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    togglePlay();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
    }
  };

  const youtubeVideoId = youtubeUrl ? getYoutubeVideoId(youtubeUrl) : '';
  const isYoutubeSource = source === 'youtube';
  const canUseControls = !isYoutubeSource || isYoutubeReady;

  const getYoutubeCurrentTime = () => youtubePlayerRef.current?.getCurrentTime?.() || 0;
  const getYoutubeDuration = () => youtubePlayerRef.current?.getDuration?.() || 0;

  useEffect(() => {
    if (!src && youtubeUrl) {
      setSource('youtube');
      return;
    }

    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1.0);
    activeSegmentRef.current = null;
    setActiveSegmentId(null);
    setIsLoopingSegment(false);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src, youtubeUrl]);

  useEffect(() => {
    if (!youtubeUrl && isYoutubeSource) {
      setSource('local');
    }
  }, [youtubeUrl, isYoutubeSource]);

  useEffect(() => {
    if (!youtubeVideoId || !youtubeContainerRef.current) return;

    let disposed = false;
    setIsYoutubeReady(false);

    loadYoutubeApi().then(() => {
      if (disposed || !window.YT?.Player || !youtubeContainerRef.current) return;

      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = new window.YT.Player(youtubeContainerRef.current, {
        videoId: youtubeVideoId,
        height: '1',
        width: '1',
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            if (disposed) return;
            setIsYoutubeReady(true);
            setDuration(getYoutubeDuration());
          },
          onStateChange: (event) => {
            if (disposed) return;
            const playerState = window.YT?.PlayerState;
            setIsPlaying(event.data === playerState?.PLAYING);
            if (event.data === playerState?.ENDED) {
              setCurrentTime(0);
            }
          }
        }
      });
    });

    return () => {
      disposed = true;
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
      setIsYoutubeReady(false);
    };
  }, [youtubeVideoId]);

  const pauseLocalAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const pauseYoutubeAudio = () => {
    youtubePlayerRef.current?.pauseVideo?.();
  };

  const handleSourceChange = (nextSource: AudioSource) => {
    pauseLocalAudio();
    pauseYoutubeAudio();
    setIsPlaying(false);
    setSource(nextSource);

    if (nextSource === 'youtube') {
      setCurrentTime(getYoutubeCurrentTime());
      setDuration(getYoutubeDuration());
    } else {
      setCurrentTime(audioRef.current?.currentTime || 0);
      setDuration(audioRef.current?.duration || 0);
    }
  };

  const togglePlay = () => {
    if (isYoutubeSource) {
      const player = youtubePlayerRef.current;
      if (!player || !isYoutubeReady) return;

      if (isPlaying) {
        player.pauseVideo?.();
        setIsPlaying(false);
      } else {
        player.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }

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
    if (!audioRef.current || isYoutubeSource) return;
    const nextTime = audioRef.current.currentTime;
    setCurrentTime(nextTime);
    handleSegmentBoundary(nextTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current || isYoutubeSource) return;
    setDuration(audioRef.current.duration);
  };

  const seekTo = useCallback((seconds: number) => {
    const nextTime = Math.max(0, Math.min(seconds, duration || seconds));

    if (isYoutubeSource) {
      youtubePlayerRef.current?.seekTo?.(nextTime, true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }

    setCurrentTime(nextTime);
  }, [duration, isYoutubeSource]);

  const pauseCurrentSource = useCallback(() => {
    if (isYoutubeSource) {
      youtubePlayerRef.current?.pauseVideo?.();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  }, [isYoutubeSource]);

  const playCurrentSource = useCallback(() => {
    if (isYoutubeSource) {
      if (!isYoutubeReady) return;
      youtubePlayerRef.current?.playVideo?.();
      setIsPlaying(true);
      return;
    }

    audioRef.current?.play().then(() => {
      setIsPlaying(true);
    }).catch((e) => {
      console.error('Audio play failed:', e);
    });
  }, [isYoutubeReady, isYoutubeSource]);

  const playSegment = useCallback((segment: AudioSegment, loop = false) => {
    if (!canUseControls || segment.end <= segment.start) return;
    activeSegmentRef.current = { segment, loop };
    setActiveSegmentId(segment.id);
    setIsLoopingSegment(loop);
    seekTo(segment.start);
    window.setTimeout(() => playCurrentSource(), 0);
  }, [canUseControls, playCurrentSource, seekTo]);

  const stopSegment = useCallback(() => {
    activeSegmentRef.current = null;
    setActiveSegmentId(null);
    setIsLoopingSegment(false);
    pauseCurrentSource();
  }, [pauseCurrentSource]);

  const handleSegmentBoundary = useCallback((nextTime: number) => {
    const activeSegment = activeSegmentRef.current;
    if (!activeSegment || nextTime < activeSegment.segment.end) return;

    if (activeSegment.loop) {
      seekTo(activeSegment.segment.start);
      playCurrentSource();
      return;
    }

    activeSegmentRef.current = null;
    setActiveSegmentId(null);
    setIsLoopingSegment(false);
    seekTo(activeSegment.segment.end);
    pauseCurrentSource();
  }, [pauseCurrentSource, playCurrentSource, seekTo]);

  useEffect(() => {
    if (!isYoutubeSource) return;

    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player) return;
      const nextTime = player.getCurrentTime?.() || 0;
      setCurrentTime(nextTime);
      setDuration(player.getDuration?.() || 0);
      handleSegmentBoundary(nextTime);
    }, 150);

    return () => window.clearInterval(timer);
  }, [handleSegmentBoundary, isYoutubeSource]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seekTo((x / rect.width) * duration);
  };

  const handleSkip = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  const handleSpeedChange = () => {
    const speeds = [0.8, 1.0, 1.2, 1.5, 1.8, 2.0];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % speeds.length;
    const nextRate = speeds[nextIndex];

    if (isYoutubeSource) {
      youtubePlayerRef.current?.setPlaybackRate?.(nextRate);
    } else if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }

    setPlaybackRate(nextRate);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    onControlStateChange?.({
      currentTime,
      duration,
      isPlaying,
      isReady: canUseControls,
      activeSegmentId,
      isLoopingSegment,
      seekTo,
      playSegment,
      stopSegment
    });
  }, [currentTime, duration, isPlaying, canUseControls, activeSegmentId, isLoopingSegment, onControlStateChange, playSegment, seekTo, stopSegment]);

  return (
    <div className="audio-player-shell" style={{ position: 'relative' }}>
      {showMobileScrubber && (
        <div className="mobile-scrubber-popup glass-panel">
          <span className="time-label">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            className="mobile-scrub-slider"
          />
          <span className="time-label">{formatTime(duration)}</span>
          <button onClick={() => setShowMobileScrubber(false)} className="close-scrubber-btn">✕</button>
        </div>
      )}
      <div className="audio-player-bar">
        {src && (
          <audio
            ref={audioRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {youtubeVideoId && <div ref={youtubeContainerRef} className="youtube-hidden-player" />}

        {youtubeUrl && src && (
          <div className="segmented-control audio-source-control">
            <button
              className={`segmented-btn ${source === 'local' ? 'active' : ''}`}
              onClick={() => handleSourceChange('local')}
              title="Use local audio"
            >
              <Volume2 size={15} />
              <span>Local</span>
            </button>
            <button
              className={`segmented-btn ${isYoutubeSource ? 'active' : ''}`}
              onClick={() => handleSourceChange('youtube')}
              title="Use YouTube"
            >
              <Youtube size={15} />
              <span>YouTube</span>
            </button>
          </div>
        )}

        <div className="audio-transport-controls">
          <button className="audio-icon-btn" onClick={() => handleSkip(-10)} disabled={!canUseControls} title="Back 10 seconds">
            <SkipBack size={18} />
          </button>
          <button
            className="audio-btn"
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
            disabled={!canUseControls}
            title={isPlaying ? 'Pause' : 'Play'}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
          </button>
          <button className="audio-icon-btn" onClick={() => handleSkip(10)} disabled={!canUseControls} title="Forward 10 seconds">
            <SkipForward size={18} />
          </button>
        </div>

        <div className="audio-progress-container">
          <span className="time-label">{formatTime(currentTime)}</span>
          <div className="progress-track" onClick={handleSeek}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="time-label">{formatTime(duration)}</span>
        </div>

        <div className="audio-extra-controls">
          <button
            className="secondary-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: playbackRate !== 1.0 ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              borderColor: playbackRate !== 1.0 ? 'hsl(var(--primary))' : 'hsl(var(--panel-border))',
              color: playbackRate !== 1.0 ? 'hsl(var(--primary))' : 'hsl(var(--text-primary))'
            }}
            onClick={handleSpeedChange}
            disabled={!canUseControls}
            title="Toggle speed: 0.8x -> 1.0x -> 1.2x -> 1.5x -> 1.8x -> 2.0x"
          >
            <FastForward size={14} />
            <span>{playbackRate.toFixed(1)}x</span>
          </button>

          {isYoutubeSource && youtubeUrl ? (
            <a className="secondary-btn youtube-open-link" href={youtubeUrl} target="_blank" rel="noreferrer" title="Open in YouTube">
              <ExternalLink size={14} />
            </a>
          ) : (
            <Volume2 size={18} className="text-slate-400" />
          )}
        </div>
      </div>
    </div>
  );
};
