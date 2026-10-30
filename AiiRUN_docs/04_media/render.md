# Render

Preview rendering and final rendering are separate.

Final render prioritizes original media, quality, deterministic output, correct color handling, and correct audio synchronization.

Processing Graph should support CPU/GPU execution and avoid unnecessary GPU↔CPU transfers.

Render Queue handles background rendering.
