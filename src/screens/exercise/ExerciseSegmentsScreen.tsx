import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import AppTopBar from '../../components/AppTopBar';
import AppToast from '../../components/AppToast';
import { ExerciseResponse, ExerciseSegmentResponse } from '../../types/exercise';
import { fetchExerciseSegmentsAction } from './ExerciseSegmentsScreen.actions';
import { styles } from './ExerciseSegmentsScreen.styles';

const ExerciseSegmentsScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const exercise = route?.params?.exercise as ExerciseResponse;
  const initialSegments = route?.params?.initialSegments as ExerciseSegmentResponse[] | undefined;
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<ExerciseSegmentResponse[]>([]);
  const [toast, setToast] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error',
  });
  const [activePreviewSegmentId, setActivePreviewSegmentId] = useState<number | null>(null);
  const [visibleSegmentIds, setVisibleSegmentIds] = useState<number[]>([]);
  const [videoReadyBySegmentId, setVideoReadyBySegmentId] = useState<Record<number, boolean>>({});

  const loadSegments = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchExerciseSegmentsAction(exercise.id);
      setSegments(data);
      if (data.length > 0) {
        setActivePreviewSegmentId(current => {
          if (current && data.some(segment => segment.id === current)) return current;
          return data[0].id;
        });
      } else {
        setActivePreviewSegmentId(null);
      }
    } catch (error: any) {
      setToast({
        visible: true,
        title: 'Hata',
        message: error?.message || 'Segmentler alınamadı.',
        type: 'error',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [exercise.id]);

  useEffect(() => {
    if (initialSegments && initialSegments.length > 0) {
      setSegments(initialSegments);
      setActivePreviewSegmentId(initialSegments[0].id);
      setLoading(false);
      loadSegments(true);
      return;
    }
    loadSegments(false);
  }, [initialSegments, loadSegments]);

  const formatDifficulty = (difficulty?: ExerciseSegmentResponse['difficulty_level']) => {
    if (difficulty === 'beginner') return 'Başlangıç';
    if (difficulty === 'intermediate') return 'Orta';
    if (difficulty === 'advanced') return 'İleri';
    return 'Seviye Yok';
  };

  const formatDuration = (duration?: number | null) => {
    if (!duration || duration <= 0) return null;
    if (duration < 60) return `${duration}s`;
    const min = Math.floor(duration / 60);
    const sec = duration % 60;
    return sec === 0 ? `${min} dk` : `${min} dk ${sec} sn`;
  };

  const formatPose = (pose?: string | null) => {
    if (!pose) return null;
    return pose.replace(/[-_]/g, ' ');
  };

  const toTitleCase = (value?: string | null) => {
    if (!value) return '';
    return value
      .replace(/[-_]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const resolveSegmentTitle = (segment: ExerciseSegmentResponse, index: number) => {
    const exerciseName = exercise.name.trim().toLowerCase();
    const normalizedL3 = segment.l3_pose?.trim().toLowerCase();
    const normalizedTitle = segment.title?.trim().toLowerCase();
    const mappedL2 = formatPose(segment.l2_pose);
    const mappedL1 = formatPose(segment.l1_pose);

    // Eğer title/l3 ana egzersiz adı ile aynıysa tekrar görüntülememek için l2/l1'e düş.
    if (normalizedTitle && normalizedTitle !== exerciseName) return toTitleCase(segment.title);
    if (normalizedL3 && normalizedL3 !== exerciseName) return toTitleCase(segment.l3_pose) || `Poz ${index + 1}`;
    if (mappedL2) return toTitleCase(mappedL2);
    if (mappedL1) return toTitleCase(mappedL1);

    const candidates = [
      toTitleCase(segment.title || null),
      toTitleCase(segment.l3_pose),
      toTitleCase(mappedL2),
      toTitleCase(mappedL1),
    ];
    const found = candidates.find(value => typeof value === 'string' && value.trim().length > 0);
    return found ? found.trim() : `Poz ${index + 1}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <AppToast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
      <AppTopBar
        title={toTitleCase(exercise.name)}
        onBack={() => navigation.goBack()}
        containerStyle={styles.topBar}
        titleStyle={styles.pageTitle}
      />

      {(() => {
        const viewabilityConfig = { itemVisiblePercentThreshold: 40 };
        const onViewableItemsChanged = ({ viewableItems }: any) => {
          const ids = viewableItems
            .map((entry: any) => entry?.item?.id)
            .filter((id: unknown): id is number => typeof id === 'number');
          setVisibleSegmentIds(ids);
        };

        const visibleIdSet = new Set(visibleSegmentIds);
        const loader = () => (
          <View style={styles.previewFallback}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        );

        return (
      <FlatList
        data={segments}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews={true}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={<Text style={styles.emptyText}>Bu egzersiz için segment bulunamadı.</Text>}
        renderItem={({ item: segment, index }) => {
          const title = resolveSegmentTitle(segment, index);
          const duration = formatDuration(segment.duration);
          const hasPlayableVideo = Boolean(segment.video_url && segment.video_url.trim().length > 0);
          const l1Pose = formatPose(segment.l1_pose);
          const l2Pose = formatPose(segment.l2_pose);
          const l3Pose = formatPose(segment.l3_pose);
          const isPreviewActive = activePreviewSegmentId === segment.id;
          const shouldRenderPreview = isPreviewActive || visibleIdSet.has(segment.id);
          const thumbnailUrl = segment.thumbnail_url || null;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.videoTitle}>{title}</Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{formatDifficulty(segment.difficulty_level)}</Text>
                </View>
              </View>

              {duration ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>Süre</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{duration}</Text>
                </View>
              ) : null}

              <View style={styles.poseRow}>
                {l1Pose ? <Text style={styles.poseChip}>{l1Pose}</Text> : null}
                {l2Pose ? <Text style={styles.poseChip}>{l2Pose}</Text> : null}
                {l3Pose ? <Text style={styles.poseChip}>{l3Pose}</Text> : null}
              </View>

              <View style={styles.thumbnail}>
                {hasPlayableVideo ? (
                  <>
                    {thumbnailUrl && !isPreviewActive ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.videoPreview} resizeMode="cover" />
                    ) : shouldRenderPreview ? (
                      <>
                        {thumbnailUrl ? (
                          <Image source={{ uri: thumbnailUrl }} style={styles.videoPreview} resizeMode="cover" />
                        ) : null}
                        <Video
                          source={{ uri: segment.video_url }}
                          style={[
                            styles.videoPreview,
                            thumbnailUrl && !videoReadyBySegmentId[segment.id] ? { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 } : null,
                          ]}
                          controls={false}
                          paused={!isPreviewActive}
                          repeat={true}
                          muted={!isPreviewActive}
                          volume={1.0}
                          rate={1.0}
                          resizeMode="cover"
                          ignoreSilentSwitch="obey"
                          renderLoader={loader}
                          onLoadStart={() => setVideoReadyBySegmentId(prev => ({ ...prev, [segment.id]: false }))}
                          onReadyForDisplay={() => setVideoReadyBySegmentId(prev => ({ ...prev, [segment.id]: true }))}
                          onError={(e) => console.log('Segment Video error:', e)}
                        />
                      </>
                    ) : (
                      thumbnailUrl ? (
                        <Image source={{ uri: thumbnailUrl }} style={styles.videoPreview} resizeMode="cover" />
                      ) : (
                        <View style={styles.videoPreview} />
                      )
                    )}
                    <TouchableOpacity
                      style={styles.previewToggleButton}
                      activeOpacity={0.9}
                      onPress={() => setActivePreviewSegmentId(isPreviewActive ? null : segment.id)}
                    >
                      <Text style={styles.previewToggleButtonText}>{isPreviewActive ? 'Duraklat' : 'Oynat'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.previewFallback}>
                    <Text style={styles.previewFallbackText}>Bu segment için local preview bulunamadı.</Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
        );
      })()}
    </View>
  );
};

export default ExerciseSegmentsScreen;
