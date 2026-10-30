# Media System

Pipeline:
Media File → Media Detection → Media Asset → Decode → Timeline/Object → Processing Graph → Preview/Final Render → Encoder

Media Asset metadata may include id, path, filename, format, container, codec, duration, resolution, frame rate, pixel format, color space, audio streams, metadata, hash, and availability.

Import performs compatibility checks and background analysis. Thumbnails, waveforms, proxies, and cache are generated as needed.

Offline media becomes a placeholder and supports relinking.
