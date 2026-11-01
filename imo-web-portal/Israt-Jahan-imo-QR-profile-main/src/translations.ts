import { Language, Translations } from './types';

const englishStrings: Translations = {
  myQrCode: 'My QR code',
  scanToAdd: 'Scan the QR code to add me on imo',
  temporaryQrCode: 'Temporary QR Code',
  temporaryTitle: 'Temporary QR Code',
  temporaryDesc: 'This QR code refreshes automatically to protect your privacy. It is valid for a single session.',
  expiresIn: 'Expires in',
  regenerate: 'Reset QR Code',
  regenerating: 'Generating new code...',
  back: 'Back',
  scannerTitle: 'Scan QR Code',
  alignQr: 'Align QR code within the frame to scan',
  uploadImage: 'Scan from Gallery',
  flashlightOn: 'Flash on',
  flashlightOff: 'Flash off',
  contactFound: 'Contact Found',
  addContact: 'Add Contact',
  chatNow: 'Start Chat',
  close: 'Close',
  editProfile: 'Edit Profile & QR',
  saveImage: 'Save to Gallery',
  share: 'Share QR Code',
  copied: 'Link copied to clipboard!',
  copyLink: 'Copy invite link',
  displayName: 'Display Name',
  saveChanges: 'Save Changes',
  changeAvatar: 'Change Profile Picture',
  durationLabel: 'Code Validity',
};

export const translations: Record<Language, Translations> = {
  en: englishStrings,
  bn: englishStrings,
};
