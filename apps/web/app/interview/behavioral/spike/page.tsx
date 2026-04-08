"use client";

import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { useEffect, useRef } from "react";

export default function VoiceSpikePage() {
  const {
    isConnected,
    isListening,
    isSpeaking,
    isMuted,
    transcript,
    connect,
    disconnect,
    mute,
    unmute,
    error,
  } = useRealtimeVoice({
    systemPrompt:
      "You are a friendly interviewer conducting a behavioral interview. Start by warmly greeting the candidate and asking them to tell you about themselves. Keep your responses concise (2-3 sentences). Ask follow-up questions based on their answers. Focus on behavioral questions like 'Tell me about a time when...' topics.",
    voice: "verse",
  });

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-bold">
        Voice Conversation Spike
      </h1>
      <p className="mb-6 text-muted-foreground">
        Test real-time voice conversation with OpenAI Realtime API
      </p>

      {/* Connection Controls */}
      <div className="mb-6 flex items-center gap-4">
        {!isConnected ? (
          <button
            onClick={connect}
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Connect
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="rounded-lg bg-destructive px-6 py-3 font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Disconnect
          </button>
        )}

        {isConnected && (
          <button
            onClick={isMuted ? unmute : mute}
            className={`rounded-lg px-4 py-3 font-medium transition-colors ${
              isMuted
                ? "bg-yellow-600 text-white hover:bg-yellow-700"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        )}
      </div>

      {/* Status Indicators */}
      <div className="mb-6 flex items-center gap-6">
        <StatusIndicator
          label="Connected"
          active={isConnected}
          color="green"
        />
        <StatusIndicator
          label="Listening"
          active={isListening}
          color="blue"
        />
        <StatusIndicator
          label="AI Speaking"
          active={isSpeaking}
          color="purple"
        />
        <StatusIndicator
          label="Muted"
          active={isMuted}
          color="yellow"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Transcript */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Live Transcript</h2>
        </div>
        <div className="h-[400px] overflow-y-auto p-4">
          {transcript.length === 0 ? (
            <p className="text-center text-muted-foreground">
              {isConnected
                ? "Waiting for conversation to start..."
                : "Click Connect to begin"}
            </p>
          ) : (
            <div className="space-y-3">
              {transcript.map((entry, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${
                    entry.speaker === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      entry.speaker === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="mb-1 text-xs font-medium opacity-70">
                      {entry.speaker === "user" ? "You" : "AI Interviewer"}
                    </div>
                    <div className="text-sm">{entry.text}</div>
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
        <h3 className="mb-2 font-medium">How it works:</h3>
        <ol className="list-inside list-decimal space-y-1">
          <li>Click <strong>Connect</strong> to start the session (mic permission required)</li>
          <li>The AI interviewer will greet you and start asking questions</li>
          <li>Speak naturally — the AI will detect when you stop talking and respond</li>
          <li>The transcript updates in real-time as the conversation progresses</li>
          <li>Click <strong>Disconnect</strong> when you&apos;re done</li>
        </ol>
      </div>
    </div>
  );
}

function StatusIndicator({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: "green" | "blue" | "purple" | "yellow";
}) {
  const colorClasses = {
    green: active ? "bg-green-500" : "bg-green-500/20",
    blue: active ? "bg-blue-500" : "bg-blue-500/20",
    purple: active ? "bg-purple-500" : "bg-purple-500/20",
    yellow: active ? "bg-yellow-500" : "bg-yellow-500/20",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-3 w-3 rounded-full transition-colors ${colorClasses[color]} ${
          active ? "animate-pulse" : ""
        }`}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
