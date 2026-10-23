#!/usr/bin/env python3
"""Build the embedded evidence profile and both learning-page fallbacks, offline."""
from __future__ import annotations
import argparse
import html
import json
from pathlib import Path
import re
import subprocess
import sys

BEGIN = "  // BEGIN GENERATED LEARNING PROFILE"
END = "  // END GENERATED LEARNING PROFILE"
TEMPLATES = ("next-learning", "preview-next-learning")

HOME_BEGIN = "<!-- BEGIN GENERATED HOME RECOMMENDATION -->"
HOME_END = "<!-- END GENERATED HOME RECOMMENDATION -->"
HOME_TEMPLATE = """<p class="label">接着上次的问题</p>
<p id="rh-evidence" class="river-feature-context">{{PRIMARY_EVIDENCE_STATUS}} · {{PRIMARY_META}}</p>
<h2 id="rh-title">{{PRIMARY_TITLE}}</h2>
<p id="rh-goal">{{PRIMARY_GOAL}}</p>
<a id="rh-link" class="text-link" href="{{PRIMARY_HREF}}">开始这一步 ↗</a>
<p id="rh-reason" class="river-feature-context">为什么先学：{{PRIMARY_WHY}}</p>
<p id="rh-check" class="river-feature-context">小目标：{{PRIMARY_CHECK}}</p>
<p id="rh-storage" class="river-feature-context">启用脚本后会参考本机方向和自报记录；当前显示默认学习问题。</p>
<a class="river-secondary-link" href="next-learning.html">查看下一步与本机学习记录</a>"""


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def escaped(value):
    return html.escape(str(value), quote=True)


def compile_profile(source, profile, directory):
    payload = json.dumps(profile, ensure_ascii=False, indent=2)
    # The payload remains safe if the script is ever inlined in HTML.
    for char, replacement in (("<", "\\u003c"), (">", "\\u003e"), ("&", "\\u0026"), ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
        payload = payload.replace(char, replacement)
    if source.count(BEGIN) != 1 or source.count(END) != 1:
        raise ValueError("Expected exactly one bounded generated-profile marker pair.")
    start, end = source.index(BEGIN), source.index(END)
    if start >= end:
        raise ValueError("Generated-profile markers are out of order.")
    built = source[:start] + BEGIN + "\n  var PROFILE = " + payload + ";\n" + source[end:]
    # Run the same model as the browser. Validation and recommendation have one source.
    runner = """
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve('learning-progress.js');
const m = new Module(filename, module);
m.filename = filename;
m.paths = module.paths;
m._compile(fs.readFileSync(0, 'utf8'), filename);
const api = m.exports;
process.stdout.write(JSON.stringify({profile: api.profile, labels: api.evidenceLabels, topics: api.topics,
  recommendation: api.recommend(api.emptyState())}));
"""
    check = subprocess.run(["node", "-e", runner], input=built, text=True, capture_output=True, cwd=directory)
    if check.returncode:
        raise ValueError("Profile/model validation failed:\n" + check.stderr.strip())
    return built, json.loads(check.stdout)


def tokens(data):
    profile, result = data["profile"], data["recommendation"]
    if result is None:
        raise ValueError("The default profile must leave at least one recommended task.")
    lesson = result["lesson"]
    topics = data["topics"]
    values = {
        "PROFILE_DATE": profile["reviewedAt"],
        "PROFILE_REVIEW_LABEL": profile["reviewLabel"],
        "PROFILE_VERSION": profile["version"],
        "PRIMARY_TITLE": lesson["title"],
        "PRIMARY_GOAL": lesson["goal"],
        "PRIMARY_CHECK": result["verificationQuestion"],
        "PRIMARY_WHY": result["reason"],
        "PRIMARY_PREREQUISITE": result["prerequisiteText"],
        "PRIMARY_FRONTIER": result["frontier"],
        "PRIMARY_TOPIC": topics[lesson["topic"]],
        "PRIMARY_HREF": lesson["href"],
        "PRIMARY_EXPERIMENT": lesson["experiment"],
        "PRIMARY_MATERIAL": lesson["material"],
        # Optional tokens let new templates avoid hard-coded status and next-step labels.
        "PRIMARY_EVIDENCE_STATUS": result["evidenceLabel"],
        "PRIMARY_AFTER_CHECK": result["afterCheck"],
        "PRIMARY_META": result["estimatedMinutes"] + " · 一次独立检查",
    }
    values = {key: escaped(value) for key, value in values.items()}
    cards = []
    for item in profile["topicSummaries"]:
        cards.append("<article><span class=\"nl-evidence-status\">" + escaped(data["labels"][item["status"]]) +
                     "</span><h3>" + escaped(item["title"]) + "</h3><p class=\"nl-evidence-frontier\">" + escaped(item["frontier"]) +
                     "</p><p>" + escaped(item["summary"]) + "</p><p class=\"nl-evidence-check\">" + escaped(item["check"]) +
                     "</p><a href=\"" + escaped(item["href"]) + "\">回看相关材料</a></article>")
    values["PROFILE_EVIDENCE"] = "\n".join(cards)
    return values


def build(directory, check=False):
    profile = json.loads((directory / "learning-profile.json").read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    source_path = directory / "learning-progress.js"
    source = source_path.read_text(encoding="utf-8")
    built, data = compile_profile(source, profile, directory)
    replacements = tokens(data)
    outputs = {source_path: built}
    found = False
    for basename in TEMPLATES:
        template_path = directory / (basename + ".template.html")
        if not template_path.exists():
            continue
        found = True
        template = template_path.read_text(encoding="utf-8")
        def replace(match):
            name = match.group(1)
            if name not in replacements:
                raise ValueError(f"Unknown template token: {name}")
            return replacements[name]
        rendered = re.sub(r"\{\{([A-Z_]+)\}\}", replace, template)
        if re.search(r"\{\{[^{}]+\}\}", rendered):
            raise ValueError(f"Unresolved template token in {template_path.name}")
        outputs[directory / (basename + ".html")] = rendered
    if not found:
        raise ValueError("No next-learning template found; no outputs written.")
    home_path = directory / "index.html"
    if home_path.exists():
        home = home_path.read_text(encoding="utf-8")
        if home.count(HOME_BEGIN) != 1 or home.count(HOME_END) != 1:
            raise ValueError("Expected exactly one homepage recommendation marker pair.")
        start, end = home.index(HOME_BEGIN), home.index(HOME_END)
        if start >= end:
            raise ValueError("Homepage recommendation markers are out of order.")
        content = re.sub(r"\{\{([A-Z_]+)\}\}", lambda match: replacements[match.group(1)], HOME_TEMPLATE)
        outputs[home_path] = home[:start] + HOME_BEGIN + "\n" + content + "\n" + home[end:]

    changed = [path for path, content in outputs.items() if not path.exists() or path.read_text(encoding="utf-8") != content]
    if check:
        if changed:
            raise ValueError("Generated files are stale: " + ", ".join(path.name for path in changed))
        print("PASS: learning profile and page fallbacks are up to date.")
    else:
        for path in changed:
            path.write_text(outputs[path], encoding="utf-8")
        print("Built " + ", ".join(path.name for path in outputs) + f" ({len(changed)} changed).")
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if generated files are stale; do not write.")
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent, help="Directory containing the profile, engine and templates.")
    args = parser.parse_args()
    try:
        build(args.directory.resolve(), args.check)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
