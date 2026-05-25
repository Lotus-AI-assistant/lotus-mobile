export interface ExerciseResponse {
  id: number;
  external_pose_id: number;
  name: string;
  level1_id?: number | null;
  level1_pose?: string | null;
  level2_id?: number | null;
  level2_pose?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseSegmentResponse {
  id: number;
  exercise_id: number;
  external_sequence_id: number;
  url_id?: number | null;
  video_url: string;
  video_path?: string | null;
  thumbnail_url?: string | null;
  original_youtube_url?: string | null;
  title?: string | null;
  frame_start: number;
  frame_end: number;
  sequence_duration?: number | null;
  start_time?: number | null;
  end_time?: number | null;
  duration?: number | null;
  source_id?: number | null;
  source?: string | null;
  collector_id?: number | null;
  split?: string | null;
  l1_pose?: string | null;
  l2_pose?: string | null;
  l3_pose?: string | null;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null;
  is_active?: boolean;
  download_status?: string;
  created_at: string;
}
