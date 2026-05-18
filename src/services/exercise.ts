import { apiClient } from './api';
import { getSessionToken } from './auth';
import { ExerciseResponse, ExerciseSegmentResponse } from '../types/exercise';

function resolveToken(token?: string) {
  const authToken = token ?? getSessionToken();
  if (!authToken) {
    throw new Error('Oturum bulunamadı.');
  }
  return authToken;
}

function resolvePlayableVideoUrl(segment: ExerciseSegmentResponse) {
  const base = apiClient.API_BASE_URL.replace(/\/$/, '');
  const normalizedPath = segment.video_path?.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const raw = (segment.video_url || '').trim();

  // Android'de bazi cihazlarda r2.dev TLS handshake sorunu oldugu icin
  // videoyu backend proxy endpoint'i uzerinden oynatiyoruz.
  if (raw && raw.includes('r2.dev')) {
    return `${base}/exercises/segments/${segment.id}/stream`;
  }

  // Cloud storage gibi harici bir tam URL geldiyse her zaman onu koru.
  if (raw && /^https?:\/\//i.test(raw)) {
    // Sadece eski railway baglantisi iceriyorsa donustur
    if (raw.includes(base) && raw.includes('/media/videos/')) {
        const mediaIndex = raw.indexOf('/media/videos/');
        return `${base}${raw.substring(mediaIndex)}`;
    }
    // Geri kalan tum harici linkleri (Cloudflare vs) direkt dondur
    return raw;
  }

  if (!raw) return raw;

  // DB'de eski IP varsa, sadece media yolunu koruyup güncel API host ile birleştir.
  const mediaIndex = raw.indexOf('/media/videos/');
  if (mediaIndex >= 0) {
    return `${base}${raw.substring(mediaIndex)}`;
  }

  // Local backend/media serving yapisinda video_path'i kullan.
  if (normalizedPath) {
    return `${base}/media/videos/${normalizedPath}`;
  }

  if (raw.startsWith('/')) {
    return `${base}${raw}`;
  }

  return raw;
}

function resolvePlayableThumbnailUrl(segment: ExerciseSegmentResponse) {
  const base = apiClient.API_BASE_URL.replace(/\/$/, '');
  const raw = (segment.thumbnail_url || '').trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
}

export async function getExercises(token?: string) {
  return apiClient.request<ExerciseResponse[]>('/exercises', {
    method: 'GET',
    token: resolveToken(token),
  });
}

export async function getExercise(exerciseId: number, token?: string) {
  return apiClient.request<ExerciseResponse>(`/exercises/${exerciseId}`, {
    method: 'GET',
    token: resolveToken(token),
  });
}

export async function getExerciseSegments(exerciseId: number, token?: string, limit: number = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const segments = await apiClient.request<ExerciseSegmentResponse[]>(
    `/exercises/${exerciseId}/segments?only_active=true&require_downloaded=true&local_only=true&limit=${safeLimit}`,
    {
    method: 'GET',
    token: resolveToken(token),
    }
  );

  return segments.map(segment => ({
    ...segment,
    video_url: resolvePlayableVideoUrl(segment),
    thumbnail_url: resolvePlayableThumbnailUrl(segment),
  }));
}
