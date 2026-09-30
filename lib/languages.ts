export const languages = [
  { code: "en", name: "English", nativeName: "English", flag: "gb" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "in" },
  { code: "fr", name: "French", nativeName: "Français", flag: "fr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "in" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "de" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "es" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "it" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "nl" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "ru" },
  { code: "zh-Hans", name: "Chinese", nativeName: "简体中文", flag: "cn" },
] as const;
export type LanguageCode = (typeof languages)[number]["code"];
export function isLanguage(value: string): value is LanguageCode {
  return languages.some((l) => l.code === value);
}
