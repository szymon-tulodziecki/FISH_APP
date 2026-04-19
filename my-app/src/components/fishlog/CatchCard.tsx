import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, WATER_LABELS, formatDate } from '@/utils/fishlog-constants';
import { CatchRecord } from './types';
import { Icon } from './icons';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';

type CatchCardProps = {
  item: CatchRecord;
  catches: CatchRecord[];
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function isPR(item: CatchRecord, catches: CatchRecord[]): boolean {
  if (!item.weight || item.status !== 'caught') return false;
  const speciesCatches = catches.filter((c) => c.species === item.species && c.status === 'caught' && c.weight);
  const maxWeight = Math.max(...speciesCatches.map((c) => c.weight!));
  return item.weight >= maxWeight;
}

export function CatchCard({ item, catches, onPress, onEdit, onDelete }: CatchCardProps) {
  const isPersonalRecord = isPR(item, catches);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {isPersonalRecord && (
        <View style={styles.prBanner}>
          <Icon.Trophy size={12} color="#7A4F00" />
          <Text style={styles.prText}>Rekord osobisty — {item.species}</Text>
        </View>
      )}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.thumbnail} contentFit="cover" />
          ) : (
            <View style={styles.avatar}>
              <Icon.Fish size={22} color={COLORS.brandMid} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{item.species}</Text>
            {(item.location || item.water_type) && (
              <View style={styles.subRow}>
                <Icon.Map size={11} color={COLORS.textTertiary} />
                <Text style={styles.subText} numberOfLines={1}>
                  {item.location ?? ''}
                  {item.location && item.water_type ? ' · ' : ''}
                  {item.water_type ? WATER_LABELS[item.water_type] : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={onEdit}>
            <Icon.Edit size={13} color={COLORS.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onDelete}>
            <Icon.Trash size={13} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.tagsRow}>
        <View style={styles.tagsLeft}>
          {!!item.weight && (
            <View style={[styles.tag, { backgroundColor: '#EAF3DE', borderColor: '#C0DD97' }]}>
              <Icon.Scale size={11} color="#3B6D11" />
              <Text style={[styles.tagText, { color: '#3B6D11' }]}>{item.weight} kg</Text>
            </View>
          )}
          {!!item.length && (
            <View style={[styles.tag, { backgroundColor: '#FAEEDA', borderColor: '#FAC775' }]}>
              <Icon.Ruler size={11} color="#854F0B" />
              <Text style={[styles.tagText, { color: '#854F0B' }]}>{item.length} cm</Text>
            </View>
          )}
          {!!item.bait && (
            <View style={[styles.tag, { backgroundColor: '#EEEDFE', borderColor: '#CECBF6' }]}>
              <Icon.Hook size={11} color="#534AB7" />
              <Text style={[styles.tagText, { color: '#534AB7' }]}>{item.bait}</Text>
            </View>
          )}
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.footerRow}>
        <StarRating value={item.rating ?? 0} readOnly size={14} />
        <Text style={styles.dateText}>{formatDate(item.date_added)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E6DD',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  prText: { fontSize: 11, fontWeight: '700', color: '#7A4F00' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, paddingBottom: 0 },
  headerLeft: { flexDirection: 'row', gap: 10, flex: 1 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#E6F1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: { width: 46, height: 46, borderRadius: 12 },
  headerText: { flex: 1 },
  title: { fontWeight: '700', fontSize: 15.5, color: COLORS.textPrimary, letterSpacing: -0.2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  subText: { fontSize: 12, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    borderWidth: 1,
    borderColor: '#E8E6DD',
    borderRadius: 8,
    padding: 7,
    backgroundColor: '#FAFAF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  tagsLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagText: { fontSize: 12, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateText: { fontSize: 11, color: COLORS.textTertiary },
});
