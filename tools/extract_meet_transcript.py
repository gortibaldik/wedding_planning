#!/usr/bin/env python3
r"""Extract a saved Google Meet transcript side sheet (HTML) into clean JSON.

The side sheet's DOM is one ``QvmvOc`` timestamp div followed by a ``wyBDIb``
body div per segment, with speaker changes marked inline as ``(Name)\n``.
This strips the markup and writes two files:

* ``<output>_segments.json`` - one entry per segment, with its utterances.
* ``<output>_turns.json`` - the same text with consecutive utterances by the
  same speaker merged into a single turn.
"""

import argparse
import html
import json
import re
from pathlib import Path

SEGMENT_RE = re.compile(
    r'<div class="QvmvOc"[^>]*data-timestamp="(\d+)"[^>]*>(.*?)</div>'
    r'<div class="wyBDIb"[^>]*>(.*?)</div>',
    re.S,
)
SPEAKER_RE = re.compile(r"\(([^()\n]+)\)\n")
TAG_RE = re.compile(r"<[^>]+>")


def clean(text):
    """Strip tags and entities from a text chunk and collapse it to one line."""
    text = html.unescape(TAG_RE.sub("", text)).replace("\xa0", " ")
    text = re.sub(r"^\s*-\s*$", "", text, flags=re.M)  # filler between speakers
    return re.sub(r"\s+", " ", text).strip()


def read_segments(source):
    """Yield ``{timestamp, offset_ms, utterances}`` for each transcript segment."""
    markup = source.read_text(encoding="utf-8")
    for offset_ms, label, body in (m.groups() for m in SEGMENT_RE.finditer(markup)):
        # Speakers are marked inside the body, so split before cleaning.
        parts = SPEAKER_RE.split(html.unescape(TAG_RE.sub("", body)))
        utterances = []
        lead = clean(parts[0])
        if lead:
            utterances.append({"speaker": None, "text": lead})
        for speaker, spoken in zip(parts[1::2], parts[2::2], strict=True):
            spoken = clean(spoken)
            if spoken:
                utterances.append({"speaker": speaker.strip(), "text": spoken})
        if utterances:
            yield {
                "timestamp": clean(label),
                "offset_ms": int(offset_ms),
                "utterances": utterances,
            }


def merge_turns(segments):
    """Join consecutive utterances by the same speaker into single turns."""
    turns = []
    for segment in segments:
        for utterance in segment["utterances"]:
            if turns and turns[-1]["speaker"] == utterance["speaker"]:
                turns[-1]["text"] += " " + utterance["text"]
            else:
                turns.append(
                    {
                        "speaker": utterance["speaker"],
                        "timestamp": segment["timestamp"],
                        "offset_ms": segment["offset_ms"],
                        "text": utterance["text"],
                    }
                )
    return turns


def write_json(data, destination):
    destination.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("source", type=Path, help="Path to the saved transcript .html")
parser.add_argument(
    "-o",
    "--output-prefix",
    type=Path,
    help="Prefix for the output files (defaults to the source without extension)",
)
args = parser.parse_args()

if not args.source.is_file():
    parser.error(f"file '{args.source}' not found")

prefix = args.output_prefix or args.source.with_suffix("")
segments = list(read_segments(args.source))
if not segments:
    parser.error(f"no transcript segments found in '{args.source}'")
turns = merge_turns(segments)

write_json(segments, prefix.with_name(f"{prefix.name}_segments.json"))
write_json(turns, prefix.with_name(f"{prefix.name}_turns.json"))

speakers = sorted({turn["speaker"] for turn in turns if turn["speaker"]})
print(f"Wrote {len(segments)} segments and {len(turns)} turns to {prefix}_*.json")
print(f"Speakers: {', '.join(speakers)}")
