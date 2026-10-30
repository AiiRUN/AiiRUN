# Core System

Core always includes:
- Core Engine
- Project System
- Object System
- Timeline
- Time System
- Property System
- Keyframe System
- Command
- Action
- Transaction
- Undo/Redo
- Basic Media Abstraction
- Basic Render Interface
- Plugin Manager
- Feature Manager
- Security / Permission
- Settings
- Update System

All user edits should eventually flow through Commands and Transactions so undo/redo remains reliable.
