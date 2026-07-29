export type ThemeId = 'blue' | 'teal' | 'dark' | 'light' | 'indigo' | 'forest';

export type AppColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderDark: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  white: string;
  black: string;
  overlay: string;
  barcodeLine: string;
  lock: string;
  isDark: boolean;
};

const baseShared = {
  white: '#FFFFFF',
  black: '#000000',
  barcodeLine: '#EF4444',
};

export const THEMES: Record<ThemeId, AppColors> = {
  blue: {
    ...baseShared,
    isDark: false,
    primary: '#0B3D91',
    primaryDark: '#082E6D',
    primaryLight: '#1B5FC7',
    secondary: '#0F766E',
    accent: '#F59E0B',
    success: '#059669',
    successBg: '#D1FAE5',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#2563EB',
    infoBg: '#DBEAFE',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    border: '#E2E8F0',
    borderDark: '#CBD5E1',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    overlay: 'rgba(15, 23, 42, 0.55)',
    lock: '#64748B',
  },
  teal: {
    ...baseShared,
    isDark: false,
    primary: '#0F766E',
    primaryDark: '#115E59',
    primaryLight: '#14B8A6',
    secondary: '#0369A1',
    accent: '#F59E0B',
    success: '#059669',
    successBg: '#D1FAE5',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#0891B2',
    infoBg: '#CFFAFE',
    background: '#F0FDFA',
    surface: '#FFFFFF',
    surfaceMuted: '#F0FDFA',
    border: '#CCFBF1',
    borderDark: '#99F6E4',
    text: '#134E4A',
    textSecondary: '#0F766E',
    textMuted: '#5EEAD4',
    overlay: 'rgba(15, 23, 42, 0.55)',
    lock: '#64748B',
  },
  indigo: {
    ...baseShared,
    isDark: false,
    primary: '#4338CA',
    primaryDark: '#3730A3',
    primaryLight: '#6366F1',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    success: '#059669',
    successBg: '#D1FAE5',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#4F46E5',
    infoBg: '#E0E7FF',
    background: '#F5F3FF',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2FF',
    border: '#E0E7FF',
    borderDark: '#C7D2FE',
    text: '#1E1B4B',
    textSecondary: '#4338CA',
    textMuted: '#A5B4FC',
    overlay: 'rgba(15, 23, 42, 0.55)',
    lock: '#64748B',
  },
  forest: {
    ...baseShared,
    isDark: false,
    primary: '#166534',
    primaryDark: '#14532D',
    primaryLight: '#22C55E',
    secondary: '#0F766E',
    accent: '#CA8A04',
    success: '#15803D',
    successBg: '#DCFCE7',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#2563EB',
    infoBg: '#DBEAFE',
    background: '#F0FDF4',
    surface: '#FFFFFF',
    surfaceMuted: '#F7FEE7',
    border: '#DCFCE7',
    borderDark: '#BBF7D0',
    text: '#14532D',
    textSecondary: '#166534',
    textMuted: '#86EFAC',
    overlay: 'rgba(15, 23, 42, 0.55)',
    lock: '#64748B',
  },
  light: {
    ...baseShared,
    isDark: false,
    primary: '#111827',
    primaryDark: '#030712',
    primaryLight: '#374151',
    secondary: '#4B5563',
    accent: '#0B3D91',
    success: '#059669',
    successBg: '#D1FAE5',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#2563EB',
    infoBg: '#DBEAFE',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F9FAFB',
    border: '#E5E7EB',
    borderDark: '#D1D5DB',
    text: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    overlay: 'rgba(15, 23, 42, 0.45)',
    lock: '#6B7280',
  },
  dark: {
    ...baseShared,
    isDark: true,
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primaryLight: '#93C5FD',
    secondary: '#2DD4BF',
    accent: '#FBBF24',
    success: '#34D399',
    successBg: '#064E3B',
    warning: '#FBBF24',
    warningBg: '#78350F',
    danger: '#F87171',
    dangerBg: '#7F1D1D',
    info: '#38BDF8',
    infoBg: '#0C4A6E',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceMuted: '#334155',
    border: '#334155',
    borderDark: '#475569',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    overlay: 'rgba(0, 0, 0, 0.65)',
    lock: '#94A3B8',
  },
};

export const THEME_OPTIONS: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'blue', label: 'Koda Blue', swatch: '#0B3D91' },
  { id: 'teal', label: 'Teal', swatch: '#0F766E' },
  { id: 'indigo', label: 'Indigo', swatch: '#4338CA' },
  { id: 'forest', label: 'Forest', swatch: '#166534' },
  { id: 'light', label: 'Clean Light', swatch: '#111827' },
  { id: 'dark', label: 'Dark', swatch: '#0F172A' },
];

/** Mutable palette used by StyleSheets that import `colors` directly.
 * Prefer useTheme().colors in new code; this keeps older screens working. */
export let colors: AppColors = { ...THEMES.blue };

export function applyThemeColors(id: ThemeId) {
  const next = THEMES[id] || THEMES.blue;
  Object.assign(colors, next);
  return colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
