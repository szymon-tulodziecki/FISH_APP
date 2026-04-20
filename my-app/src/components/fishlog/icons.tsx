import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

type IconProps = { size?: number; color?: string };

export const Icon = {
  Fish: ({ size = 16, color = '#000' }: IconProps) => <MaterialCommunityIcons name="fish" size={size} color={color} />,
  Plus: ({ size = 16, color = '#000' }: IconProps) => <Feather name="plus" size={size} color={color} />,
  Star: ({ filled = false, size = 16, color }: { filled?: boolean; size?: number; color?: string }) => (
    <MaterialCommunityIcons name={filled ? 'star' : 'star-outline'} size={size} color={color} />
  ),
  Search: ({ size = 16, color = '#000' }: IconProps) => <Feather name="search" size={size} color={color} />,
  Users: ({ size = 16, color = '#000' }: IconProps) => <Feather name="users" size={size} color={color} />,
  BarChart: ({ size = 16, color = '#000' }: IconProps) => <Feather name="bar-chart-2" size={size} color={color} />,
  LogOut: ({ size = 16, color = '#000' }: IconProps) => <Feather name="log-out" size={size} color={color} />,
  ChevronRight: ({ size = 16, color = '#000' }: IconProps) => <Feather name="chevron-right" size={size} color={color} />,
  X: ({ size = 16, color = '#000' }: IconProps) => <Feather name="x" size={size} color={color} />,
  Trash: ({ size = 16, color = '#000' }: IconProps) => <Feather name="trash-2" size={size} color={color} />,
  Edit: ({ size = 16, color = '#000' }: IconProps) => <Feather name="edit-2" size={size} color={color} />,
  ArrowLeft: ({ size = 16, color = '#000' }: IconProps) => <Feather name="arrow-left" size={size} color={color} />,
  Check: ({ size = 16, color = '#000' }: IconProps) => <Feather name="check" size={size} color={color} />,
  Map: ({ size = 16, color = '#000' }: IconProps) => <Feather name="map-pin" size={size} color={color} />,
  Scale: ({ size = 16, color = '#000' }: IconProps) => <MaterialCommunityIcons name="scale" size={size} color={color} />,
  Ruler: ({ size = 16, color = '#000' }: IconProps) => <MaterialCommunityIcons name="ruler" size={size} color={color} />,
  Hook: ({ size = 16, color = '#000' }: IconProps) => <MaterialCommunityIcons name="hook" size={size} color={color} />,
  Camera: ({ size = 16, color = '#000' }: IconProps) => <Feather name="camera" size={size} color={color} />,
  Trophy: ({ size = 16, color = '#000' }: IconProps) => <MaterialCommunityIcons name="trophy-outline" size={size} color={color} />,
  Note: ({ size = 16, color = '#000' }: IconProps) => <Feather name="file-text" size={size} color={color} />,
  Heart: ({ filled = false, size = 16, color = '#000' }: { filled?: boolean; size?: number; color?: string }) => (
    <MaterialCommunityIcons name={filled ? 'heart' : 'heart-outline'} size={size} color={color} />
  ),
  MessageCircle: ({ size = 16, color = '#000' }: IconProps) => <Feather name="message-circle" size={size} color={color} />,
  Send: ({ size = 16, color = '#000' }: IconProps) => <Feather name="send" size={size} color={color} />,
};
