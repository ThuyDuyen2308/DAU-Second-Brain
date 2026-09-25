// lib/utils.ts
/**
 * Utility gộp className thuần TypeScript/JavaScript không cần thư viện ngoài.
 * An toàn, không phụ thuộc clsx hay tailwind-merge khi cài đặt trên môi trường Windows.
 */
export type ClassValue = string | number | boolean | undefined | null | { [key: string]: any } | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === "object") {
      for (const key of Object.keys(input)) {
        if ((input as any)[key]) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(" ");
}
