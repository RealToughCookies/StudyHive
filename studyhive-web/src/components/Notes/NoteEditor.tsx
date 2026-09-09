import { saveFlashcardDeck, assertActiveAccount } from '../../services/studyMaterials'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Save, Sparkles, FileQuestion, GraduationCap, BookOpen, Tag, Bold, Italic, List, ListOrdered, Highlighter, Underline, Image, Table, X, Trash2, MousePointerClick, Minus, Plus, Type, Layers, Check } from 'lucide-react'
import { Note, Class } from '../../types'
import { useStore } from '../../store'
import { generateFlashcards, generateQuiz, generateStudyGuide } from '../../services/openai'
import AttachmentManager from './AttachmentManager'
import { useNoteAutosave } from '../../hooks/useNoteAutosave'

interface NoteEditorProps {
  note: Note | null
  classes?: Class[]
  onBack: () => void
  onUpdate: (note: Note) => void
}

const HIGHLIGHT_OPTIONS = [
  { name: 'Yellow', className: 'highlight-yellow', preview: '#fef08a' },
  { name: 'Green', className: 'highlight-green', preview: '#bbf7d0' },
  { name: 'Blue', className: 'highlight-blue', preview: '#bfdbfe' },
  { name: 'Pink', className: 'highlight-pink', preview: '#fbcfe8' },
  { name: 'Orange', className: 'highlight-orange', preview: '#fed7aa' },
  { name: 'Purple', className: 'highlight-purple', preview: '#ddd6fe' },
]

