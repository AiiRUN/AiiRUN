# AI

AiiRUN can provide AI features without requiring a proprietary foundation model.

External providers may include OpenAI, Gemini, Claude, and compatible services.

AiiRUN remains fully usable with AI disabled. No unexpected-cost fallback is allowed.

Security:
- API keys in OS secure credential storage
- Never store keys in project files
- Store provider/model metadata, not credentials

AI editing flow:
AI → Structured Proposal → Validation → User Approval → Command → Core

AI jobs run in the background and must not corrupt project state.
