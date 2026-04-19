import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/fishlog/icons';
import { StarRating } from '@/components/fishlog/StarRating';
import { CatchRecord } from '@/components/fishlog/types';
import { supabase } from '@/lib/supabase';
import { COLORS, STATUS_LABELS, WATER_LABELS } from '@/utils/fishlog-constants';

type Props = {
  existing?: CatchRecord | null;
  userId: string;
  onBack: () => void;
  onSave: () => void;
};

const BUCKET = 'FISH_BUCKET';

export default function AddCatchScreen({ existing, userId, onBack, onSave }: Props) {
  const [form, setForm] = useState({
    species: existing?.species || '',
    weight: existing?.weight ? String(existing.weight) : '',
    length: existing?.length ? String(existing.length) : '',
    location: existing?.location || '',
    water_type: existing?.water_type || 'river',
    bait: existing?.bait || '',
    status: existing?.status || 'caught',
    rating: existing?.rating || 0,
    notes: existing?.notes || '',
    caught_at: existing?.caught_at || new Date().toISOString().slice(0, 10),
  });
  const [photoUri, setPhotoUri] = useState<string | null>(existing?.photo_url ?? null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Brak uprawnień', 'Zezwól na dostęp do galerii w ustawieniach.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoChanged(true);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
    setPhotoChanged(true);
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const ext = (uri.split('.').pop()?.toLowerCase() ?? 'jpg').split('?')[0];
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const filename = `${userId}/${Date.now()}.${ext === 'png' ? 'png' : 'jpg'}`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mime } as any);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${filename}`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-upsert': 'false',
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text();
        setError(`Upload błąd: ${err}`);
        return null;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
      return data.publicUrl;
    } catch (e: any) {
      setError(e.message ?? 'Błąd uploadu zdjęcia');
      return null;
    }
  };

  const handleSave = async () => {
    if (!form.species.trim()) { setError('Podaj gatunek ryby.'); return; }
    setError('');
    setSaving(true);

    let photo_url: string | null = existing?.photo_url ?? null;
    if (photoChanged) {
      if (photoUri) {
        const uploaded = await uploadPhoto(photoUri);
        if (!uploaded) { setSaving(false); return; }
        photo_url = uploaded;
      } else {
        photo_url = null;
      }
    }

    const payload: any = {
      species: form.species.trim(),
      location: form.location.trim() || null,
      water_type: form.water_type || null,
      bait: form.bait.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      user_id: userId,
      weight: form.weight ? parseFloat(form.weight) : null,
      length: form.length ? parseFloat(form.length) : null,
      rating: form.rating || null,
      caught_at: form.caught_at || null,
      ...(photo_url !== null ? { photo_url } : {}),
    };

    let err: any;
    if (existing?.id) {
      ({ error: err } = await supabase.from('catches').update(payload).eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('catches').insert([payload]));
    }

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSave();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Wróć</Text>
        </Pressable>
        <Text style={styles.title}>{existing ? 'Edytuj połów' : 'Nowy połów'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Zdjęcie ryby</Text>
        {photoUri ? (
          <View style={styles.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.photoActions}>
              <Pressable style={styles.photoBtn} onPress={pickPhoto}>
                <Text style={styles.photoBtnText}>Zmień zdjęcie</Text>
              </Pressable>
              <Pressable style={[styles.photoBtn, styles.photoBtnDanger]} onPress={removePhoto}>
                <Text style={[styles.photoBtnText, { color: COLORS.danger }]}>Usuń</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.photoPlaceholder} onPress={pickPhoto}>
            <Icon.Camera size={28} color={COLORS.textTertiary} />
            <Text style={styles.photoPlaceholderText}>Dodaj zdjęcie</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Podstawowe dane</Text>
        <TextInput style={styles.input} placeholder="Gatunek ryby *" placeholderTextColor={COLORS.textTertiary} value={form.species} onChangeText={(v) => set('species', v)} />
        <View style={styles.row2}>
          <TextInput style={[styles.input, styles.flex1]} placeholder="Masa (kg)" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" value={form.weight} onChangeText={(v) => set('weight', v)} />
          <TextInput style={[styles.input, styles.flex1]} placeholder="Długość (cm)" placeholderTextColor={COLORS.textTertiary} keyboardType="decimal-pad" value={form.length} onChangeText={(v) => set('length', v)} />
        </View>
        <TextInput style={styles.input} placeholder="Łowisko" placeholderTextColor={COLORS.textTertiary} value={form.location} onChangeText={(v) => set('location', v)} />
        <TextInput style={styles.input} placeholder="Przynęta" placeholderTextColor={COLORS.textTertiary} value={form.bait} onChangeText={(v) => set('bait', v)} />
        {form.status === 'caught' && (
          <TextInput style={styles.input} placeholder="Data złowienia (YYYY-MM-DD)" placeholderTextColor={COLORS.textTertiary} value={form.caught_at} onChangeText={(v) => set('caught_at', v)} />
        )}
        <TextInput style={[styles.input, styles.textArea]} placeholder="Notatki" placeholderTextColor={COLORS.textTertiary} value={form.notes} onChangeText={(v) => set('notes', v)} multiline />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.chipRow}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Pressable key={key} style={[styles.chip, form.status === key && styles.chipActive]} onPress={() => set('status', key)}>
              <Text style={[styles.chipText, form.status === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Typ wody</Text>
        <View style={styles.chipRow}>
          {Object.entries(WATER_LABELS).map(([key, label]) => (
            <Pressable key={key} style={[styles.chip, form.water_type === key && styles.chipActive]} onPress={() => set('water_type', key)}>
              <Text style={[styles.chipText, form.water_type === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ocena</Text>
        <StarRating value={form.rating} onChange={(v) => set('rating', v)} size={28} />
      </View>

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Zapisz połów</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F2EB' },
  content: { gap: 12, paddingBottom: 32 },
  header: {
    backgroundColor: COLORS.brandDark,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 6,
  },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E3D8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAF7',
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E5E3D8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FAFAF7',
  },
  chipActive: { borderColor: COLORS.brandMid, backgroundColor: '#E6F1FB' },
  chipText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: COLORS.brandMid, fontWeight: '700' },
  photoPlaceholder: {
    borderWidth: 2,
    borderColor: '#D5D3C7',
    borderStyle: 'dashed',
    borderRadius: 14,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAFAF7',
  },
  photoPlaceholderText: { color: COLORS.textSecondary, fontWeight: '600' },
  photoPreviewWrap: { gap: 10 },
  photoPreview: { width: '100%', height: 200, borderRadius: 12 },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E3D8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FAFAF7',
  },
  photoBtnDanger: { borderColor: '#FACDCD', backgroundColor: '#FFF5F5' },
  photoBtnText: { fontWeight: '700', color: COLORS.brandMid, fontSize: 13 },
  errorBox: {
    marginHorizontal: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FACDCD',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: COLORS.danger, fontSize: 13 },
  saveButton: {
    marginHorizontal: 16,
    backgroundColor: COLORS.brandMid,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.brandMid,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
});
