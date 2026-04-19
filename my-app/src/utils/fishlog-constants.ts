export const STATUS_LABELS: Record<string, string> = {
  caught: 'Złowione',
};

export const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  caught: { bg: '#E6F1FB', color: '#185FA5', border: '#B5D4F4' },
};

export const WATER_LABELS: Record<string, string> = {
  river: 'Rzeka',
  lake: 'Jezioro',
  sea: 'Morze',
  pond: 'Staw',
};

export const COLORS = {
  backgroundPrimary: '#FFFFFF',
  backgroundSecondary: '#F7F6F1',
  backgroundTertiary: '#F1EFE8',
  borderSecondary: '#D3D1C7',
  borderTertiary: '#E0DED4',
  textPrimary: '#1E1E1A',
  textSecondary: '#6B6A63',
  textTertiary: '#9C9A90',
  brandDark: '#042C53',
  brandMid: '#185FA5',
  brandGreen: '#0F6E56',
  accentOrange: '#EF9F27',
  danger: '#A32D2D',
};

export const formatDate = (date?: string | null) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
