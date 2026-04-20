import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatchCard } from '@/components/fishlog/CatchCard';
import { Icon } from '@/components/fishlog/icons';
import { CatchRecord } from '@/components/fishlog/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import AddCatchScreen from '@/screens/fishlog/AddCatchScreen';
import AuthScreen from '@/screens/fishlog/AuthScreen';
import CatchDetailScreen from '@/screens/fishlog/CatchDetailScreen';
import ProfileScreen from '@/screens/fishlog/ProfileScreen';
import SocialScreen from '@/screens/fishlog/SocialScreen';
import StatsScreen from '@/screens/fishlog/StatsScreen';
import { useFishlogStore } from '@/store/useFishlogStore';
import { COLORS } from '@/utils/fishlog-constants';

type Screen = 'list' | 'add' | 'edit' | 'detail' | 'stats' | 'social' | 'profile';

const TAB_SCREENS: Screen[] = ['list', 'stats', 'social', 'profile'];

export default function FishLogApp() {
  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.emptyCard}>
          <Text style={styles.setupTitle}>Brak konfiguracji Supabase</Text>
          <Text style={styles.emptyText}>
            Ustaw zmienne EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY w pliku .env,
            a potem uruchom ponownie Expo.
          </Text>
        </View>
      </View>
    );
  }

  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, statusFilter, sortBy, setSortBy, searchQuery, setSearchQuery } = useFishlogStore();
  const [screen, setScreen] = useState<Screen>('list');
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<CatchRecord | null>(null);
  const [detailItem, setDetailItem] = useState<CatchRecord | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) loadUsername(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) loadUsername(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [setCurrentUser]);

  const loadUsername = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('id', uid).single();
    if (data) setCurrentUsername((data as any).username ?? '');
  };

  const fetchCatches = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    const { data } = await supabase.from('catches').select('*').eq('user_id', currentUser.id).order('date_added', { ascending: false });
    setCatches(((data as CatchRecord[]) ?? []).map((item) => ({ ...item })));
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { fetchCatches(); }, [fetchCatches]);

  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  const deleteCatch = async (id: string) => {
    Alert.alert('Usuwanie', 'Usunąć ten połów?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive',
        onPress: async () => {
          await supabase.from('catches').delete().eq('id', id);
          setCatches((prev) => prev.filter((c) => c.id !== id));
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    let list = catches.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.species.toLowerCase().includes(q) || (c.location || '').toLowerCase().includes(q);
    });
    if (sortBy === 'weight') list.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    else list.sort((a, b) => +new Date(b.date_added) - +new Date(a.date_added));
    return list;
  }, [catches, searchQuery, sortBy, statusFilter]);

  if (!currentUser) return <AuthScreen onAuth={setCurrentUser} />;

  // Full-screen overlay screens (no tab bar)
  if (screen === 'add' || screen === 'edit') {
    return (
      <AddCatchScreen
        existing={editItem}
        userId={currentUser.id}
        onBack={() => { setScreen('list'); setEditItem(null); }}
        onSave={() => { fetchCatches(); setScreen('list'); setEditItem(null); }}
      />
    );
  }

  if (screen === 'detail' && detailItem) {
    return (
      <CatchDetailScreen
        item={detailItem}
        catches={catches}
        onBack={() => { setScreen('list'); setDetailItem(null); }}
      />
    );
  }

  const thisYear = new Date().getFullYear();
  const caughtThisYear = catches.filter(
    (c) => c.status === 'caught' && c.caught_at && new Date(c.caught_at).getFullYear() === thisYear
  ).length;
  const caughtTotal = catches.filter((c) => c.status === 'caught').length;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.brandRow}>
          <Icon.Fish size={20} color="#fff" />
          <View>
            <Text style={styles.brand}>FishLog</Text>
            <Text style={styles.brandSub}>Twój dziennik połowów</Text>
          </View>
        </View>
        <View style={styles.topActions}>
          {screen === 'list' && (
            <Pressable style={styles.addButton} onPress={() => setScreen('add')}>
              <Icon.Plus size={14} color="#fff" />
              <Text style={styles.addButtonText}>Nowy</Text>
            </Pressable>
          )}
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Icon.LogOut size={14} color="rgba(255,255,255,0.75)" />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {screen === 'stats' && <StatsScreen catches={catches} />}
        {screen === 'social' && (
          <SocialScreen currentUserId={currentUser.id} currentUsername={currentUsername} />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            currentUserId={currentUser.id}
            currentUsername={currentUsername}
            onUsernameChange={setCurrentUsername}
          />
        )}
        {screen === 'list' && (
          <ScrollView style={styles.scrollFill} contentContainerStyle={styles.contentInner}>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: COLORS.brandMid }]}>
                <Text style={styles.statValue}>{caughtThisYear}</Text>
                <Text style={styles.statLabel}>W {thisYear} roku</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: COLORS.brandDark }]}>
                <Text style={styles.statValue}>{caughtTotal}</Text>
                <Text style={styles.statLabel}>Łącznie złowionych</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Icon.Search size={14} color={COLORS.textTertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Szukaj po gatunku lub łowisku..."
                placeholderTextColor={COLORS.textTertiary}
                style={styles.search}
              />
            </View>

            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sortuj:</Text>
              <SortChip active={sortBy === 'date_added'} label="Najnowsze" onPress={() => setSortBy('date_added')} />
              <SortChip active={sortBy === 'weight'} label="Masa" onPress={() => setSortBy('weight')} />
            </View>

            <Text style={styles.counter}>{filtered.length} {filtered.length === 1 ? 'wpis' : 'wpisów'}</Text>

            {loading ? (
              <ActivityIndicator color={COLORS.brandMid} size="large" style={{ marginTop: 32 }} />
            ) : filtered.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon.Fish size={40} color={COLORS.borderSecondary} />
                <Text style={styles.emptyTitle}>Brak połowów</Text>
                <Text style={styles.emptyText}>Dodaj swój pierwszy połów!</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filtered.map((item) => (
                  <CatchCard
                    key={item.id}
                    item={item}
                    catches={catches}
                    onPress={() => { setDetailItem(item); setScreen('detail'); }}
                    onEdit={() => { setEditItem(item); setScreen('edit'); }}
                    onDelete={() => deleteCatch(item.id)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 4 }]}>
        <BottomTab
          icon={<Icon.Fish size={22} color={screen === 'list' ? COLORS.brandMid : COLORS.textTertiary} />}
          label="Połowy"
          active={screen === 'list'}
          onPress={() => setScreen('list')}
        />
        <BottomTab
          icon={<Icon.BarChart size={22} color={screen === 'stats' ? COLORS.brandMid : COLORS.textTertiary} />}
          label="Statystyki"
          active={screen === 'stats'}
          onPress={() => setScreen('stats')}
        />
        <BottomTab
          icon={<Icon.Users size={22} color={screen === 'social' ? COLORS.brandMid : COLORS.textTertiary} />}
          label="Społeczność"
          active={screen === 'social'}
          onPress={() => setScreen('social')}
        />
        <BottomTab
          icon={<Icon.User size={22} color={screen === 'profile' ? COLORS.brandMid : COLORS.textTertiary} />}
          label="Profil"
          active={screen === 'profile'}
          onPress={() => setScreen('profile')}
        />
      </View>
    </View>
  );
}

