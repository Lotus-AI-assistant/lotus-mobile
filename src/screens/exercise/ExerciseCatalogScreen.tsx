import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import AppTopBar from '../../components/AppTopBar';
import AppToast from '../../components/AppToast';
import { getExerciseSegments } from '../../services/exercise';
import { ExerciseResponse, ExerciseSegmentResponse } from '../../types/exercise';
import { fetchExerciseCatalogAction } from './ExerciseCatalogScreen.actions';
import { styles } from './ExerciseCatalogScreen.styles';

let exerciseCache: ExerciseResponse[] | null = null;
let previewUrlCache: Record<number, string> = {};
let segmentCacheByExerciseId: Record<number, ExerciseSegmentResponse[]> = {};

const ExerciseCatalogScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const isUnmountedRef = useRef(false);
  const [loading, setLoading] = useState(!exerciseCache);
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Record<number, boolean>>({});
  const [previewByExerciseId, setPreviewByExerciseId] = useState<Record<number, string>>(previewUrlCache);
  const [previewTriedIds, setPreviewTriedIds] = useState<Record<number, boolean>>({});
  const [visibleExerciseIds, setVisibleExerciseIds] = useState<number[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedL1, setSelectedL1] = useState('Tümü');
  const [selectedL2, setSelectedL2] = useState('Tümü');
  const [items, setItems] = useState<ExerciseResponse[]>(exerciseCache ?? []);
  const [toast, setToast] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error',
  });

  const loadExercises = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchExerciseCatalogAction();
      exerciseCache = data;
      setItems(data);
    } catch (error: any) {
      setToast({
        visible: true,
        title: 'Hata',
        message: error?.message || 'Exercise katalogu alınamadı.',
        type: 'error',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (exerciseCache && exerciseCache.length > 0) {
      loadExercises(true);
      return;
    }
    loadExercises(false);
  }, [loadExercises]);

  const searchFiltered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, keyword]);

  const l1Options = useMemo(() => {
    const values = Array.from(
      new Set(items.map(item => (item.level1_pose || '').trim()).filter(Boolean))
    );
    return ['Tümü', ...values];
  }, [items]);

  const l2Options = useMemo(() => {
    const base =
      selectedL1 === 'Tümü'
        ? items
        : items.filter(item => (item.level1_pose || '').trim() === selectedL1);
    const values = Array.from(
      new Set(base.map(item => (item.level2_pose || '').trim()).filter(Boolean))
    );
    return ['Tümü', ...values];
  }, [items, selectedL1]);

  const filtered = useMemo(() => {
    return searchFiltered.filter(item => {
      const l1 = (item.level1_pose || '').trim();
      const l2 = (item.level2_pose || '').trim();
      const l1Match = selectedL1 === 'Tümü' || l1 === selectedL1;
      const l2Match = selectedL2 === 'Tümü' || l2 === selectedL2;
      return l1Match && l2Match;
    });
  }, [searchFiltered, selectedL1, selectedL2]);

  const toTitleCase = (value?: string | null) => {
    if (!value) return '-';
    return value
      .replace(/[-_]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    const timeoutPromise = new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise, timeoutPromise]);
  };

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    const candidates = filtered.filter(item => visibleExerciseIds.includes(item.id));
    const missing = candidates.filter(
      exercise =>
        !previewByExerciseId[exercise.id] &&
        !previewTriedIds[exercise.id]
    );
    if (missing.length === 0) return;

    const loadPreviews = async () => {
      const queue = [...missing];
      const maxConcurrent = Math.min(3, queue.length);

      const worker = async () => {
        while (queue.length > 0) {
          if (isUnmountedRef.current) return;
          const exercise = queue.shift();
          if (!exercise) return;
          setPreviewLoadingIds(prev => ({ ...prev, [exercise.id]: true }));
          setPreviewTriedIds(prev => ({ ...prev, [exercise.id]: true }));
          try {
            const segments = await withTimeout(getExerciseSegments(exercise.id, undefined, 6), 3500, []);
            segmentCacheByExerciseId[exercise.id] = segments;
            for (const segment of segments) {
              if (segment.thumbnail_url) {
                Image.prefetch(segment.thumbnail_url);
              }
            }
            const playable = segments.filter(segment => Boolean(segment.video_url && segment.video_url.trim().length > 0));
            if (isUnmountedRef.current) return;
            if (playable.length > 0) {
              const random = playable[Math.floor(Math.random() * playable.length)];
              previewUrlCache = { ...previewUrlCache, [exercise.id]: random.video_url };
              setPreviewByExerciseId(prev => ({ ...prev, [exercise.id]: random.video_url }));
            }
          } catch {
          } finally {
            if (!isUnmountedRef.current) {
              setPreviewLoadingIds(prev => ({ ...prev, [exercise.id]: false }));
            }
          }
        }
      };

      await Promise.all(Array.from({ length: maxConcurrent }, worker));
    };

    loadPreviews();
  }, [filtered, visibleExerciseIds, previewByExerciseId, previewTriedIds]);

  useEffect(() => {
    setVisibleExerciseIds(filtered.slice(0, 8).map(item => item.id));
  }, [filtered]);

  useEffect(() => {
    if (!l2Options.includes(selectedL2)) {
      setSelectedL2('Tümü');
    }
  }, [l2Options, selectedL2]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 40 });
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const ids = viewableItems
      .map((entry: any) => entry?.item?.id)
      .filter((id: unknown): id is number => typeof id === 'number');
    if (ids.length === 0) return;
    setVisibleExerciseIds(prev => Array.from(new Set([...prev, ...ids])));
  });

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
      <AppTopBar title="Exercise Katalog" onBack={() => navigation.goBack()} containerStyle={styles.topBar} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        ListHeaderComponent={(
          <View>
            <Text style={styles.subtitle}>Egzersizleri listele, seç ve segment akışını aç.</Text>
            <TextInput
              style={styles.input}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Egzersiz adı ara"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.filterTitle}>L1 Filtre</Text>
            <FlatList
              data={l1Options}
              keyExtractor={(item) => `l1-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => {
                const active = selectedL1 === item;
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setSelectedL1(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{toTitleCase(item)}</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <Text style={styles.filterTitle}>L2 Filtre</Text>
            <FlatList
              data={l2Options}
              keyExtractor={(item) => `l2-${item}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.filterRow, styles.filterRowBottom]}
              renderItem={({ item }) => {
                const active = selectedL2 === item;
                return (
                  <TouchableOpacity
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setSelectedL2(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{toTitleCase(item)}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Sonuç bulunamadı.</Text>}
        renderItem={({ item }) => {
          const previewUri = previewByExerciseId[item.id];
          const isPreviewLoading = previewLoadingIds[item.id];
          const segments = segmentCacheByExerciseId[item.id];
          const thumbnailUrl = segments?.find(segment => Boolean(segment.thumbnail_url))?.thumbnail_url ?? null;

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('ExerciseSegments', {
                exercise: item,
                initialPreviewUrl: previewUri,
                initialSegments: segmentCacheByExerciseId[item.id],
              })}
            >
              <View style={styles.previewWrap}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.previewVideo} resizeMode="cover" />
                ) : previewUri ? (
                  <View style={{ flex: 1, backgroundColor: 'transparent', width: '100%', height: '100%' }}>
                    <Video
                      source={{ uri: previewUri }}
                      style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}
                      controls={false}
                        paused={false}
                        muted={true}
                        repeat={true}
                        resizeMode="cover"
                        playInBackground={false}
                        playWhenInactive={false}
                        ignoreSilentSwitch="obey"
                        renderLoader={() => (
                          <View style={styles.previewFallback}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          </View>
                        )}
                        onError={(e) => console.log('Video error catalog:', e)}
                      />
                  </View>
                ) : (
                  <View style={styles.previewFallback}>
                    {isPreviewLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.previewFallbackText}>Önizleme Yok</Text>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.name}>{toTitleCase(item.name)}</Text>
              <Text style={styles.meta}>{toTitleCase(item.level1_pose)} • {toTitleCase(item.level2_pose)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default ExerciseCatalogScreen;
