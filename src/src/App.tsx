import {
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";

type MenuName =
  | "File"
  | "Edit"
  | "View"
  | "Project"
  | "Object"
  | "Effect"
  | "Audio";

type SelectionType =
  | "none"
  | "text"
  | "image"
  | "audio";

type Track = {
  id: string;
  name: string;
  type: "video" | "audio";
};

const menus: MenuName[] = [
  "File",
  "Edit",
  "View",
  "Project",
  "Object",
  "Effect",
  "Audio",
];

const menuItems: Record<MenuName, string[]> = {
  File: [
    "New Project",
    "Open Project",
    "Save",
    "Save As",
    "Export",
    "Exit",
  ],
  Edit: [
    "Undo",
    "Redo",
    "Cut",
    "Copy",
    "Paste",
    "Delete",
  ],
  View: [
    "Workspace",
    "Timeline",
    "Preview",
    "Inspector",
  ],
  Project: [
    "Project Settings",
    "Project Information",
    "Project Manager",
  ],
  Object: [
    "Add Video",
    "Add Image",
    "Add Text",
    "Add Shape",
    "Add Audio",
  ],
  Effect: [
    "Effects",
    "Transitions",
    "Masks",
    "Adjustment",
  ],
  Audio: [
    "Audio Mixer",
    "Audio Effects",
    "Voice",
    "Music",
    "Sound Effects",
  ],
};

const defaultToolbar = [
  "Select",
  "Split",
  "+ Add",
  "Undo",
  "Redo",
  "More",
];

const toolbarBySelection: Record<
  SelectionType,
  string[]
> = {
  none: defaultToolbar,

  text: [
    "Select",
    "Text",
    "Font",
    "Size",
    "Align",
    "Color",
    "Animation",
  ],

  image: [
    "Select",
    "Crop",
    "Mask",
    "Brush",
    "Color",
    "Transform",
    "More",
  ],

  audio: [
    "Select",
    "Split",
    "Volume",
    "Fade",
    "EQ",
    "Audio",
    "More",
  ],
};

const TRACK_COUNT = 16;

const DEFAULT_TRACK_HEIGHT = 20;
const MIN_TRACK_HEIGHT = 10;
const MAX_TRACK_HEIGHT = 64;

const tracks: Track[] = [
  {
    id: "V1",
    name: "V1",
    type: "video",
  },
  {
    id: "V2",
    name: "V2",
    type: "video",
  },
  {
    id: "V3",
    name: "V3",
    type: "video",
  },
  {
    id: "V4",
    name: "V4",
    type: "video",
  },
  {
    id: "V5",
    name: "V5",
    type: "video",
  },
  {
    id: "V6",
    name: "V6",
    type: "video",
  },
  {
    id: "V7",
    name: "V7",
    type: "video",
  },
  {
    id: "V8",
    name: "V8",
    type: "video",
  },
  {
    id: "A1",
    name: "A1",
    type: "audio",
  },
  {
    id: "A2",
    name: "A2",
    type: "audio",
  },
  {
    id: "A3",
    name: "A3",
    type: "audio",
  },
  {
    id: "A4",
    name: "A4",
    type: "audio",
  },
  {
    id: "A5",
    name: "A5",
    type: "audio",
  },
  {
    id: "A6",
    name: "A6",
    type: "audio",
  },
  {
    id: "A7",
    name: "A7",
    type: "audio",
  },
  {
    id: "A8",
    name: "A8",
    type: "audio",
  },
];

function App() {
  const [activeMenu, setActiveMenu] =
    useState<MenuName | null>(null);

  const [selection, setSelection] =
    useState<SelectionType>("none");

  const [trackHeight, setTrackHeight] =
    useState(DEFAULT_TRACK_HEIGHT);

  const [timelineScrollTop, setTimelineScrollTop] =
    useState(0);

  const timelineViewportRef =
    useRef<HTMLDivElement | null>(null);

  const toolbarItems =
    toolbarBySelection[selection];

  const totalTrackHeight =
    TRACK_COUNT * trackHeight;

  const updateTimelineScroll = () => {
    const element =
      timelineViewportRef.current;

    if (!element) {
      return;
    }

    const maxScroll = Math.max(
      0,
      totalTrackHeight - element.clientHeight,
    );

    setTimelineScrollTop((current) =>
      Math.min(current, maxScroll),
    );
  };

  useEffect(() => {
    updateTimelineScroll();

    window.addEventListener(
      "resize",
      updateTimelineScroll,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateTimelineScroll,
      );
    };
  }, [trackHeight]);

  const handleMenuClick = (
    menu: MenuName,
  ) => {
    setActiveMenu((current) =>
      current === menu ? null : menu,
    );
  };

  const handleWorkspaceClick = () => {
    if (activeMenu) {
      setActiveMenu(null);
    }
  };

  const handleTimelineWheel = (
    event: React.WheelEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    /*
     * Ctrl + Wheel
     * --------------------------------
     * トラックの高さを変更
     */
    if (event.ctrlKey) {
      const direction =
        event.deltaY > 0 ? -1 : 1;

      setTrackHeight((current) =>
        Math.min(
          MAX_TRACK_HEIGHT,
          Math.max(
            MIN_TRACK_HEIGHT,
            current + direction,
          ),
        ),
      );

      return;
    }

    /*
     * 通常のWheel
     * --------------------------------
     * Timelineを上下スクロール
     */
    const viewport =
      timelineViewportRef.current;

    if (!viewport) {
      return;
    }

    const maxScroll = Math.max(
      0,
      totalTrackHeight -
        viewport.clientHeight,
    );

    const nextScroll =
      timelineScrollTop + event.deltaY;

    setTimelineScrollTop(
      Math.max(
        0,
        Math.min(maxScroll, nextScroll),
      ),
    );
  };

  const trackStyle = {
    height: `${trackHeight}px`,
  };

  return (
    <div
      className="app"
      onClick={handleWorkspaceClick}
    >
      {/* Menu Bar */}
      <header
        className="menu-bar"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="menu-items">
          {menus.map((menu) => (
            <div
              className="menu-item-wrapper"
              key={menu}
            >
              <button
                className={`menu-item ${
                  activeMenu === menu
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  handleMenuClick(menu)
                }
              >
                {menu}
              </button>

              {activeMenu === menu && (
                <div className="menu-dropdown">
                  {menuItems[menu].map(
                    (item, index) => (
                      <button
                        className="menu-dropdown-item"
                        key={item}
                        onClick={() =>
                          setActiveMenu(null)
                        }
                      >
                        <span>{item}</span>

                        {index === 0 &&
                          (menu === "File" ||
                            menu === "Edit" ||
                            menu === "Object") && (
                            <span className="submenu-arrow">
                              ›
                            </span>
                          )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Upper Workspace */}
      <main
        className="workspace"
        onClick={handleWorkspaceClick}
      >
        {/* Project / Media */}
        <section className="panel left-panel">
          <div className="panel-title">
            Project / Media
          </div>

          <div className="panel-tabs">
            <button className="panel-tab active">
              Project
            </button>

            <button className="panel-tab">
              Media
            </button>
          </div>

          <div className="media-list">
            <div className="media-folder">
              <span className="tree-arrow">
                ▾
              </span>

              <span className="folder-icon">
                ▣
              </span>

              <span>Media</span>
            </div>

            <div className="media-item">
              <span className="media-icon video">
                V
              </span>

              <span>
                Video_001.mp4
              </span>
            </div>

            <div className="media-item">
              <span className="media-icon image">
                I
              </span>

              <span>
                Image_001.png
              </span>
            </div>

            <div className="media-item">
              <span className="media-icon audio">
                A
              </span>

              <span>
                Audio_001.wav
              </span>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="preview-area">
          <div className="preview-header">
            <span>Preview</span>
          </div>

          <div className="preview-stage">
            <div className="preview-canvas">
              <div className="preview-placeholder" />

              <div className="preview-footer">
                <span>
                  00:00:00:00
                </span>

                <div className="preview-controls">
                  <button
                    className="preview-control-button"
                    title="Previous Frame"
                  >
                    ◀
                  </button>

                  <button
                    className="preview-control-button preview-play-button"
                    title="Play"
                  >
                    ▶
                  </button>

                  <button
                    className="preview-control-button"
                    title="Next Frame"
                  >
                    ▶
                  </button>

                  <div className="preview-timecode">
                    00:00:00:00
                  </div>

                  <button
                    className="preview-control-button"
                    title="Loop"
                  >
                    ↻
                  </button>
                </div>

                <span>
                  100%
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Inspector */}
        <section className="panel right-panel">
          <div className="panel-title">
            Item
          </div>

          <div className="inspector-content">
            <div className="inspector-section">
              <div className="inspector-heading">
                Selection
              </div>

              <div className="selection-buttons">
                <button
                  className={
                    selection === "none"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelection("none")
                  }
                >
                  None
                </button>

                <button
                  className={
                    selection === "text"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelection("text")
                  }
                >
                  Text
                </button>

                <button
                  className={
                    selection === "image"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelection("image")
                  }
                >
                  Image
                </button>

                <button
                  className={
                    selection === "audio"
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setSelection("audio")
                  }
                >
                  Audio
                </button>
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-heading">
                Transform
              </div>

              <div className="property-grid">
                <label>
                  <span>X</span>
                  <input defaultValue="0" />
                </label>

                <label>
                  <span>Y</span>
                  <input defaultValue="0" />
                </label>

                <label>
                  <span>W</span>
                  <input defaultValue="1920" />
                </label>

                <label>
                  <span>H</span>
                  <input defaultValue="1080" />
                </label>

                <label>
                  <span>Rotation</span>
                  <input defaultValue="0°" />
                </label>

                <label>
                  <span>Opacity</span>
                  <input defaultValue="100%" />
                </label>
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-heading">
                Properties
              </div>

              <div className="property-row">
                <span>Position</span>

                <span className="property-value">
                  0, 0
                </span>
              </div>

              <div className="property-row">
                <span>Scale</span>

                <span className="property-value">
                  100%
                </span>
              </div>

              <div className="property-row">
                <span>Blend</span>

                <span className="property-value">
                  Normal
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Context Toolbar */}
      <section
        className="context-toolbar"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="toolbar-left">
          {toolbarItems.map(
            (item, index) => (
              <button
                className={`toolbar-button ${
                  index === 0
                    ? "primary"
                    : ""
                }`}
                key={item}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <div className="toolbar-right">
          <button className="toolbar-icon-button">
            ⌘
          </button>

          <button className="toolbar-icon-button">
            ⚙
          </button>
        </div>
      </section>

      {/* Timeline */}
      <section className="timeline-section">
        <div className="timeline-title-bar">
          <div className="timeline-title-left">
            <span className="timeline-icon">
              ▤
            </span>

            <span>Timeline</span>

            <span className="timeline-sequence">
              Sequence 01
            </span>
          </div>

          <div className="timeline-title-right">
            <span className="timeline-hint">
              Wheel: Scroll
            </span>

            <span className="timeline-hint">
              Ctrl + Wheel: Track Height
            </span>

            <span className="track-height-value">
              {trackHeight}px
            </span>
          </div>
        </div>

        <div
          className="timeline-main"
          onWheel={handleTimelineWheel}
        >
          {/* Audio Meter */}
          <div className="audio-meter">
            <div className="audio-meter-label">
              dB
            </div>

            <div className="audio-meter-scale">
              <span>0</span>
              <span>-12</span>
              <span>-24</span>
              <span>-48</span>
            </div>

            <div className="audio-meter-track">
              <div className="audio-meter-level">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          {/* Track Header */}
          <div className="track-header">
            <div className="track-header-top">
              <span>Tracks</span>
            </div>

            <div
              ref={timelineViewportRef}
              className="track-scroll-viewport"
            >
              <div
                className="track-scroll-content"
                style={{
                  transform: `translateY(-${timelineScrollTop}px)`,
                }}
              >
                {tracks.map((track) => (
                  <div
                    className={`track-row ${
                      track.type === "audio"
                        ? "audio-track"
                        : ""
                    }`}
                    style={trackStyle}
                    key={track.id}
                  >
                    <span className="track-label">
                      {track.name}
                    </span>

                    <div className="track-controls">
                      <button>
                        ◉
                      </button>

                      <button>
                        🔒
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Content */}
          <div className="timeline-content">
            {/* Time Ruler */}
            <div className="time-ruler">
              <span style={{ left: "0%" }}>
                00:00
              </span>

              <span style={{ left: "20%" }}>
                00:05
              </span>

              <span style={{ left: "40%" }}>
                00:10
              </span>

              <span style={{ left: "60%" }}>
                00:15
              </span>

              <span style={{ left: "80%" }}>
                00:20
              </span>

              <span style={{ left: "100%" }}>
                00:25
              </span>
            </div>

            {/* Timeline Grid */}
            <div className="timeline-grid">
              <div
                className="timeline-scroll-content"
                style={{
                  transform: `translateY(-${timelineScrollTop}px)`,
                }}
              >
                <div className="grid-lines">
                  <span
                    style={{
                      left: "0%",
                    }}
                  />

                  <span
                    style={{
                      left: "20%",
                    }}
                  />

                  <span
                    style={{
                      left: "40%",
                    }}
                  />

                  <span
                    style={{
                      left: "60%",
                    }}
                  />

                  <span
                    style={{
                      left: "80%",
                    }}
                  />

                  <span
                    style={{
                      left: "100%",
                    }}
                  />
                </div>

                {tracks.map(
                  (track, index) => (
                    <div
                      className="timeline-row"
                      style={trackStyle}
                      key={track.id}
                    >
                      {index === 0 && (
                        <div
                          className="timeline-clip video-clip"
                          style={{
                            left: "2%",
                            width: "31%",
                          }}
                        >
                          <span>
                            Video_001
                          </span>
                        </div>
                      )}

                      {index === 1 && (
                        <div
                          className="timeline-clip image-clip"
                          style={{
                            left: "18%",
                            width: "18%",
                          }}
                        >
                          <span>
                            Image_001
                          </span>
                        </div>
                      )}

                      {index === 2 && (
                        <div
                          className="timeline-clip text-clip"
                          style={{
                            left: "42%",
                            width: "22%",
                          }}
                        >
                          <span>
                            Text
                          </span>
                        </div>
                      )}

                      {index === 8 && (
                        <div
                          className="timeline-clip audio-clip"
                          style={{
                            left: "2%",
                            width: "46%",
                          }}
                        >
                          <span>
                            Audio_001
                          </span>
                        </div>
                      )}

                      {index === 9 && (
                        <div
                          className="timeline-clip audio-clip secondary"
                          style={{
                            left: "51%",
                            width: "25%",
                          }}
                        >
                          <span>
                            Music
                          </span>
                        </div>
                      )}
                    </div>
                  ),
                )}

                {/* Playhead */}
                <div
                  className="playhead"
                  style={{
                    left: "14%",
                  }}
                >
                  <div className="playhead-handle" />
                  <div className="playhead-line" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span className="status-indicator" />
          <span>Ready</span>
        </div>

        <div className="status-right">
          <span>24 fps</span>
          <span>1920×1080</span>
          <span>Auto</span>
        </div>
      </footer>
    </div>
  );
}

export default App;