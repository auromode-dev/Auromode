import type { LanguageCode } from "./languages";

export type Dictionary = Readonly<Record<string, string>>;
const loaders = {
  ta: () => import("./translations/ta.json"),
  fr: () => import("./translations/fr.json"),
  hi: () => import("./translations/hi.json"),
  de: () => import("./translations/de.json"),
  es: () => import("./translations/es.json"),
  it: () => import("./translations/it.json"),
  nl: () => import("./translations/nl.json"),
  ru: () => import("./translations/ru.json"),
  "zh-Hans": () => import("./translations/zh-Hans.json"),
};
export async function loadDictionary(
  language: LanguageCode,
): Promise<Dictionary> {
  return language === "en" ? {} : (await loaders[language]()).default;
}
export const normalizeTranslationText = (text: string) =>
  text.replace(/\s+/g, " ").trim();

// Only exact reviewed phrases and explicitly declared numeric templates match.
// Unknown content remains English; never invent or partially translate new terms.
export function translateStored(text: string, dictionary: Dictionary): string {
  const key = normalizeTranslationText(text);
  if (Object.hasOwn(dictionary, key)) return dictionary[key];
  for (const [source, target] of Object.entries(dictionary)) {
    if (!source.includes("{")) continue;
    const parameters: string[] = [];
    const pattern = source
      .split(/(\{[a-zA-Z]+\})/g)
      .map((part) => {
        if (/^\{[a-zA-Z]+\}$/.test(part)) {
          parameters.push(part);
          return "([0-9][0-9,.-]*)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    const match = key.match(new RegExp("^" + pattern + "$"));
    if (match)
      return target.replace(
        /\{[a-zA-Z]+\}/g,
        (parameter) => match[parameters.indexOf(parameter) + 1] ?? parameter,
      );
  }
  return key;
}
