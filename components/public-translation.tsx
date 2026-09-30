"use client";
import { useEffect } from "react";
import type { LanguageCode } from "@/lib/languages";
const excluded =
  'script,style,noscript,textarea,code,pre,[translate="no"],[data-private], [contenteditable="true"]';
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
// Translate display text only. Form values, URLs, contact details and reservation IDs are never sent.
const eligible = (text: string) =>
  !!text &&
  text.length <= 3000 &&
  /\p{L}/u.test(text) &&
  !/@|https?:|[0-9a-f]{8}-[0-9a-f-]{27,}|\d{7,}/i.test(text);
type Entry = { original: string; translated: string };
export function PublicTranslation({
  language,
  path,
  onError,
  onBusy,
}: {
  language: LanguageCode;
  path: string;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  useEffect(() => {
    if (language === "en" || path.startsWith("/admin")) {
      document.documentElement.lang = "en";
      return;
    }
    let disposed = false,
      running = false,
      dirty = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const nodes = new Map<Text, Entry>();
    const attributes = new Map<Element, Map<string, Entry>>();
    const cache = new Map<string, string>();
    const restore = () => {
      for (const [node, entry] of nodes)
        if (node.isConnected && node.data === entry.translated)
          node.data = entry.original;
      for (const [el, entries] of attributes)
        for (const [attr, entry] of entries)
          if (el.isConnected && el.getAttribute(attr) === entry.translated)
            el.setAttribute(attr, entry.original);
      document.documentElement.lang = "en";
    };
    const source = (node: Text) => {
      const previous = nodes.get(node);
      return previous && node.data === previous.translated
        ? previous.original
        : node.data;
    };
    async function translate() {
      if (disposed || running) return;
      running = true;
      dirty = false;
      const targets: { text: string; apply: (translated: string) => void }[] =
        [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        if (!parent || parent.closest(excluded)) continue;
        const original = source(textNode);
        const text = normalize(original);
        if (!eligible(text)) continue;
        targets.push({
          text,
          apply: (value) => {
            if (!textNode.isConnected || source(textNode) !== original) return;
            const translated = original.replace(original.trim(), value);
            nodes.set(textNode, { original, translated });
            if (textNode.data !== translated) textNode.data = translated;
          },
        });
      }
      for (const el of document.body.querySelectorAll(
        "[placeholder],[aria-label],[alt],[title]",
      )) {
        if (el.closest(excluded)) continue;
        for (const attr of ["placeholder", "aria-label", "alt", "title"]) {
          const current = el.getAttribute(attr);
          if (!current) continue;
          const previous = attributes.get(el)?.get(attr);
          const original =
            previous && current === previous.translated
              ? previous.original
              : current;
          const text = normalize(original);
          if (!eligible(text)) continue;
          targets.push({
            text,
            apply: (value) => {
              if (!el.isConnected) return;
              const latest = el.getAttribute(attr),
                old = attributes.get(el)?.get(attr);
              if (latest !== original && latest !== old?.translated) return;
              const entries = attributes.get(el) || new Map();
              entries.set(attr, { original, translated: value });
              attributes.set(el, entries);
              if (latest !== value) el.setAttribute(attr, value);
            },
          });
        }
      }
      for (const [n] of nodes) if (!n.isConnected) nodes.delete(n);
      for (const [el] of attributes) if (!el.isConnected) attributes.delete(el);
      const missing = [...new Set(targets.map((t) => t.text))].filter(
        (text) => !cache.has(text),
      );
      if (missing.length) onBusy(true);
      try {
        while (missing.length) {
          const batch: string[] = [];
          let count = 0;
          while (
            missing.length &&
            batch.length < 100 &&
            count + missing[0].length <= 10000
          ) {
            const text = missing.shift()!;
            batch.push(text);
            count += text.length;
          }
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ language, texts: batch }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "Translation unavailable. Showing English.",
            );
          if (
            !Array.isArray(result.translations) ||
            result.translations.length !== batch.length
          )
            throw new Error("Translation unavailable. Showing English.");
          batch.forEach((text, i) => cache.set(text, result.translations[i]));
        }
        if (disposed) return;
        observer.disconnect();
        targets.forEach((t) => {
          const value = cache.get(t.text);
          if (value !== undefined) t.apply(value);
        });
        document.documentElement.lang = language;
        observe();
      } catch (error) {
        if (!disposed) {
          disposed = true;
          observer.disconnect();
          restore();
          onError(
            error instanceof Error
              ? error.message
              : "Translation unavailable. Showing English.",
          );
        }
      } finally {
        running = false;
        if (!disposed) {
          onBusy(false);
          if (dirty) schedule();
        }
      }
    }
    // Observe React updates without replacing its nodes or modifying input values.
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(() => void translate(), 350);
    };
    const observer = new MutationObserver(() => {
      dirty = true;
      schedule();
    });
    const observe = () =>
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "aria-label", "alt", "title"],
      });
    observe();
    void translate();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      observer.disconnect();
      restore();
      onBusy(false);
    };
  }, [language, path, onError, onBusy]);
  return null;
}
