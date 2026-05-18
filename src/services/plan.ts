import { getSessionToken } from './auth';
import { apiClient } from './api';
import { DailyPlanResponse, GenerateWeeklyPlanResponse, PlanExerciseResponse, WeeklyPlanResponse } from '../types/plan';

type CreateWeeklyPlanPayload = {
  title: string;
  goal?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
};

function resolveToken(token?: string) {
  const authToken = token ?? getSessionToken();
  if (!authToken) {
    throw new Error('Oturum bulunamadı.');
  }
  return authToken;
}

export async function getWeeklyPlans(token?: string) {
  return apiClient.request<WeeklyPlanResponse[]>('/plans/weekly', {
    method: 'GET',
    token: resolveToken(token),
  });
}

export async function createWeeklyPlan(payload: CreateWeeklyPlanPayload, token?: string) {
  return apiClient.request<WeeklyPlanResponse>('/plans/weekly', {
    method: 'POST',
    token: resolveToken(token),
    body: payload,
  });
}

export async function generateWeeklyPlan(
  payload: { start_date?: string; replace_existing_draft?: boolean } = {},
  token?: string
) {
  return apiClient.request<GenerateWeeklyPlanResponse>('/plans/weekly/generate', {
    method: 'POST',
    token: resolveToken(token),
    body: payload,
  });
}

export async function getDailyPlans(weeklyPlanId: number, token?: string) {
  return apiClient.request<DailyPlanResponse[]>(`/plans/weekly/${weeklyPlanId}/days`, {
    method: 'GET',
    token: resolveToken(token),
  });
}

export async function getPlanExercises(dailyPlanId: number, token?: string) {
  return apiClient.request<PlanExerciseResponse[]>(`/plans/days/${dailyPlanId}/exercises`, {
    method: 'GET',
    token: resolveToken(token),
  });
}
