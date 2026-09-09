import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function markdownToNoteHtml(markdown: string): string {
  // Raw HTML is disabled; model output becomes the same HTML format the editor saves.
  return renderToStaticMarkup(createElement(ReactMarkdown, { children: markdown, remarkPlugins: [remarkGfm], skipHtml: true }))
}

