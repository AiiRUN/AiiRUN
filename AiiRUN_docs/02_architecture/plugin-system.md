# Plugin System

Plugin extension: `.allrunplugin`

Example:
```text
MyBlur/
├─ plugin.json
├─ src/main.ts
├─ assets/
└─ README.md
```

Types:
- Effect
- Transition
- Generator
- Audio Effect
- Tool
- Object
- Panel
- Command
- AI Provider
- Import / Export
- Encoder

Initial SDK direction:
1. VS Code + SDK + CLI
2. AiiRUN Plugin Studio
3. CLI

Developer Mode should support hot reload. Plugin permissions and manifests are required. Crash isolation should be used where practical.
