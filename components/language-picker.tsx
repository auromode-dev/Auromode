"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MotionButton } from "@/components/motion-controls";
import { Check, ChevronDown } from "lucide-react";
import { languages, type LanguageCode } from "@/lib/languages";
export function LanguagePicker({
  value,
  onChange,
}: {
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = languages.find((l) => l.code === value)!;
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      translate="no"
      className="language-picker"
      ref={root}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <MotionButton
        ref={trigger}
        className="language-trigger"
        type="button"
        aria-label={`Language: ${current.name}`}
        aria-expanded={open}
        aria-controls="language-options"
        onClick={() => setOpen(!open)}
      >
        <img src={`/flags/${current.flag}.svg`} alt="" width={24} height={16} />
        <span>{value === "zh-Hans" ? "ZH" : value.toUpperCase()}</span>
        <ChevronDown size={13} />
      </MotionButton>
      {open && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          id="language-options"
          className="language-options"
          role="group"
          aria-label="Choose your language"
        >
          <p>Choose your language</p>
          {languages.map((l) => (
            <button
              type="button"
              key={l.code}
              lang={l.code}
              aria-pressed={value === l.code}
              onClick={() => {
                onChange(l.code);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <img src={`/flags/${l.flag}.svg`} alt="" width={24} height={16} />
              <span>
                {l.nativeName}
                <small>{l.name}</small>
              </span>
              {value === l.code && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
