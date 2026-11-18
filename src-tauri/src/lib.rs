mod project;
mod project_file;

use project::{
    FrameRequest, FrameResult, MediaAsset, ProjectState, SplitVideoObjects, VideoObject,
};
use project_file::{load_project, save_project};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Default)]
struct CancelledFrameRequests(Mutex<std::collections::HashSet<String>>);

#[tauri::command]
fn save_project_file(project: ProjectState, path: String) -> Result<(), String> {
    save_project(&project, &path)
}

#[tauri::command]
fn load_project_file(app: tauri::AppHandle, path: String) -> Result<ProjectState, String> {
    let project = load_project(&path)?;

    for asset in &project.assets {
        if asset.availability && Path::new(&asset.path).is_file() {
            app.asset_protocol_scope()
                .allow_file(&asset.path)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(project)
}

#[tauri::command]
fn create_project(project_id: String, name: String) -> ProjectState {
    ProjectState::new(project_id, name)
}

#[tauri::command]
fn create_media_asset(app: tauri::AppHandle, path: String) -> Result<MediaAsset, String> {
    let source_path = Path::new(&path);

    if !source_path.is_file() {
        return Err(format!("Media file does not exist: {path}"));
    }

    app.asset_protocol_scope()
        .allow_file(source_path)
        .map_err(|error| error.to_string())?;

    let filename = source_path
        .file_name()
        .ok_or_else(|| format!("Media filename could not be resolved: {path}"))?
        .to_string_lossy()
        .to_string();

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    timestamp.hash(&mut hasher);

    Ok(MediaAsset {
        id: format!("asset-{timestamp:x}-{:x}", hasher.finish()),
        path,
        filename,
        availability: true,
    })
}

#[tauri::command]
fn create_video_object(asset_id: String, start: f64, duration: f64) -> Result<VideoObject, String> {
    if start < 0.0 || duration <= 0.0 {
        return Err("Video Object start and duration must be valid".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();

    let mut hasher = DefaultHasher::new();
    asset_id.hash(&mut hasher);
    timestamp.hash(&mut hasher);

    Ok(VideoObject::new(
        format!("object-{timestamp:x}-{:x}", hasher.finish()),
        asset_id,
        start,
        duration,
    ))
}

#[tauri::command]
fn split_video_object(
    video_object: VideoObject,
    timeline_time: f64,
) -> Result<SplitVideoObjects, String> {
    eprintln!(
        "[Split Trace 3] Rust split_video_object input: original_start={} original_duration={} source_start={} split_position={}",
        video_object.start,
        video_object.duration,
        video_object.source_start,
        timeline_time,
    );

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();

    let mut first_hasher = DefaultHasher::new();
    video_object.id.hash(&mut first_hasher);
    "first".hash(&mut first_hasher);
    timestamp.hash(&mut first_hasher);

    let mut second_hasher = DefaultHasher::new();
    video_object.id.hash(&mut second_hasher);
    "second".hash(&mut second_hasher);
    timestamp.hash(&mut second_hasher);

    video_object.split(
        format!("object-{timestamp:x}-{:x}", first_hasher.finish()),
        format!("object-{timestamp:x}-{:x}", second_hasher.finish()),
        timeline_time,
    )
}

#[tauri::command]
fn request_preview_frame(
    app: tauri::AppHandle,
    request: FrameRequest,
    assets: Vec<MediaAsset>,
    cancelled_requests: tauri::State<'_, CancelledFrameRequests>,
) -> Result<FrameResult, String> {
    if request.time < 0.0 {
        return Err("Preview frame time must not be negative".to_string());
    }

    let cancelled = cancelled_requests
        .0
        .lock()
        .map_err(|error| error.to_string())?;

    if cancelled.contains(&request.request_id) {
        return Ok(FrameResult {
            request_id: request.request_id.clone(),
            asset_id: request.asset_id.clone(),
            time: request.time,
            path: None,
            available: false,
        });
    }
    drop(cancelled);

    let asset = assets
        .iter()
        .find(|asset| asset.id == request.asset_id);

    let Some(asset) = asset else {
        return Ok(FrameResult {
            request_id: request.request_id.clone(),
            asset_id: request.asset_id.clone(),
            time: request.time,
            path: None,
            available: false,
        });
    };

    let source_path = Path::new(&asset.path);
    let available = asset.availability && source_path.is_file();

    if available {
        app.asset_protocol_scope()
            .allow_file(source_path)
            .map_err(|error| error.to_string())?;
    }

    Ok(FrameResult {
        request_id: request.request_id,
        asset_id: request.asset_id,
        time: request.time,
        path: if available { Some(asset.path.clone()) } else { None },
        available,
    })
}

#[tauri::command]
fn cancel_preview_frame(
    request_id: String,
    cancelled_requests: tauri::State<'_, CancelledFrameRequests>,
) -> Result<(), String> {
    let mut cancelled = cancelled_requests
        .0
        .lock()
        .map_err(|error| error.to_string())?;
    cancelled.insert(request_id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CancelledFrameRequests::default())
        .invoke_handler(tauri::generate_handler![
            create_project,
            save_project_file,
            load_project_file,
            create_media_asset,
            create_video_object,
            split_video_object,
            request_preview_frame,
            cancel_preview_frame
        ])
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
