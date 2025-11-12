import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useFavorites } from '../../contexts/FavoritesContext'

export default function Favorites() {
  const navigate = useNavigate()
  
  const { removeFavorite, isFavorite, favoritesDocs, loaded, error, refreshFavorites } = useFavorites()

  // Load favorites on mount & always reset scroll to top when page is shown
  useEffect(() => {
    refreshFavorites()
    // Use requestAnimationFrame to ensure after navigation paint
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
  }, [refreshFavorites])

  // Handler to remove favorite
  async function handleRemoveFavorite(eventId, eventName, e) {
    e.stopPropagation()
    // Pass event object with at least name and id for toast notification
    await removeFavorite(eventId, { id: eventId, name: eventName })
  }

  return (
    <div className="px-6 md:px-16 lg:px-64 py-6">
      <h2 className="text-3xl font-semibold mb-6">Favorites</h2>
  {/* Removed transient loading text per request */}
      {error && <div className="text-sm text-red-500">{error}</div>}
      {loaded && favoritesDocs.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <p className="text-sm font-medium text-gray-700 mb-1">No favorite events yet.</p>
          <p className="text-xs text-gray-500">Add events to your favorites by clicking the heart icon on any event.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {favoritesDocs.map((fav) => {
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
              onClick={() => navigate(`/event/${fav.eventId}`, { state: { from: 'favorites' } })}
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
                    onClick={(e) => handleRemoveFavorite(fav.eventId, fav.name, e)}
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