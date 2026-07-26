"use client";

/**
 * Muffliato — the student-facing PWA (Phase 2).
 *
 * Big, thumb-friendly buttons for a phone:
 *   🪄 "I'm lost"  →  sends a 'lost' ping over WebSocket
 *   ✅ "Got it"    →  sends a 'gotit' ping
 *   ⏩ "Slower"    →  sends a 'slower' ping
 *
 * Also receives analogy audio back from Sonorus (Phase 6).
 * Now with TTS read-aloud and video recommendations.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { SignalType } from "@/lib/types";
import type { VideoResult, RecordingChunk } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import Link from "next/link";

export default function MuffliatoPage() {
  const { user, loading: authLoading, requireAuth } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const [lectureId, setLectureId] = useState(1);
  const [studentId, setStudentId] = useState("student_x");
  const { sendPing, lastMessage, connected } = useWebSocket(lectureId);

  const [analogy, setAnalogy] = useState<{text: string; audioUrl?: string; conceptNode?: string} | null>(null);
  const [avatar, setAvatar] = useState<'cricketer'|'gamer'|'cook'>('cricketer');

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Video recommendations state
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // Catch-up state
  const [catchUpChunks, setCatchUpChunks] = useState<RecordingChunk[]>([]);
  const [catchUpLoading, setCatchUpLoading] = useState(false);
  const [playingChunkId, setPlayingChunkId] = useState<string | null>(null);
  const [confusionTs, setConfusionTs] = useState<number | null>(null);
  const catchUpAudioRef = useRef<HTMLAudioElement | null>(null);

  // Guard: student route
  useEffect(() => { requireAuth("student"); }, [requireAuth]);

  // Move ALL hooks before the early return on line ~49
  useEffect(() => {
    if (lastMessage?.type === 'analogy_ready') {
      const { analogy_text, audio_url, concept_node } = lastMessage as any;
      setAnalogy({ text: analogy_text, audioUrl: audio_url, conceptNode: concept_node });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      if (audio_url) {
        const playAudio = (url: string, retries = 1) => {
          const audio = new Audio(url);
          audio.play().catch(e => {
            console.error("Auto-play prevented", e);
            if (retries > 0) {
              setTimeout(() => playAudio(url, retries - 1), 500);
            } else {
              setAnalogy(prev => prev ? { ...prev, text: prev.text + " (Auto-play failed, tap to play)" } : null);
            }
          });
        };
        playAudio(audio_url);
      }

      // Fetch video recommendations for the concept
      if (concept_node) {
        fetchVideos(concept_node);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lid = Number(params.get("lectureId")) || 1;
      setLectureId(lid);

      let sid = localStorage.getItem("legilimens_student_id");
      if (!sid && user) {
        sid = `student_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem("legilimens_student_id", sid);
      }
      setStudentId(sid || "student_x");
    }
  }, [user]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fetch video recommendations
  const fetchVideos = useCallback(async (concept: string) => {
    setVideosLoading(true);
    try {
      const resp = await api.videoRecommendations(concept);
      setVideos(resp.videos);
    } catch (err) {
      console.error("Video fetch error:", err);
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }, []);

  // TTS: speak text via backend ElevenLabs → browser fallback
  const speakText = useCallback(async (text: string) => {
    // If already speaking, stop
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    setTtsLoading(true);
    setIsSpeaking(true);

    try {
      const resp = await api.ttsSpeak(text);

      if (!resp.use_browser_tts && resp.audio_base64) {
        // Play ElevenLabs audio
        const audioSrc = `data:${resp.mime};base64,${resp.audio_base64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          // Fallback to browser TTS
          browserTTS(text);
        };
        await audio.play();
      } else {
        // Use browser Speech Synthesis
        browserTTS(text);
      }
    } catch (err) {
      console.error("TTS error:", err);
      // Fallback to browser TTS
      browserTTS(text);
    } finally {
      setTtsLoading(false);
    }
  }, [isSpeaking]);

  const browserTTS = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  if (authLoading || !user) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c", fontSize: "1.5rem" }}>🔮 Verifying...</div>;

  const handleSignal = (signalType: SignalType) => {
    sendPing({ student_id: studentId, signal_type: signalType, ts: new Date().toISOString(), avatar });
    if (signalType === SignalType.LOST) {
      setConfusionTs(Date.now() / 1000); // Track when confusion started
    }
  };

  const fetchCatchUpChunks = useCallback(async () => {
    if (!confusionTs) return;
    setCatchUpLoading(true);
    try {
      const manifest = await api.fullManifest(lectureId);
      // Show chunks from confusion time onwards
      const relevant = manifest.filter((c: RecordingChunk) => c.end_ts >= confusionTs - 10);
      setCatchUpChunks(relevant.slice(-20)); // Last 20 chunks
    } catch (err) {
      console.error("Catch-up fetch error:", err);
    } finally {
      setCatchUpLoading(false);
    }
  }, [confusionTs, lectureId]);

  const playCatchUpChunk = async (chunk: RecordingChunk) => {
    if (catchUpAudioRef.current) {
      catchUpAudioRef.current.pause();
    }
    setPlayingChunkId(chunk.chunk_id);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const token = localStorage.getItem("legilimens_token");
      const resp = await fetch(`${apiUrl}/recording/${lectureId}/chunk/${chunk.chunk_id}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error("Chunk fetch failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      catchUpAudioRef.current = audio;
      audio.onended = () => setPlayingChunkId(null);
      await audio.play();
    } catch (err) {
      console.error("Playback error:", err);
      setPlayingChunkId(null);
    }
  };

  return (
    <main style={styles.main}>
      {showToast && analogy && (
        <div className="toast">
          🔮 {analogy.text.substring(0, 50)}...
        </div>
      )}
      <header style={styles.header}>
        <h1 style={styles.title}>🔮 Muffliato</h1>
        <p style={styles.subtitle}>Tap to signal — quietly, without disrupting class</p>
        <p style={styles.status}>
          {connected ? "🟢 Connected" : "🔴 Connecting..."}
        </p>
      </header>

      <section style={styles.buttons}>
        <button
          style={{ ...styles.button, background: "var(--lost-red)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.LOST)}
        >
          🪄 I&apos;m lost
        </button>
        <button
          style={{ ...styles.button, background: "var(--slower-amber)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.SLOWER)}
        >
          ⏩ Slower
        </button>
        <button
          style={{ ...styles.button, background: "var(--gotit-green)" }}
          className={connected ? "pulse-button" : ""}
          onClick={() => handleSignal(SignalType.GOTIT)}
        >
          ✅ Got it
        </button>
      </section>

      {/* Avatar picker */}
      <section style={styles.avatarPicker}>
        <label style={styles.avatarLabel}>Your Interest:</label>
        <div style={styles.avatarOptions}>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="cricketer"
              checked={avatar === 'cricketer'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🏏 Cricketer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="gamer"
              checked={avatar === 'gamer'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>🎮 Gamer</span>
          </label>
          <label style={styles.avatarOption}>
            <input
              type="radio"
              name="avatar"
              value="cook"
              checked={avatar === 'cook'}
              onChange={(e) => setAvatar(e.target.value as any)}
              style={styles.avatarRadio}
            />
            <span style={styles.avatarName}>👨‍🍳 Cook</span>
          </label>
        </div>
      </section>

      {/* Audio player for incoming analogy + TTS */}
      <section style={styles.audioSection}>
        {analogy ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
            <p style={{ ...styles.audioHint, color: "var(--gotit-green)", fontWeight: "bold" }}>
              {analogy.audioUrl ? "🔊 Accio Analogy!" : "🪄 Analogy Received!"}
            </p>
            <p style={{ fontStyle: "italic", opacity: 0.9 }}>{analogy.text}</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {analogy.audioUrl && (
                <button
                  style={{ ...styles.smallButton }}
                  onClick={() => new Audio(analogy.audioUrl!).play()}
                >
                  🔊 Replay Audio
                </button>
              )}
              <button
                style={{
                  ...styles.smallButton,
                  background: isSpeaking ? "var(--lost-red)" : "rgba(102, 252, 241, 0.15)",
                  borderColor: isSpeaking ? "var(--lost-red)" : "var(--accent-cyan, #66FCF1)",
                }}
                onClick={() => speakText(analogy.text)}
                disabled={ttsLoading}
              >
                {ttsLoading ? "⏳ Loading..." : isSpeaking ? "⏹ Stop" : "🗣️ Read Aloud"}
              </button>
            </div>
          </div>
        ) : (
          <p style={styles.audioHint}>🔊 Waiting for analogy...</p>
        )}
      </section>

      {/* Video Recommendations */}
      {(videos.length > 0 || videosLoading) && (
        <section style={styles.videoSection}>
          <h3 style={styles.videoTitle}>📺 Recommended Videos</h3>
          {videosLoading ? (
            <p style={{ opacity: 0.7, textAlign: "center" }}>Loading recommendations...</p>
          ) : (
            <div style={styles.videoGrid}>
              {videos.map((video, idx) => (
                <a
                  key={idx}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.videoCard}
                >
                  {video.thumbnail && (
                    <div style={styles.videoThumbWrapper}>
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        style={styles.videoThumb}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div style={styles.videoInfo}>
                    <p style={styles.videoName}>{video.title}</p>
                    <p style={styles.videoChannel}>{video.channel}</p>
                    {video.description && (
                      <p style={styles.videoDesc}>{video.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Catch Up — Review what you missed */}
      {confusionTs && (
        <section style={styles.catchUpSection}>
          <h3 style={styles.catchUpTitle}>📼 What did I miss?</h3>
          <p style={{ opacity: 0.7, fontSize: "0.85rem", textAlign: "center", margin: "0 0 0.75rem 0" }}>
            Review the lecture from when you got confused
          </p>
          {catchUpChunks.length === 0 && !catchUpLoading && (
            <button
              onClick={fetchCatchUpChunks}
              style={styles.catchUpButton}
            >
              🔍 Load Recording
            </button>
          )}
          {catchUpLoading && (
            <p style={{ textAlign: "center", opacity: 0.6 }}>Loading chunks...</p>
          )}
          {catchUpChunks.length > 0 && (
            <div style={styles.catchUpList}>
              {catchUpChunks.map((chunk) => (
                <div
                  key={chunk.chunk_id}
                  style={{
                    ...styles.catchUpChunk,
                    borderColor: playingChunkId === chunk.chunk_id ? "#7c3aed" : "rgba(255,255,255,0.1)",
                    background: playingChunkId === chunk.chunk_id ? "rgba(124, 58, 237, 0.1)" : "rgba(255,255,255,0.03)",
                  }}
                  onClick={() => playCatchUpChunk(chunk)}
                >
                  <span style={{ fontSize: "1.2rem" }}>
                    {playingChunkId === chunk.chunk_id ? "🔊" : "▶️"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={styles.catchUpTranscript}>
                      {chunk.transcript || "(no transcript)"}
                    </p>
                    <span style={styles.catchUpTime}>
                      {Math.floor(chunk.start_ts / 60)}:{Math.floor(chunk.start_ts % 60).toString().padStart(2, "0")} —
                      {Math.floor(chunk.end_ts / 60)}:{Math.floor(chunk.end_ts % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Back to landing */}
      <footer style={styles.footer}>
        <Link href="/" style={styles.backLink}>
          ← Back to Legilimens Landing
        </Link>
      </footer>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "space-between",
    padding: "2rem 1rem",
  },
  header: {
    textAlign: "center" as const,
  },
  title: {
    fontSize: "2.5rem",
    margin: "0.5rem 0",
    color: "var(--gryffindor-gold)",
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: "0.5rem",
  },
  status: {
    fontSize: "0.9rem",
  },
  buttons: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    width: "100%",
    maxWidth: "360px",
  },
  button: {
    padding: "1.5rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "white",
    border: "none",
    borderRadius: "16px",
    cursor: "pointer",
    minHeight: "80px",
  },
  smallButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "white",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid var(--gryffindor-gold)",
    borderRadius: "10px",
    cursor: "pointer",
    minHeight: "40px",
    transition: "all 0.2s",
  },
  avatarPicker: {
    margin: "2rem 0",
    padding: "1rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "360px",
  },
  avatarLabel: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: 600,
    color: "var(--gryffindor-gold)",
  },
  avatarOptions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
    justifyContent: "center",
  },
  avatarOption: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    padding: "0.5rem 1rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    border: "1px solid transparent",
    transition: "all 0.2s",
  },
  avatarRadio: {
    display: "none",
  },
  avatarName: {
    fontSize: "1rem",
  },
  audioSection: {
    padding: "1rem",
    margin: "1rem 0",
    background: "rgba(211, 166, 37, 0.1)",
    border: "1px solid var(--gryffindor-gold)",
    borderRadius: "8px",
    width: "100%",
    maxWidth: "360px",
    textAlign: "center" as const,
  },
  audioHint: {
    margin: 0,
    color: "var(--gryffindor-gold)",
    fontStyle: "italic",
  },
  // Video recommendation styles
  videoSection: {
    width: "100%",
    maxWidth: "360px",
    margin: "1rem 0",
    padding: "1rem",
    background: "rgba(102, 252, 241, 0.05)",
    border: "1px solid rgba(102, 252, 241, 0.2)",
    borderRadius: "12px",
  },
  videoTitle: {
    margin: "0 0 0.75rem 0",
    fontSize: "1.1rem",
    color: "var(--gryffindor-gold)",
    textAlign: "center" as const,
  },
  videoGrid: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  videoCard: {
    display: "flex",
    gap: "0.75rem",
    padding: "0.6rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "8px",
    textDecoration: "none",
    color: "inherit",
    border: "1px solid rgba(255,255,255,0.08)",
    transition: "all 0.2s",
    cursor: "pointer",
  },
  videoThumbWrapper: {
    flexShrink: 0,
    width: "100px",
    height: "56px",
    borderRadius: "6px",
    overflow: "hidden",
    background: "rgba(0,0,0,0.3)",
  },
  videoThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },
  videoInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.15rem",
    minWidth: 0,
    flex: 1,
  },
  videoName: {
    margin: 0,
    fontSize: "0.85rem",
    fontWeight: 600,
    lineHeight: 1.3,
    color: "rgba(255,255,255,0.9)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  videoChannel: {
    margin: 0,
    fontSize: "0.75rem",
    color: "rgba(255,255,255,0.5)",
  },
  videoDesc: {
    margin: 0,
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.4)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
  },
  catchUpSection: {
    width: "100%",
    maxWidth: "360px",
    margin: "1rem 0",
    padding: "1rem",
    background: "rgba(124, 58, 237, 0.05)",
    border: "1px solid rgba(124, 58, 237, 0.2)",
    borderRadius: "12px",
  },
  catchUpTitle: {
    margin: "0 0 0.25rem 0",
    fontSize: "1.1rem",
    color: "var(--gryffindor-gold)",
    textAlign: "center" as const,
  },
  catchUpButton: {
    display: "block",
    width: "100%",
    padding: "0.75rem",
    background: "rgba(124, 58, 237, 0.2)",
    border: "1px solid rgba(124, 58, 237, 0.4)",
    borderRadius: "10px",
    color: "#c4b5fd",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center" as const,
  },
  catchUpList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    maxHeight: "300px",
    overflowY: "auto" as const,
  },
  catchUpChunk: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.6rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  catchUpTranscript: {
    margin: 0,
    fontSize: "0.82rem",
    lineHeight: 1.4,
    color: "rgba(255,255,255,0.85)",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
  },
  catchUpTime: {
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.4)",
    fontFamily: "monospace",
  },
  footer: {
    marginTop: "2rem",
    paddingTop: "1rem",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    width: "100%",
    maxWidth: "360px",
    textAlign: "center" as const,
  },
  backLink: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    fontSize: "0.9rem",
  },
  debugFooter: {
    opacity: 0.6,
    textAlign: "center" as const,
    marginTop: "1rem",
  },
};