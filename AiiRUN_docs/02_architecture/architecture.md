# Architecture

Technology:
- Tauri 2
- React
- TypeScript
- Rust
- FFmpeg

React/TypeScript: UI, panels, toolbar, timeline interaction, inspector.
Tauri: desktop shell and native integration.
Rust: project, timeline, objects, commands, undo/redo, cache, rendering, plugins, feature management.
FFmpeg: media probing, decode/encode, transcoding, export.

Layers:
Core → Basic Edition → Official Feature Packages → Third-party Plugins → External AI/Services

Core must not depend on optional plugins.
