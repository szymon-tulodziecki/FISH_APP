import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
type FeedPost = CatchRecord & { author_username: string };
type CatchSocial = {
  likeCount: number;
  liked: boolean;
  comments: Comment[];
  showComments: boolean;
  commentDraft: string;
  sendingComment: boolean;
};
type ViewMode = 'feed' | 'following' | 'search' | 'userProfile';

type Props = { currentUserId: string; currentUsername: string };

export default function SocialScreen({ currentUserId, currentUsername }: Props) {
  const [view, setView] = useState<ViewMode>('feed');

  // Feed
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [social, setSocial] = useState<Record<string, CatchSocial>>({});

  // Following management
  const [following, setFollowing] = useState<FollowRow[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User profile
  const [profileUser, setProfileUser] = useState<Profile | null>(null);
  const [profileCatches, setProfileCatches] = useState<CatchRecord[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileBackTo, setProfileBackTo] = useState<ViewMode>('feed');

  useEffect(() => {
    loadFollowedIds().then(() => loadFeed());
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadFollowedIds = async () => {
    const { data } = await supabase
      .from('user_follows').select('following_id').eq('follower_id', currentUserId);
    const ids = ((data ?? []) as any[]).map((r) => r.following_id);
    setFollowedIds(new Set(ids));
    return ids;
  };

  const loadFollowing = async () => {
    const { data: followData } = await supabase
      .from('user_follows').select('following_id, created_at').eq('follower_id', currentUserId).order('created_at', { ascending: false });
    const follows = (followData ?? []) as { following_id: string; created_at: string }[];
    const ids = follows.map((r) => r.following_id);
    setFollowedIds(new Set(ids));
    if (ids.length === 0) { setFollowing([]); return; }
    const { data: profileData } = await supabase.from('profiles').select('id, username').in('id', ids);
    const pm: Record<string, Profile> = {};
    ((profileData ?? []) as Profile[]).forEach((p) => { pm[p.id] = p; });
    setFollowing(follows.map((r) => ({
      following_id: r.following_id,
      profiles: pm[r.following_id] ?? { id: r.following_id, username: r.following_id.slice(0, 8) },
    })));
  };

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoadingFeed(true);

    // Get current followed ids
    const { data: followData } = await supabase
      .from('user_follows').select('following_id').eq('follower_id', currentUserId);
    const ids = ((followData ?? []) as any[]).map((r) => r.following_id);

    if (ids.length === 0) {
      setFeedPosts([]);
      setSocial({});
      if (isRefresh) setRefreshing(false); else setLoadingFeed(false);
      return;
    }

    // Fetch catches from followed users
    const { data: catchData } = await supabase
      .from('catches').select('*').in('user_id', ids).eq('status', 'caught')
      .order('caught_at', { ascending: false }).limit(50);

    const catches = (catchData as CatchRecord[]) ?? [];

    // Fetch profiles for usernames
    const { data: profileData } = await supabase.from('profiles').select('id, username').in('id', ids);
    const pm: Record<string, string> = {};
    ((profileData ?? []) as Profile[]).forEach((p) => { pm[p.id] = p.username; });

    const posts: FeedPost[] = catches.map((c) => ({
      ...c,
      author_username: pm[c.user_id] ?? c.user_id.slice(0, 8),
    }));
    setFeedPosts(posts);

    // Load social data
    if (posts.length > 0) {
      const catchIds = posts.map((p) => p.id);
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from('catch_likes').select('catch_id, user_id').in('catch_id', catchIds),
        supabase.from('catch_comments').select('*').in('catch_id', catchIds).order('created_at', { ascending: true }),
      ]);
      const next: Record<string, CatchSocial> = {};
      catchIds.forEach((cid) => {
        const cl = (likes ?? []).filter((l: any) => l.catch_id === cid);
        const cc = (comments ?? []).filter((c: any) => c.catch_id === cid) as Comment[];
        next[cid] = {
          likeCount: cl.length,
          liked: cl.some((l: any) => l.user_id === currentUserId),
          comments: cc,
          showComments: false,
          commentDraft: '',
          sendingComment: false,
        };
      });
      setSocial(next);
    }

    if (isRefresh) setRefreshing(false); else setLoadingFeed(false);
  }, [currentUserId]);

  // ── Social actions ────────────────────────────────────────────────────────────

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
      if (error) setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], liked: wasLiked, likeCount: s.likeCount } }));
    }
  };

  const toggleComments = (catchId: string) => {
    setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], showComments: !prev[catchId]?.showComments } }));
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
      catch_id: catchId, user_id: currentUserId, username: currentUsername, content,
    }).select().single();
    if (error) {
      Alert.alert('Błąd', 'Nie udało się dodać komentarza.');
      setSocial((prev) => ({ ...prev, [catchId]: { ...prev[catchId], sendingComment: false } }));
    } else {
      setSocial((prev) => ({
        ...prev,
        [catchId]: { ...prev[catchId], comments: [...prev[catchId].comments, data as Comment], commentDraft: '', sendingComment: false },
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

  // ── Follow actions ────────────────────────────────────────────────────────────

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

  // ── Search ───────────────────────────────────────────────────────────────────

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

  // ── Open user profile ─────────────────────────────────────────────────────────

  const openUserProfile = async (profile: Profile, backTo: ViewMode = 'search') => {
    setProfileUser(profile);
    setProfileBackTo(backTo);
    setView('userProfile');
    setLoadingProfile(true);
    const { data } = await supabase.from('catches').select('*')
      .eq('user_id', profile.id).eq('status', 'caught').order('caught_at', { ascending: false });
    setProfileCatches((data as CatchRecord[]) ?? []);
    setLoadingProfile(false);
  };

  const avatarLetter = (username: string) => username[0]?.toUpperCase() ?? '?';

  // ── User profile view ─────────────────────────────────────────────────────────

  if (view === 'userProfile' && profileUser) {
    const isFollowed = followedIds.has(profileUser.id);
    const inProgress = followingInProgress.has(profileUser.id);
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setView(profileBackTo)} activeOpacity={0.7}>
            <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.backBtnText}>
              {profileBackTo === 'feed' ? 'Tablica' : profileBackTo === 'following' ? 'Obserwowani' : 'Szukaj'}
            </Text>
          </TouchableOpacity>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLetterLarge}>{avatarLetter(profileUser.username)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subHeaderTitle}>{profileUser.username}</Text>
              <Text style={styles.subHeaderSub}>{profileCatches.length} połowów</Text>
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
        <ScrollView contentContainerStyle={styles.content}>
          {loadingProfile
            ? <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 32 }} />
            : profileCatches.length === 0
              ? <View style={styles.emptyCard}><Icon.Fish size={32} color={COLORS.borderSecondary} /><Text style={styles.emptyTitle}>Brak połowów</Text></View>
              : profileCatches.map((c) => <CatchCard key={c.id} c={c} />)}
        </ScrollView>
      </View>
    );
  }

  // ── Main tabs ─────────────────────────────────────────────────────────────────

  const mainTabBar = (
    <View style={styles.tabBar}>
      <TabBtn active={view === 'feed'} label="Tablica" onPress={() => { setView('feed'); loadFeed(); }} />
      <TabBtn active={view === 'following'} label={`Obserwowani`} onPress={() => { setView('following'); loadFollowing(); }} />
      <TabBtn active={view === 'search'} label="Szukaj" onPress={() => setView('search')} />
    </View>
  );

  // Feed view
  if (view === 'feed') {
    return (
      <View style={styles.container}>
        {mainTabBar}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} colors={[COLORS.brandMid]} tintColor={COLORS.brandMid} />}
        >
          {loadingFeed ? (
            <ActivityIndicator color={COLORS.brandMid} style={{ marginTop: 40 }} />
          ) : feedPosts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon.Users size={36} color={COLORS.borderSecondary} />
              <Text style={styles.emptyTitle}>Tablica jest pusta</Text>
              <Text style={styles.muted}>Zaobserwuj innych wędkarzy, żeby zobaczyć ich połowy.</Text>
            </View>
          ) : (
            feedPosts.map((post) => {
              const s = social[post.id];
              return (
                <KeyboardAvoidingView key={post.id} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <View style={styles.card}>
                    {/* Author row */}
                    <TouchableOpacity
                      style={styles.authorRow}
                      onPress={() => openUserProfile({ id: post.user_id, username: post.author_username }, 'feed')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.authorAvatar}>
                        <Text style={styles.authorAvatarLetter}>{avatarLetter(post.author_username)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.authorName}>{post.author_username}</Text>
                        <Text style={styles.postDate}>{formatDate(post.caught_at)}</Text>
                      </View>
                      <Icon.ChevronRight size={14} color={COLORS.textTertiary} />
                    </TouchableOpacity>

                    {!!post.photo_url && (
                      <Image source={{ uri: post.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
                    )}

                    <View style={styles.cardBody}>
                      <Text style={styles.species}>{post.species}</Text>
                      <View style={styles.metaRow}>
                        {!!post.weight && (
                          <View style={styles.metaChip}>
                            <Icon.Scale size={11} color={COLORS.textTertiary} />
                            <Text style={styles.metaText}>{post.weight} kg</Text>
                          </View>
                        )}
                        {!!post.length && (
                          <View style={styles.metaChip}>
                            <Icon.Ruler size={11} color={COLORS.textTertiary} />
                            <Text style={styles.metaText}>{post.length} cm</Text>
                          </View>
                        )}
                        {!!post.location && (
                          <View style={styles.metaChip}>
                            <Icon.Map size={11} color={COLORS.textTertiary} />
                            <Text style={styles.metaText}>{post.location}</Text>
                          </View>
                        )}
                      </View>
                      {!!post.rating && <StarRating value={post.rating} readOnly size={14} />}
                      {!!post.notes && <Text style={styles.notes}>{post.notes}</Text>}
                    </View>

                    {/* Social bar */}
                    <View style={styles.socialBar}>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => toggleLike(post.id)} activeOpacity={0.7}>
                        <Icon.Heart filled={s?.liked} size={20} color={s?.liked ? '#E0344E' : COLORS.textSecondary} />
                        <Text style={[styles.socialCount, s?.liked && styles.socialCountLiked]}>{s?.likeCount ?? 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.socialBtn} onPress={() => toggleComments(post.id)} activeOpacity={0.7}>
                        <Icon.MessageCircle size={20} color={s?.showComments ? COLORS.brandMid : COLORS.textSecondary} />
                        <Text style={[styles.socialCount, s?.showComments && styles.socialCountComment]}>{s?.comments?.length ?? 0}</Text>
                      </TouchableOpacity>
                    </View>

                    {s?.showComments && (
                      <View style={styles.commentsSection}>
                        {s.comments.length === 0
                          ? <Text style={styles.noComments}>Bądź pierwszy!</Text>
                          : s.comments.map((cm) => (
                            <View key={cm.id} style={styles.commentRow}>
                              <View style={styles.commentAvatar}>
                                <Text style={styles.commentAvatarLetter}>{cm.username[0]?.toUpperCase()}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.commentUsername}>{cm.username}</Text>
                                <Text style={styles.commentContent}>{cm.content}</Text>
                              </View>
                              {cm.user_id === currentUserId && (
                                <TouchableOpacity onPress={() => deleteComment(post.id, cm.id)} activeOpacity={0.7}>
                                  <Icon.X size={13} color={COLORS.textTertiary} />
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        <View style={styles.commentInputRow}>
                          <TextInput
                            value={s.commentDraft}
                            onChangeText={(t) => updateDraft(post.id, t)}
                            placeholder="Dodaj komentarz..."
                            placeholderTextColor={COLORS.textTertiary}
                            style={styles.commentTextInput}
                            maxLength={500}
                          />
                          <TouchableOpacity
                            onPress={() => sendComment(post.id)}
                            disabled={!s.commentDraft?.trim() || s.sendingComment}
                            activeOpacity={0.7}
                            style={[styles.sendBtn, (!s.commentDraft?.trim() || s.sendingComment) && styles.sendBtnDisabled]}
                          >
                            {s.sendingComment
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Icon.Send size={14} color="#fff" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </KeyboardAvoidingView>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  // Following management view
  if (view === 'following') {
    return (
      <View style={styles.container}>
        {mainTabBar}
        <ScrollView contentContainerStyle={styles.content}>
          {following.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon.Users size={32} color={COLORS.borderSecondary} />
              <Text style={styles.emptyTitle}>Nie obserwujesz nikogo</Text>
              <Text style={styles.muted}>Przejdź do zakładki "Szukaj" aby znaleźć wędkarzy.</Text>
            </View>
          ) : (
            following.map((r) => (
              <View key={r.following_id} style={styles.card}>
                <View style={styles.userRow}>
                  <TouchableOpacity style={styles.userInfo} onPress={() => openUserProfile(r.profiles, 'following')} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarLetter}>{avatarLetter(r.profiles?.username ?? '?')}</Text>
                    </View>
                    <View>
                      <Text style={styles.species}>{r.profiles?.username ?? r.following_id.slice(0, 8)}</Text>
                      <Text style={styles.muted}>Zobacz profil</Text>
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
      </View>
    );
  }

  // Search view
  return (
    <View style={styles.container}>
      {mainTabBar}
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
          </View>
        ) : (
          searchResults.map((p) => {
            const isF = followedIds.has(p.id);
            const inProg = followingInProgress.has(p.id);
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.userRow}>
                  <TouchableOpacity style={styles.userInfo} onPress={() => openUserProfile(p)} activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarLetter}>{avatarLetter(p.username)}</Text>
                    </View>
                    <View>
                      <Text style={styles.species}>{p.username}</Text>
                      <Text style={styles.muted}>Zobacz profil</Text>
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
  );
}

function CatchCard({ c }: { c: CatchRecord }) {
  return (
    <View style={styles.card}>
      {!!c.photo_url && <Image source={{ uri: c.photo_url }} style={styles.cardPhoto} resizeMode="cover" />}
      <View style={styles.cardBody}>
        <Text style={styles.species}>{c.species}</Text>
        <View style={styles.metaRow}>
          {!!c.weight && <View style={styles.metaChip}><Icon.Scale size={11} color={COLORS.textTertiary} /><Text style={styles.metaText}>{c.weight} kg</Text></View>}
          {!!c.length && <View style={styles.metaChip}><Icon.Ruler size={11} color={COLORS.textTertiary} /><Text style={styles.metaText}>{c.length} cm</Text></View>}
          {!!c.location && <View style={styles.metaChip}><Icon.Map size={11} color={COLORS.textTertiary} /><Text style={styles.metaText}>{c.location}</Text></View>}
        </View>
        {!!c.rating && <StarRating value={c.rating} readOnly size={14} />}
        {!!c.notes && <Text style={styles.notes}>{c.notes}</Text>}
        <Text style={styles.date}>{formatDate(c.caught_at)}</Text>
      </View>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6DD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  tabButton: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#F4F2EB' },
  tabButtonActive: { backgroundColor: COLORS.brandDark },
  tabButtonText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  tabButtonTextActive: { color: '#fff', fontWeight: '800' },
  subHeader: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subHeaderSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  avatarLarge: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetterLarge: { color: '#fff', fontWeight: '800', fontSize: 20 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, borderWidth: 1.5, borderColor: '#DDD9CE',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  content: { padding: 12, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1,
    borderColor: '#E8E6DD', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  authorAvatar: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  authorAvatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 16 },
  authorName: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 },
  postDate: { color: COLORS.textTertiary, fontSize: 12 },
  cardPhoto: { width: '100%', height: 220 },
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
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  socialBar: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F0EEE6',
  },
  socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  socialCount: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  socialCountLiked: { color: '#E0344E' },
  socialCountComment: { color: COLORS.brandMid },
  commentsSection: {
    borderTopWidth: 1, borderTopColor: '#F0EEE6',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
    gap: 10, backgroundColor: '#FAFAF7',
  },
  noComments: { color: COLORS.textTertiary, fontSize: 13, textAlign: 'center' },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 12 },
  commentUsername: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 12 },
  commentContent: { color: COLORS.textSecondary, fontSize: 13, marginTop: 1 },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  commentTextInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#DDD9CE',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: COLORS.textPrimary, backgroundColor: '#fff',
  },
  sendBtn: {
    backgroundColor: COLORS.brandMid, borderRadius: 12,
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.borderSecondary },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: COLORS.brandMid, fontWeight: '800', fontSize: 18 },
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
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
