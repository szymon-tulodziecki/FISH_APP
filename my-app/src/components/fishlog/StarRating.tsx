import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { COLORS } from '@/utils/fishlog-constants';
import { Icon } from './icons';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
};

export function StarRating({ value, onChange, size = 18, readOnly = false }: StarRatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={readOnly}
          onPress={() => onChange?.(n)}
          style={styles.button}>
          <Icon.Star
            filled={n <= value}
            size={size}
            color={n <= value ? COLORS.accentOrange : COLORS.borderSecondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
  },
  button: {
    padding: 2,
  },
});
