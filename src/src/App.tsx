import {
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

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

type VideoObject = {
  id: string;
  type: "video";
  asset_id: string;
  start: number;
  duration: number;
  source_start: number;
};

type SplitVideoObjects = {
  first: VideoObject;
  second: VideoObject;
};

type TimelineState = {
  id: string;
  name: string;
  objects: VideoObject[];
};

type MediaAsset = {
  id: string;
  path: string;
  filename: string;
  availability: boolean;
};

type ProjectState = {
  format_version: number;
  project_id: string;
  name: string;
  timelines: TimelineState[];
  assets: MediaAsset[];
};

const restrictVideoObjectStartForLane = (
  draggedObject: VideoObject,
  candidateStart: number,
  currentStart: number,
  timelineObjects: VideoObject[],
  timelineDuration: number,
) => {
  let restrictedStart = Math.max(
    0,
    Math.min(
      timelineDuration - draggedObject.duration,
      candidateStart,
    ),
  );
  const candidateEnd =
    restrictedStart + draggedObject.duration;
  const draggingLeft =
    restrictedStart < currentStart;

  const otherObjects =
    timelineObjects.filter(
      (object) => object.id !== draggedObject.id,
    );

  if (draggingLeft) {
    const leftCollisions =
      otherObjects.filter(
        (object) =>
          restrictedStart < object.start + object.duration &&
          candidateEnd > object.start,
      );

    if (leftCollisions.length > 0) {
      restrictedStart = Math.max(
        restrictedStart,
        ...leftCollisions.map(
          (object) => object.start + object.duration,
        ),
      );
    }
  } else {
    const rightCollisions =
      otherObjects.filter(
        (object) =>
          restrictedStart < object.start + object.duration &&
          candidateEnd > object.start,
      );

    if (rightCollisions.length > 0) {
      restrictedStart = Math.min(
        restrictedStart,
        ...rightCollisions.map(
          (object) =>
            object.start - draggedObject.duration,
        ),
      );
    }
  }

  return Math.max(
    0,
    Math.min(
      timelineDuration - draggedObject.duration,
      restrictedStart,
    ),
  );
};

type FrameRequest = {
  request_id: string;
  asset_id: string;
  time: number;
};

type FrameResult = {
  request_id: string;
  asset_id: string;
  time: number;
  path: string | null;
  available: boolean;
};

export type TimelineContextMenu = {
  x: number;
  y: number;
  objectId: string | null;
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
    "Import Media",
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
  "分割",
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
    "分割",
    "Volume",
    "Fade",
    "EQ",
    "Audio",
    "More",
  ],
};

