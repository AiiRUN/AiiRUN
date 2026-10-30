# Design Decisions

## D001 — Technology
Tauri 2 + React/TypeScript + Rust + FFmpeg.

## D002 — Editing language
Object / Timeline / Property / Keyframe / Path / Effect / Relationship / Command / Action.

## D003 — Toolbar position
Default: between upper workspace and Timeline. Future configurable positions: Top / Middle / Bottom.

## D004 — Timeline
Timeline is a major focus. Do not arbitrarily change its size. The previously considered 1.2x enlargement is not a current requirement.

## D005 — Item panel
Item is the control center for the selected Object.

## D006 — Effects
Effects use an Effect Browser and an editable, reorderable applied-effect stack. Built-in, official-extension, and third-party effects share one discovery model.

## D007 — Preview
Remove placeholder title/subtitle. Center playback controls in the bottom status bar. Timecode remains left; zoom remains right.

## D008 — Modular features
Expected professional features should not be pushed into third-party plugins merely because they are advanced. Use Basic and Basic Extension for expected capabilities.

## D009 — AI
AI is optional/provider-based. AI proposes structured edits; Core validates and executes through Commands.

## D010 — Project format
Project extension: `.allrunproject`. Plugin extension: `.allrunplugin`. Project format is independently versioned and migratable.
