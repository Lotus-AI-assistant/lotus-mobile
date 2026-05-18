import { generateWeeklyPlan, getWeeklyPlans } from '../../services/plan';

function toISODate(date: Date) {
  return date.toISOString().split('T')[0];
}

export async function fetchWeeklyPlansAction() {
  return getWeeklyPlans();
}

export async function generatePersonalizedWeeklyPlanAction() {
  const start = new Date();
  return generateWeeklyPlan({
    start_date: toISODate(start),
    replace_existing_draft: false,
  });
}