const TRACK_COUNT = 16;
const TIMELINE_DURATION_SECONDS = 25;
const MIN_CLIP_DURATION = 0.1;

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

  const [project, setProject] =
    useState<ProjectState | null>(null);

  const [projectPath, setProjectPath] =
    useState<string | null>(null);

  const [selectedVideoObjectId, setSelectedVideoObjectId] =
    useState<string | null>(null);

  const [frameResult, setFrameResult] =
    useState<FrameResult | null>(null);

  const [timelineCurrentTime, setTimelineCurrentTime] =
    useState(0);

  const [previewPlaying, setPreviewPlaying] =
    useState(false);

  const previewVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const timelineCurrentTimeRef =
    useRef(0);

  const previewPlayingRef =
    useRef(false);

  const pendingPreviewAssetRef =
    useRef<string | null>(null);

  const latestPreviewRequestRef =
    useRef<string | null>(null);

  const timelineScrubbingRef =
    useRef(false);

  const timelineObjectDragRef =
    useRef<{
      objectId: string;
      startClientX: number;
      initialStart: number;
      initialDuration: number;
      initialSourceStart: number;
      mode: "move" | "resize-left" | "resize-right";
    } | null>(null);

  const timelineObjectDidDragRef =
    useRef(false);

  const [timelineContextMenu, setTimelineContextMenu] =
    useState<TimelineContextMenu | null>(null);

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
    setTimelineContextMenu(null);
  };

  const handleCreateProject = async () => {
    try {
      const createdProject =
        await invoke<ProjectState>("create_project", {
          projectId: crypto.randomUUID(),
          name: "Untitled Project",
        });

      setProject(createdProject);
      setProjectPath(null);
      setSelectedVideoObjectId(null);
      setFrameResult(null);
      setTimelineCurrentTime(0);
      console.log("Created project:", createdProject);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const saveProject = async (
    useSaveDialog: boolean = false,
  ) => {
    if (!project) {
      return;
    }

    try {
      let path = useSaveDialog ? null : projectPath;

      if (!path) {
        path = await save({
          defaultPath: `${project.name}.allrunproject`,
          filters: [
            {
              name: "AiiRUN Project",
              extensions: ["allrunproject"],
            },
          ],
        });
      }

      if (!path) {
        return;
      }

      await invoke("save_project_file", {
        project,
        path,
      });
      setProjectPath(path);
      console.log("Saved project:", path);
    } catch (error) {
      console.error("Failed to save project:", error);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: "AiiRUN Project",
            extensions: ["allrunproject"],
          },
        ],
      });

      if (typeof selectedPath !== "string") {
        return;
      }

      const loadedProject =
        await invoke<ProjectState>("load_project_file", {
          path: selectedPath,
        });

      setProject(loadedProject);
      setProjectPath(selectedPath);
      setSelectedVideoObjectId(null);
      setFrameResult(null);
      setTimelineCurrentTime(0);
      console.log("Loaded project:", loadedProject);
    } catch (error) {
      console.error("Failed to open project:", error);
    }
  };

  const handleImportMedia = async () => {
    if (!project) {
      return;
    }

    try {
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "webm", "mkv"],
          },
        ],
      });

      if (typeof selectedPath !== "string") {
        return;
      }

      const asset = await invoke<MediaAsset>(
        "create_media_asset",
        {
          path: selectedPath,
        },
      );

      setProject((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          assets: [...current.assets, asset],
        };
      });
      console.log("Imported media asset:", asset);
    } catch (error) {
      console.error("Failed to import media:", error);
    }
  };

  const handleAddMediaToTimeline = async (
    asset: MediaAsset,
  ) => {
    if (!project) {
      return;
    }

    try {
      const existingObjects =
        project.timelines[0]?.objects ?? [];
      const sortedObjects =
        [...existingObjects].sort(
          (first, second) =>
            first.start - second.start,
        );
      let insertStart = 0;
      for (const videoObject of sortedObjects) {
        if (
          insertStart + 10 <=
          videoObject.start
        ) {
          break;
        }
        insertStart = Math.max(
          insertStart,
          videoObject.start +
            videoObject.duration,
        );
      }

      const videoObject =
        await invoke<VideoObject>(
          "create_video_object",
          {
            assetId: asset.id,
            start: insertStart,
            duration: 10,
          },
        );

      setProject((current) => {
        if (!current) {
          return current;
        }

        const timelines =
          current.timelines.length > 0
            ? current.timelines
            : [{
                id: "sequence-01",
                name: "Sequence 01",
                objects: [],
              }];

        return {
          ...current,
          timelines: timelines.map((timeline, index) =>
            index === 0
              ? {
                  ...timeline,
                  objects: [
                    ...timeline.objects,
                    videoObject,
                  ],
                }
              : timeline,
          ),
        };
      });
      console.log(
        "Added video object to timeline:",
        videoObject,
      );
    } catch (error) {
      console.error(
        "Failed to add media to timeline:",
        error,
      );
    }
  };

  const requestPreviewFrame = async (
    videoObject: VideoObject,
    timelineTime: number,
  ) => {
    if (!project) {
      return;
    }

    const previousRequestId =
      latestPreviewRequestRef.current;

    if (previousRequestId) {
      void invoke("cancel_preview_frame", {
        requestId: previousRequestId,
      }).catch((error) => {
        console.error(
          "Failed to cancel preview frame request:",
          error,
        );
      });
    }

    const requestId = crypto.randomUUID();
    latestPreviewRequestRef.current = requestId;
    pendingPreviewAssetRef.current =
      videoObject.asset_id;
    const sourceTime =
      Number.isFinite(videoObject.source_start)
        ? videoObject.source_start +
          Math.max(
            0,
            timelineTime - videoObject.start,
          )
        : Math.max(
            0,
            timelineTime - videoObject.start,
          );

    const request: FrameRequest = {
      request_id: requestId,
      asset_id: videoObject.asset_id,
      time: sourceTime,
    };

    try {
      const result =
        await invoke<FrameResult>(
          "request_preview_frame",
          {
            request,
            assets: project.assets,
          },
        );

      if (
        latestPreviewRequestRef.current !==
        requestId
      ) {
        return;
      }
      if (
        pendingPreviewAssetRef.current ===
        result.asset_id
      ) {
        pendingPreviewAssetRef.current = null;
      }
      setFrameResult(result);
    } catch (error) {
      if (
        latestPreviewRequestRef.current ===
        requestId
      ) {
        console.error(
          "Failed to request preview frame:",
          error,
        );
      }
    }
  };

  const handleSelectVideoObject = (
    videoObject: VideoObject,
  ) => {
    setSelectedVideoObjectId(videoObject.id);
    setTimelineCurrentTime(
      Math.max(0, videoObject.start),
    );
    void requestPreviewFrame(
      videoObject,
      videoObject.start,
    );
  };

  const handleSplitVideoObject = async (
    targetObject?: VideoObject | null,
    splitTimeOverride?: number,
  ) => {
    const objectToSplit =
      targetObject ?? selectedVideoObject;

    if (!objectToSplit) {
      return;
    }

    const splitPosition =
      Number.isFinite(splitTimeOverride)
        ? (splitTimeOverride as number)
        : Number.isFinite(timelineCurrentTime)
          ? timelineCurrentTime
          : objectToSplit.start;

    const objectEnd =
      objectToSplit.start +
      objectToSplit.duration;

    if (
      splitPosition <=
        objectToSplit.start ||
      splitPosition >= objectEnd
    ) {
      console.warn(
        "Split skipped: split position is outside the Video Object",
        {
          splitPosition,
          objectStart: objectToSplit.start,
          objectEnd,
        },
      );
      return;
    }

    try {

      const split =
        await invoke<SplitVideoObjects>(
          "split_video_object",
          {
            videoObject: objectToSplit,
            timelineTime: splitPosition,
          },
        );

      setProject((current) => {
        if (!current) {
          return current;
        }

        const nextProject = {
          ...current,
          timelines: current.timelines.map(
            (timeline, index) =>
              index === 0
                ? {
                    ...timeline,
                    objects: timeline.objects.flatMap(
                      (videoObject) =>
                        videoObject.id ===
                        objectToSplit.id
                          ? [
                              split.first,
                              split.second,
                            ]
                          : [videoObject],
                    ),
                  }
                : timeline,
          ),
        };
        return nextProject;
      });

      setSelectedVideoObjectId(split.second.id);
      syncPreviewToTimelineTime(timelineCurrentTime);

      console.log(
        "Split video object:",
        split,
      );
    } catch (error) {
      console.error(
        "Failed to split video object:",
        error,
      );
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

  const timelineObjects =
    project?.timelines[0]?.objects ?? [];

  const selectedVideoObject =
    timelineObjects.find(
      (videoObject) =>
        videoObject.id === selectedVideoObjectId,
    ) ?? null;

  const resolveVideoObjectAtTimelineTime = (
    time: number,
  ) => {
    const sortedObjects =
      [...timelineObjects].sort(
        (first, second) =>
          first.start - second.start,
      );

    return sortedObjects.find(
      (videoObject) =>
        time >= videoObject.start &&
        time < videoObject.start +
          videoObject.duration,
    ) ?? null;
  };

  const syncPreviewToTimelineTime = (
    time: number,
  ) => {
    const video =
      previewVideoRef.current;

    const timelineObject =
      resolveVideoObjectAtTimelineTime(
        time,
      );

    if (!timelineObject) {
        video?.pause();
      setFrameResult(null);
      return;
    }

    if (frameResult?.asset_id !== timelineObject.asset_id) {
      if (
        pendingPreviewAssetRef.current !==
        timelineObject.asset_id
      ) {
        void requestPreviewFrame(
          timelineObject,
          time,
        );
      }
      return;
    }

    if (!video) {
      return;
    }

    const sourceStart =
      Number.isFinite(
        timelineObject.source_start,
      )
        ? timelineObject.source_start
        : 0;
    const mediaTime =
      sourceStart +
      (time - timelineObject.start);
    const safeMediaTime = Number.isFinite(
      video.duration,
    )
      ? Math.min(
          mediaTime,
          video.duration,
        )
      : mediaTime;

    if (
      Math.abs(video.currentTime - safeMediaTime) >
      0.05
    ) {
      video.currentTime = safeMediaTime;
    }
  };

  useEffect(() => {
    timelineCurrentTimeRef.current =
      timelineCurrentTime;
  }, [timelineCurrentTime]);

  useEffect(() => {
    if (!previewPlaying) {
      previewPlayingRef.current = false;
      return;
    }

    previewPlayingRef.current = true;
    let animationFrameId = 0;
    let previousTimestamp =
      performance.now();

    const playbackEndTime =
      timelineObjects.length > 0
        ? Math.min(
            TIMELINE_DURATION_SECONDS,
            Math.max(
              ...timelineObjects.map(
                (videoObject) =>
                  videoObject.start +
                  videoObject.duration,
              ),
            ),
          )
        : TIMELINE_DURATION_SECONDS;

    const advanceTimeline = (
      timestamp: number,
    ) => {
      if (!previewPlayingRef.current) {
        return;
      }

      const elapsedSeconds =
        Math.max(
          0,
          (timestamp - previousTimestamp) /
            1000,
        );
      previousTimestamp = timestamp;

      const nextTime =
        Math.min(
          TIMELINE_DURATION_SECONDS,
          timelineCurrentTimeRef.current +
            elapsedSeconds,
        );

      timelineCurrentTimeRef.current =
        nextTime;
      setTimelineCurrentTime(nextTime);

      const timelineObject =
        resolveVideoObjectAtTimelineTime(
          nextTime,
        );
      const video =
        previewVideoRef.current;

      if (!timelineObject) {
        video?.pause();
        if (frameResult !== null) {
          setFrameResult(null);
        }
      } else {
        if (
          frameResult?.asset_id !==
          timelineObject.asset_id
        ) {
          if (
            pendingPreviewAssetRef.current !==
            timelineObject.asset_id
          ) {
            void requestPreviewFrame(
              timelineObject,
              nextTime,
            );
          }
        } else if (video) {
          syncPreviewToTimelineTime(nextTime);
          if (
            video.paused &&
            !video.ended &&
            !timelineScrubbingRef.current
          ) {
            void video.play().catch((error) => {
              console.error(
                "Failed to play preview:",
                error,
              );
            });
          }
        }
      }

      if (nextTime >= playbackEndTime) {
        previewPlayingRef.current = false;
        setPreviewPlaying(false);
        video?.pause();
        return;
      }

      animationFrameId =
        window.requestAnimationFrame(
          advanceTimeline,
        );
    };

    animationFrameId =
      window.requestAnimationFrame(
        advanceTimeline,
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrameId,
      );
    };
  }, [
    previewPlaying,
    timelineObjects,
    frameResult?.asset_id,
  ]);

  const applyTimelineSeek = (
    nextTime: number,
  ) => {
    previewPlayingRef.current = false;
    setPreviewPlaying(false);
    previewVideoRef.current?.pause();
    timelineCurrentTimeRef.current = nextTime;
    setTimelineCurrentTime(nextTime);
    syncPreviewToTimelineTime(nextTime);
  };

  const timelineTimeFromClientX = (
    clientX: number,
  ) => {
    const grid =
      document.querySelector<HTMLElement>(
        ".timeline-grid",
      );
    const rect =
      grid?.getBoundingClientRect();

    if (!rect || rect.width <= 0) {
      return null;
    }

    const ratio = Math.min(
      1,
      Math.max(
        0,
        (clientX - rect.left) /
          rect.width,
      ),
    );

    return ratio * TIMELINE_DURATION_SECONDS;
  };

  const setTimelineTimeFromPointer = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const timelineGrid =
      event.currentTarget.closest(
        ".timeline-grid",
      );
    const rect =
      timelineGrid?.getBoundingClientRect() ??
      event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(
        0,
        (event.clientX - rect.left) /
          rect.width,
      ),
    );
    const nextTime =
      ratio * TIMELINE_DURATION_SECONDS;

    timelineScrubbingRef.current = true;
    applyTimelineSeek(nextTime);
  };

  const handleDeleteVideoObject = (
    objectId: string,
  ) => {
    if (!project) {
      return;
    }

    setProject((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        timelines: current.timelines.map(
          (timeline, index) =>
            index === 0
              ? {
                  ...timeline,
                  objects: timeline.objects.filter(
                    (videoObject) =>
                      videoObject.id !== objectId,
                  ),
                }
              : timeline,
        ),
      };
    });

    if (selectedVideoObjectId === objectId) {
      setSelectedVideoObjectId(null);
    }

    setFrameResult(null);

    const remainingObjects =
      timelineObjects.filter(
        (videoObject) =>
          videoObject.id !== objectId,
      );
    const objectAtPlayhead =
      [...remainingObjects]
        .sort(
          (first, second) =>
            first.start - second.start,
        )
        .find(
          (videoObject) =>
            timelineCurrentTime >=
              videoObject.start &&
            timelineCurrentTime <
              videoObject.start +
                videoObject.duration,
        ) ?? null;

    if (objectAtPlayhead) {
      void requestPreviewFrame(
        objectAtPlayhead,
        timelineCurrentTime,
      );
    }
  };

  const handleTimelineContextMenuSplit = () => {
    if (!timelineContextMenu?.objectId) {
      return;
    }

    const targetObject =
      timelineObjects.find(
        (videoObject) =>
          videoObject.id ===
          timelineContextMenu.objectId,
      );

    if (!targetObject) {
      return;
    }

    const clickTime =
      timelineTimeFromClientX(
        timelineContextMenu.x,
      );

    if (clickTime === null) {
      return;
    }

    void handleSplitVideoObject(
      targetObject,
      clickTime,
    );
  };

  const togglePreviewPlayback = () => {
    if (!project) {
      return;
    }

    const video =
      previewVideoRef.current;

    if (previewPlayingRef.current) {
      video?.pause();
      previewPlayingRef.current = false;
      setPreviewPlaying(false);
      return;
    }

    if (!video) {
      const playObject =
        resolveVideoObjectAtTimelineTime(
          timelineCurrentTime,
        );
      if (playObject) {
        void requestPreviewFrame(
          playObject,
          timelineCurrentTime,
        );
      }
      previewPlayingRef.current = true;
      setPreviewPlaying(true);
      return;
    }

    syncPreviewToTimelineTime(
      timelineCurrentTime,
    );
    const playObject =
      resolveVideoObjectAtTimelineTime(
        timelineCurrentTime,
      );

    if (!playObject) {
      previewPlayingRef.current = true;
      setPreviewPlaying(true);
      return;
    }
    previewPlayingRef.current = true;
    setPreviewPlaying(true);
    void video.play().catch((error) => {
      console.error(
        "Failed to play preview:",
        error,
      );
    });
  };

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setTimelineContextMenu(null);
        return;
      }

      if (
        event.code !== "Space" ||
        event.repeat
      ) {
        return;
      }

      const target =
        event.target as HTMLElement | null;

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      togglePreviewPlayback();
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [togglePreviewPlayback]);

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
                        onClick={() => {
                          setActiveMenu(null);

                          if (
                            menu === "File" &&
                            item === "New Project"
                          ) {
                            void handleCreateProject();
                          }

                          if (
                            menu === "File" &&
                            item === "Open Project"
                          ) {
                            void handleOpenProject();
                          }

                          if (
                            menu === "File" &&
                            item === "Save"
                          ) {
                            void saveProject(false);
                          }

                          if (
                            menu === "File" &&
                            item === "Save As"
                          ) {
                            void saveProject(true);
                          }

                          if (
                            menu === "File" &&
                            item === "Import Media"
                          ) {
                            void handleImportMedia();
                          }
                        }}
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
            {project && (
              <span className="current-project-name">
                {project.name}
              </span>
            )}
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

            {project?.assets.map((asset) => (
              <div
                className="media-item"
                key={asset.id}
                title={asset.path}
              >
                <span className="media-icon video">
                  V
                </span>

                <span>{asset.filename}</span>
                <button
                  className="add-media-button"
                  type="button"
                  title="Timelineに追加"
                  onClick={() =>
                    void handleAddMediaToTimeline(asset)
                  }
                >
                  Timelineに追加
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Preview */}
        <section className="preview-area">
          <div className="preview-header">
            <span>Preview</span>
          </div>

          <div className="preview-stage">
            <div className="preview-canvas">
              {frameResult?.available && frameResult.path ? (
                <video
                  ref={previewVideoRef}
                  className="preview-video"
                  src={convertFileSrc(frameResult.path)}
                  key={frameResult.request_id}
                  muted
                  preload="metadata"
                  onError={(event) => {
                    const video = event.currentTarget;
                    console.error(
                      "Preview video load error",
                      {
                        currentSrc: video.currentSrc,
                        networkState: video.networkState,
                        readyState: video.readyState,
                        errorCode: video.error?.code,
                        errorMessage: video.error?.message,
                      },
                    );
                  }}
                  onLoadedMetadata={() => {
                    syncPreviewToTimelineTime(
                      timelineCurrentTime,
                    );
                  }}
                  onEnded={(event) => {
                    event.currentTarget.pause();
                  }}
                />
              ) : (
                <div className="preview-placeholder">
                  {timelineObjects.length > 0
                    ? "Preview unavailable"
                    : "No Video Object on Timeline"}
                </div>
              )}

              <div className="preview-footer">
                <span>
                  00:{timelineCurrentTime.toFixed(0).padStart(2, "0")}
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
                    onClick={togglePreviewPlayback}
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
                onClick={() => {
                  if (item === "分割") {
                    void handleSplitVideoObject();
                  }
                }}
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
            <div
              className="time-ruler"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(
                  event.pointerId,
                );
                setTimelineTimeFromPointer(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) {
                  setTimelineTimeFromPointer(event);
                }
              }}
              onPointerUp={(event) => {
                timelineScrubbingRef.current = false;
                if (
                  event.currentTarget.hasPointerCapture(
                    event.pointerId,
                  )
                ) {
                  event.currentTarget.releasePointerCapture(
                    event.pointerId,
                  );
                }
              }}
              onPointerCancel={() => {
                timelineScrubbingRef.current = false;
              }}
            >
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
            <div
              className="timeline-grid"
              onPointerDown={(event) => {
                const target =
                  event.target as HTMLElement;

                if (
                  target.closest(
                    ".timeline-clip, .playhead",
                  )
                ) {
                  return;
                }

                event.currentTarget.setPointerCapture(
                  event.pointerId,
                );
                setTimelineTimeFromPointer(event);
              }}
              onPointerMove={(event) => {
                if (
                  event.buttons === 1 &&
                  timelineScrubbingRef.current &&
                  !timelineObjectDragRef.current
                ) {
                  setTimelineTimeFromPointer(event);
                }
              }}
              onPointerUp={(event) => {
                timelineScrubbingRef.current = false;
                if (
                  event.currentTarget.hasPointerCapture(
                    event.pointerId,
                  )
                ) {
                  event.currentTarget.releasePointerCapture(
                    event.pointerId,
                  );
                }
              }}
              onPointerCancel={() => {
                timelineScrubbingRef.current = false;
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setTimelineContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  objectId: null,
                });
              }}
            >
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
                        <>
                          {timelineObjects.map((videoObject) => {
                            const asset =
                              project?.assets.find(
                                (item) =>
                                  item.id ===
                                  videoObject.asset_id,
                              );

                            const left =
                              Math.min(
                                100,
                                Math.max(
                                  0,
                                  (videoObject.start / 25) *
                                    100,
                                ),
                              );
                            const width =
                              Math.min(
                                100 - left,
                                Math.max(
                                  0,
                                  (videoObject.duration / 25) *
                                    100,
                                ),
                              );

                            return (
                              <div
                                className={`timeline-clip video-clip ${
                                  selectedVideoObjectId ===
                                  videoObject.id
                                    ? "selected"
                                    : ""
                                }`}
                                key={videoObject.id}
                                data-video-object-id={videoObject.id}
                                data-video-object-start={videoObject.start}
                                data-video-object-duration={videoObject.duration}
                                title={`${asset?.filename ?? "Missing Media"} | start ${videoObject.start}s | duration ${videoObject.duration}s`}
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                  event.preventDefault();
                                  event.currentTarget.setPointerCapture(
                                    event.pointerId,
                                  );
                                  timelineObjectDragRef.current = {
                                    objectId: videoObject.id,
                                    startClientX: event.clientX,
                                    initialStart: videoObject.start,
                                    initialDuration:
                                      videoObject.duration,
                                    initialSourceStart:
                                      videoObject.source_start,
                                    mode: "move",
                                  };
                                  timelineObjectDidDragRef.current = false;
                                }}
                                onPointerMove={(event) => {
                                  const drag =
                                    timelineObjectDragRef.current;

                                  if (
                                    !drag ||
                                    drag.objectId !==
                                      videoObject.id
                                  ) {
                                    return;
                                  }

                                  if (
                                    drag.mode !== "move"
                                  ) {
                                    const pointerTime =
                                      timelineTimeFromClientX(
                                        event.clientX,
                                      );

                                    if (
                                      pointerTime === null
                                    ) {
                                      return;
                                    }

                                    const edgeTime =
                                      drag.mode ===
                                      "resize-left"
                                        ? drag.initialStart
                                        : drag.initialStart +
                                          drag.initialDuration;

                                    if (
                                      Math.abs(
                                        pointerTime -
                                          edgeTime,
                                      ) < 0.02
                                    ) {
                                      return;
                                    }

                                    timelineObjectDidDragRef.current =
                                      true;

                                    const initialEnd =
                                      drag.initialStart +
                                      drag.initialDuration;

                                    let nextStart =
                                      drag.initialStart;
                                    let nextDuration =
                                      drag.initialDuration;
                                    let nextSourceStart =
                                      drag.initialSourceStart;

                                    if (
                                      drag.mode ===
                                      "resize-right"
                                    ) {
                                      const rightLimit =
                                        Math.min(
                                          TIMELINE_DURATION_SECONDS,
                                          ...timelineObjects
                                            .filter(
                                              (other) =>
                                                other.id !==
                                                  drag.objectId &&
                                                other.start >=
                                                  drag.initialStart,
                                            )
                                            .map(
                                              (other) =>
                                                other.start,
                                            ),
                                        );
                                      const newEnd = Math.min(
                                        Math.max(
                                          pointerTime,
                                          drag.initialStart +
                                            MIN_CLIP_DURATION,
                                        ),
                                        rightLimit,
                                      );
                                      nextDuration =
                                        newEnd -
                                        drag.initialStart;
                                    } else {
                                      const leftLimit = Math.max(
                                        0,
                                        drag.initialStart -
                                          drag.initialSourceStart,
                                        ...timelineObjects
                                          .filter(
                                            (other) =>
                                              other.id !==
                                                drag.objectId &&
                                              other.start <
                                                initialEnd,
                                          )
                                          .map(
                                            (other) =>
                                              other.start +
                                              other.duration,
                                          ),
                                      );
                                      nextStart = Math.min(
                                        Math.max(
                                          pointerTime,
                                          leftLimit,
                                        ),
                                        initialEnd -
                                          MIN_CLIP_DURATION,
                                      );
                                      nextDuration =
                                        initialEnd -
                                        nextStart;
                                      nextSourceStart =
                                        drag.initialSourceStart +
                                        (nextStart -
                                          drag.initialStart);
                                    }

                                    if (
                                      nextDuration <=
                                        0 ||
                                      !Number.isFinite(
                                        nextDuration,
                                      )
                                    ) {
                                      return;
                                    }

                                    setProject(
                                      (current) => {
                                        if (!current) {
                                          return current;
                                        }

                                        return {
                                          ...current,
                                          timelines:
                                            current.timelines.map(
                                              (
                                                timeline,
                                                index,
                                              ) =>
                                                index === 0
                                                  ? {
                                                      ...timeline,
                                                      objects:
                                                        timeline.objects.map(
                                                          (
                                                            object,
                                                          ) =>
                                                            object.id ===
                                                            drag.objectId
                                                              ? {
                                                                  ...object,
                                                                  start:
                                                                    nextStart,
                                                                  duration:
                                                                    nextDuration,
                                                                  source_start:
                                                                    nextSourceStart,
                                                                }
                                                              : object,
                                                        ),
                                                    }
                                                  : timeline,
                                            ),
                                        };
                                      },
                                    );
                                    return;
                                  }

                                  const grid =
                                    event.currentTarget.closest(
                                      ".timeline-grid",
                                    );
                                  const rect =
                                    grid?.getBoundingClientRect();

                                  if (!rect || rect.width <= 0) {
                                    return;
                                  }

                                  const deltaTime =
                                    ((event.clientX -
                                      drag.startClientX) /
                                      rect.width) *
                                    TIMELINE_DURATION_SECONDS;

                                  if (Math.abs(deltaTime) < 0.02) {
                                    return;
                                  }

                                  timelineObjectDidDragRef.current =
                                    true;
                                  const candidateStart =
                                    Math.max(
                                      0,
                                      Math.min(
                                        TIMELINE_DURATION_SECONDS -
                                          videoObject.duration,
                                        drag.initialStart + deltaTime,
                                      ),
                                    );
                                  const nextStart =
                                    restrictVideoObjectStartForLane(
                                      videoObject,
                                      candidateStart,
                                      videoObject.start,
                                      timelineObjects,
                                      TIMELINE_DURATION_SECONDS,
                                    );

                                  setProject((current) => {
                                    if (!current) {
                                      return current;
                                    }

                                    const nextProject = {
                                      ...current,
                                      timelines: current.timelines.map(
                                        (timeline, index) =>
                                          index === 0
                                            ? {
                                                ...timeline,
                                                objects:
                                                  timeline.objects.map(
                                                    (object) =>
                                                      object.id ===
                                                      videoObject.id
                                                        ? {
                                                            ...object,
                                                            start:
                                                              nextStart,
                                                          }
                                                        : object,
                                                  ),
                                              }
                                            : timeline,
                                      ),
                                    };
                                    return nextProject;
                                  });
                                }}
                                onPointerUp={(event) => {
                                  timelineObjectDragRef.current = null;
                                  if (
                                    event.currentTarget.hasPointerCapture(
                                      event.pointerId,
                                    )
                                  ) {
                                    event.currentTarget.releasePointerCapture(
                                      event.pointerId,
                                    );
                                  }
                                }}
                                onPointerCancel={() => {
                                  timelineObjectDragRef.current = null;
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setTimelineContextMenu({
                                    x: event.clientX,
                                    y: event.clientY,
                                    objectId: videoObject.id,
                                  });
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (
                                    timelineObjectDidDragRef.current
                                  ) {
                                    timelineObjectDidDragRef.current =
                                      false;
                                    return;
                                  }
                                  handleSelectVideoObject(
                                    videoObject,
                                  );
                                }}
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                }}
                              >
                                <span
                                  className="timeline-clip-handle timeline-clip-handle-left"
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    event.currentTarget.setPointerCapture(
                                      event.pointerId,
                                    );
                                    timelineObjectDragRef.current = {
                                      objectId: videoObject.id,
                                      startClientX: event.clientX,
                                      initialStart: videoObject.start,
                                      initialDuration:
                                        videoObject.duration,
                                      initialSourceStart:
                                        videoObject.source_start,
                                      mode: "resize-left",
                                    };
                                    timelineObjectDidDragRef.current = false;
                                  }}
                                />
                                <span
                                  className="timeline-clip-handle timeline-clip-handle-right"
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    event.currentTarget.setPointerCapture(
                                      event.pointerId,
                                    );
                                    timelineObjectDragRef.current = {
                                      objectId: videoObject.id,
                                      startClientX: event.clientX,
                                      initialStart: videoObject.start,
                                      initialDuration:
                                        videoObject.duration,
                                      initialSourceStart:
                                        videoObject.source_start,
                                      mode: "resize-right",
                                    };
                                    timelineObjectDidDragRef.current = false;
                                  }}
                                />
                                <span>
                                  {asset?.filename ?? "Missing Media"}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  ),
                )}

                {/* Playhead */}
                <div
                  className="playhead"
                  style={{
                    left: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (timelineCurrentTime /
                          TIMELINE_DURATION_SECONDS) *
                          100,
                      ),
                    )}%`,
                  }}
                >
                  <div
                    className="playhead-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(
                        event.pointerId,
                      );
                      setTimelineTimeFromPointer(
                        event as React.PointerEvent<HTMLDivElement>,
                      );
                    }}
                    onPointerMove={(event) => {
                      if (event.buttons === 1) {
                        setTimelineTimeFromPointer(
                          event as React.PointerEvent<HTMLDivElement>,
                        );
                      }
                    }}
                    onPointerUp={(event) => {
                      timelineScrubbingRef.current = false;
                      if (
                        event.currentTarget.hasPointerCapture(
                          event.pointerId,
                        )
                      ) {
                        event.currentTarget.releasePointerCapture(
                          event.pointerId,
                        );
                      }
                    }}
                    onPointerCancel={() => {
                      timelineScrubbingRef.current = false;
                    }}
                  />
                  <div className="playhead-line" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {timelineContextMenu && (
        <div
          className="timeline-context-menu"
          style={{
            left: Math.max(
              4,
              Math.min(
                timelineContextMenu.x,
                window.innerWidth - 176,
              ),
            ),
            top: Math.max(
              4,
              Math.min(
                timelineContextMenu.y,
                window.innerHeight -
                  (timelineContextMenu.objectId
                    ? 190
                    : 280),
              ),
            ),
          }}
        >
          {timelineContextMenu.objectId ? (
            <>
              <button
                className="timeline-context-menu-item"
                type="button"
                disabled
              >
                編集
              </button>
              <button
                className="timeline-context-menu-item"
                type="button"
                onClick={() => {
                  handleTimelineContextMenuSplit();
                  setTimelineContextMenu(null);
                }}
              >
                分割
              </button>
              <button
                className="timeline-context-menu-item"
                type="button"
                disabled
              >
                ロック
              </button>
              <button
                className="timeline-context-menu-item"
                type="button"
                disabled
              >
                切り取り
              </button>
              <button
                className="timeline-context-menu-item"
                type="button"
                disabled
              >
                コピー
              </button>
              <button
                className="timeline-context-menu-item"
                type="button"
                onClick={() => {
                  const objectId =
                    timelineContextMenu.objectId;
                  if (objectId) {
                    handleDeleteVideoObject(objectId);
                  }
                  setTimelineContextMenu(null);
                }}
              >
                削除
              </button>
            </>
          ) : (
            [
              "読み上げ",
              "字幕",
              "動画",
              "音声",
              "画像",
              "表情",
              "貼り付け",
              "空白を追加",
              "設定",
            ].map((item) => (
              <button
                className="timeline-context-menu-item"
                type="button"
                key={item}
                disabled
              >
                {item}
              </button>
            ))
          )}
        </div>
      )}

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