# UI Concept

AiiRUN uses React/TypeScript inside Tauri 2, but should feel like a desktop editing application rather than a generic web application.

Core principle:
> 上で素材・Preview・Itemを扱い、中央のツールバーで操作し、下でTimeline編集

Standard layout:
- Menu bar
- Project / Media
- Preview
- Item / Inspector
- Toolbar between upper area and Timeline
- Timeline at bottom

Avoid unnecessary web-style cards, excessive rounded containers, excessive whitespace, and page-like navigation. Emphasize panels, editing density, selection state, drag interaction, keyboard shortcuts, context menus, and direct manipulation.
