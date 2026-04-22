// IndexedDB utility to persist files across auth flow
// File objects can't be stored in localStorage, so we use IndexedDB

const DB_NAME = "5star_pending_files"
const STORE_NAME = "files"
const DB_VERSION = 1

interface PendingFileData {
  id: string
  name: string
  type: string
  size: number
  data: ArrayBuffer
  lastModified: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" })
      }
    }
  })
}

export async function savePendingFiles(files: File[]): Promise<void> {
  try {
    // IndexedDB transactions auto-commit when no sync work is pending
    const fileDataArray: PendingFileData[] = await Promise.all(
      files.map(async (file, i) => {
        const arrayBuffer = await file.arrayBuffer()
        return {
          id: `file_${i}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: arrayBuffer,
          lastModified: file.lastModified,
        }
      }),
    )

    // Now open transaction and store all data synchronously
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)

    // Clear existing files first
    store.clear()

    // Store all files synchronously within the transaction
    for (const fileData of fileDataArray) {
      store.put(fileData)
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  } catch (error) {
    console.error("Error saving pending files:", error)
  }
}

export async function loadPendingFiles(): Promise<File[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)

    const allFiles = await new Promise<PendingFileData[]>((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    db.close()

    if (allFiles.length === 0) {
      return []
    }

    // Convert back to File objects
    const files = allFiles.map((fileData) => {
      const blob = new Blob([fileData.data], { type: fileData.type })
      return new File([blob], fileData.name, {
        type: fileData.type,
        lastModified: fileData.lastModified,
      })
    })

    return files
  } catch (error) {
    console.error("Error loading pending files:", error)
    return []
  }
}

export async function clearPendingFiles(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    store.clear()

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
  } catch (error) {
    console.error("Error clearing pending files:", error)
  }
}

export async function hasPendingFiles(): Promise<boolean> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)

    const count = await new Promise<number>((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    db.close()
    return count > 0
  } catch (error) {
    console.error("Error checking pending files:", error)
    return false
  }
}
