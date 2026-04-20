import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Profile = { id: string; username: string };
type FollowRow = { following_id: string; profiles: Profile };
type Comment = { id: string; user_id: string; username: string; content: string; created_at: string };
type CatchSocial = {
  likeCount: number;
  liked: boolean;
  comments: Comment[];
  showComments: boolean;
  commentDraft: string;
  sendingComment: boolean;
};

type Props = { currentUserId: string; currentUsername: string; onBack: () => void };
type ViewMode = 'feed' | 'search' | 'profile';

export default function SocialScreen({ currentUserId, currentUsername, onBack }: Props) {
  const [view, setView] = useState<ViewMode>('feed');
  const [following, setFollowing] = useState<FollowRow[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [profileUser, setProfileUser] = useState<Profile | null>(null);
  const [profileCatches, setProfileCatches] = useState<CatchRecord[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  // social state per catch
  const [social, setSocial] = useState<Record<string, CatchSocial>>({});

  useEffect(() => { loadFollowing(); }, []);

  const loadFollowing = async () => {
    setLoadingFeed(true);
    const { data: followData } = await supabase
      .from('user_follows').select('following_id, created_at')
      .eq('follower_id', currentUserId).order('created_at', { ascending: false });
    const follows = (followData ?? []) as { following_id: string; created_at: string }[];
    const ids = follows.map((r) => r.following_id);
    setFollowedIds(new Set(ids));
    if (ids.length === 0) { setFollowing([]); setLoadingFeed(false); return; }
    const { data: profileData } = await supabase.from('profiles').select('id, username').in('id', ids);
    const pm: Record<string, Profile> = {};
    ((profileData ?? []) as Profile[]).forEach((p) => { pm[p.id] = p; });
    setFollowing(follows.map((r) => ({
      following_id: r.following_id,
      profiles: pm[r.following_id] ?? { id: r.following_id, username: r.following_id.slice(0, 8) },
    })));
    setLoadingFeed(false);
  };

  const doSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length === 0) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from('profiles').select('id, username')
        .ilike('username', `%${q.trim()}%`).neq('id', currentUserId).order('username').limit(30);
      if (!error) setSearchResults((data as Profile[]) ?? []);
      setSearching(false);
    }, 300);
  };

  const follow = async (uid: string) => {
    if (followingInProgress.has(uid)) return;
    setFollowingInProgress((p) => new Set([...p, uid]));
    const { error } = await supabase.from('user_follows').insert({ follower_id: currentUserId, following_id: uid });
    if (error) Alert.alert('Błąd', 'Nie można zaobserwować. Spróbuj ponownie.');
    else { setFollowedIds((prev) => new Set([...prev, uid])); await loadFollowing(); }
    setFollowingInProgress((p) => { const s = new Set(p); s.delete(uid); return s; });
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
    setSocial({});
    const { data } = await supabase.from('catches').select('*')
      .eq('user_id', profile.id).eq('status', 'caught').order('caught_at', { ascending: false });
    const catches = (data as CatchRecord[]) ?? [];
    setProfileCatches(catches);
    setLoadingProfile(false);
    if (catches.length > 0) loadSocialForCatches(catches.map((c) => c.id));
  };

  const loadSocialForCatches = async (catchIds: string[]) => {
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from('catch_likes').select('catch_id, user_id').in('catch_id', catchIds),
      supabase.from('catch_comments').select('*').in('catch_id', catchIds).order('created_at', { ascending: true }),
    ]);
    setSocial((prev) => {
      const next = { ...prev };
      catchIds.forEach((cid) => {
        const catchLikes = (likes ?? []).filter((l: any) => l.catch_id === cid);
        const catchComments = (comments ?? []).filter((c: any) => c.catch_id === cid) as Comment[];
        next[cid] = {
          likeCount: catchLikes.length,
          liked: catchLikes.some((l: any) => l.user_id === currentUserId),
          comments: catchComments,
          showComments: prev[cid]?.showComments ?? false,
          commentDraft: prev[cid]?.commentDraft ?? '',
          sendingComment: false,
        };
      });
      return next;
    });
  };

  const toggleLike = async (catchId: string) => {
    const s = social[catchId];
    if (!s) return;
    const wasLiked = s.liked;
    setSocial((prev) => ({
      ...prev,
      [catchId]: { ...prev[catchId], liked: !wasLiked, likeCount: wasLiked ? s.likeCount - 1 : s.likeCount + 1 },
    }));
    if (wasLiked) {
      await supabase.from('catch_likes').delete().eq('catch_id', catchId).eq('user_id', currentUserId);
    } else {
      const { error } = await supabase.from('catch_likes').insert({ catch_id: catchId, user_id: currentUserId });
      if (error) {
        setSocial((prev) => ({
          ...prev,
          [catchId]: { ...prev[catchId], liked: wasLiked, likeCount: s.likeCount },
        }));
      }
    }
  };

  const toggleComments = (catchId: string) => {
    setSocial((prev) => ({
      ...prev,
      [catchId]: { ...prev[catchId], showComments: !prev[catchId]?.showComments },
    }));
  };

  const updateDraft = (catchId: string, text: string) => {
    setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], commentDraft: text } }));
  };

  const sendComment = async (catchId: string) => {
    const s = social[catchId];
    const content = s?.commentDraft?.trim();
    if (!content) return;
    setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], sendingComment: true } }));
    const { data, error } = await supabase.from('catch_comments').insert({
      catch_id: catchId,
      user_id: currentUserId,
      username: currentUsername,
      content,
    }).select().single();
    if (error) {
      Alert.alert('Błąd', 'Nie udało się dodać komentarza.');
      setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], sendingComment: false } }));
    } else {
      setSocial((prev) => ({
        ...prev,
        [catchId]: {
          ...prev[catchId],
          comments: [...prev[catchId].comments, data as Comment],
          commentDraft: '',
          sendingComment: false,
        },
      }));
    }
  };

  const deleteComment = async (catchId: string, commentId: string) => {
    await supabase.from('catch_comments').delete().eq('id', commentId);
    setSocial((prev) => ({
      ...prev,
      [catchId]: { ...prev[catchId], comments: prev[catchId].comments.filter((c) => c.id !== commentId) },
    }));
  };

  const avatarLetter = (username: string) => username[0]?.toUpperCase() ?? '?';

  // ── Profile view ──────────────────────────────────────────────────────────────
  if (view === 'profile' && profileUser) {
    const isFollowed = followedIds.has(profileUser.id);
    const inProgress = followingInProgress.has(profileUser.id);
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setView('feed')} activeOpacity={0.7}>
              <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.backBtnText}>Społeczność</Text>
            </TouchableOpacity>
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
              <TouchableOpacity
                style={[styles.followBtn, isFollowed && styles.followBtnActive]}
                onPress={() => isFollowed ? unfollow(profileUser.id) : follow(profileUser.id)}
                disabled={inProgress} activeOpacity={0.75}
              >
                {inProgress
                  ? <ActivityIndicator size="small" color={isFollowed ? COLORS.brandMid : '#fff'} />
                  : isFollowed ? <Icon.Check size={14} color={COLORS.brandMid} /> : <Icon.Users size={14} color="#fff" />}
                <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                  {isFollowed ? 'Obserwujesz' : 'Obserwuj'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {loadingProfile ? (
              <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
            ) : profileCatches.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon.Fish size={32} color={COLORS.borderSecondary} />
                <Text style={styles.emptyTitle}>Brak połowów</Text>
              </View>
            ) : (
              profileCatches.map((c) => {
                const s = social[c.id];
                return (
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

                    {/* Like & comment bar */}
                    <View style={styles.socialBar}>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => toggleLike(c.id)} activeOpacity={0.7}>
                        <Icon.Heart filled={s?.liked} size={18} color={s?.liked ? '#E0344E' : COLORS.textSecondary} />
                        <Text style={[styles.socialCount, s?.liked && styles.socialCountLiked]}>
                          {s?.likeCount ?? 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => toggleComments(c.id)} activeOpacity={0.7}>
                        <Icon.MessageCircle size={18} color={s?.showComments ? COLORS.brandMid : COLORS.textSecondary} />
                        <Text style={[styles.socialCount, s?.showComments && styles.socialCountComment]}>
                          {s?.comments?.length ?? 0}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Comments section */}
                    {s?.showComments && (
                      <View style={styles.commentsSection}>
                        {s.comments.length === 0 ? (
                          <Text style={styles.noComments}>Brak komentarzy. Bądź pierwszy!</Text>
                        ) : (
                          s.comments.map((cm) => (
                            <View key={cm.id} style={styles.commentRow}>
                              <View style={styles.commentAvatar}>
                                <Text style={styles.commentAvatarLetter}>{cm.username[0]?.toUpperCase()}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.commentUsername}>{cm.username}</Text>
                                <Text style={styles.commentContent}>{cm.content}</Text>
                              </View>
                              {cm.user_id === currentUserId && (
                                <TouchableOpacity onPress={() => deleteComment(c.id, cm.id)} activeOpacity={0.7}>
                                  <Icon.X size={14} color={COLORS.textTertiary} />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))
                        )}
                        <View style={styles.commentInput}>
                          <TextInput
                            value={s.commentDraft}
                            onChangeText={(t) => updateDraft(c.id, t)}
                            placeholder="Dodaj komentarz..."
                            placeholderTextColor={COLORS.textTertiary}
                            style={styles.commentTextInput}
                            multiline
                            maxLength={500}
                          />
                          <TouchableOpacity
                            onPress={() => sendComment(c.id)}
                            disabled={!s.commentDraft?.trim() || s.sendingComment}
                            activeOpacity={0.7}
                            style={[styles.sendBtn, (!s.commentDraft?.trim() || s.sendingComment) && styles.sendBtnDisabled]}
                          >
                            {s.sendingComment
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Icon.Send size={15} color="#fff" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Feed & Search ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TabBtn active={view === 'feed'} label={`Obserwowani (${following.length})`} onPress={() => setView('feed')} />
        <TabBtn active={view === 'search'} label="Szukaj wędkarzy" onPress={() => setView('search')} />
      </View>

      {view === 'search' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <Icon.Search size={14} color={COLORS.textTertiary} />
            <TextInput
              value={searchQuery}
              onChangeText={doSearch}
              placeholder="Wpisz nazwę użytkownika..."
              placeholderTextColor={COLORS.textTertiary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={COLORS.brandMid} />}
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {searchQuery.trim().length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon.Search size={28} color={COLORS.borderSecondary} />
                <Text style={styles.emptyTitle}>Wpisz nazwę użytkownika</Text>
              </View>
            ) : !searching && searchResults.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nie znaleziono</Text>
                <Text style={styles.muted}>Sprawdź pisownię lub wpisz inną frazę.</Text>
              </View>
            ) : (
              searchResults.map((p) => {
                const isF = followedIds.has(p.id);
                const inProg = followingInProgress.has(p.id);
                return (
                  <View key={p.id} style={styles.card}>
                    <View style={styles.userRow}>
                      <TouchableOpacity style={styles.userInfo} onPress={() => openProfile(p)} activeOpacity={0.7}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarLetter}>{avatarLetter(p.username)}</Text>
                        </View>
                        <View>
                          <Text style={styles.species}>{p.username}</Text>
                          <Text style={styles.muted}>Dotknij, aby zobaczyć profil</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.followBtn, isF && styles.followBtnActive]}
                        onPress={() => isF ? unfollow(p.id) : follow(p.id)}
                        disabled={inProg} activeOpacity={0.75}
                      >
                        {inProg
                          ? <ActivityIndicator size="small" color={isF ? COLORS.brandMid : '#fff'} />
                          : isF ? <Icon.Check size={13} color={COLORS.brandMid} /> : <Icon.Plus size={13} color="#fff" />}
                        <Text style={[styles.followBtnText, isF && styles.followBtnTextActive]}>
                          {isF ? 'Obserwujesz' : 'Obserwuj'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
              <Text style={styles.muted}>Przejdź do "Szukaj wędkarzy" aby znaleźć innych.</Text>
            </View>
          ) : (
            following.map((r) => (
              <View key={r.following_id} style={styles.card}>
                <View style={styles.userRow}>
                  <TouchableOpacity style={styles.userInfo} onPress={() => openProfile(r.profiles)} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarLetter}>{avatarLetter(r.profiles?.username ?? '?')}</Text>
                    </View>
                    <View>
                      <Text style={styles.species}>{r.profiles?.username ?? r.following_id.slice(0, 8)}</Text>
                      <Text style={styles.muted}>Dotknij, aby zobaczyć profil</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.unfollowBtn} onPress={() => unfollow(r.following_id)} activeOpacity={0.75}>
                    <Text style={styles.unfollowText}>Usuń</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  profileHeader: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 6,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6DD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#F4F2EB' },
  tabButtonActive: { backgroundColor: COLORS.brandDark },
  tabButtonText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
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
  cardPhoto: { width: '100%', height: 180 },
  cardBody: { padding: 14, gap: 6 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 18 },
  avatarLarge: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetterLarge: { color: '#fff', fontWeight: '800', fontSize: 24 },
  species: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F4F2EB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  notes: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  date: { color: COLORS.textTertiary, fontSize: 12, marginTop: 2 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  // Social bar
  socialBar: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EEE6',
  },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialCount: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  socialCountLiked: { color: '#E0344E' },
  socialCountComment: { color: COLORS.brandMid },
  // Comments
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#F0EEE6',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: '#FAFAF7',
  },
  noComments: { color: COLORS.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentAvatar: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 13 },
  commentUsername: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 12 },
  commentContent: { color: COLORS.textSecondary, fontSize: 13, marginTop: 1 },
  commentInput: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 4,
  },
  commentTextInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD9CE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#fff',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: COLORS.brandMid,
    borderRadius: 12,
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.borderSecondary },
  // Follow
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.brandMid, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, minWidth: 110, justifyContent: 'center',
  },
  followBtnActive: { backgroundColor: '#E6F1FB', borderWidth: 1.5, borderColor: COLORS.brandMid },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  followBtnTextActive: { color: COLORS.brandMid },
  unfollowBtn: {
    borderWidth: 1, borderColor: '#F7C1C1', backgroundColor: '#FCEBEB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  unfollowText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: '#E8E6DD', padding: 36, alignItems: 'center', gap: 10, marginTop: 8,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
});
