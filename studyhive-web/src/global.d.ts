/// <reference types="vite/client" />

interface ElectronAPI {
  db: {
    batch: (commands: { sql: string; params?: any[] }[]) => Promise<{ lastInsertRowid: number; changes: number }[]>
    query: (sql: string, params?: any[]) => Promise<any[]>
    run: (sql: string, params?: any[]) => Promise<any>
    get: (sql: string, params?: any[]) => Promise<any>
  }
  file: {
    selectFiles: () => Promise<any[]>
    saveAttachment: (sourcePath: string, originalName: string) => Promise<any>
    deleteAttachment: (filename: string) => Promise<boolean>
    openAttachment: (filename: string, originalName?: string) => Promise<string>
    selectImage: () => Promise<any>
    saveImage: (dataUrl: string, filename: string) => Promise<string>
    getImageDataUrl: (filename: string) => Promise<string | null>
    selectDocument: () => Promise<any>
    readBuffer: (filePath: string) => Promise<Uint8Array>
    readText: (filePath: string) => Promise<string>
  }
  onWindowBlur: (callback: () => void) => () => void
  onWindowFocus: (callback: () => void) => () => void
  notify: (title: string, body: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
