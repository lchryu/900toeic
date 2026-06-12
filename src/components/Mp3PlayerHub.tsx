import React, { useState, useEffect } from 'react';
import { Play, Disc, ChevronRight, ListMusic, Repeat, Volume2, Youtube, Radio, Search } from 'lucide-react';
import { LessonData, LessonManifest, AudioControlState, AudioSegment } from '../types';

interface Mp3PlayerHubProps {
  lessons: LessonManifest[];
  activeTrackId: string | null;
  setActiveTrackId: (id: string | null) => void;
  audioControl: AudioControlState | null;
  onPlaySegment?: (lessonId: string, lessonTitle: string, segmentLabel: string, isLoop: boolean) => void;
}

export const Mp3PlayerHub: React.FC<Mp3PlayerHubProps> = ({
  lessons,
  activeTrackId,
  setActiveTrackId,
  audioControl,
  onPlaySegment
}) => {
  // Filter only lessons with audio source (either mp3 or youtube)
  const tracks = React.useMemo(() => {
    return lessons.filter((l) => l.audio || l.youtubeUrl);
  }, [lessons]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'local' | 'youtube'>('all');
  const [mobileView, setMobileView] = useState<'playlist' | 'player'>('playlist');
  const [activeTrackData, setActiveTrackData] = useState<LessonData | null>(null);
  const [isLoadingTrackData, setIsLoadingTrackData] = useState(false);

  useEffect(() => {
    if (!activeTrackId) {
      setActiveTrackData(null);
      return;
    }
    
    setIsLoadingTrackData(true);
    import(`../data/lessons/${activeTrackId}.json`)
      .then((module) => {
        setActiveTrackData(module.default as LessonData);
        setIsLoadingTrackData(false);
      })
      .catch((err) => {
        console.error(`Failed to load track data for ${activeTrackId}:`, err);
        setActiveTrackData(null);
        setIsLoadingTrackData(false);
      });
  }, [activeTrackId]);

  useEffect(() => {
    if (!activeTrackId && tracks.length > 0 && typeof setActiveTrackId === 'function') {
      setActiveTrackId(tracks[0].id);
    }
  }, [activeTrackId, tracks, setActiveTrackId]);

  const filteredTracks = React.useMemo(() => {
    return tracks.filter((track) => {
      const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'local' && track.audio) ||
        (filterType === 'youtube' && track.youtubeUrl && !track.audio);
      return matchesSearch && matchesFilter;
    });
  }, [tracks, searchQuery, filterType]);

  const activeTrack = React.useMemo(() => {
    return tracks.find((t) => t.id === activeTrackId);
  }, [tracks, activeTrackId]);

  // Generate audio segments dynamically for the active track
  const trackSegments = React.useMemo(() => {
    if (!activeTrackData || !audioControl?.duration) return [];
    
    // Check if the user has custom segments stored locally/synced
    try {
      const stored = localStorage.getItem('toeic_audio_segments');
      if (stored) {
        const parsed = JSON.parse(stored) as { [lessonId: string]: AudioSegment[] };
        const storedSegments = parsed[activeTrackData.id];
        if (storedSegments && storedSegments.length > 0) {
          return storedSegments;
        }
      }
    } catch (e) {
      console.error('Failed to parse stored audio segments in Mp3PlayerHub:', e);
    }

    // Check if the track has preset segments
    if (activeTrackData.audioSegments && activeTrackData.audioSegments.length > 0) {
      return activeTrackData.audioSegments;
    }

    // Fallback: split by listening groups
    const duration = audioControl.duration;
    if (!duration || !activeTrackData.listening || activeTrackData.listening.length === 0) return [];
    const sliceDuration = duration / activeTrackData.listening.length;

    return activeTrackData.listening.map((group, index) => ({
      id: `${activeTrackData.id}-${group.id}`,
      lessonId: activeTrackData.id,
      groupId: group.id,
      label: `Questions ${group.range}`,
      range: group.range,
      start: Math.round(sliceDuration * index),
      end: Math.round(index === activeTrackData.listening.length - 1 ? duration : sliceDuration * (index + 1))
    }));
  }, [activeTrackData, audioControl?.duration]);

  // Handle auto-advancing to the next track when ended
  useEffect(() => {
    if (!audioControl) return;
    
    // Check if track ended
    if (audioControl.duration > 0 && audioControl.currentTime >= audioControl.duration - 0.5 && !audioControl.isPlaying) {
      // Advance to next track
      const currentIndex = filteredTracks.findIndex((t) => t.id === activeTrackId);
      if (currentIndex !== -1 && currentIndex < filteredTracks.length - 1) {
        if (typeof setActiveTrackId === 'function') {
          setActiveTrackId(filteredTracks[currentIndex + 1].id);
        }
      }
    }
  }, [audioControl?.currentTime, audioControl?.isPlaying, audioControl?.duration, activeTrackId, filteredTracks, setActiveTrackId]);

  const handleTrackSelect = (trackId: string) => {
    if (typeof setActiveTrackId === 'function') {
      setActiveTrackId(trackId);
    }
    setMobileView('player');
  };

  const handlePlaySegment = (segment: AudioSegment, loop = false) => {
    if (!audioControl) return;
    audioControl.playSegment(segment, loop);
    if (activeTrack) {
      onPlaySegment?.(activeTrack.id, activeTrack.title, segment.label, loop);
    }
  };

  const handleStopSegment = () => {
    if (!audioControl) return;
    audioControl.stopSegment();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (tracks.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        No audio tracks found in the lessons database.
      </div>
    );
  }

  const isCurrentPlaying = audioControl?.isPlaying;

  return (
    <div className="mp3-hub-container" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-title)' }}>
          Audio Center
        </h1>
        <p style={{ color: 'hsl(var(--text-secondary))' }}>
          Browse, preview, and loop listening tracks and question segments across all lessons.
        </p>
      </header>

      {/* Mobile view selector */}
      <div className="mp3-mobile-tabs" style={{ display: 'none', marginBottom: '20px', gap: '8px' }}>
        <button
          className={`mp3-mobile-tab ${mobileView === 'playlist' ? 'active' : ''}`}
          onClick={() => setMobileView('playlist')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid hsl(var(--panel-border))',
            background: mobileView === 'playlist' ? 'hsl(var(--primary))' : 'hsl(var(--panel-bg) / 0.3)',
            color: mobileView === 'playlist' ? 'var(--button-contrast)' : 'hsl(var(--text-secondary))',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Playlist
        </button>
        <button
          className={`mp3-mobile-tab ${mobileView === 'player' ? 'active' : ''}`}
          onClick={() => setMobileView('player')}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid hsl(var(--panel-border))',
            background: mobileView === 'player' ? 'hsl(var(--primary))' : 'hsl(var(--panel-bg) / 0.3)',
            color: mobileView === 'player' ? 'var(--button-contrast)' : 'hsl(var(--text-secondary))',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Now Playing
        </button>
      </div>

      {/* Main Music Player Grid */}
      <div className={`mp3-grid ${mobileView === 'playlist' ? 'show-playlist' : 'show-player'}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Column: Playlist */}
        <div className="glass-panel mp3-playlist-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListMusic size={20} className="text-sky-400" />
              Playlist
            </h2>
            
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input
                type="text"
                placeholder="Search lessons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--panel-border))',
                  background: 'hsl(var(--panel-bg) / 0.5)',
                  color: 'hsl(var(--text-primary))',
                  fontSize: '0.88rem',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                className="mp3-search-input"
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
              {(['all', 'local', 'youtube'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: filterType === type ? 'hsl(var(--primary))' : 'transparent',
                    color: filterType === type ? 'var(--button-contrast)' : 'hsl(var(--text-muted))',
                    borderColor: filterType === type ? 'hsl(var(--primary))' : 'hsl(var(--panel-border))',
                    transition: 'all 0.2s ease'
                  }}
                  className={`mp3-filter-pill ${filterType === type ? 'active' : ''}`}
                >
                  {type === 'all' ? 'All' : type === 'local' ? 'Local' : 'YouTube'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mp3-track-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredTracks.map((track, idx) => {
              const isActive = track.id === activeTrackId;
              const isLocal = !!track.audio;
              return (
                <div
                  key={track.id}
                  className={`mp3-track-row ${isActive ? 'active' : ''}`}
                  onClick={() => handleTrackSelect(track.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid hsl(var(--panel-border) / 0.5)',
                    background: isActive ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--panel-bg) / 0.25)',
                    borderColor: isActive ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--panel-border) / 0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', fontWeight: 700 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: isActive ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {track.title.replace(/📘|Lesson\s*/g, '').trim()}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        {isLocal ? <Volume2 size={12} /> : <Youtube size={12} />}
                        {isLocal ? 'Local Audio' : 'YouTube Source'}
                      </span>
                    </div>
                  </div>

                  {isActive && isCurrentPlaying ? (
                    <div className="sound-visualizer-bars">
                      <div className="bar bar1" />
                      <div className="bar bar2" />
                      <div className="bar bar3" />
                    </div>
                  ) : (
                    <ChevronRight size={16} style={{ color: 'hsl(var(--text-muted))' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Audio details and controls */}
        <div className="mp3-player-column" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active Audio Card */}
          {activeTrack && (
            <div className="glass-panel mp3-player-card" style={{ padding: '32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div 
                className="gradient-bg-accent" 
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }}
              />
              
              {/* Record Player Wrapper */}
              <div className="turntable-wrapper" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', position: 'relative', width: '220px', margin: '0 auto' }}>
                <div style={{
                  position: 'absolute',
                  inset: '-10px',
                  borderRadius: '16px',
                  background: 'hsl(var(--panel-bg) / 0.15)',
                  border: '1px solid hsl(var(--panel-border) / 0.3)',
                  zIndex: 0
                }} />

                <div 
                  className={`vinyl-record-disc ${isCurrentPlaying ? 'spinning' : ''}`}
                  style={{
                    width: '160px',
                    height: '160px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #2d3748 30%, #1a202c 70%, #0d1117 100%)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    border: '5px solid #2d3748',
                    zIndex: 1,
                    marginRight: '20px'
                  }}
                >
                  <div style={{ position: 'absolute', inset: '10px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.03)' }} />
                  <div style={{ position: 'absolute', inset: '24px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.03)' }} />
                  <div style={{ position: 'absolute', inset: '40px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.03)' }} />
                  
                  <div 
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      zIndex: 2
                    }}
                  >
                    <Disc size={28} className="text-white" style={{ animation: isCurrentPlaying ? 'spin 3s linear infinite' : 'none' }} />
                  </div>
                  
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'hsl(var(--bg-app))', zIndex: 3 }} />
                </div>

                <div 
                  className={`turntable-tone-arm ${isCurrentPlaying ? 'playing' : ''}`}
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '15px',
                    width: '60px',
                    height: '100px',
                    pointerEvents: 'none',
                    zIndex: 5,
                    transformOrigin: '40px 15px',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isCurrentPlaying ? 'rotate(24deg)' : 'rotate(0deg)'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '5px',
                    left: '30px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#718096',
                    border: '3px solid #4a5568',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '38px',
                    width: '4px',
                    height: '70px',
                    background: 'linear-gradient(to right, #cbd5e0, #a0aec0, #718096)',
                    borderRadius: '2px',
                    transform: 'rotate(-10deg)',
                    transformOrigin: 'top center'
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '0px',
                    left: '20px',
                    width: '12px',
                    height: '20px',
                    background: '#2d3748',
                    borderRadius: '2px',
                    transform: 'rotate(15deg)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </div>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>
                {activeTrack.title}
              </h3>
              <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', marginBottom: '24px' }}>
                Track {tracks.findIndex((t) => t.id === activeTrackId) + 1} of {tracks.length}
              </p>

            </div>
          )}

          {/* Chapter / Audio Segments List */}
          {activeTrack && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={18} className="text-emerald-400" />
                Audio Chapters (Loop Segments)
              </h3>
              
              {isLoadingTrackData ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', color: 'hsl(var(--primary))' }}>
                  <div className="animate-spin" style={{ width: '20px', height: '20px', border: '2px solid hsl(var(--primary) / 0.1)', borderTopColor: 'hsl(var(--primary))', borderRadius: '50%', marginRight: '10px' }} />
                  <span>Loading Chapters...</span>
                </div>
              ) : trackSegments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {trackSegments.map((segment) => {
                    const isSegmentActive = audioControl?.activeSegmentId === segment.id;
                    const isLooping = isSegmentActive && audioControl?.isLoopingSegment;
                    
                    return (
                      <div 
                        key={segment.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          background: isSegmentActive ? 'hsl(var(--success) / 0.08)' : 'hsl(var(--panel-bg) / 0.2)',
                          border: '1px solid',
                          borderColor: isSegmentActive ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--panel-border) / 0.5)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.9rem', color: isSegmentActive ? 'hsl(var(--success))' : 'hsl(var(--text-primary))' }}>
                            {segment.label}
                          </strong>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                            Range: {formatTime(segment.start)} - {formatTime(segment.end)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="audio-segment-btn"
                            type="button"
                            onClick={() => isSegmentActive && !isLooping ? handleStopSegment() : handlePlaySegment(segment, false)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              borderRadius: '6px',
                              background: isSegmentActive && !isLooping ? 'hsl(var(--success))' : 'transparent',
                              color: isSegmentActive && !isLooping ? 'white' : 'inherit'
                            }}
                          >
                            <Play size={12} fill="currentColor" style={{ marginRight: '4px' }} />
                            <span>Play</span>
                          </button>
                          <button
                            className="audio-segment-btn"
                            type="button"
                            onClick={() => isLooping ? handleStopSegment() : handlePlaySegment(segment, true)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.78rem',
                              borderRadius: '6px',
                              background: isLooping ? 'hsl(var(--success))' : 'transparent',
                              color: isLooping ? 'white' : 'inherit'
                            }}
                          >
                            <Repeat size={12} style={{ marginRight: '4px' }} />
                            <span>Loop</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                  No chapters available for this track.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
