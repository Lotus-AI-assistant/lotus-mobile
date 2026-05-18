import { getPlanExercises } from '../../services/plan';
import { getExercise } from '../../services/exercise';

export async function fetchDayExercisesAction(dailyPlanId: number) {
  return getPlanExercises(dailyPlanId);
}

export async function fetchExerciseForPlanAction(exerciseId: number) {
  return getExercise(exerciseId);
}
