import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import FishLogApp from '@/components/fishlog/FishLogApp';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <FishLogApp />
    </SafeAreaProvider>
  );
}
