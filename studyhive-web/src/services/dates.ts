// Calendar dates are local days, not UTC timestamps.
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nextReminderDate(current: string, repeat: string): string {
  const date = new Date(`${current}T12:00:00`)
  if (repeat === 'monthly') {
    const day = date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    date.setDate(Math.min(day, lastDay))
  } else {
    date.setDate(date.getDate() + (repeat === 'weekly' ? 7 : 1))
  }
  return localDateKey(date)
}

// SQLite datetime('now') is UTC but lacks the suffix JavaScript needs.
export function parseStoredDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + 'Z' : value)
}
