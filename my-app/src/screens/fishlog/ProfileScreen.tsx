import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { CatchRecord } from '@/components/fishlog/types';
import { supabase } from '@/lib/supabase';
import { COLORS, formatDate } from '@/utils/fishlog-constants';

type Props = {
  currentUserId: string;
  currentUsername: string;
  onUsernameChange: (u: string) => void;
};

export default function ProfileScreen({ currentUserId, currentUsername, onUsernameChange }: Props) {
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(currentUsername);
  const [savingUsername, setSavingUsername] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: catchData }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from('catches').select('*').eq('user_id', currentUserId).eq('status', 'caught').order('caught_at', { ascending: false }),
      supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', currentUserId),
      supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUserId),
    ]);
    setCatches((catchData as CatchRecord[]) ?? []);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
    setLoading(false);
  };

  const saveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (!trimmed || trimmed === currentUsername) { setEditingUsername(false); return; }
    if (trimmed.length < 3) { Alert.alert('Błąd', 'Nazwa musi mieć min. 3 znaki.'); return; }
    setSavingUsername(true);
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', currentUserId);
    if (error) {
      Alert.alert('Błąd', error.message.includes('unique') ? 'Ta nazwa jest już zajęta.' : 'Nie udało się zapisać.');
    } else {
      onUsernameChange(trimmed);
      setEditingUsername(false);
    }
    setSavingUsername(false);
  };

  const caught = catches;
  const thisYear = new Date().getFullYear();
  const thisYearCount = caught.filter((c) => c.caught_at && new Date(c.caught_at).getFullYear() === thisYear).length;
  const speciesSet = new Set(caught.map((c) => c.species));
  const heaviest = caught.filter((c) => c.weight).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];

  const avatarLetter = currentUsername[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarLetter}>{avatarLetter}</Text>
        </View>

        {editingUsername ? (
          <View style={styles.usernameEditRow}>
            <TextInput
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              style={styles.usernameInput}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={30}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveUsername} disabled={savingUsername} activeOpacity={0.75}>
              {savingUsername ? <ActivityIndicator size="small" color="#fff" /> : <Icon.Check size={14} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingUsername(false); setUsernameDraft(currentUsername); }} activeOpacity={0.75}>
              <Icon.X size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.usernameRow} onPress={() => { setEditingUsername(true); setUsernameDraft(currentUsername); }} activeOpacity={0.8}>
            <Text style={styles.username}>{currentUsername || '—'}</Text>
            <Icon.Edit size={14} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}

        <View style={styles.socialStats}>
          <View style={styles.socialStat}>
            <Text style={styles.socialStatValue}>{followersCount}</Text>
            <Text style={styles.socialStatLabel}>obserwujących</Text>
          </View>
          <View style={styles.socialStatDivider} />
          <View style={styles.socialStat}>
            <Text style={styles.socialStatValue}>{followingCount}</Text>
            <Text style={styles.socialStatLabel}>obserwowanych</Text>
          </View>
          <View style={styles.socialStatDivider} />
          <View style={styles.socialStat}>
            <Text style={styles.socialStatValue}>{caught.length}</Text>
            <Text style={styles.socialStatLabel}>połowów</Text>
          </View>
        </View>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <StatTile label={`W ${thisYear} roku`} value={String(thisYearCount)} />
        <StatTile label="Gatunki" value={String(speciesSet.size)} />
        <StatTile
          label="Rekord"
          value={heaviest ? `${heaviest.weight} kg` : '—'}
          sub={heaviest?.species}
        />
      </View>

      {/* Catches */}
      <Text style={styles.sectionTitle}>Moje połowy</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 24 }} />
      ) : caught.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon.Fish size={32} color={COLORS.borderSecondary} />
          <Text style={styles.emptyTitle}>Brak połowów</Text>
          <Text style={styles.muted}>Dodaj swój pierwszy połów!</Text>
        </View>
      ) : (
        caught.map((c) => (
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
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      {!!sub && <Text style={styles.statSub}>{sub}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  content: { padding: 14, gap: 12, paddingBottom: 32 },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 32 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  usernameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usernameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.brandMid,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: '#F8F8F5',
  },
  saveBtn: {
    backgroundColor: COLORS.brandMid,
    borderRadius: 10,
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F0EEE6',
    borderRadius: 10,
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  socialStats: { flexDirection: 'row', alignItems: 'center', gap: 0, width: '100%', justifyContent: 'center' },
  socialStat: { flex: 1, alignItems: 'center', gap: 2 },
  socialStatValue: { fontSize: 20, fontWeight: '800', color: COLORS.brandDark },
  socialStatLabel: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600' },
  socialStatDivider: { width: 1, height: 32, backgroundColor: '#E8E6DD' },

  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.brandMid, letterSpacing: -0.5 },
  statSub: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPhoto: { width: '100%', height: 180 },
  cardBody: { padding: 14, gap: 6 },
  species: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F4F2EB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  notes: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  date: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  muted: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: '#E8E6DD', padding: 36, alignItems: 'center', gap: 10,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
});
