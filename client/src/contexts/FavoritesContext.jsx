import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'

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

  const addFavorite = useCallback(async (eventObj, silent = false) => {
    if (!eventObj || !eventObj.id) return false
    const eventId = eventObj.id
    // Optimistic update for both ids and docsById
    setIds(prev => new Set(prev).add(eventId))
    // Optimistically add to docsById with the event data we have
    const optimisticDoc = {
      eventId: eventId,
      name: eventObj.name,
      snapshot: eventObj,
      image: eventObj.images?.[0]?.url || null,
      venue: eventObj._embedded?.venues?.[0]?.name || null,
      date: eventObj.dates?.start?.localDate || null,
      createdAt: new Date().toISOString(),
    }
    setDocsById(prev => {
      const m = new Map(prev)
      m.set(eventId, optimisticDoc)
      return m
    })
    
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventObj)
      })
      if (res.status === 409) {
        // already exists, ensure id is present
        setIds(prev => new Set(prev).add(eventId))
        if (!silent) {
          toast.success(`${eventObj.name} added to favorites!`, {
            description: 'You can view it in the Favorites page.'
          })
        }
        return true
      }
      if (!res.ok) throw new Error('Failed to add favorite')
      const payload = await res.json().catch(() => ({}))
      if (payload && payload.doc) {
        // Update with real doc from server
        setDocsById(prev => {
          const m = new Map(prev)
          m.set(eventId, payload.doc)
          return m
        })
      }
      if (!silent) {
        toast.success(`${eventObj.name} added to favorites!`, {
          description: 'You can view it in the Favorites page.'
        })
      }
      return true
    } catch (err) {
      // rollback optimistic updates
      setIds(prev => {
        const n = new Set(prev)
        n.delete(eventId)
        return n
      })
      setDocsById(prev => {
        const m = new Map(prev)
        m.delete(eventId)
        return m
      })
      if (!silent) {
        toast.error('Failed to add to favorites')
      }
      return false
    }
  }, [])

  const removeFavorite = useCallback(async (eventId, eventObj = null) => {
    if (!eventId) return false
    // Store the event object for potential undo
    const removedDoc = docsById.get(eventId)
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
      
      // Show toast with undo action (using info style with i icon)
      const eventName = (eventObj?.name || removedDoc?.name || 'Event')
      toast.info(`${eventName} removed from favorites!`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            if (removedDoc) {
              // Re-add favorite after undo (silent to avoid duplicate add toast)
              // Use snapshot if available (contains original Ticketmaster event data)
              // Otherwise reconstruct event object from removedDoc
              const eventToReAdd = removedDoc.snapshot || {
                id: removedDoc.eventId,
                name: removedDoc.name,
                ...removedDoc
              }
              const success = await addFavorite(eventToReAdd, true)
              if (success) {
                // Reload favorites from server in background to get complete data
                load()
                toast.success(`${eventName} re-added to favorites!`, {
                  description: 'You can view it in the Favorites page.'
                })
              }
            }
          }
        }
      })
      return true
    } catch (err) {
      // rollback
      setIds(prev => new Set(prev).add(eventId))
      toast.error('Failed to remove from favorites')
      return false
    }
  }, [docsById, addFavorite])

  const toggleFavorite = useCallback(async (eventObj) => {
    if (!eventObj || !eventObj.id) return
    if (ids.has(eventObj.id)) return removeFavorite(eventObj.id, eventObj)
    return addFavorite(eventObj)
  }, [ids, addFavorite, removeFavorite])

  const value = useMemo(() => ({
    loaded,
    error,
    favoritesIds: Array.from(ids),
    favoritesSet: ids,
    favoritesMap: docsById,
    favoritesDocs: Array.from(docsById.values()).sort((a,b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return aT - bT
    }),
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
