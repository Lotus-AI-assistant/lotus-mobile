import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppToast from '../../components/AppToast';
import AppTopBar from '../../components/AppTopBar';
import { DailyPlanResponse, PlanExerciseResponse } from '../../types/plan';
import { fetchDayExercisesAction, fetchExerciseForPlanAction } from './DayExercisesScreen.actions';
import { styles } from './DayExercisesScreen.styles';

const DayExercisesScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dailyPlan = route?.params?.dailyPlan as DailyPlanResponse;
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PlanExerciseResponse[]>([]);
  const [toast, setToast] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error',
  });

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDayExercisesAction(dailyPlan.id);
      setItems(data);
    } catch (error: any) {
      setToast({
        visible: true,
        title: 'Hata',
        message: error?.message || 'Egzersizler alınamadı.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [dailyPlan.id]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const handleOpenExercise = async (item: PlanExerciseResponse) => {
    if (!item.exercise_id) {
      return;
    }

    try {
      const exercise = await fetchExerciseForPlanAction(item.exercise_id);
      navigation.navigate('ExerciseSegments', { exercise });
    } catch (error: any) {
      setToast({
        visible: true,
        title: 'Hata',
        message: error?.message || 'Egzersiz detayi acilamadi.',
        type: 'error',
      });
    }
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds} sn`;
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    return remain > 0 ? `${minutes} dk ${remain} sn` : `${minutes} dk`;
  };

  const formatPose = (value?: string | null) => {
    if (!value) return null;
    return value
      .replace(/[-_]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <AppToast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
      <AppTopBar title={`Gün ${dailyPlan.day_index}`} onBack={() => navigation.goBack()} containerStyle={styles.topBar} />
      <Text style={styles.title}>{dailyPlan.day_name || 'Günlük Plan'}</Text>
      <Text style={styles.subtitle}>
        {dailyPlan.focus_area || 'Bugünün planı'} • {dailyPlan.estimated_minutes ? `${dailyPlan.estimated_minutes} dk` : 'Süre belirlenmedi'}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>Bu gün için planlanmış egzersiz bulunamadı.</Text>
        ) : (
          items.map((item) => {
            const isNavigable = Boolean(item.exercise_id);
            return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, isNavigable && styles.cardPressable]}
              activeOpacity={isNavigable ? 0.85 : 1}
              disabled={!isNavigable}
              onPress={() => handleOpenExercise(item)}
            >
              <View style={styles.headerRow}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{item.order_index}</Text>
                </View>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.exerciseName}>{item.exercise_name || 'Toparlanma Bloğu'}</Text>
                  <Text style={styles.exerciseMeta}>
                    {item.exercise_level1_pose || item.exercise_level2_pose
                      ? [formatPose(item.exercise_level1_pose), formatPose(item.exercise_level2_pose)].filter(Boolean).join(' • ')
                      : 'Plan notu'}
                  </Text>
                </View>
                <View style={styles.intensityPill}>
                  <Text style={styles.intensityPillText}>{item.intensity_level || '-'}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.label}>Set / Tekrar</Text>
                  <Text style={styles.value}>{item.sets ?? '-'} / {item.reps ?? '-'}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.label}>Süre</Text>
                  <Text style={styles.value}>{formatDuration(item.duration_seconds)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.label}>Dinlenme</Text>
                  <Text style={styles.value}>{formatDuration(item.rest_seconds)}</Text>
                </View>
              </View>

              {item.exercise_id ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Video Detayi</Text>
                  <Text style={styles.linkText}>Videoyu Goster</Text>
                </View>
              ) : null}

              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            </TouchableOpacity>
          )})
        )}
      </ScrollView>
    </View>
  );
};

export default DayExercisesScreen;
