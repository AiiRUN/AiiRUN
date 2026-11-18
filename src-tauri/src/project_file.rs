use crate::project::ProjectState;
use std::fs;

pub fn serialize_project(project: &ProjectState) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(project)
}

pub fn deserialize_project(json: &str) -> Result<ProjectState, serde_json::Error> {
    let mut project: ProjectState = serde_json::from_str(json)?;
    project.ensure_default_timeline();
    Ok(project)
}

pub fn save_project(project: &ProjectState, path: &str) -> Result<(), String> {
    let json = serialize_project(project).map_err(|error| error.to_string())?;

    fs::write(path, json).map_err(|error| error.to_string())
}

pub fn load_project(path: &str) -> Result<ProjectState, String> {
    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;

    deserialize_project(&json).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::{MediaAsset, ProjectState, VideoObject};

    #[test]
    fn serialize_project_creates_valid_json() {
        let project = ProjectState::new("test-project".to_string(), "Test Project".to_string());

        let json = serialize_project(&project).expect("serialization failed");

        assert!(json.contains("\"project_id\": \"test-project\""));
        assert!(json.contains("\"name\": \"Test Project\""));
        assert!(json.contains("\"format_version\": 1"));
    }

    #[test]
    fn deserialize_project_restores_project() {
        let json = r#"{
            "format_version": 1,
            "project_id": "test-project",
            "name": "Test Project",
            "timelines": []
        }"#;

        let project = deserialize_project(json).expect("deserialization failed");

        assert_eq!(project.project_id, "test-project");
        assert_eq!(project.name, "Test Project");
        assert_eq!(project.format_version, 1);
        assert!(project.assets.is_empty());
        assert_eq!(project.timelines.len(), 1);
        assert!(project.timelines[0].objects.is_empty());
    }

    #[test]
    fn save_and_load_project() {
        let project = ProjectState::new(
            "roundtrip-project".to_string(),
            "Roundtrip Test".to_string(),
        );
        let mut project = project;
        project.assets.push(MediaAsset {
            id: "asset-test".to_string(),
            path: "C:\\\\Videos\\\\example.mp4".to_string(),
            filename: "example.mp4".to_string(),
            availability: true,
        });
        project.timelines[0].objects.push(VideoObject::new(
            "object-test".to_string(),
            "asset-test".to_string(),
            0.0,
            10.0,
        ));

        let path = std::env::temp_dir().join("aiirun-test.allrunproject");
        let path_string = path.to_string_lossy().to_string();

        save_project(&project, &path_string).expect("save failed");

        let loaded = load_project(&path_string).expect("load failed");

        assert_eq!(loaded.project_id, "roundtrip-project");
        assert_eq!(loaded.name, "Roundtrip Test");
        assert_eq!(loaded.format_version, 1);
        assert_eq!(loaded.assets.len(), 1);
        assert_eq!(loaded.assets[0].filename, "example.mp4");
        assert_eq!(loaded.timelines[0].objects.len(), 1);
        assert_eq!(loaded.timelines[0].objects[0].asset_id, "asset-test");

        let _ = std::fs::remove_file(path);
    }
}
