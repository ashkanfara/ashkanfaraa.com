declare global {
  interface Window {
    clarity?: (command: string, ...args: string[]) => void
  }
}

export function clarityEvent(name: string) {
  try {
    window.clarity?.('event', name)
  } catch { /* Clarity not loaded — dev or blocked by ad blocker */ }
}

export function clarityTag(key: string, value: string) {
  try {
    window.clarity?.('set', key, value)
  } catch { /* noop */ }
}
