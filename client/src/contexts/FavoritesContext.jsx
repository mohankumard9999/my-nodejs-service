import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

// FavoritesContext centralizes favorite events state across the app.
// It keeps a set of favorite eventIds and a map of eventId -> favorite doc from the backend.
const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const [loaded, setLoaded] = useState(false)
  const [ids, setIds] = useState(() => new Set())
  const [docsById, setDocsById] = useState(() => new Map())
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/favorites')
      if (!res.ok) throw new Error('Failed to load favorites')
      const data = await res.json()
      const nextIds = new Set()
      const nextMap = new Map()
      if (Array.isArray(data)) {
        for (const d of data) {
          if (!d || !d.eventId) continue
          nextIds.add(d.eventId)
          nextMap.set(d.eventId, d)
        }
      }
      setIds(nextIds)
      setDocsById(nextMap)
    } catch (e) {
      setError(e.message)
      setIds(new Set())
      setDocsById(new Map())
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isFavorite = useCallback((eventId) => ids.has(eventId), [ids])

  const addFavorite = useCallback(async (eventObj) => {
    if (!eventObj || !eventObj.id) return false
    const eventId = eventObj.id
    // Optimistic update
    setIds(prev => new Set(prev).add(eventId))
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventObj)
      })
      if (res.status === 409) {
        // already exists, ensure id is present
        setIds(prev => new Set(prev).add(eventId))
        return true
      }
      if (!res.ok) throw new Error('Failed to add favorite')
      const payload = await res.json().catch(() => ({}))
      if (payload && payload.doc) {
        setDocsById(prev => {
          const m = new Map(prev)
          m.set(eventId, payload.doc)
          return m
        })
      }
      return true
    } catch (err) {
      // rollback optimistic update
      setIds(prev => {
        const n = new Set(prev)
        n.delete(eventId)
        return n
      })
      return false
    }
  }, [])

  const removeFavorite = useCallback(async (eventId) => {
    if (!eventId) return false
    // Optimistic update
    setIds(prev => {
      const n = new Set(prev)
      n.delete(eventId)
      return n
    })
    try {
      const res = await fetch(`/api/favorites/${eventId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove favorite')
      setDocsById(prev => {
        const m = new Map(prev)
        m.delete(eventId)
        return m
      })
      return true
    } catch (err) {
      // rollback
      setIds(prev => new Set(prev).add(eventId))
      return false
    }
  }, [])

  const toggleFavorite = useCallback(async (eventObj) => {
    if (!eventObj || !eventObj.id) return
    if (ids.has(eventObj.id)) return removeFavorite(eventObj.id)
    return addFavorite(eventObj)
  }, [ids, addFavorite, removeFavorite])

  const value = useMemo(() => ({
    loaded,
    error,
    favoritesIds: Array.from(ids),
    favoritesSet: ids,
    favoritesMap: docsById,
    favoritesDocs: Array.from(docsById.values()),
    refreshFavorites: load,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  }), [loaded, error, ids, docsById, load, isFavorite, addFavorite, removeFavorite, toggleFavorite])

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
