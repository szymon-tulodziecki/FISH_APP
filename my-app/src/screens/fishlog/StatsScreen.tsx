import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { CatchRecord } from '@/components/fishlog/types';
import { COLORS, formatDate } from '@/utils/fishlog-constants';

type Props = { catches: CatchRecord[] };

export default function StatsScreen({ catches }: Props) {
  const thisYear = new Date().getFullYear();
  const caught = catches.filter((c) => c.status === 'caught');
  const caughtThisYear = caught.filter((c) => c.caught_at && new Date(c.caught_at).getFullYear() === thisYear);
  const rated = caught.filter((c) => c.rating);
  const avgRating = rated.length
    ? (rated.reduce((sum, c) => sum + (c.rating || 0), 0) / rated.length).toFixed(1)
    : null;
  const bestCatch = rated.length > 0 ? [...rated].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] : null;
  const withWeight = caught.filter((c) => c.weight != null);
  const heaviest = withWeight.length > 0 ? [...withWeight].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0] : null;

  const speciesMap: Record<string, number> = {};
  caught.forEach((c) => { speciesMap[c.species] = (speciesMap[c.species] || 0) + 1; });
  const topSpecies = Object.entries(speciesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const prMap: Record<string, CatchRecord> = {};
  withWeight.forEach((c) => {
    if (!prMap[c.species] || (c.weight ?? 0) > (prMap[c.species].weight ?? 0)) prMap[c.species] = c;
  });
  const prs = Object.values(prMap).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        <StatCard label="Łącznie złowione" value={String(caught.length)} />
        <StatCard label={`W ${thisYear} roku`} value={String(caughtThisYear.length)} />
        <StatCard label="Różnych gatunków" value={String(Object.keys(speciesMap).length)} />
        <StatCard label="Średnia ocena" value={avgRating ? `${avgRating}/5` : '—'} sub={avgRating ? `z ${rated.length} ocen` : undefined} />
      </View>

      {!!heaviest && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon.Trophy size={16} color={COLORS.accentOrange} />
            <Text style={styles.cardTitle}>Najcięższa ryba</Text>
          </View>
          <Text style={styles.highlight}>{heaviest.species}</Text>
          <Text style={styles.bigValue}>{heaviest.weight} kg</Text>
          {!!heaviest.length && <Text style={styles.muted}>Długość: {heaviest.length} cm · {formatDate(heaviest.caught_at)}</Text>}
        </View>
      )}

      {!!bestCatch && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon.Star filled size={16} color={COLORS.accentOrange} />
            <Text style={styles.cardTitle}>Najwyżej oceniony</Text>
          </View>
          <Text style={styles.highlight}>{bestCatch.species}</Text>
          {!!bestCatch.location && <Text style={styles.muted}>{bestCatch.location}</Text>}
          <StarRating value={bestCatch.rating || 0} readOnly size={16} />
        </View>
      )}

      {prs.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon.Trophy size={16} color={COLORS.brandMid} />
            <Text style={styles.cardTitle}>Rekordy osobiste (PR)</Text>
          </View>
          <View style={styles.stack}>
            {prs.map((c) => (
              <View key={c.species} style={styles.prRow}>
                <View style={styles.prLeft}>
                  <Text style={styles.prSpecies}>{c.species}</Text>
                  {!!c.location && <Text style={styles.muted}>{c.location}</Text>}
                </View>
                <View style={styles.prRight}>
                  <Text style={styles.prWeight}>{c.weight} kg</Text>
                  {!!c.length && <Text style={styles.muted}>{c.length} cm</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {topSpecies.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Icon.Fish size={16} color={COLORS.brandDark} />
            <Text style={styles.cardTitle}>Najczęściej łowione</Text>
          </View>
          <View style={styles.stack}>
            {topSpecies.map(([species, count], i) => (
              <View key={species} style={styles.topRow}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Text style={[styles.rowText, { flex: 1 }]}>{species}</Text>
                <Text style={styles.muted}>{count}×</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {caught.length === 0 && (
        <View style={styles.emptyCard}>
          <Icon.BarChart size={36} color={COLORS.borderSecondary} />
          <Text style={styles.emptyTitle}>Brak danych</Text>
          <Text style={styles.muted}>Dodaj połowy, żeby zobaczyć statystyki.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {!!sub && <Text style={styles.muted}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  content: { gap: 12, paddingBottom: 32, paddingTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 14,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '800', color: COLORS.brandDark, letterSpacing: -0.5 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.brandDark },
  highlight: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  bigValue: { fontSize: 28, fontWeight: '800', color: COLORS.brandMid, letterSpacing: -0.5 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
  stack: { gap: 8 },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F7F5EE',
    borderRadius: 12,
  },
  prLeft: { gap: 2 },
  prRight: { alignItems: 'flex-end', gap: 2 },
  prSpecies: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 },
  prWeight: { fontWeight: '800', color: COLORS.brandMid, fontSize: 16 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#F7F5EE',
    borderRadius: 10,
  },
  rank: { width: 20, textAlign: 'center', fontWeight: '800', color: COLORS.textTertiary, fontSize: 13 },
  rowText: { color: COLORS.textPrimary, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
});
