import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { CatchRecord } from '@/components/fishlog/types';
import { supabase } from '@/lib/supabase';
import { COLORS, formatDate } from '@/utils/fishlog-constants';

type Profile = { id: string; username: string };
type FollowRow = { following_id: string; profiles: Profile };
type Props = { currentUserId: string };

type View_ = 'feed' | 'search' | 'profile';

export default function SocialScreen({ currentUserId }: Props) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>('feed');
  const [following, setFollowing] = useState<FollowRow[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const [profileUser, setProfileUser] = useState<Profile | null>(null);
  const [profileCatches, setProfileCatches] = useState<CatchRecord[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFollowing();
  }, []);

  const loadFollowing = async () => {
    setLoadingFeed(true);
    const { data } = await supabase
      .from('user_follows')
      .select('following_id, profiles!user_follows_following_id_fkey(id, username)')
      .eq('follower_id', currentUserId)
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as any[];
    setFollowing(rows.map((r) => ({ following_id: r.following_id, profiles: r.profiles })));
    setFollowedIds(new Set(rows.map((r) => r.following_id)));
    setLoadingFeed(false);
  };

  const doSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${q.trim()}%`)
      .neq('id', currentUserId)
      .limit(20);
    setSearchResults((data as Profile[]) ?? []);
    setSearching(false);
  };

  const follow = async (uid: string) => {
    await supabase.from('user_follows').insert({ follower_id: currentUserId, following_id: uid });
    setFollowedIds((prev) => new Set([...prev, uid]));
    loadFollowing();
  };

  const unfollow = async (uid: string) => {
    await supabase.from('user_follows').delete().eq('follower_id', currentUserId).eq('following_id', uid);
    setFollowedIds((prev) => { const s = new Set(prev); s.delete(uid); return s; });
    setFollowing((prev) => prev.filter((r) => r.following_id !== uid));
  };

  const openProfile = async (profile: Profile) => {
    setProfileUser(profile);
    setView('profile');
    setLoadingProfile(true);
    const { data } = await supabase
      .from('catches')
      .select('*')
      .eq('user_id', profile.id)
      .eq('status', 'caught')
      .order('caught_at', { ascending: false });
    setProfileCatches((data as CatchRecord[]) ?? []);
    setLoadingProfile(false);
  };

  const avatarLetter = (username: string) => username[0]?.toUpperCase() ?? '?';

  // ── Profile view ────────────────────────────────────────────────────────────
  if (view === 'profile' && profileUser) {
    const isFollowed = followedIds.has(profileUser.id);
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backBtn} onPress={() => setView('feed')}>
            <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.backBtnText}>Społeczność</Text>
          </Pressable>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLetterLarge}>{avatarLetter(profileUser.username)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{profileUser.username}</Text>
              <Text style={styles.headerSub}>
                {profileCatches.length} {profileCatches.length === 1 ? 'połów' : 'połowów'}
              </Text>
            </View>
            <Pressable
              style={[styles.followBtn, isFollowed && styles.followBtnActive]}
              onPress={() => isFollowed ? unfollow(profileUser.id) : follow(profileUser.id)}
            >
              {isFollowed
                ? <Icon.Check size={14} color={COLORS.brandMid} />
                : <Icon.Users size={14} color="#fff" />}
              <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                {isFollowed ? 'Obserwujesz' : 'Obserwuj'}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loadingProfile ? (
            <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
          ) : profileCatches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon.Fish size={32} color={COLORS.borderSecondary} />
              <Text style={styles.emptyTitle}>Brak połowów</Text>
            </View>
          ) : (
            profileCatches.map((c) => (
              <View key={c.id} style={styles.card}>
                {!!c.photo_url && (
                  <Image source={{ uri: c.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.species}>{c.species}</Text>
                  <View style={styles.metaRow}>
                    {!!c.weight && (
                      <View style={styles.metaChip}>
                        <Icon.Scale size={11} color={COLORS.textTertiary} />
                        <Text style={styles.metaText}>{c.weight} kg</Text>
                      </View>
                    )}
                    {!!c.length && (
                      <View style={styles.metaChip}>
                        <Icon.Ruler size={11} color={COLORS.textTertiary} />
                        <Text style={styles.metaText}>{c.length} cm</Text>
                      </View>
                    )}
                    {!!c.location && (
                      <View style={styles.metaChip}>
                        <Icon.Map size={11} color={COLORS.textTertiary} />
                        <Text style={styles.metaText}>{c.location}</Text>
                      </View>
                    )}
                  </View>
                  {!!c.rating && <StarRating value={c.rating} readOnly size={14} />}
                  {!!c.notes && <Text style={styles.notes}>{c.notes}</Text>}
                  <Text style={styles.date}>{formatDate(c.caught_at)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Main social view (feed + search) ────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTitleRow}>
          <Icon.Users size={18} color="#fff" />
          <Text style={styles.headerTitle}>Społeczność</Text>
        </View>
        <Text style={styles.headerSub}>Obserwuj innych wędkarzy</Text>
      </View>

      <View style={styles.tabs}>
        <TabBtn active={view === 'feed'} label={`Obserwowani (${following.length})`} onPress={() => setView('feed')} />
        <TabBtn active={view === 'search'} label="Szukaj" onPress={() => setView('search')} />
      </View>

      {view === 'search' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <Icon.Search size={14} color={COLORS.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={doSearch}
              placeholder="Szukaj po nazwie użytkownika..."
              placeholderTextColor={COLORS.textTertiary}
              style={styles.searchInput}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={COLORS.brandMid} />}
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {searchQuery.trim().length < 2 ? (
              <View style={styles.emptyCard}>
                <Icon.Search size={28} color={COLORS.borderSecondary} />
                <Text style={styles.emptyTitle}>Wpisz min. 2 znaki</Text>
              </View>
            ) : searchResults.length === 0 && !searching ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nie znaleziono</Text>
              </View>
            ) : (
              searchResults.map((p) => {
                const isF = followedIds.has(p.id);
                return (
                  <Pressable key={p.id} style={styles.card} onPress={() => openProfile(p)}>
                    <View style={styles.userRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarLetter}>{avatarLetter(p.username)}</Text>
                      </View>
                      <Text style={[styles.species, { flex: 1 }]}>{p.username}</Text>
                      <Pressable
                        style={[styles.followBtn, isF && styles.followBtnActive]}
                        onPress={(e) => { e.stopPropagation(); isF ? unfollow(p.id) : follow(p.id); }}
                      >
                        {isF
                          ? <Icon.Check size={13} color={COLORS.brandMid} />
                          : <Icon.Plus size={13} color="#fff" />}
                        <Text style={[styles.followBtnText, isF && styles.followBtnTextActive]}>
                          {isF ? 'Obserwujesz' : 'Obserwuj'}
                        </Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {loadingFeed ? (
            <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
          ) : following.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon.Users size={32} color={COLORS.borderSecondary} />
              <Text style={styles.emptyTitle}>Nie obserwujesz nikogo</Text>
              <Text style={styles.muted}>Przejdź do zakładki "Szukaj" aby znaleźć wędkarzy.</Text>
            </View>
          ) : (
            following.map((r) => (
              <Pressable key={r.following_id} style={styles.card} onPress={() => openProfile(r.profiles)}>
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>{avatarLetter(r.profiles?.username ?? '?')}</Text>
                  </View>
                  <Text style={[styles.species, { flex: 1 }]}>{r.profiles?.username ?? r.following_id.slice(0, 8)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Icon.ChevronRight size={16} color={COLORS.textTertiary} />
                    <Pressable
                      style={styles.unfollowBtn}
                      onPress={(e) => { e.stopPropagation(); unfollow(r.following_id); }}
                    >
                      <Text style={styles.unfollowText}>Usuń</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function TabBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  header: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 4,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 6 },
  backBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 4,
  },
  tabButton: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabButtonActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabButtonText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  tabButtonTextActive: { color: '#fff', fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    borderWidth: 1.5,
    borderColor: '#DDD9CE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  content: { padding: 14, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPhoto: { width: '100%', height: 160 },
  cardBody: { padding: 14, gap: 6 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 18 },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetterLarge: { color: '#fff', fontWeight: '800', fontSize: 24 },
  species: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F4F2EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  notes: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  date: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  muted: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.brandMid,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followBtnActive: {
    backgroundColor: '#E6F1FB',
    borderWidth: 1.5,
    borderColor: COLORS.brandMid,
  },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  followBtnTextActive: { color: COLORS.brandMid },
  unfollowBtn: {
    borderWidth: 1,
    borderColor: '#F7C1C1',
    backgroundColor: '#FCEBEB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unfollowText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 36,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
});