function BottomTab({ icon, label, active, onPress }: { icon: React.ReactNode; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.bottomTab} onPress={onPress}>
      {icon}
      <Text style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function SortChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.sortChip, active && styles.sortChipActive]} onPress={onPress}>
      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 16 },
  topBar: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: '#fff', fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },
  brandSub: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 1 },
  topActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.brandMid,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  logoutButton: {
    padding: 8, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1 },
  scrollFill: { flex: 1 },
  contentInner: { padding: 16, gap: 10, paddingBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, gap: 2 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#DDD9CE', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
  },
  search: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '600' },
  sortChip: {
    borderWidth: 1, borderColor: '#DDD9CE', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff',
  },
  sortChipActive: { borderColor: COLORS.brandDark, backgroundColor: COLORS.brandDark },
  sortChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  sortChipTextActive: { color: '#fff', fontWeight: '700' },
  counter: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '500' },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: '#E8E6DD', padding: 32, alignItems: 'center', gap: 10,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
  setupTitle: { color: COLORS.brandDark, fontWeight: '700', fontSize: 18, marginBottom: 8 },
  list: { gap: 10 },
  // Bottom tab bar
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8E6DD',
    paddingTop: 8,
  },
  bottomTab: { flex: 1, alignItems: 'center', gap: 3 },
  bottomTabLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary },
  bottomTabLabelActive: { color: COLORS.brandMid, fontWeight: '700' },
});
