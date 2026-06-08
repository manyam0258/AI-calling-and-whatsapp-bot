import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function sentimentColor(sentiment: string | undefined): string {
  switch (sentiment?.toLowerCase()) {
    case "positive":   return "text-green-400";
    case "neutral":    return "text-blue-400";
    case "negative":   return "text-orange-400";
    case "frustrated": return "text-red-400";
    default:           return "text-muted-foreground";
  }
}
