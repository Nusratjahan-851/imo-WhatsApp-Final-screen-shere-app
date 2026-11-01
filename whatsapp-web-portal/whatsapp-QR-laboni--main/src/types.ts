export interface ProfileData {
  name: string;
  subtitle: string;
  phoneOrLink: string;
  avatarUrl: string;
  originalImagePath: string;
  notes?: string;
}

export type AccessibilityTheme = 'standard' | 'high-contrast-yellow' | 'high-contrast-dark';

export interface AccessibilitySettings {
  theme: AccessibilityTheme;
  largeFont: boolean;
  soundEnabled: boolean;
  voiceGuideEnabled: boolean;
  lang: 'bn' | 'en';
}

export const DEFAULT_PROFILE: ProfileData = {
  name: 'mst laboni',
  subtitle: 'WhatsApp business account',
  phoneOrLink: 'https://wa.me/qr/MSTLABONI',
  avatarUrl: '/my-logo.jpg',
  originalImagePath: '/my-logo.jpg',
  notes: 'দৃষ্টি প্রতিবন্ধী ভাই ও বোনদের জন্য সহজ হোয়াটসঅ্যাপ কিউআর শেয়ারিং',
};
