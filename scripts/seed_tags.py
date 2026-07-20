#!/usr/bin/env python3
"""
Seed a few tags onto sessions by keyword-matching their titles.

THIS IS A PLACEHOLDER, not the real enrichment. The SIGGRAPH source has no
abstracts and no keyword column, and titles are 3-6 words, so this only
reaches the sessions whose topic is obvious from the title. Its purpose is to
exercise the tag filter and scoring paths with realistic data.

Real enrichment (SPEC.md open question #4) means mining each session's URL.
When that happens, tags must be committed as build artifacts rather than
regenerated per build (SPEC sect. 4.2) — otherwise the recommended list
reshuffles between builds and shared picks disagree about what a session is.

Idempotent: re-running replaces only the tags this script owns.

Usage: python3 scripts/seed_tags.py [--data public/data/sessions.json]
"""

import argparse
import json
import pathlib
import re
from collections import Counter

# tag -> title keywords that imply it. Deliberately conservative: a wrong tag
# is worse than a missing one, because it silently mis-ranks recommendations.
TAG_KEYWORDS = {
    "rendering":        ["render", "ray tracing", "raytracing", "path tracing", "shading", "shader"],
    "gaussian-splatting": ["gaussian splat", "splatting", "3dgs"],
    "neural":           ["neural", "diffusion", "generative", "latent", "gan "],
    "geometry":         ["geometry", "mesh", "surface", "sdf", "iso-surface", "winding number", "topolog"],
    "simulation":       ["simulation", "physics", "fluid", "cloth", "dynamics", "deformation", "collision"],
    "animation":        ["animation", "rigging", "motion", "character", "skinning"],
    "capture":          ["capture", "scanning", "photogramm", "reconstruction", "lidar"],
    "humans":           ["human", "face", "avatar", "hand", "body", "hair", "portrait"],
    "vr-ar":            ["virtual reality", " vr", " ar ", "augmented", "immersive", "holograph", "spatial"],
    "display":          ["display", "holography", "projector", "light field"],
    "games":            ["game", "real-time", "realtime", "engine", "gpu"],
    "fabrication":      ["fabrication", "3d print", "manufactur", "knit", "textile"],
    "ai-tools":         ["llm", "language model", "ai for", "ai-", "agent", "copilot"],
    "education":        ["education", "teaching", "curriculum", "student", "classroom"],
    "production":       ["production", "pipeline", "vfx", "studio", "workflow"],
}


def tags_for(title):
    lowered = f" {title.lower()} "
    found = [tag for tag, keys in TAG_KEYWORDS.items() if any(k in lowered for k in keys)]
    return sorted(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="public/data/sessions.json")
    args = ap.parse_args()

    path = pathlib.Path(args.data)
    sessions = json.loads(path.read_text(encoding="utf-8"))

    counts = Counter()
    tagged = 0
    for session in sessions:
        found = tags_for(session["title"])
        session["tags"] = found
        if found:
            tagged += 1
            counts.update(found)

    path.write_text(json.dumps(sessions, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Tagged {tagged} of {len(sessions)} sessions "
          f"({tagged * 100 // len(sessions)}%) from titles alone.")
    for tag, n in counts.most_common():
        print(f"  {tag:<20} {n}")
    print("\nThe untagged remainder needs URL mining — see SPEC.md open question #4.")


if __name__ == "__main__":
    main()
