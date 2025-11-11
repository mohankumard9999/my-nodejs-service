import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Heart, Facebook, Twitter } from 'lucide-react'
import { useFavorites } from '../../contexts/FavoritesContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { isFavorite, toggleFavorite } = useFavorites()
  const [tab, setTab] = useState('info')
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyError, setSpotifyError] = useState(null)
  const [spotify, setSpotify] = useState({ artist: null, albums: [] })
  const [spotifyFor, setSpotifyFor] = useState('')

  useEffect(() => {
    async function fetchDetails() {
      try {
        setLoading(true)
        const res = await fetch(`/api/event/${id}`)
        if (!res.ok) throw new Error('Failed to load event details')
        const data = await res.json()
        setEvent(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [id])

  // Global favorite status now comes from context

  const startDate = event?.dates?.start?.localDate || ''
  const startTime = event?.dates?.start?.localTime || ''
  const dateTime = startDate && startTime
    ? new Date(`${startDate}T${startTime}`)
    : startDate ? new Date(startDate) : null

  const attractions = event?._embedded?.attractions || []
  const venue = event?._embedded?.venues?.[0] || null
  // Build ordered genres per spec
  const genres = (() => {
    const cls = event?.classifications?.[0]
    if (!cls) return []
    const order = [
      cls.segment?.name,
      cls.genre?.name,
      cls.subGenre?.name,
      cls.type?.name,
      cls.subType?.name,
    ]
      .filter(Boolean) // Remove undefined/null
      .filter(g => g.toLowerCase() !== 'undefined') // Remove "undefined" strings
      .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
    return order
  })()
  const seatmap = event?.seatmap?.staticUrl || null
  const ticketUrl = event?.url || null
  const status = event?.dates?.status?.code || ''
  const statusCfg = {
    on_sale: { class: 'bg-green-600 text-white', label: 'On Sale' },
    onsale: { class: 'bg-green-600 text-white', label: 'On Sale' },
    offsale: { class: 'bg-red-600 text-white', label: 'Off Sale' },
    canceled: { class: 'bg-black text-white', label: 'Canceled' },
    cancelled: { class: 'bg-black text-white', label: 'Cancelled' },
    postponed: { class: 'bg-orange-600 text-white', label: 'Postponed' },
    rescheduled: { class: 'bg-orange-600 text-white', label: 'Rescheduled' },
  }
  const statusKey = (status || '').toLowerCase().replace(/\s+/g,'')
  const statusConfig = statusCfg[statusKey]

  // Determine if event is Music related
  const isMusicEvent = !!event?.classifications?.some(
    (c) => (c.segment?.name || '').toLowerCase() === 'music'
  )

  // Check if Info tab has any data to display
  const hasInfoData = !!(dateTime || attractions.length > 0 || venue || genres.length > 0 || (status && statusConfig) || ticketUrl || seatmap)

  // Check if Venue tab has any data to display
  const hasVenueData = !!(venue && (venue.name || venue.address?.line1 || venue.city?.name || venue.state?.name || venue.url || (venue.images && venue.images.length > 0) || venue.parkingDetail || venue.generalInfo?.generalRule || venue.generalInfo?.childRule))

  // Determine primary artist name (prefer music segment)
  const primaryArtistName = (() => {
    if (!attractions || attractions.length === 0) return ''
    const music = attractions.find(a => a.classifications?.some(c => c.segment?.name?.toLowerCase() === 'music'))
    return (music?.name || attractions[0]?.name || '').trim()
  })()

  // Fetch Spotify info when Artist tab becomes active
  useEffect(() => {
    async function fetchSpotify(name) {
      if (!name) return
      try {
        setSpotifyLoading(true)
        setSpotifyError(null)
        const res = await fetch(`/api/spotify/artist?name=${encodeURIComponent(name)}`)
        if (!res.ok) throw new Error('Failed to load Spotify data')
        const data = await res.json()
        setSpotify({ artist: data.artist || null, albums: Array.isArray(data.albums) ? data.albums : [] })
        setSpotifyFor(name)
      } catch (e) {
        setSpotifyError(e.message)
        setSpotify({ artist: null, albums: [] })
      } finally {
        setSpotifyLoading(false)
      }
    }
    if (!isMusicEvent) return
    if (tab === 'artists' && primaryArtistName && primaryArtistName !== spotifyFor) {
      fetchSpotify(primaryArtistName)
    }
  }, [tab, primaryArtistName, spotifyFor, isMusicEvent])

  // Ensure we don't stay on a disabled tab
  useEffect(() => {
    if (tab === 'artists' && !isMusicEvent) setTab('info')
  }, [tab, isMusicEvent])

  return (
    <div className="px-6 md:px-16 lg:px-40 py-6">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-600 bg-transparent mb-6 hover:text-gray-900 focus:outline-none focus-visible:outline-none"
      >
        <ArrowLeft size={16} /> Back to Search
      </button>

      {loading && (
        <div className="py-20 text-center text-sm text-gray-500">Loading event details...</div>
      )}

      {error && (
        <div className="py-20 text-center text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && event && (
        <div>
          {/* Header Row */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex-1 min-w-[200px]">{event.name}</h1>
            <div className="flex items-center gap-3">
              {ticketUrl && (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-black text-white text-sm font-medium px-4 py-2 rounded hover:bg-gray-800 visited:text-white active:text-white focus:text-white [&:visited]:text-white"
                >
                  Buy Tickets <ExternalLink size={14} />
                </a>
              )}
              <button
                onClick={() => { if (event) toggleFavorite(event) }}
                className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                aria-label="Toggle Favorite"
              >
                <Heart
                  size={16}
                  className="text-black"
                  fill={event?.id && isFavorite(event.id) ? 'red' : 'none'}
                  strokeWidth={event?.id && isFavorite(event.id) ? 0 : 1.5}
                />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} defaultValue="info" className="w-full">
            <TabsList className="w-full flex bg-gray-100 rounded-xl p-1 ring-1 ring-gray-200 shadow-sm">
              <TabsTrigger value="info" disabled={!hasInfoData} className="btn-no-bg disabled:opacity-50 disabled:pointer-events-none flex-1 rounded-lg px-6 py-2 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow data-[state=active]:ring-1 data-[state=active]:ring-gray-200">Info</TabsTrigger>
              <TabsTrigger value="artists" disabled={!isMusicEvent} className="btn-no-bg disabled:opacity-50 disabled:pointer-events-none flex-1 rounded-lg px-6 py-2 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow data-[state=active]:ring-1 data-[state=active]:ring-gray-200">Artist</TabsTrigger>
              <TabsTrigger value="venue" disabled={!hasVenueData} className="btn-no-bg disabled:opacity-50 disabled:pointer-events-none flex-1 rounded-lg px-6 py-2 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow data-[state=active]:ring-1 data-[state=active]:ring-gray-200">Venue</TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-5 text-sm">
                  {dateTime && (
                    <div>
                      <p className="text-gray-500 font-semibold">Date</p>
                      <p className="font-medium">
                        {dateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {startTime && ', ' + dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  {attractions.length > 0 && (
                    <div>
                      <p className="text-gray-500 font-semibold">Artist/Team</p>
                      <p className="font-medium">
                        {attractions.map(a => a.name).filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {venue && (
                    <div>
                      <p className="text-gray-500 font-semibold">Venue</p>
                      <p className="font-medium">{venue.name}</p>
                    </div>
                  )}
                  {genres.length > 0 && (
                    <div>
                      <p className="text-gray-500 font-semibold">Genres</p>
                      <p className="font-medium">{genres.join(', ')}</p>
                    </div>
                  )}
                  {event.priceRanges && event.priceRanges.length > 0 && (() => {
                    const pr = event.priceRanges[0];
                    const priceDisplay = pr.min === pr.max 
                      ? `$${pr.min}` 
                      : `$${pr.min} - $${pr.max}`;
                    return (
                      <div>
                        <p className="text-gray-500 font-semibold">Price Range</p>
                        <p className="font-medium">{priceDisplay} {pr.currency || 'USD'}</p>
                      </div>
                    );
                  })()}
                  {status && statusConfig && (
                    <div>
                      <p className="text-gray-500 font-semibold">Ticket Status</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded text-xs font-semibold ${statusConfig.class}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  )}
                  {ticketUrl && (
                    <div>
                      <p className="text-gray-500 font-semibold mb-2">Share</p>
                      <div className="flex items-center gap-2">
                        <a
                          className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-xs flex items-center justify-center text-black visited:text-black hover:text-black"
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ticketUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on Facebook"
                        >
                          <Facebook className="w-4 h-4" />
                        </a>
                        <a
                          className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-xs flex items-center justify-center text-black visited:text-black hover:text-black"
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check ${event.name} on Ticketmaster`)}&url=${encodeURIComponent(ticketUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Share on Twitter"
                        >
                          <Twitter className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {seatmap && (
                  <div>
                    <p className="text-gray-500 font-semibold mb-3">Seatmap</p>
                    <div className="border border-gray-200 rounded-md overflow-hidden max-w-2xl">
                      <img src={seatmap} alt="Seatmap" className="w-full h-auto" />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Artists Tab */}
            <TabsContent value="artists" className="pt-6">
              {(!primaryArtistName || attractions.length === 0) && (
                <p className="text-sm text-gray-500">No artist/team data available.</p>
              )}

              {primaryArtistName && (
                <div className="space-y-6">
                  {/* Artist summary */}
                  {spotifyLoading ? (
                    <p className="text-sm text-gray-500">Loading artist...</p>
                  ) : spotifyError ? (
                    <p className="text-sm text-red-500">{spotifyError}</p>
                  ) : spotify.artist ? (
                    <div className="flex items-start gap-4">
                      <div className="w-28 h-28 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                        {spotify.artist.images && spotify.artist.images[0] ? (
                          <img src={spotify.artist.images[0].url} alt={spotify.artist.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold mb-1 truncate">{spotify.artist.name}</h3>
                        <p className="text-sm text-gray-600">
                          <span className="font-semibold text-black">Followers:</span> {Number(spotify.artist.followers?.total || 0).toLocaleString()}
                          <span className="ml-4"></span>
                          <span className="font-semibold text-black">Popularity:</span> {spotify.artist.popularity ?? 0}%
                        </p>
                        {Array.isArray(spotify.artist.genres) && spotify.artist.genres.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-semibold text-black">Genres:</span> {spotify.artist.genres.slice(0, 3).join(', ')}
                          </p>
                        )}
                        {spotify.artist.external_urls?.spotify && (
                          <a
                            href={spotify.artist.external_urls.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 visited:text-white active:text-white focus:text-white [&:visited]:text-white"
                          >
                            Open in Spotify <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No Spotify profile found for {primaryArtistName}.</div>
                  )}

                  {/* Albums */}
                  <div>
                    <h4 className="text-base font-semibold mb-3">Albums</h4>
                    {spotifyLoading ? (
                      <p className="text-sm text-gray-500">Loading albums...</p>
                    ) : spotify.albums && spotify.albums.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {spotify.albums.map((al) => (
                          <a
                            key={al.id}
                            href={al.external_urls?.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer block text-black visited:text-black active:text-black focus:text-black hover:text-black [&:visited]:text-black"
                          >
                            <div className="aspect-square bg-gray-100 overflow-hidden">
                              {al.images && al.images[0] ? (
                                <img src={al.images[0].url} alt={al.name} className="w-full h-full object-cover" />
                              ) : null}
                            </div>
                            <div className="p-3">
                              <p className="text-sm font-medium line-clamp-2">{al.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{al.release_date || ''}</p>
                              <p className="text-xs text-gray-500">{al.total_tracks || 0} tracks</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No albums available.</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Venue Tab */}
            <TabsContent value="venue" className="pt-6">
              {!venue && <p className="text-sm text-gray-500">No venue information available.</p>}
              {venue && (
                <div>
                  {/* Header with name, address and See Events button */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{venue.name}</h3>
                      {(venue.address?.line1 || venue.city?.name || venue.state?.name) && (
                        <a
                          href={`https://www.google.com/maps?q=${venue.location?.latitude},${venue.location?.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                        >
                          {[venue.address?.line1, venue.city?.name, venue.state?.name].filter(Boolean).join(', ')}
                          <ExternalLink size={12} className="inline" />
                        </a>
                      )}
                    </div>
                    {venue.url && (
                      <a
                        href={venue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-black text-sm px-3 py-1.5 rounded hover:bg-gray-50 whitespace-nowrap shadow-sm visited:text-black active:text-black"
                      >
                        See Events <ExternalLink size={12} />
                      </a>
                    )}
                  </div>

                  {/* Two-column layout: Image on left, details on right */}
                  <div className={`grid grid-cols-1 gap-8 ${venue.images && venue.images.length > 0 ? 'lg:grid-cols-[500px_1fr]' : ''}`}>
                    {/* Left column - Venue Image/Logo */}
                    {venue.images && venue.images.length > 0 && (
                      <div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white p-4">
                          <img 
                            src={venue.images[0].url} 
                            alt={venue.name}
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {/* Right column - Venue details */}
                    <div className="space-y-5 text-xs">
                      {/* Parking Info */}
                      {venue.parkingDetail && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Parking</p>
                          <p className="text-gray-900">{venue.parkingDetail}</p>
                        </div>
                      )}

                      {/* General Rule */}
                      {venue.generalInfo?.generalRule && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">General Rule</p>
                          <p className="text-gray-900 whitespace-pre-line">{venue.generalInfo.generalRule}</p>
                        </div>
                      )}

                      {/* Child Rule */}
                      {venue.generalInfo?.childRule && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">Child Rule</p>
                          <p className="text-gray-900">{venue.generalInfo.childRule}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}