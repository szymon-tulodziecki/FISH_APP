import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { CatchRecord } from '@/components/fishlog/types';
import { supabase } from '@/lib/supabase';
import { COLORS, formatDate } from '@/utils/fishlog-constants';

type Props = { currentUserId: string; onBack: () => void };
type FollowRow = { following_id: string; created_at: string };

export default function FollowingScreen({ currentUserId, onBack }: Props) {
  const [rows, setRows] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userCatches, setUserCatches] = useState<CatchRecord[]>([]);
  const [loadingCatches, setLoadingCatches] = useState(false);
  const [addMsg, setAddMsg] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', currentUserId)
      .order('created_at', { ascending: false });
    setRows((data as FollowRow[]) ?? []);
    setLoading(false);
  };

  const unfollow = async (uid: string) => {
    await supabase.from('user_follows').delete().eq('follower_id', currentUserId).eq('following_id', uid);
    setRows((prev) => prev.filter((x) => x.following_id !== uid));
    if (selectedUser === uid) setSelectedUser(null);
  };

  const openUserCatches = async (uid: string) => {
    setSelectedUser(uid);
    setLoadingCatches(true);
    const { data } = await supabase
      .from('catches').select('*').eq('user_id', uid).eq('status', 'caught').order('caught_at', { ascending: false });
    setUserCatches((data as CatchRecord[]) ?? []);
    setLoadingCatches(false);
  };

  const addToMyList = async (c: CatchRecord) => {
    const { error } = await supabase.from('catches').insert([{
      user_id: currentUserId,
      species: c.species,
      status: 'want_to_catch',
      location: c.location,
      water_type: c.water_type,
      bait: c.bait,
    }]);
    if (!error) {
      setAddMsg((prev) => ({ ...prev, [c.id]: true }));
      setTimeout(() => setAddMsg((prev) => { const n = { ...prev }; delete n[c.id]; return n; }), 2000);
    }
  };

  const shortUid = (uid: string) => uid.slice(0, 8);

  if (selectedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => setSelectedUser(null)}>
            <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.backBtnText}>Obserwowani</Text>
          </Pressable>
          <Text style={styles.headerTitle}>angler_{shortUid(selectedUser)}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {loadingCatches ? (
            <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
          ) : userCatches.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.muted}>Brak połowów.</Text></View>
          ) : (
            userCatches.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.species}>{c.species}</Text>
                    {!!c.location && (
                      <View style={styles.infoRow}>
                        <Icon.Map size={11} color={COLORS.textTertiary} />
                        <Text style={styles.muted}>{c.location}</Text>
                      </View>
                    )}
                    {!!c.weight && (
                      <View style={styles.infoRow}>
                        <Icon.Scale size={11} color={COLORS.textTertiary} />
                        <Text style={styles.muted}>{c.weight} kg{c.length ? ` · ${c.length} cm` : ''}</Text>
                      </View>
                    )}
                    <StarRating value={c.rating || 0} readOnly size={14} />
                    <Text style={styles.date}>{formatDate(c.caught_at)}</Text>
                  </View>
                  <Pressable style={styles.addBtn} onPress={() => addToMyList(c)}>
                    <Text style={styles.addBtnText}>{addMsg[c.id] ? 'Dodano' : '+ Dodaj'}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backBtnText}>Połowy</Text>
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Icon.Users size={18} color="#fff" />
          <Text style={styles.headerTitle}>Obserwowani</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon.Users size={32} color={COLORS.borderSecondary} />
            <Text style={styles.emptyTitle}>Nie obserwujesz nikogo</Text>
            <Text style={styles.muted}>Znajdź wędkarzy w szczegółach połowów.</Text>
          </View>
        ) : (
          rows.map((r) => (
            <Pressable key={r.following_id} style={styles.card} onPress={() => openUserCatches(r.following_id)}>
              <View style={styles.rowBetween}>
                <View style={styles.anglerInfo}>
                  <View style={styles.anglerAvatar}>
                    <Icon.Users size={16} color={COLORS.brandMid} />
                  </View>
                  <View>
                    <Text style={styles.species}>angler_{shortUid(r.following_id)}</Text>
                    <Text style={styles.date}>Od {formatDate(r.created_at)}</Text>
                  </View>
                </View>
                <Pressable style={styles.unfollowBtn} onPress={() => unfollow(r.following_id)}>
                  <Text style={styles.unfollowText}>Usuń</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  header: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  anglerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  anglerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  species: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 },
  date: { color: COLORS.textTertiary, fontSize: 12 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.brandMid,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#E6F1FB',
  },
  addBtnText: { color: COLORS.brandMid, fontWeight: '700', fontSize: 12 },
  unfollowBtn: {
    borderWidth: 1,
    borderColor: '#F7C1C1',
    backgroundColor: '#FCEBEB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unfollowText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
});
