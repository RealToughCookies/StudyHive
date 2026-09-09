import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { NoteAttachment } from '../../types'
import { Paperclip, FileText, Image, File, Download, Trash2, Plus } from 'lucide-react'

interface AttachmentManagerProps {
  noteId: number
}

const AttachmentManager = ({ noteId }: AttachmentManagerProps) => {
  const { currentUser } = useStore()
  const [attachments, setAttachments] = useState<NoteAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadAttachments()
  }, [noteId, currentUser])

  const loadAttachments = async () => {
    if (!currentUser || !noteId) return
    try {
      const results = await window.electronAPI.db.query(
        'SELECT * FROM note_attachments WHERE note_id = ? AND user_id = ? ORDER BY created_at DESC',
        [noteId, currentUser.id]
      )
      setAttachments(results || [])
    } catch (error) {
      console.error('Failed to load attachments:', error)
    }
  }

  const handleAddFiles = async () => {
    if (!currentUser || !noteId) return

    try {
      setUploading(true)
      setErrorMessage('')
      const files = await window.electronAPI.file.selectFiles()

      for (const file of files) {
        const { filename, stats } = await window.electronAPI.file.saveAttachment(file.path, file.name)

        try {
          await window.electronAPI.db.run(
          `INSERT INTO note_attachments (note_id, user_id, filename, original_name, file_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [noteId, currentUser.id, filename, file.name, stats?.type || '', stats?.size || 0]
          )
        } catch (error) {
          await window.electronAPI.file.deleteAttachment(filename).catch(() => {})
          throw error
        }
      }

      await loadAttachments()
    } catch (error) {
      console.error('Failed to add attachments:', error)
      setErrorMessage('Some attachments could not be saved. Please try again.')
      await loadAttachments()
    } finally {
      setUploading(false)
    }
  }

  const handleOpenAttachment = async (attachment: NoteAttachment) => {
    try {
      await window.electronAPI.file.openAttachment(attachment.filename, attachment.original_name)
    } catch (error) {
      console.error('Failed to open attachment:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Could not open attachment.')
    }
  }

  const handleDeleteAttachment = async (attachment: NoteAttachment) => {
    if (!confirm(`Delete "${attachment.original_name}"?`)) return

    try {
      await window.electronAPI.db.run(
        'DELETE FROM note_attachments WHERE id = ?',
        [attachment.id]
      )
      setAttachments(items => items.filter(a => a.id !== attachment.id))
      await window.electronAPI.file.deleteAttachment(attachment.filename)
    } catch (error) {
      console.error('Failed to delete attachment:', error)
      setErrorMessage('Could not finish deleting the attachment. Please try again.')
    }
  }

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase()
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(type)) {
      return <Image className="w-4 h-4" />
    }
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(type)) {
      return <FileText className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Paperclip className="w-4 h-4" />
          Attachments ({attachments.length})
        </div>
        <button
          onClick={handleAddFiles}
          disabled={uploading}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {uploading ? 'Adding...' : 'Add Files'}
        </button>
      </div>

      {errorMessage && <p role="alert" className="text-sm text-red-600 mb-2">{errorMessage}</p>}
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No attachments yet. Click "Add Files" to attach documents.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group"
            >
              <button
                onClick={() => handleOpenAttachment(attachment)}
                className="flex items-center gap-3 flex-1 text-left hover:text-primary transition-colors"
              >
                <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                  {getFileIcon(attachment.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {attachment.original_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenAttachment(attachment)}
                  className="p-1.5 text-gray-500 hover:text-primary hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                  title="Open"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAttachment(attachment)}
                  className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AttachmentManager
