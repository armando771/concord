// GIFs de fundo guardados no IndexedDB (o localStorage não comporta arquivos de
// vários MB). Interface pequena para o store e para os testes trocarem.

export interface GifStorage {
  put: (id: string, blob: Blob) => Promise<void>
  get: (id: string) => Promise<Blob | null>
  delete: (id: string) => Promise<void>
}

const DB_NAME = 'concord-video'
const STORE = 'gifs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível'))
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? new Error('falha no IndexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB cancelado'))
    })
  } finally {
    db.close()
  }
}

export const gifStorage: GifStorage = {
  put: async (id, blob) => {
    await run('readwrite', (s) => s.put(blob, id))
  },
  get: async (id) => {
    const found = await run<unknown>('readonly', (s) => s.get(id))
    return found instanceof Blob ? found : null
  },
  delete: async (id) => {
    await run('readwrite', (s) => s.delete(id))
  }
}
