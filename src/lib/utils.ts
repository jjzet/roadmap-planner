import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Strip HTML tags for plain-text consumers (search, logs, badges)
export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  if (!/<[^>]+>/.test(html)) return html;
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').trim();
}
