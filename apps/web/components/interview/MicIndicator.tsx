"use client";

interface MicIndicatorProps {
  isRecording: boolean;
  audioLevel: number; // 0-1
}

export function MicIndicator({ isRecording, audioLevel }: MicIndicatorProps) {
  if (!isRecording) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
        <span className="text-xs text-muted-foreground">Mic off</span>
      </div>
    );
  }

  // Scale: 1.0 at silence, up to 1.8 at max volume
  const scale = 1 + audioLevel * 0.8;
  // Opacity: 0.6 at silence, 1.0 at max volume
  const opacity = 0.6 + audioLevel * 0.4;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2.5 w-2.5 rounded-full bg-red-500 transition-transform duration-75"
        style={{
          transform: `scale(${scale})`,
          opacity,
        }}
      />
      <span className="text-xs text-red-500">Recording...</span>
    </div>
  );
}
