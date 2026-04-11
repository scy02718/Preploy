"""Timeline correlator: merges transcript entries and code snapshots into a single
sorted timeline of events. Pure function — no AI calls."""

from app.schemas import CodeSnapshot, TimelineEvent, TranscriptEntry


def build_timeline(
    transcript: list[TranscriptEntry],
    code_snapshots: list[CodeSnapshot],
) -> list[TimelineEvent]:
    """Merge transcript entries and code snapshots into a chronological timeline."""
    events: list[TimelineEvent] = []

    for entry in transcript:
        text = entry.text
        # Truncate summary cleanly at word boundary
        if len(text) > 100:
            summary = text[:97].rsplit(" ", 1)[0] + "..."
            full_text = text
        else:
            summary = text
            full_text = None  # No need to duplicate short text
        events.append(
            TimelineEvent(
                timestamp_ms=entry.timestamp_ms,
                event_type="speech",
                summary=summary,
                full_text=full_text,
            )
        )

    for snapshot in code_snapshots:
        if snapshot.event_type == "reset":
            summary = "Reset code"
        elif snapshot.event_type == "submit":
            summary = f"Submitted final code ({snapshot.language})"
        else:
            summary = f"Changed code ({snapshot.language})"
        events.append(
            TimelineEvent(
                timestamp_ms=snapshot.timestamp_ms,
                event_type="code_change",
                summary=summary,
                code=snapshot.code,
            )
        )

    events.sort(key=lambda e: e.timestamp_ms)
    return events
