"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RecordingChunk } from "@/lib/types";
import { useRef } from "react";

export default function ReviewPage() {
  const lectureId = 1;
  const [chunks, setChunks] = useState<RecordingChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedChunks, setHighlightedChunks] = useState<Set<string>>(new Set());
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const token = localStorage.getItem("legilimens_token");
        const resp = await fetch(`http://localhost:8001/recording/${lectureId}/manifest`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });
        if (!resp.ok) throw new Error("Manifest fetch failed");
        const data = await resp.json();
        setChunks(data);
      } catch (err) {
        setError("No recordings yet");
      }
    };
    fetchManifest();
  }, [lectureId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setHighlightedChunks(new Set());
      return;
    }
    try {
      const token = localStorage.getItem("legilimens_token");
      const resp = await fetch("http://localhost:8001/retrieval/accio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          concept_node: searchQuery,
          chunk_text: searchQuery,
          avatar: "cricketer",
          lecture_id: lectureId
        })
      });
      const data = await resp.json();
      if (data.chunk_id) {
        setHighlightedChunks(new Set([data.chunk_id]));
      } else {
        setHighlightedChunks(new Set());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const playChunk = async (chunkId: string) => {
    setActiveChunkId(chunkId);
    setProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      const token = localStorage.getItem("legilimens_token");
      const resp = await fetch(`http://localhost:8001/recording/${lectureId}/chunk/${chunkId}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!resp.ok) throw new Error("Chunk fetch failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.ontimeupdate = () => {
        setProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.onended = () => {
        setActiveChunkId(null);
        setProgress(0);
      };
      
      await audio.play();
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href="/dashboard" style={styles.backLink}>← Back to Dashboard</Link>
          <h1 style={styles.title}>📼 Lecture Recording</h1>
        </div>
        
        <div style={styles.searchBox}>
          <input 
            type="text" 
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            style={styles.searchInput}
          />
          <button onClick={handleSearch} style={styles.searchBtn}>🔍 Search</button>
        </div>
      </header>

      <section style={styles.timeline}>
        {error ? (
          <p style={styles.empty}>{error}</p>
        ) : chunks.length === 0 ? (
          <p style={styles.empty}>No recordings found for this lecture.</p>
        ) : (
          <div style={styles.chunkList}>
            {chunks.map((chunk) => {
              const isHighlighted = highlightedChunks.has(chunk.chunk_id);
              const isActive = activeChunkId === chunk.chunk_id;
              
              return (
                <div 
                  key={chunk.chunk_id} 
                  style={{
                    ...styles.chunkCard,
                    borderColor: isActive ? "#7c3aed" : isHighlighted ? "var(--gryffindor-gold)" : "rgba(255,255,255,0.1)",
                    background: isActive ? "rgba(124, 58, 237, 0.1)" : "rgba(10, 14, 26, 0.6)",
                    position: "relative",
                    overflow: "hidden"
                  }}
                  onClick={() => playChunk(chunk.chunk_id)}
                >
                  {isActive && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      height: "4px",
                      background: "#7c3aed",
                      width: `${progress}%`,
                      transition: "width 0.1s linear"
                    }} />
                  )}
                  <div style={styles.chunkTime}>
                    <span style={styles.timeText}>{formatTime(chunk.start_ts)} - {formatTime(chunk.end_ts)}</span>
                  </div>
                  
                  <div style={styles.chunkContent}>
                    {chunk.topic_node && (
                      <span style={styles.topicBadge}>{chunk.topic_node.replace(/_/g, " ")}</span>
                    )}
                    <p style={styles.transcript}>{chunk.transcript}</p>
                  </div>
                  
                  <div style={styles.playIcon}>
                    {isActive ? "🔊" : "▶️"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    padding: "2rem",
    maxWidth: "1000px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    flexWrap: "wrap" as const,
    gap: "1rem",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  backLink: {
    color: "var(--gryffindor-gold)",
    textDecoration: "none",
    fontSize: "0.9rem",
    opacity: 0.8,
  },
  title: {
    margin: 0,
    color: "white",
  },
  searchBox: {
    display: "flex",
    gap: "0.5rem",
  },
  searchInput: {
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.3)",
    color: "white",
    width: "250px",
  },
  searchBtn: {
    padding: "0.75rem 1.5rem",
    borderRadius: "8px",
    border: "none",
    background: "var(--gryffindor-gold)",
    color: "black",
    fontWeight: "bold",
    cursor: "pointer",
  },
  timeline: {
    background: "rgba(255,255,255,0.02)",
    borderRadius: "16px",
    padding: "1.5rem",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  empty: {
    textAlign: "center" as const,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
  },
  chunkList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  chunkCard: {
    display: "flex",
    alignItems: "center",
    gap: "1.5rem",
    padding: "1.5rem",
    borderRadius: "12px",
    borderWidth: "1px",
    borderStyle: "solid",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  chunkTime: {
    minWidth: "120px",
    color: "var(--gryffindor-gold)",
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  timeText: {
    background: "rgba(201, 168, 76, 0.1)",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
  },
  chunkContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    alignItems: "flex-start",
  },
  topicBadge: {
    background: "rgba(124, 58, 237, 0.2)",
    color: "#a78bfa",
    padding: "0.25rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    border: "1px solid rgba(124, 58, 237, 0.5)",
  },
  transcript: {
    margin: 0,
    opacity: 0.9,
    lineHeight: 1.5,
  },
  playIcon: {
    fontSize: "1.5rem",
    opacity: 0.7,
  }
};
