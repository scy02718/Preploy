"""Unit tests for the timeline correlator service."""

from app.schemas import CodeSnapshot, TranscriptEntry
from app.services.timeline_correlator import build_timeline


class TestBuildTimeline:
    def test_empty_inputs_return_empty_list(self):
        result = build_timeline([], [])
        assert result == []

    def test_transcript_only_creates_speech_events(self):
        transcript = [
            TranscriptEntry(speaker="user", text="I would use a hash map here.", timestamp_ms=1000),
            TranscriptEntry(speaker="user", text="The time complexity is O(n).", timestamp_ms=3000),
        ]
        result = build_timeline(transcript, [])
        assert len(result) == 2
        assert all(e.event_type == "speech" for e in result)

    def test_snapshots_only_creates_code_change_events(self):
        snapshots = [
            CodeSnapshot(code="def foo(): pass", language="python", timestamp_ms=500, event_type="edit"),
        ]
        result = build_timeline([], snapshots)
        assert len(result) == 1
        assert result[0].event_type == "code_change"

    def test_code_change_events_include_code(self):
        snapshots = [
            CodeSnapshot(code="def foo(): pass", language="python", timestamp_ms=500, event_type="edit"),
        ]
        result = build_timeline([], snapshots)
        assert result[0].code == "def foo(): pass"

    def test_speech_events_have_no_code(self):
        transcript = [
            TranscriptEntry(speaker="user", text="Hello", timestamp_ms=0),
        ]
        result = build_timeline(transcript, [])
        assert result[0].code is None

    def test_events_are_sorted_by_timestamp(self):
        transcript = [
            TranscriptEntry(speaker="user", text="Let me think about this.", timestamp_ms=5000),
        ]
        snapshots = [
            CodeSnapshot(code="x = 1", language="python", timestamp_ms=2000, event_type="edit"),
            CodeSnapshot(code="x = 2", language="python", timestamp_ms=8000, event_type="edit"),
        ]
        result = build_timeline(transcript, snapshots)
        timestamps = [e.timestamp_ms for e in result]
        assert timestamps == sorted(timestamps)

    def test_speech_summary_truncated_with_ellipsis(self):
        long_text = "word " * 40  # 200 chars
        transcript = [TranscriptEntry(speaker="user", text=long_text.strip(), timestamp_ms=0)]
        result = build_timeline(transcript, [])
        assert len(result[0].summary) <= 100
        assert result[0].summary.endswith("...")

    def test_long_speech_stores_full_text(self):
        long_text = "word " * 40
        transcript = [TranscriptEntry(speaker="user", text=long_text.strip(), timestamp_ms=0)]
        result = build_timeline(transcript, [])
        assert result[0].full_text == long_text.strip()

    def test_speech_summary_short_text_not_truncated(self):
        short_text = "Hello world"
        transcript = [TranscriptEntry(speaker="user", text=short_text, timestamp_ms=0)]
        result = build_timeline(transcript, [])
        assert result[0].summary == short_text
        assert result[0].full_text is None

    def test_code_change_summary_includes_language(self):
        snapshots = [
            CodeSnapshot(code="function foo() {}", language="javascript", timestamp_ms=1000, event_type="edit"),
        ]
        result = build_timeline([], snapshots)
        assert "javascript" in result[0].summary

    def test_reset_event_summary(self):
        snapshots = [
            CodeSnapshot(code="def solution(): pass", language="python", timestamp_ms=1000, event_type="reset"),
        ]
        result = build_timeline([], snapshots)
        assert result[0].summary == "Reset code"

    def test_submit_event_summary(self):
        snapshots = [
            CodeSnapshot(code="def solution(): pass", language="python", timestamp_ms=1000, event_type="submit"),
        ]
        result = build_timeline([], snapshots)
        assert "Submitted" in result[0].summary
        assert "python" in result[0].summary

    def test_merged_timeline_has_correct_count(self):
        transcript = [
            TranscriptEntry(speaker="user", text="text1", timestamp_ms=1000),
            TranscriptEntry(speaker="user", text="text2", timestamp_ms=3000),
        ]
        snapshots = [
            CodeSnapshot(code="x", language="python", timestamp_ms=2000, event_type="edit"),
        ]
        result = build_timeline(transcript, snapshots)
        assert len(result) == 3

    def test_correct_event_types_in_merged_result(self):
        transcript = [TranscriptEntry(speaker="user", text="hi", timestamp_ms=0)]
        snapshots = [CodeSnapshot(code="x", language="python", timestamp_ms=1000, event_type="edit")]
        result = build_timeline(transcript, snapshots)
        assert result[0].event_type == "speech"
        assert result[1].event_type == "code_change"
