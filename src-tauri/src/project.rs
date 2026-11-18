use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    pub format_version: u32,
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub timelines: Vec<TimelineState>,
    #[serde(default)]
    pub assets: Vec<MediaAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineState {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub objects: Vec<VideoObject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub availability: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoObject {
    pub id: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub asset_id: String,
    pub start: f64,
    pub duration: f64,
    #[serde(default)]
    pub source_start: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitVideoObjects {
    pub first: VideoObject,
    pub second: VideoObject,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameRequest {
    pub request_id: String,
    pub asset_id: String,
    pub time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameResult {
    pub request_id: String,
    pub asset_id: String,
    pub time: f64,
    pub path: Option<String>,
    pub available: bool,
}

impl ProjectState {
    pub fn new(project_id: String, name: String) -> Self {
        Self {
            format_version: 1,
            project_id,
            name,
            timelines: vec![TimelineState::new(
                "sequence-01".to_string(),
                "Sequence 01".to_string(),
            )],
            assets: Vec::new(),
        }
    }

    pub fn ensure_default_timeline(&mut self) {
        if self.timelines.is_empty() {
            self.timelines.push(TimelineState::new(
                "sequence-01".to_string(),
                "Sequence 01".to_string(),
            ));
        }
    }
}

impl TimelineState {
    pub fn new(id: String, name: String) -> Self {
        Self {
            id,
            name,
            objects: Vec::new(),
        }
    }
}

impl VideoObject {
    pub fn new(id: String, asset_id: String, start: f64, duration: f64) -> Self {
        Self {
            id,
            object_type: "video".to_string(),
            asset_id,
            start,
            duration,
            source_start: 0.0,
        }
    }

    pub fn split(
        &self,
        first_id: String,
        second_id: String,
        timeline_time: f64,
    ) -> Result<SplitVideoObjects, String> {
        if !self.start.is_finite()
            || !self.duration.is_finite()
            || !timeline_time.is_finite()
        {
            return Err("Split time and Video Object range must be finite".to_string());
        }

        if self.start < 0.0 || self.duration <= 0.0 {
            return Err("Video Object start and duration must be valid".to_string());
        }

        let object_end = self.start + self.duration;
        let split_offset = timeline_time - self.start;

        if split_offset <= 0.0 || split_offset >= self.duration {
            return Err("Split time must be inside the Video Object".to_string());
        }

        let split_time = self.start + split_offset;
        let second_duration = self.duration - split_offset;

        eprintln!(
            "[Split Trace 4] VideoObject::split input/calculation: original_start={} original_duration={} split_position={} split_offset={} first_start={} first_duration={} second_start={} second_duration={} first_end={} second_end={} object_end={} source_start={}",
            self.start,
            self.duration,
            timeline_time,
            split_offset,
            self.start,
            split_offset,
            split_time,
            second_duration,
            self.start + split_offset,
            split_time + second_duration,
            object_end,
            self.source_start,
        );

        let mut first = VideoObject::new(
            first_id,
            self.asset_id.clone(),
            self.start,
            split_offset,
        );
        first.source_start = self.source_start;

        let mut second = VideoObject::new(
            second_id,
            self.asset_id.clone(),
            split_time,
            second_duration,
        );
        second.source_start =
            self.source_start + split_offset;

        if (first.start + first.duration) != second.start {
            return Err("Split time produced inconsistent Timeline ranges".to_string());
        }
        let end_error = ((second.start + second.duration) - object_end).abs();
        let end_tolerance =
            f64::EPSILON * 8.0
                * (object_end.abs().max(second.start.abs().max(second.duration.abs())));
        if end_error > end_tolerance {
            return Err("Split produced inconsistent Video Object duration".to_string());
        }

        Ok(SplitVideoObjects { first, second })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_video_object_result_has_correct_ranges_and_source_references() {
        let video = VideoObject {
            id: "object-1".to_string(),
            object_type: "video".to_string(),
            asset_id: "asset-1".to_string(),
            start: 2.0,
            duration: 10.0,
            source_start: 1.0,
        };

        let split_time = 6.0;
        let split = video.split(
            "object-1-first".to_string(),
            "object-1-second".to_string(),
            split_time,
        ).expect("split failed");

        assert_eq!(split.first.start, 2.0);
        assert_eq!(split.first.duration, 4.0);
        assert_eq!(split.first.source_start, 1.0);
        assert_eq!(split.second.start, 6.0);
        assert_eq!(split.second.duration, 6.0);
        assert_eq!(split.second.source_start, 5.0);
        assert_eq!(split.first.asset_id, split.second.asset_id);
        assert_ne!(split.first.id, split.second.id);
    }

    #[test]
    fn split_video_object_rejects_start_and_end_boundaries() {
        let video = VideoObject::new(
            "object-1".to_string(),
            "asset-1".to_string(),
            2.0,
            10.0,
        );

        assert!(video.split(
            "first".to_string(),
            "second".to_string(),
            2.0,
        ).is_err());
        assert!(video.split(
            "first".to_string(),
            "second".to_string(),
            12.0,
        ).is_err());
    }

    #[test]
    fn split_video_object_keeps_adjacent_timeline_ranges_continuous() {
        let video = VideoObject::new(
            "object-1".to_string(),
            "asset-1".to_string(),
            0.0,
            10.0,
        );

        let split = video.split(
            "object-1-first".to_string(),
            "object-1-second".to_string(),
            5.0,
        ).expect("split failed");

        assert_eq!(split.first.start, 0.0);
        assert_eq!(split.first.duration, 5.0);
        assert_eq!(split.first.source_start, 0.0);
        assert_eq!(split.second.start, 5.0);
        assert_eq!(split.second.duration, 5.0);
        assert_eq!(split.second.source_start, 5.0);
        assert_eq!(
            split.first.start + split.first.duration,
            split.second.start,
        );
        assert_eq!(
            split.second.start + split.second.duration,
            10.0,
        );
        assert_eq!(split.first.asset_id, "asset-1");
        assert_eq!(split.second.asset_id, "asset-1");
    }

    #[test]
    fn split_video_object_keeps_shifted_ranges_and_source_start_continuous() {
        let video = VideoObject {
            id: "object-measured".to_string(),
            object_type: "video".to_string(),
            asset_id: "asset-measured".to_string(),
            start: 2.5,
            duration: 9.4,
            source_start: 7.25,
        };

        let split_position = 3.400577679281027;
        let split = video.split(
            "object-measured-first".to_string(),
            "object-measured-second".to_string(),
            split_position,
        ).expect("split failed");

        let first_duration = split_position - video.start;
        let second_duration = video.duration - first_duration;

        assert_eq!(split.first.start, 2.5);
        assert_eq!(split.first.duration, first_duration);
        assert_eq!(split.first.source_start, 7.25);
        assert_eq!(split.second.start, split_position);
        assert_eq!(split.second.duration, second_duration);
        assert_eq!(
            split.second.source_start,
            video.source_start + first_duration,
        );
        assert_eq!(
            split.first.start + split.first.duration,
            split.second.start,
        );
        let original_end = video.start + video.duration;
        let split_end = split.second.start + split.second.duration;
        assert!((split_end - original_end).abs() < f64::EPSILON * 32.0);
        let split_duration_sum =
            split.first.duration + split.second.duration;
        assert!(
            (split_duration_sum - video.duration).abs()
                < f64::EPSILON * 32.0
        );
    }

    #[test]
    fn split_video_object_rejects_non_finite_values() {
        let video = VideoObject::new(
            "object-1".to_string(),
            "asset-1".to_string(),
            0.0,
            10.0,
        );

        assert!(video.split(
            "first".to_string(),
            "second".to_string(),
            f64::NAN,
        ).is_err());
        assert!(video.split(
            "first".to_string(),
            "second".to_string(),
            f64::INFINITY,
        ).is_err());
    }
}
