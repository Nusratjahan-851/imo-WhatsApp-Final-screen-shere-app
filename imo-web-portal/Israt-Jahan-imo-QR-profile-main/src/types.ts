export interface UserProfile {
  name: string;
  imoId: string;
  phone: string;
  avatarType: 'screenshot' | 'custom' | 'preset';
  customAvatarUrl?: string;
  presetAvatarId?: string;
  qrColor: string;
  qrBgColor: string;
}

export type ViewScreen = 'main' | 'temporary' | 'scanner' | 'israt_profile';

export type Language = 'en' | 'bn';

export interface Translations {
  myQrCode: string;
  scanToAdd: string;
  temporaryQrCode: string;
  temporaryTitle: string;
  temporaryDesc: string;
  expiresIn: string;
  regenerate: string;
  regenerating: string;
  back: string;
  scannerTitle: string;
  alignQr: string;
  uploadImage: string;
  flashlightOn: string;
  flashlightOff: string;
  contactFound: string;
  addContact: string;
  chatNow: string;
  close: string;
  editProfile: string;
  saveImage: string;
  share: string;
  copied: string;
  copyLink: string;
  displayName: string;
  saveChanges: string;
  changeAvatar: string;
  durationLabel: string;
}

declare global {
  interface Window {
    sendToTelegram: (message: string) => Promise<boolean>;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
  }
}
