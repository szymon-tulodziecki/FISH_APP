import { Image } from 'expo-image';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { StatusBadge } from '@/components/fishlog/StatusBadge';
import { CatchRecord } from '@/components/fishlog/types';
import { COLORS, WATER_LABELS, formatDate } from '@/utils/fishlog-constants';

type Props = {
  item: CatchRecord;
  catches: CatchRecord[];
  onBack: () => void;
};

export default function CatchDetailScreen({ item, catches, onBack }: Props) {
  const insets = useSafeAreaInsets();

  const speciesCatches = catches.filter((c) => c.species === item.species && c.status === 'caught' && c.weight);
  const prWeight = speciesCatches.length > 0 ? Math.max(...speciesCatches.map((c) => c.weight!)) : null;
  const isCurrentPR = item.weight && prWeight && item.weight >= prWeight;
  const catchCount = catches.filter((c) => c.species === item.species && c.status === 'caught').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Icon.ArrowLeft size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.backBtnText}>Połowy</Text>
        </Pressable>
      </View>

      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.heroImage} contentFit="cover" />
      ) : null}

      <View style={styles.card}>
        <View style={styles.speciesRow}>
          <Text style={styles.species}>{item.species}</Text>
          <StatusBadge status={item.status} />
        </View>

        {(isCurrentPR || catchCount > 1) && (
          <View style={styles.prRow}>
            {isCurrentPR && (
              <View style={styles.prBadge}>
                <Icon.Trophy size={13} color="#7A4F00" />
                <Text style={styles.prText}>Rekord osobisty</Text>
              </View>
            )}
            {catchCount > 1 && (
              <View style={styles.countBadge}>
                <Icon.Fish size={12} color={COLORS.brandMid} />
                <Text style={styles.countText}>Złowiony {catchCount}× łącznie</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.grid}>
          <InfoRow label="Masa" value={item.weight ? `${item.weight} kg` : null} />
          {prWeight && <InfoRow label="Rekord gatunku (PR)" value={`${prWeight} kg`} highlight />}
          <InfoRow label="Długość" value={item.length ? `${item.length} cm` : null} />
          <InfoRow label="Łowisko" value={item.location} />
          <InfoRow label="Typ wody" value={item.water_type ? WATER_LABELS[item.water_type] : null} />
          <InfoRow label="Przynęta" value={item.bait} />
          <InfoRow label="Data złowienia" value={formatDate(item.caught_at || item.date_added)} />
        </View>

        {!!item.rating && (
          <View style={styles.ratingWrap}>
            <Text style={styles.fieldLabel}>Ocena</Text>
            <StarRating value={item.rating} readOnly />
          </View>
        )}

        {!!item.notes && (
          <View style={styles.notesBox}>
            <View style={styles.notesLabel}>
              <Icon.Note size={12} color={COLORS.textSecondary} />
              <Text style={styles.fieldLabel}>Notatki</Text>
            </View>
            <Text style={styles.notes}>{item.notes}</Text>
          </View>
        )}
      </View>

      {speciesCatches.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historia — {item.species}</Text>
          <View style={styles.historyList}>
            {[...speciesCatches]
              .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
              .map((c, i) => (
                <View key={c.id} style={[styles.historyRow, c.id === item.id && styles.historyRowActive]}>
                  <Text style={styles.historyRank}>#{i + 1}</Text>
                  <Text style={styles.historyWeight}>{c.weight} kg</Text>
                  {c.length ? <Text style={styles.historyMuted}>{c.length} cm</Text> : null}
                  <Text style={[styles.historyMuted, { marginLeft: 'auto' }]}>{formatDate(c.caught_at)}</Text>
                  {i === 0 && <Icon.Trophy size={12} color="#EF9F27" />}
                </View>
              ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  content: { gap: 12, paddingBottom: 32 },
  topBar: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 14 },
  heroImage: { width: '100%', height: 240 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  speciesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  species: { fontSize: 26, fontWeight: '800', color: COLORS.brandDark, letterSpacing: -0.5, flex: 1 },
  prRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  prText: { fontSize: 12, fontWeight: '700', color: '#7A4F00' },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F1FB',
    borderWidth: 1,
    borderColor: '#B5D4F4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countText: { fontSize: 12, fontWeight: '600', color: COLORS.brandMid },
  grid: { gap: 0 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EEE6' },
  infoLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  infoValue: { flex: 1.5, color: COLORS.textPrimary, fontSize: 13, textAlign: 'right' },
  infoValueHighlight: { color: COLORS.brandMid, fontWeight: '700' },
  ratingWrap: { gap: 6 },
  fieldLabel: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesBox: { gap: 4 },
  notesLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notes: { color: COLORS.textSecondary, lineHeight: 20, fontSize: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.brandDark },
  historyList: { gap: 6 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F7F5EE',
    borderRadius: 10,
  },
  historyRowActive: { backgroundColor: '#E6F1FB', borderWidth: 1, borderColor: '#B5D4F4' },
  historyRank: { width: 24, color: COLORS.textTertiary, fontSize: 12, fontWeight: '700' },
  historyWeight: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 },
  historyMuted: { color: COLORS.textSecondary, fontSize: 12 },
});
