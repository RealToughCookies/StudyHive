export function notePlainText(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  container.querySelectorAll('script, style').forEach(element => element.remove())
  container.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, br').forEach(element => element.append('\n'))
  return container.textContent?.trim() || ''
}