const NoteEditor = ({ note, classes = [], onBack, onUpdate }: NoteEditorProps) => {
  const { currentUser, settings } = useStore()
  const [title, setTitle] = useState(note?.title || 'Untitled Note')
  const [classId, setClassId] = useState<number | undefined>(note?.class_id)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationType, setGenerationType] = useState<'flashcards' | 'quiz' | 'study-guide' | null>(null)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableSize, setTableSize] = useState({ rows: 0, cols: 0 })
  const [customRows, setCustomRows] = useState('')
  const [customCols, setCustomCols] = useState('')
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null)
  const [fontSize, setFontSize] = useState(18)
  const [showFlashcardCreator, setShowFlashcardCreator] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [deckCards, setDeckCards] = useState<{ front: string; back: string }[]>([])
  const [cardFront, setCardFront] = useState('')
  const [cardBack, setCardBack] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef(note?.content || '')
  const { isSaving, lastSaved, saveError, triggerSave, saveNote } = useNoteAutosave(note, title, classId, contentRef, onUpdate)
  const handleInputRef = useRef<() => void>(() => {})
  const colResizeState = useRef({
    active: false,
    startX: 0,
    startWidth: 0,
    colIndex: -1,
    table: null as HTMLTableElement | null,
    tableStartWidth: 0,
  })

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && note?.content) {
      editorRef.current.innerHTML = note.content
      contentRef.current = note.content
    }
  }, [note?.id])

  // Escape closes the deck creator modal
  useEffect(() => {
    if (!showFlashcardCreator) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowFlashcardCreator(false)
        setDeckName('')
        setDeckCards([])
        setCardFront('')
        setCardBack('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showFlashcardCreator])

  // Remove highlight spans that have become empty so cursor doesn't inherit the color.
  // \u200B = zero-width space, \u00a0 = non-breaking space Chrome inserts into empty spans.
  const cleanupEmptyHighlights = () => {
    const editor = editorRef.current
    if (!editor) return
    const HIGHLIGHT_SEL = HIGHLIGHT_OPTIONS.map(h => `.${h.className}`).join(',')
    const empties = Array.from(editor.querySelectorAll<HTMLElement>(HIGHLIGHT_SEL))
      .filter(span => !(span.textContent || '').replace(/[\u200B\u00a0]/g, '').trim())
    if (empties.length === 0) return
    const sel = window.getSelection()
    empties.forEach(span => {
      const parent = span.parentNode
      if (!parent) { span.remove(); return }
      const cursorInSpan = sel?.rangeCount ? span.contains(sel.getRangeAt(0).startContainer) : false
      const prev = span.previousSibling
      span.remove()
      if (cursorInSpan && sel) {
        try {
          const r = document.createRange()
          if (prev?.nodeType === Node.TEXT_NODE) r.setStart(prev, (prev as Text).length)
          else if (prev) r.setStartAfter(prev)
          else r.setStart(parent, 0)
          r.collapse(true)
          sel.removeAllRanges()
          sel.addRange(r)
        } catch (_) { /* ignore range errors */ }
      }
    })
  }

  // Chrome's contenteditable reads the *computed* background-color / color from adjacent
  // highlight spans and re-applies them as inline styles on the next typed character,
  // creating e.g. <span style="background-color:#fef08a">newchar</span>.
  // Our highlights are class-based, so any <span style="…"> carrying these properties
  // was injected by the browser and must be unwrapped immediately.
  const cleanupBrowserHighlightSpans = () => {
    const editor = editorRef.current
    if (!editor) return
    const highlightClasses = HIGHLIGHT_OPTIONS.map(h => h.className)
    editor.querySelectorAll<HTMLElement>('span[style]').forEach(el => {
      if (highlightClasses.some(c => el.classList.contains(c))) return // our span, leave it
      if (el.style.backgroundColor || el.style.color) {
        const frag = document.createDocumentFragment()
        while (el.firstChild) frag.appendChild(el.firstChild)
        el.replaceWith(frag)
      }
    })
  }

  // Handle content changes
  const handleInput = () => {
    if (editorRef.current) {
      cleanupEmptyHighlights()
      cleanupBrowserHighlightSpans()
      contentRef.current = editorRef.current.innerHTML
      triggerSave()
    }
  }
  handleInputRef.current = handleInput

  const formatLastSaved = () => {
    if (saveError) return saveError
    if (!lastSaved) return 'Not saved yet'
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000)
    if (seconds < 5) return 'Saved just now'
    if (seconds < 60) return `Saved ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `Saved ${minutes}m ago`
  }

  // Formatting commands
  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    handleInput()
  }

  const applyBold = () => execFormat('bold')
  const applyItalic = () => execFormat('italic')
  const applyUnderline = () => execFormat('underline')

  // After execCommand list toggle, browsers inject inline styles (background-color, color)
  // by copying computed values off highlight spans/elements. Strip them all so class-based
  // highlights continue to work correctly.
  const cleanupListToggle = () => {
    const editor = editorRef.current
    if (!editor) return
    const highlightClasses = HIGHLIGHT_OPTIONS.map(h => h.className)

    // Strip browser-injected inline styles from highlight spans (keep the class, lose the style attr)
    editor.querySelectorAll<HTMLElement>(highlightClasses.map(c => `span.${c}`).join(',')).forEach(el => {
      el.removeAttribute('style')
    })

    // Strip browser-injected color/background-color from div wrappers (converted from <li>)
    editor.querySelectorAll<HTMLElement>('div[style], p[style]').forEach(el => {
      el.style.removeProperty('background-color')
      el.style.removeProperty('color')
      if (el.style.cssText.trim() === '') el.removeAttribute('style')
    })

    // Unwrap browser-generated <span style="..."> wrappers that have no highlight class
    editor.querySelectorAll<HTMLElement>('span[style]').forEach(el => {
      if (!highlightClasses.some(c => el.classList.contains(c))) {
        const frag = document.createDocumentFragment()
        while (el.firstChild) frag.appendChild(el.firstChild)
        el.replaceWith(frag)
      }
    })
  }

  const insertList = () => {
    editorRef.current?.focus()
    document.execCommand('insertUnorderedList', false, undefined)
    cleanupListToggle()
    handleInput()
  }

  const insertOrderedList = () => {
    editorRef.current?.focus()
    document.execCommand('insertOrderedList', false, undefined)
    cleanupListToggle()
    handleInput()
  }

  const removeHighlightsInRange = (range: Range) => {
    // Find all highlight spans that overlap the selection
    const container = range.commonAncestorContainer
    const root = container.nodeType === Node.ELEMENT_NODE
      ? (container as HTMLElement)
      : container.parentElement
    if (!root) return

    const highlightSpans = Array.from(
      (root.closest('.note-editor') || root).querySelectorAll(
        HIGHLIGHT_OPTIONS.map(h => `.${h.className}`).join(',')
      )
    ).filter(span => range.intersectsNode(span))

    for (const span of highlightSpans) {
      const parent = span.parentNode
      if (!parent) continue
      // Replace the span with its children (unwrap)
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span)
      }
      parent.removeChild(span)
    }
    // Normalize to merge adjacent text nodes
    root.closest('.note-editor')?.normalize()
  }

  const applyHighlight = (className: string | null) => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setShowHighlightPicker(false)
      return
    }

    const range = selection.getRangeAt(0)
    if (range.collapsed) {
      setShowHighlightPicker(false)
      return
    }

    // Use invisible DOM markers to survive normalize() inside removeHighlightsInRange.
    // After DOM mutation the original range containers may be gone; markers let us
    // reconstruct the exact same text range afterward.
    const START = document.createElement('span')
    const END = document.createElement('span')
    START.setAttribute('data-hl-start', '1')
    END.setAttribute('data-hl-end', '1')

    try {
      // Insert END first so inserting START doesn't shift END's position
      const endRange = range.cloneRange()
      endRange.collapse(false)
      endRange.insertNode(END)

      const startRange = range.cloneRange()
      startRange.collapse(true)
      startRange.insertNode(START)
    } catch (_) {
      START.remove()
      END.remove()
      setShowHighlightPicker(false)
      return
    }

    // Build sweep range between the markers and remove existing highlights
    const sweepRange = document.createRange()
    sweepRange.setStartAfter(START)
    sweepRange.setEndBefore(END)
    removeHighlightsInRange(sweepRange)

    if (className) {
      // Reconstruct range from markers (DOM changed by removeHighlightsInRange)
      try {
        const newRange = document.createRange()
        newRange.setStartAfter(START)
        newRange.setEndBefore(END)
        if (!newRange.collapsed) {
          const span = document.createElement('span')
          span.className = className
          span.appendChild(newRange.extractContents())
          newRange.insertNode(span)
          newRange.selectNodeContents(span)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
      } catch (_) { /* ignore */ }
    }

    START.remove()
    END.remove()
    editorRef.current?.normalize()
    handleInput()
    setShowHighlightPicker(false)
  }

  // Image and table selection handling
  const handleEditorClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && target.closest('.note-editor')) {
      e.preventDefault()
      e.stopPropagation()
      setSelectedImage(target as HTMLImageElement)
      setSelectedTable(null)
    } else if (!target.closest('.image-resize-handle') && !target.closest('.image-size-input')) {
      setSelectedImage(null)
    }

    // Table selection: clicking on a table cell selects the table
    const tableEl = target.closest('.note-editor .note-table') as HTMLTableElement | null
    if (tableEl && !target.closest('.table-toolbar')) {
      setSelectedTable(tableEl)
    } else if (!target.closest('.table-toolbar')) {
      setSelectedTable(null)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('click', handleEditorClick)
    return () => document.removeEventListener('click', handleEditorClick)
  }, [handleEditorClick])

  // Column resize via drag on cell borders, table resize via right edge
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const EDGE = 6
    const state = colResizeState.current

    // Detect mouse near the right edge of any table cell
    const getCellNearRightEdge = (e: MouseEvent): HTMLTableCellElement | null => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) return null
      const cell = el.closest('.note-table td, .note-table th') as HTMLTableCellElement | null
      if (!cell) return null
      const rect = cell.getBoundingClientRect()
      if (e.clientX >= rect.right - EDGE && e.clientX <= rect.right + 2) return cell
      return null
    }

    // Detect mouse near the left edge of a table cell (resize previous column)
    const getCellNearLeftEdge = (e: MouseEvent): { cell: HTMLTableCellElement; prevIndex: number } | null => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) return null
      const cell = el.closest('.note-table td, .note-table th') as HTMLTableCellElement | null
      if (!cell || cell.cellIndex === 0) return null
      const rect = cell.getBoundingClientRect()
      if (e.clientX >= rect.left - 2 && e.clientX <= rect.left + EDGE) {
        return { cell, prevIndex: cell.cellIndex - 1 }
      }
      return null
    }

    // Get the resize target: which column index and which table
    const getResizeTarget = (e: MouseEvent): { colIndex: number; table: HTMLTableElement; width: number } | null => {
      // Check right edge first
      const rightCell = getCellNearRightEdge(e)
      if (rightCell) {
        const table = rightCell.closest('table') as HTMLTableElement
        if (table) return { colIndex: rightCell.cellIndex, table, width: rightCell.getBoundingClientRect().width }
      }
      // Check left edge (resize the column to the left)
      const leftHit = getCellNearLeftEdge(e)
      if (leftHit) {
        const table = leftHit.cell.closest('table') as HTMLTableElement
        if (table) {
          const prevCell = table.rows[0]?.cells[leftHit.prevIndex]
          if (prevCell) return { colIndex: leftHit.prevIndex, table, width: prevCell.getBoundingClientRect().width }
        }
      }
      return null
    }

    const onEditorMouseMove = (e: MouseEvent) => {
      if (state.active) return
      const target = getResizeTarget(e)
      editor.style.cursor = target ? 'col-resize' : ''
    }

    const onEditorMouseDown = (e: MouseEvent) => {
      const target = getResizeTarget(e)
      if (!target) return

      const { colIndex, table, width } = target
      e.preventDefault()

      // Capture the table's exact visual width before freezing
      const tableWidth = table.getBoundingClientRect().width

      // Freeze every cell's current width as explicit px (border-box ensures match)
      for (let r = 0; r < table.rows.length; r++) {
        for (let c = 0; c < table.rows[r].cells.length; c++) {
          table.rows[r].cells[c].style.width = `${table.rows[r].cells[c].getBoundingClientRect().width}px`
        }
      }
      table.style.tableLayout = 'fixed'
      // Explicit table width prevents fixed layout from expanding to container
      table.style.width = `${tableWidth}px`

      state.active = true
      state.startX = e.clientX
      state.startWidth = width
      state.colIndex = colIndex
      state.table = table
      state.tableStartWidth = tableWidth

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onDocMouseMove)
      document.addEventListener('mouseup', onDocMouseUp)
    }

    const onDocMouseMove = (e: MouseEvent) => {
      if (!state.active || !state.table) return
      const diff = e.clientX - state.startX
      const newWidth = Math.max(40, state.startWidth + diff)

      // Only update the dragged column — other columns stay untouched
      for (let r = 0; r < state.table.rows.length; r++) {
        const c = state.table.rows[r].cells[state.colIndex]
        if (c) c.style.width = `${newWidth}px`
      }

      // Adjust table width by the same delta so other columns aren't redistributed
      state.table.style.width = `${state.tableStartWidth + (newWidth - state.startWidth)}px`

      e.preventDefault()
    }

    const onDocMouseUp = () => {
      if (!state.active) return
      state.active = false
      state.table = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      editor.style.cursor = ''
      document.removeEventListener('mousemove', onDocMouseMove)
      document.removeEventListener('mouseup', onDocMouseUp)
      handleInputRef.current()
    }

    editor.addEventListener('mousemove', onEditorMouseMove)
    editor.addEventListener('mousedown', onEditorMouseDown)

    return () => {
      editor.removeEventListener('mousemove', onEditorMouseMove)
      editor.removeEventListener('mousedown', onEditorMouseDown)
      document.removeEventListener('mousemove', onDocMouseMove)
      document.removeEventListener('mouseup', onDocMouseUp)
    }
  }, [])

  const selectEntireTable = () => {
    if (!selectedTable) return
    const range = document.createRange()
    range.selectNodeContents(selectedTable)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  const deleteSelectedTable = () => {
    if (!selectedTable) return
    selectedTable.remove()
    setSelectedTable(null)
    handleInput()
  }

  const handleImageResize = (newWidth: number) => {
    if (selectedImage) {
      const minWidth = 50
      const maxWidth = editorRef.current?.clientWidth || 800
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      selectedImage.style.width = `${clampedWidth}px`
      selectedImage.style.height = 'auto'
      handleInput()
    }
  }

  const deleteSelectedImage = () => {
    if (selectedImage) {
      selectedImage.remove()
      setSelectedImage(null)
      handleInput()
    }
  }

  // Insert image
  const insertImage = async () => {
    try {
      const result = await window.electronAPI.file.selectImage()
      if (result) {
        const img = document.createElement('img')
        img.src = result.dataUrl
        img.alt = result.name
        img.className = 'note-image'
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        img.style.borderRadius = '8px'
        img.style.margin = '8px 0'

        editorRef.current?.focus()
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          range.insertNode(img)
          range.setStartAfter(img)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          editorRef.current?.appendChild(img)
        }

        handleInput()
      }
    } catch (error) {
      console.error('Failed to insert image:', error)
    }
  }

  // Insert table with custom size
  const insertTable = (rows: number, cols: number) => {
    let tableHtml = '<table class="note-table"><tbody>'
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>'
      for (let j = 0; j < cols; j++) {
        tableHtml += '<td><br></td>'
      }
      tableHtml += '</tr>'
    }
    tableHtml += '</tbody></table><p><br></p>'

    editorRef.current?.focus()
    document.execCommand('insertHTML', false, tableHtml)
    handleInput()
    setShowTablePicker(false)
    setTableSize({ rows: 0, cols: 0 })
  }

  // Handle paste for images
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string
            if (dataUrl) {
              const img = document.createElement('img')
              img.src = dataUrl
              img.className = 'note-image'
              img.style.maxWidth = '100%'
              img.style.height = 'auto'
              img.style.borderRadius = '8px'
              img.style.margin = '8px 0'

              const selection = window.getSelection()
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()
                range.insertNode(img)
                range.setStartAfter(img)
                range.collapse(true)
                selection.removeAllRanges()
                selection.addRange(range)
              }

              handleInput()
            }
          }
          reader.readAsDataURL(file)
        }
        return
      }
    }
  }

  // Handle keyboard shortcuts and auto-formatting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMod = e.metaKey || e.ctrlKey

    if (isMod && e.key === 'b') {
      e.preventDefault()
      applyBold()
    } else if (isMod && e.key === 'i') {
      e.preventDefault()
      applyItalic()
    } else if (isMod && e.key === 'u') {
      e.preventDefault()
      applyUnderline()
    }

    // Handle Backspace in custom lists: exit or merge with previous item
    if (e.key === 'Backspace') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (range.collapsed) {
          const node = range.startContainer
          const li = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement)?.closest('li')
          const dashedList = li?.closest('ul.dashed-list')
          const orderedList = li?.closest('ol')
          if ((dashedList || orderedList) && li) {
            const list = (dashedList || orderedList)!
            // Detect cursor at the very start of the li (ignoring zero-width spaces)
            const isAtStart = (() => {
              try {
                const beforeRange = document.createRange()
                beforeRange.setStart(li, 0)
                beforeRange.setEnd(range.startContainer, range.startOffset)
                return beforeRange.toString().replace(/\u200B/g, '') === ''
              } catch (_) { return false }
            })()
            if (isAtStart) {
              e.preventDefault()
              const prevLi = li.previousElementSibling as HTMLElement | null
              if (prevLi) {
                // Merge this li's content into the previous li
                const prevLastChild = prevLi.lastChild
                while (li.firstChild) prevLi.appendChild(li.firstChild)
                li.remove()
                if (list.children.length === 0) list.remove()
                const newRange = document.createRange()
                if (prevLastChild?.nodeType === Node.TEXT_NODE) {
                  newRange.setStart(prevLastChild, (prevLastChild as Text).length)
                } else if (prevLastChild) {
                  newRange.setStartAfter(prevLastChild)
                } else {
                  newRange.setStart(prevLi, 0)
                }
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              } else {
                // First item: lift content out of list into a div before it
                const div = document.createElement('div')
                const content = li.innerHTML.replace(/\u200B/g, '').trim()
                div.innerHTML = content || '<br>'
                list.before(div)
                li.remove()
                if (list.children.length === 0) list.remove()
                const newRange = document.createRange()
                newRange.setStart(div, 0)
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              }
              handleInput()
            }
          }
        }
      }
    }

    // Break out of highlight spans on Enter (list-aware)
    if (e.key === 'Enter' && !e.shiftKey) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const node = selection.getRangeAt(0).startContainer
        const HIGHLIGHT_SEL = HIGHLIGHT_OPTIONS.map(h => `.${h.className}`).join(',')
        const highlightSpan = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement)
          ?.closest(HIGHLIGHT_SEL)
        if (highlightSpan) {
          const li = highlightSpan.closest('li')
          const dashedList = li?.closest('ul.dashed-list')

          if (!li) {
            // Not in a list — break out of span into a new line
            e.preventDefault()
            const range = selection.getRangeAt(0)
            const afterRange = document.createRange()
            afterRange.setStart(range.endContainer, range.endOffset)
            afterRange.setEndAfter(highlightSpan.lastChild || highlightSpan)
            const trailing = afterRange.extractContents()
            const br = document.createElement('br')
            highlightSpan.after(br)
            if (trailing.textContent) {
              br.after(trailing)
            }
            const newRange = document.createRange()
            newRange.setStartAfter(br)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
            handleInput()
            return
          }

          if (!dashedList) {
            // In a native ol/ul — let browser create new <li>, then strip the continued highlight
            setTimeout(() => {
              const sel = window.getSelection()
              if (!sel || sel.rangeCount === 0) return
              const container = sel.getRangeAt(0).startContainer
              const curEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as HTMLElement
              const newLi = curEl?.closest('li')
              if (newLi) {
                newLi.querySelectorAll<HTMLElement>(HIGHLIGHT_SEL).forEach(span => {
                  const frag = document.createDocumentFragment()
                  while (span.firstChild) frag.appendChild(span.firstChild)
                  span.replaceWith(frag)
                })
                handleInputRef.current()
              }
            }, 0)
            return // No preventDefault — browser creates the new <li>
          }

          // In a dashed-list — fall through to the dashed-list handler below.
          // It creates a clean new <li> without highlight and calls e.preventDefault().
        }
      }
    }

    // Handle "- " and "1. " to start lists
    if (e.key === ' ') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const node = range.startContainer

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || ''
          const cursorPos = range.startOffset
          const parent = node.parentElement

          // "- " → dashed bullet list
          if (cursorPos === 1 && text.charAt(0) === '-' && parent) {
            const existingList = parent.closest('ul, ol')
            if (!existingList) {
              e.preventDefault()
              node.textContent = text.substring(1)

              const ul = document.createElement('ul')
              ul.className = 'dashed-list'
              const li = document.createElement('li')
              li.innerHTML = '&#8203;'
              ul.appendChild(li)

              if (parent.tagName === 'DIV' && parent !== editorRef.current) {
                parent.replaceWith(ul)
              } else {
                range.deleteContents()
                range.insertNode(ul)
              }

              const newRange = document.createRange()
              newRange.setStart(li, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
              handleInput()
            }
          }

          // "1. " → numbered list
          if (cursorPos === 2 && text.charAt(0) === '1' && text.charAt(1) === '.' && parent) {
            const existingList = parent.closest('ul, ol')
            if (!existingList) {
              e.preventDefault()
              node.textContent = text.substring(2)

              const ol = document.createElement('ol')
              const li = document.createElement('li')
              li.innerHTML = '&#8203;'
              ol.appendChild(li)

              if (parent.tagName === 'DIV' && parent !== editorRef.current) {
                parent.replaceWith(ol)
              } else {
                range.deleteContents()
                range.insertNode(ol)
              }

              const newRange = document.createRange()
              newRange.setStart(li, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
              handleInput()
            }
          }
        }
      }
    }

    // Handle Enter key in custom lists (dashed ul and our ol)
    if (e.key === 'Enter' && !e.shiftKey) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const node = range.startContainer
        const li = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement)?.closest('li')
        const dashedList = li?.closest('ul.dashed-list')
        const orderedList = li?.closest('ol')

        if ((dashedList || orderedList) && li) {
          e.preventDefault()

          const list = dashedList || orderedList!
          const liText = li.textContent?.replace(/\u200B/g, '').trim() || ''
          if (liText === '') {
            const p = document.createElement('div')
            p.innerHTML = '<br>'
            list.after(p)

            li.remove()

            if (list.children.length === 0) {
              list.remove()
            }

            const newRange = document.createRange()
            newRange.setStart(p, 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
          } else {
            // Move the content after the caret into the new item, preserving inline formatting.
            range.deleteContents()
            const trailingRange = document.createRange()
            trailingRange.setStart(range.startContainer, range.startOffset)
            trailingRange.setEnd(li, li.childNodes.length)
            const newLi = document.createElement('li')
            newLi.appendChild(trailingRange.extractContents())
            newLi.querySelectorAll<HTMLElement>('[class*="highlight-"]').forEach(span => {
              span.replaceWith(...Array.from(span.childNodes))
            })
            if (!newLi.hasChildNodes()) newLi.innerHTML = '&#8203;'
            if (!li.hasChildNodes()) li.innerHTML = '&#8203;'
            li.after(newLi)

            const newRange = document.createRange()
            newRange.setStart(newLi, 0)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)
          }

          handleInput()
        }
      }
    }
  }

  // Get plain text for AI features and word count
  const getPlainText = () => {
    return editorRef.current?.innerText || editorRef.current?.textContent || ''
  }

  const handleGenerateFlashcards = async () => {
    const plainText = getPlainText()
    if (!plainText.trim()) {
      alert('Please add some content to your note first.')
      return
    }
    if (!settings?.openai_api_key) {
      alert('Please add your OpenAI API key in Settings to use AI features.')
      return
    }
    setIsGenerating(true)
    setGenerationType('flashcards')
    try {
      const flashcards = await generateFlashcards(plainText, settings.openai_api_key)
      await saveFlashcardDeck(currentUser!.id, title, flashcards, classId, note?.id)
      alert(`Created deck "${title}" with ${flashcards.length} flashcards! View it in the Flashcards section.`)
    } catch (error: any) {
      console.error('Failed to generate flashcards:', error)
      alert(error.message || 'Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
      setGenerationType(null)
    }
  }

  const handleGenerateQuiz = async () => {
    const plainText = getPlainText()
    if (!plainText.trim()) {
      alert('Please add some content to your note first.')
      return
    }
    if (!settings?.openai_api_key) {
      alert('Please add your OpenAI API key in Settings to use AI features.')
      return
    }
    setIsGenerating(true)
    setGenerationType('quiz')
    try {
      const questions = await generateQuiz(plainText, settings.openai_api_key)
      assertActiveAccount(currentUser!.id)
      await window.electronAPI.db.run(
        `INSERT INTO quizzes (user_id, note_id, class_id, title, questions, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [currentUser?.id, note?.id, classId || null, `Quiz: ${title}`, JSON.stringify(questions)]
      )
      alert(`Successfully generated quiz with ${questions.length} questions! View it in the Quizzes section.`)
    } catch (error: any) {
      console.error('Failed to generate quiz:', error)
      alert(error.message || 'Failed to generate quiz')
    } finally {
      setIsGenerating(false)
      setGenerationType(null)
    }
  }

  const handleGenerateStudyGuide = async () => {
    const plainText = getPlainText()
    if (!plainText.trim()) {
      alert('Please add some content to your note first.')
      return
    }
    if (!settings?.openai_api_key) {
      alert('Please add your OpenAI API key in Settings to use AI features.')
      return
    }
    setIsGenerating(true)
    setGenerationType('study-guide')
    try {
      const studyGuide = await generateStudyGuide(plainText, settings.openai_api_key)
      const { markdownToNoteHtml } = await import('../../services/markdown')
      assertActiveAccount(currentUser!.id)
      await window.electronAPI.db.run(
        `INSERT INTO notes (user_id, class_id, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [currentUser?.id, classId || null, `Study Guide: ${title}`, markdownToNoteHtml(studyGuide)]
      )
      alert('Successfully generated study guide! It has been saved as a new note.')
    } catch (error: any) {
      console.error('Failed to generate study guide:', error)
      alert(error.message || 'Failed to generate study guide')
    } finally {
      setIsGenerating(false)
      setGenerationType(null)
    }
  }

  const saveDeckCards = async () => {
    if (!currentUser) return
    if (!deckName.trim()) {
      alert('Please enter a deck name.')
      return
    }
    if (deckCards.length === 0) {
      alert('Add at least one card before saving.')
      return
    }
    try {
      await saveFlashcardDeck(currentUser.id, deckName.trim(), deckCards, classId, note?.id)
      alert(`Saved deck "${deckName.trim()}" with ${deckCards.length} card${deckCards.length !== 1 ? 's' : ''}!`)
      setDeckName('')
      setDeckCards([])
      setCardFront('')
      setCardBack('')
      setShowFlashcardCreator(false)
    } catch (error) {
      console.error('Failed to save flashcard deck:', error)
      alert('Failed to save flashcard deck')
    }
  }

  const wordCount = getPlainText().split(/\s+/).filter(Boolean).length
  const charCount = getPlainText().length

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={async () => { if (await saveNote()) onBack() }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold text-gray-900 border-none outline-none bg-transparent w-64"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            placeholder="Note title..."
          />
          {/* Class Selector */}
          {classes.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              <select
                value={classId || ''}
                onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : undefined)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="">No Class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
              {classId && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: classes.find(c => c.id === classId)?.color }}
                />
              )}
            </div>
          )}
        </div>

        <button type="button" onClick={saveNote} disabled={isSaving} title="Save note" className="flex items-center gap-2 text-sm text-gray-500">
          {isSaving ? (
            <>
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {formatLastSaved()}
            </>
          )}
        </button>
      </div>

      {/* AI Actions Bar */}
      <div className="bg-gradient-to-r from-primary-light to-primary px-8 py-3 flex flex-wrap items-center gap-3">
        <Sparkles className="w-5 h-5 text-white" />
        <span className="text-white font-medium text-sm">AI Tools:</span>
        <button
          onClick={handleGenerateFlashcards}
          disabled={isGenerating}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating && generationType === 'flashcards' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <GraduationCap className="w-4 h-4" />
          )}
          Generate Flashcards
        </button>
        <button
          onClick={handleGenerateQuiz}
          disabled={isGenerating}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating && generationType === 'quiz' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileQuestion className="w-4 h-4" />
          )}
          Generate Quiz
        </button>
        <button
          onClick={handleGenerateStudyGuide}
          disabled={isGenerating}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating && generationType === 'study-guide' ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <BookOpen className="w-4 h-4" />
          )}
          Create Study Guide
        </button>
        <button
          onClick={() => setShowFlashcardCreator(true)}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Layers className="w-4 h-4" />
          Create Deck
        </button>
      </div>

      {/* Formatting Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-2 flex items-center gap-1">
        <button
          onClick={applyBold}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Bold (⌘B)"
        >
          <Bold className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={applyItalic}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Italic (⌘I)"
        >
          <Italic className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={applyUnderline}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Underline (⌘U)"
        >
          <Underline className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={insertList}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Bullet List"
        >
          <List className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={insertOrderedList}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <div className="relative">
          <button
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            className={`p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors ${showHighlightPicker ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
            title="Highlight"
          >
            <Highlighter className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">Select text first, then pick a color</p>
              <div className="flex gap-1">
                {HIGHLIGHT_OPTIONS.map((hl) => (
                  <button
                    key={hl.name}
                    onClick={() => applyHighlight(hl.className)}
                    className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: hl.preview }}
                    title={hl.name}
                  />
                ))}
                <button
                  onClick={() => applyHighlight(null)}
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform bg-white dark:bg-gray-700 flex items-center justify-center"
                  title="Remove highlight"
                >
                  <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          onClick={insertImage}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Insert Image"
        >
          <Image className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowTablePicker(!showTablePicker)}
            className={`p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors ${showTablePicker ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
            title="Insert Table"
          >
            <Table className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          {showTablePicker && (
            <div
              className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10"
              onMouseLeave={() => { setShowTablePicker(false); setTableSize({ rows: 0, cols: 0 }) }}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {tableSize.rows > 0 ? `${tableSize.rows} × ${tableSize.cols}` : 'Select size'}
              </p>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                {Array.from({ length: 8 }).map((_, row) =>
                  Array.from({ length: 8 }).map((_, col) => (
                    <button
                      key={`${row}-${col}`}
                      className={`w-4 h-4 border rounded-sm transition-colors ${
                        row < tableSize.rows && col < tableSize.cols
                          ? 'bg-primary border-primary'
                          : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                      }`}
                      onMouseEnter={() => setTableSize({ rows: row + 1, cols: col + 1 })}
                      onClick={() => insertTable(row + 1, col + 1)}
                    />
                  ))
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Custom size</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customRows}
                    onChange={(e) => setCustomRows(e.target.value)}
                    placeholder="rows"
                    className="w-14 px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <span className="text-xs text-gray-400">×</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customCols}
                    onChange={(e) => setCustomCols(e.target.value)}
                    placeholder="cols"
                    className="w-14 px-1.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      const r = parseInt(customRows)
                      const c = parseInt(customCols)
                      if (r > 0 && c > 0) {
                        insertTable(r, c)
                        setCustomRows('')
                        setCustomCols('')
                      }
                    }}
                    className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                  >
                    Insert
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <div className="flex items-center gap-1">
          <Type className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <button
            onClick={() => setFontSize(s => Math.max(12, s - 2))}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Decrease font size"
          >
            <Minus className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400 w-7 text-center font-mono">{fontSize}</span>
          <button
            onClick={() => setFontSize(s => Math.min(32, s + 2))}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Increase font size"
          >
            <Plus className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-400">
          ⌘B Bold | ⌘I Italic | ⌘U Underline
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-8 py-6 bg-white dark:bg-gray-900 relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
              cleanupEmptyHighlights()
              cleanupBrowserHighlightSpans()
            }
          }}
          onPaste={handlePaste}
          className="note-editor min-h-full outline-none text-gray-900 dark:text-gray-100 leading-relaxed"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: `${fontSize}px`,
          }}
          data-placeholder="Start writing your notes here..."
          suppressContentEditableWarning
        />

        {/* Image resize overlay */}
        {selectedImage && (
          <div
            className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 flex items-center gap-2"
            style={{
              top: selectedImage.getBoundingClientRect().top - 48,
              left: selectedImage.getBoundingClientRect().left,
            }}
          >
            <input
              type="number"
              value={selectedImage.offsetWidth}
              onChange={(e) => handleImageResize(Number(e.target.value))}
              className="image-size-input w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              min={50}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">px</span>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <button
              onClick={() => handleImageResize(selectedImage.naturalWidth * 0.25)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              25%
            </button>
            <button
              onClick={() => handleImageResize(selectedImage.naturalWidth * 0.5)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              50%
            </button>
            <button
              onClick={() => handleImageResize(selectedImage.naturalWidth)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              100%
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <button
              onClick={deleteSelectedImage}
              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="Delete image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table toolbar overlay */}
        {selectedTable && (
          <div
            className="table-toolbar fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-50 flex items-center gap-2"
            style={{
              top: selectedTable.getBoundingClientRect().top - 48,
              left: selectedTable.getBoundingClientRect().left,
            }}
          >
            <button
              onClick={selectEntireTable}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center gap-1"
              title="Select entire table"
            >
              <MousePointerClick className="w-3 h-3" />
              Select All
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <button
              onClick={deleteSelectedTable}
              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              title="Delete table"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Attachments */}
      {note && (
        <div className="px-8 pb-4 bg-white dark:bg-gray-900">
          <AttachmentManager noteId={note.id} />
        </div>
      )}

      {/* Stats Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-8 py-3 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center gap-6">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div>
          Last edited: {new Date(note?.updated_at || Date.now()).toLocaleString()}
        </div>
      </div>

      {/* Flashcard Deck Creator Modal */}
      {showFlashcardCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Flashcard Deck</h2>
              </div>
              <button
                onClick={() => { setShowFlashcardCreator(false); setDeckName(''); setDeckCards([]); setCardFront(''); setCardBack('') }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deck Name</label>
                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="e.g. Biology Chapter 5"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                <textarea
                  value={cardFront}
                  onChange={e => setCardFront(e.target.value)}
                  placeholder="Front (question / term)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
                <textarea
                  value={cardBack}
                  onChange={e => setCardBack(e.target.value)}
                  placeholder="Back (answer / definition)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
                <button
                  onClick={() => {
                    if (!cardFront.trim() || !cardBack.trim()) return
                    setDeckCards(cards => [...cards, { front: cardFront.trim(), back: cardBack.trim() }])
                    setCardFront('')
                    setCardBack('')
                  }}
                  disabled={!cardFront.trim() || !cardBack.trim()}
                  className="w-full py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add Card
                </button>
              </div>
              {deckCards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {deckCards.length} card{deckCards.length !== 1 ? 's' : ''}
                  </p>
                  {deckCards.map((card, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{card.front}</p>
                        <p className="text-gray-500 dark:text-gray-400 truncate">{card.back}</p>
                      </div>
                      <button
                        onClick={() => setDeckCards(cards => cards.filter((_, idx) => idx !== i))}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-400 hover:text-red-500 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={saveDeckCards}
                disabled={deckCards.length === 0}
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Deck ({deckCards.length} card{deckCards.length !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor styling */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .dark-mode .note-editor {
          color: #f3f4f6;
        }
        .note-editor ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .note-editor ul.dashed-list {
          list-style-type: none;
          padding-left: 1.5em;
        }
        .note-editor ul.dashed-list li::before {
          content: "–";
          position: absolute;
          margin-left: -1.2em;
          color: inherit;
        }
        .note-editor ul.dashed-list li {
          position: relative;
        }
        .note-editor ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .note-editor li {
          margin: 0.25em 0;
        }
        /* Images */
        .note-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 8px 0;
          cursor: pointer;
          transition: outline 0.15s ease;
        }
        .note-editor img:hover {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        /* Tables */
        .note-editor .note-table {
          border-collapse: collapse;
          margin: 1em 0;
          font-size: 0.95em;
          border: 2px solid #9ca3af;
        }
        .note-editor .note-table td,
        .note-editor .note-table th {
          box-sizing: border-box;
          border: 1.5px solid #9ca3af;
          padding: 8px 12px;
          text-align: left;
          min-width: 40px;
          overflow-wrap: break-word;
        }
        .dark-mode .note-editor .note-table {
          border-color: #6b7280;
        }
        .dark-mode .note-editor .note-table td,
        .dark-mode .note-editor .note-table th {
          border-color: #6b7280;
        }
        /* Highlight colors - light mode */
        .highlight-yellow { background-color: #fef08a; padding: 2px 4px; border-radius: 3px; }
        .highlight-green { background-color: #bbf7d0; padding: 2px 4px; border-radius: 3px; }
        .highlight-blue { background-color: #bfdbfe; padding: 2px 4px; border-radius: 3px; }
        .highlight-pink { background-color: #fbcfe8; padding: 2px 4px; border-radius: 3px; }
        .highlight-orange { background-color: #fed7aa; padding: 2px 4px; border-radius: 3px; }
        .highlight-purple { background-color: #ddd6fe; padding: 2px 4px; border-radius: 3px; }
        /* Highlight colors - dark mode */
        .dark-mode .highlight-yellow { background-color: rgba(254, 240, 138, 0.3); color: #fef08a; }
        .dark-mode .highlight-green { background-color: rgba(187, 247, 208, 0.3); color: #bbf7d0; }
        .dark-mode .highlight-blue { background-color: rgba(191, 219, 254, 0.3); color: #bfdbfe; }
        .dark-mode .highlight-pink { background-color: rgba(251, 207, 232, 0.3); color: #fbcfe8; }
        .dark-mode .highlight-orange { background-color: rgba(254, 215, 170, 0.3); color: #fed7aa; }
        .dark-mode .highlight-purple { background-color: rgba(221, 214, 254, 0.3); color: #ddd6fe; }
      `}</style>
    </div>
  )
}

export default NoteEditor
