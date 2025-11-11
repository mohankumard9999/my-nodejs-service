import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useFavorites } from '../../contexts/FavoritesContext'

export default function Favorites() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/favorites')
      if (!res.ok) throw new Error('Failed to load favorites')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setItems(list)
    } catch (e) {
      setError(e.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Client-side enrichment for legacy docs without snapshot/image/venue/date
  useEffect(() => {
    async function enrichIfNeeded(list) {
      const needs = (list || []).filter(f => !f?.snapshot || !f?.image || !f?.date || !f?.venue)
      if (needs.length === 0) return
      try {
        const results = await Promise.all(needs.map(async (f) => {
          try {
            const r = await fetch(`/api/event/${f.eventId}`)
            if (!r.ok) return null
            const ev = await r.json()
            const imgPick = Array.isArray(ev.images) && (ev.images.find(i => (i.ratio || '').toLowerCase() === '16_9') || ev.images[0])
            return {
              key: f._id || f.eventId,
              patch: {
                snapshot: ev,
                image: f.image || (imgPick && imgPick.url) || '',
                venue: f.venue || ev?._embedded?.venues?.[0]?.name || '',
                date: f.date || ev?.dates?.start?.localDate || '',
              }
            }
          } catch {
            return null
          }
        }))
        const map = new Map(results.filter(Boolean).map(x => [String(x.key), x.patch]))
        setItems(prev => prev.map(it => {
          const p = map.get(String(it._id || it.eventId))
          return p ? { ...it, ...p } : it
        }))
      } catch {
        // ignore enrichment errors; base list will still render title
      }
    }
    if (items && items.length > 0) enrichIfNeeded(items)
  }, [items])

  const { removeFavorite, isFavorite } = useFavorites()

  // Handler to remove favorite and reload list
  async function handleRemoveFavorite(eventId, e) {
    e.stopPropagation()
    const success = await removeFavorite(eventId)
    if (success) {
      // Reload the favorites list from the server
      await load()
    }
  }

  // enrichment now handled server-side; keep component simpler

  return (
    <div className="px-6 md:px-16 lg:px-64 py-6">
      <h2 className="text-3xl font-semibold mb-6">Favorites</h2>
      {loading && <div className="text-sm text-gray-500">Loading favorites...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}
      {!loading && items.length === 0 && <div className="text-sm text-gray-500">No favorites yet.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {items.map((fav) => {
          const ev = fav.snapshot || {}
          // Prefer enriched direct fields first, fallback to snapshot
          const image = fav.image || (ev.images && ev.images[0] && ev.images[0].url) || ''
          const date = fav.date || ev?.dates?.start?.localDate || ''
          const time = ev?.dates?.start?.localTime || ''
          const genre = ev?.classifications?.[0]?.segment?.name || 'Event'
          const venue = fav.venue || ev?._embedded?.venues?.[0]?.name || ''
          return (
            <div
              key={fav._id || fav.eventId}
              className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/event/${fav.eventId}`)}
            >
              <div className="relative h-60 bg-gray-200 overflow-hidden">
                {image ? (
                  <img src={image} alt={fav.name} className="w-full h-full object-cover" />
                ) : null}
                <div className="absolute top-3 left-3 bg-white text-black px-3 py-1 rounded-md text-xs font-medium shadow-sm">
                  {genre}
                </div>
                {(date || time) && (
                  <div className="absolute top-3 right-3 bg-white text-gray-800 px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shadow-sm">
                    {date ? new Date(`${date}${time?`T${time}`:''}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    {time ? `, ${new Date(`1970-01-01T${time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-lg text-gray-900 line-clamp-2 flex-1">{fav.name}</h3>
                  <button
                    onClick={(e) => handleRemoveFavorite(fav.eventId, e)}
                    className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
                    aria-label={isFavorite(fav.eventId) ? 'Remove Favorite' : 'Add Favorite'}
                  >
                    <Heart size={18} className="text-black" fill={isFavorite(fav.eventId) ? 'red' : 'none'} strokeWidth={isFavorite(fav.eventId) ? 0 : 1.5} />
                  </button>
                </div>
                {venue && <p className="text-sm text-gray-600">{venue}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}