import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, ChevronDown, ChevronUp, X, Loader2, Heart } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Switch } from './switch'
import { useFavorites } from '../../contexts/FavoritesContext'

export default function Search() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    keyword: '',
    category: 'all',
    distance: '10',
    location: '',
    autoDetect: false
  })

  const [errors, setErrors] = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [events, setEvents] = useState([])
  // Global favorites
  const { favoritesSet, isFavorite, toggleFavorite } = useFavorites()
  const containerRef = useRef(null)
  const debounceRef = useRef(null)
  const lastTypedRef = useRef('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validation
    const newErrors = {}
    if (!formData.keyword.trim()) {
      newErrors.keyword = 'Please enter some keywords'
    }
    if (!formData.autoDetect && !formData.location.trim()) {
      newErrors.location = 'Location is required when auto-detect is disabled'
    }
    // Distance must be a number and within allowed range
    const distNum = Number(formData.distance)
    if (formData.distance === '' || isNaN(distNum)) {
      newErrors.distance = 'Distance must be a number'
    } else if (distNum <= 0) {
      newErrors.distance = 'Distance must be a positive number'
    } else if (distNum > 100) {
      newErrors.distance = 'Distance cannot exceed 100 miles'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    // Clear errors on successful validation
    setErrors({})
    
    // Show loading state
    setIsSearching(true)
    
    // Build query parameters for GET request
    const params = new URLSearchParams()
    params.append('keyword', formData.keyword.trim())
    params.append('category', formData.category)
    params.append('distance', formData.distance)
    params.append('location', formData.location.trim())
    params.append('autoDetect', formData.autoDetect)
    
    console.log('Sending filters to API:', {
      keyword: formData.keyword.trim(),
      category: formData.category,
      distance: formData.distance,
      location: formData.location.trim(),
      autoDetect: formData.autoDetect
    })
    
    // Send GET request to backend
    fetch(`/api/events?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log('Search results:', data)
        // Parse events from Ticketmaster response
        if (data._embedded && data._embedded.events) {
          setEvents(data._embedded.events)
        } else {
          setEvents([])
        }
        setIsSearching(false)
      })
      .catch(err => {
        console.error('Search error:', err)
        setEvents([])
        setIsSearching(false)
      })
  }

  function onToggleFavorite(ev, e) {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(ev)
  }

  // Parse Ticketmaster suggest response into an array of suggestion strings.
  function parseSuggestions(data) {
    const results = []
    if (!data) return results

    // Ticketmaster may return embedded attractions, events, venues, or a suggestions array
    if (data._embedded) {
      console.log('Embedded data:', data._embedded);
      if (data._embedded.attractions) {
        results.push(...data._embedded.attractions.map((a) => a.name).filter(Boolean))
      }
      if (data._embedded.events) {
        results.push(...data._embedded.events.map((e) => e.name).filter(Boolean))
      }
      if (data._embedded.venues) {
        results.push(...data._embedded.venues.map((v) => v.name).filter(Boolean))
      }
    }

    if (Array.isArray(data.suggestions)) {
      // some responses use {value, term} or {value}
      results.push(
        ...data.suggestions.map((s) => s.value || s.term || s).filter(Boolean)
      )
    }

    if (Array.isArray(data.results)) {
      results.push(...data.results.map((r) => r.name || r).filter(Boolean))
    }

    // Deduplicate while preserving order
    return Array.from(new Set(results)).slice(0, 10)
  }

  async function fetchSuggestions(query) {
    if (!query || query.trim().length === 0) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    try {
      // Use Vite env variable VITE_API_BASE to allow dev proxying to backend (e.g. http://localhost:8080)
      const API_BASE = import.meta.env.VITE_API_BASE || ''
      const res = await fetch(`${API_BASE}/api/suggest?keyword=${encodeURIComponent(query)}`)
      // If server responded with non-OK status, capture text for debugging
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Suggest API error: ${res.status} ${res.statusText} ${txt}`)
      }
      // Some dev setups return HTML (index.html) with 200 which will make res.json() throw.
      // Guard against non-JSON responses to give a clearer error message.
      const contentType = (res.headers.get('content-type') || '')
      if (!contentType.includes('application/json')) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Unexpected non-JSON response from suggest API: ${txt.slice(0,200)}`)
      }
      const data = await res.json()
      let parsed = parseSuggestions(data)

      // Ensure the currently-typed query appears as the first suggestion (if not present)
      if (query && !parsed.some((s) => s.toLowerCase() === query.toLowerCase())) {
        parsed.unshift(query)
      }

      // Deduplicate case-insensitively while preserving order and limit to 6
      const seen = new Set()
      const final = []
      for (const item of parsed) {
        const key = item.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          final.push(item)
          if (final.length >= 6) break
        }
      }

      setSuggestions(final)
      setShowSuggestions(final.length > 0)
      setActiveIndex(-1)
    } catch (err) {
      console.error('Suggestion fetch error', err)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Debounce suggestion fetch when keyword changes
  useEffect(() => {
    const q = formData.keyword
    // clear any existing timer
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // only fetch when there's at least 1 char
    debounceRef.current = setTimeout(() => {
      if (q && q.trim().length > 0) fetchSuggestions(q.trim())
      else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [formData.keyword])

  // Close suggestions on outside click
  useEffect(() => {
    function handleDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [])

  function selectSuggestion(value) {
    setFormData((prev) => ({ ...prev, keyword: value }))
    setShowSuggestions(false)
    setActiveIndex(-1)
  }

  function handleKeywordChange(e) {
    const v = e.target.value
    lastTypedRef.current = v
    setFormData((prev) => ({ ...prev, keyword: v }))
    if (v && v.trim().length > 0) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  function validateDistance(value) {
    const v = String(value || '')
    const num = Number(v)
    setErrors((prev) => {
      const next = { ...prev }
      if (v === '' || isNaN(num)) {
        next.distance = 'Distance must be a number'
      } else if (num <= 0) {
        next.distance = 'Distance must be a positive number'
      } else if (num > 100) {
        next.distance = 'Distance cannot exceed 100 miles'
      } else {
        delete next.distance
      }
      return next
    })
  }

  function handleKeywordKeyDown(e) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault()
        selectSuggestion(suggestions[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="w-full px-8 md:px-8 lg:px-60 py-4">
      <form onSubmit={handleSubmit}>
        {/* Single Row Layout */}
        <div className="flex items-start gap-4">
          {/* Keywords */}
          <div className="flex-1 min-h-fit">
            <Label htmlFor="keyword" className={`text-xs font-medium mb-2 block ${errors.keyword ? 'text-red-500' : ''}`}>
              Keywords <span className="text-red-500">*</span>
            </Label>
            <div ref={containerRef} className="relative">
              <div className="relative flex items-center">
                <Input
                  id="keyword"
                  placeholder="Search for events..."
                  value={formData.keyword}
                  onChange={(e) => handleKeywordChange(e)}
                  onKeyDown={handleKeywordKeyDown}
                  onFocus={() => { setShowSuggestions(true) }}
                  className={`w-full px-2 py-1 h-8 pr-16 ${errors.keyword ? 'border-red-500 focus-visible:ring-1 focus-visible:ring-red-200' : ''}`}
                  autoComplete="off"
                />
                {formData.keyword && (
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, keyword: ''})}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 bg-transparent rounded"
                    tabIndex="-1"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 bg-transparent rounded"
                  tabIndex="-1"
                >
                  {showSuggestions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {showSuggestions && (
                <ul className="absolute left-0 right-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm text-sm">
                      {loadingSuggestions && (
                        <li className="p-2 text-gray-500">Loading...</li>
                      )}
                      {!loadingSuggestions && suggestions.length === 0 && showSuggestions && (
                        <li className="p-3 text-gray-700">Start typing to see options</li>
                      )}
                      {!loadingSuggestions && suggestions.map((s, idx) => (
                        <li
                          key={`${s}-${idx}`}
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`cursor-pointer px-3 py-2 ${activeIndex === idx ? 'bg-gray-100' : ''}`}
                        >
                          {s}
                        </li>
                      ))}
                </ul>
              )}
            </div>
            <p className="text-red-500 text-xs mt-1 min-h-[1rem]">{errors.keyword || '\u00A0'}</p>
          </div>

          {/* Category */}
          <div className="w-40 min-h-fit">
            <Label htmlFor="category" className="text-xs font-medium mb-2 block">
              Category <span className="text-red-500">*</span>
            </Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="music">Music</option>
              <option value="sports">Sports</option>
              <option value="arts">Arts & Theatre</option>
              <option value="film">Film</option>
              <option value="miscellaneous">Miscellaneous</option>
            </select>
          </div>

            {/* Location with Auto-detect on same line */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2 h-5">
                <Label htmlFor="location" className={`text-xs text-black font-medium ${errors.location ? 'text-red-500' : ''}`}>
                  Location <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="autoDetect" className={`text-xs font-medium whitespace-nowrap mb-0 ${errors.location ? 'text-red-500' : ''}`}>
                    Auto-detect Location
                  </Label>
                  <Switch
                    id="autoDetect"
                    checked={formData.autoDetect}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        autoDetect: checked,
                        location: checked ? '' : formData.location,
                      })
                    }}
                  />
                </div>
              </div>
              <Input
                id="location"
                placeholder="Enter city, district or street..."
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                disabled={formData.autoDetect}
                className={`px-2 py-1 h-8 w-full ${errors.location ? 'border-red-500 focus-visible:ring-1 focus-visible:ring-red-200' : ''}`}
              />
              <p className="text-red-500 text-xs mt-1 min-h-[1rem]">{errors.location || '\u00A0'}</p>
            </div>

          {/* Distance */}
          <div className="w-40 min-h-fit">
            <Label htmlFor="distance" className={`text-xs font-medium mb-2 block ${errors.distance ? 'text-red-500' : ''}`}>
              Distance <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="distance"
                type="number"
                placeholder="10"
                min={1}
                max={100}
                value={formData.distance}
                onChange={(e) => {
                  const v = e.target.value
                  setFormData({...formData, distance: v})
                  const num = Number(v)
                  // If empty, set validation immediately
                  if (v === '') {
                    setErrors((prev) => ({ ...prev, distance: 'Distance must be a number' }))
                    return
                  }
                  if (isNaN(num)) {
                    setErrors((prev) => ({ ...prev, distance: 'Distance must be a number' }))
                    return
                  }
                  if (num <= 0) {
                    setErrors((prev) => ({ ...prev, distance: 'Distance must be a positive number' }))
                    return
                  }
                  if (num > 100) {
                    setErrors((prev) => ({ ...prev, distance: 'Distance cannot exceed 100 miles' }))
                    return
                  }
                  // valid
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.distance
                    return next
                  })
                }}
                onBlur={(e) => validateDistance(e.target.value)}
                className={`w-full pr-12 h-8 text-xs ${errors.distance ? 'border-red-500 focus-visible:ring-1 focus-visible:ring-red-200' : ''}`}
              />
              {/* Text inside the input */}
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
              miles
              </span>
            </div>
            <p className="text-red-500 text-xs mt-1 min-h-[1rem]">{errors.distance || '\u00A0'}</p>
          </div>

          {/* Search Button */}
          <div className="pt-6">
            <Button type="submit" disabled={isSearching} className="bg-black hover:bg-gray-800 text-white px-6 py-1 h-8 disabled:opacity-70 focus:outline-none focus-visible:outline-none">
              {isSearching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <SearchIcon className="w-4 h-4 mr-2" />
              )}
              {isSearching ? 'Searching...' : 'Search Events'}
            </Button>
          </div>
        </div>
      </form>

      {/* Results section */}
      <div className="mt-8">
        {isSearching ? (
          <div className="text-center text-gray-500 py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
              <p className="text-xs text-gray-600">Searching for events...</p>
            </div>
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, idx) => {
              // Extract date and time from localDate and localTime
              const eventDate = event.dates?.start?.localDate || ''
              const eventTime = event.dates?.start?.localTime || ''
              const genre = event.classifications?.[0]?.segment?.name || 'Event'
              const venueInfo = event._embedded?.venues?.[0]?.name || 'Venue TBA'
              
              return (
                <div
                  key={idx}
                  className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/event/${event.id}`)}
                >
                  {/* Event Image */}
                  <div className="relative h-48 bg-gray-200 overflow-hidden">
                    {event.images && event.images.length > 0 ? (
                      <img src={event.images[0].url} alt={event.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <SearchIcon className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Genre Badge */}
                    <div className="absolute top-3 left-3 bg-white text-black px-3 py-1 rounded-md text-xs font-medium">
                      {genre}
                    </div>
                    
                    {/* Date Badge - Format: "Jan 14, 2026, 06:00 PM" */}
                    {eventDate && eventTime && (
                      <div className="absolute top-3 right-3 bg-white text-gray-800 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                        {new Date(`${eventDate}T${eventTime}`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(`${eventDate}T${eventTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>

                  {/* Event Details */}
                  <div className="p-4">
                    {/* Event Name and Heart Icon */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">{event.name}</h3>
                      <button
                        onClick={(e) => onToggleFavorite(event, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex-shrink-0 p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors focus:outline-none focus-visible:outline-none"
                        aria-label={isFavorite(event.id) ? 'Remove Favorite' : 'Add Favorite'}
                      >
                        <Heart
                          size={18}
                          className="text-black"
                          fill={isFavorite(event.id) ? 'red' : 'none'}
                          strokeWidth={isFavorite(event.id) ? 0 : 1.5}
                        />
                      </button>
                    </div>
                    
                    {/* Venue Name */}
                    <p className="text-xs text-gray-600">{venueInfo}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-12">
            <SearchIcon className="w-8 h-8 mx-auto mb-4 text-gray-400" />
            <p className="text-xs">Enter search criteria and click the Search button to find events.</p>
          </div>
        )}
      </div>
    </div>
  )
}