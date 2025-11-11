import { useState, useEffect, useRef } from 'react'
import { Search as SearchIcon, ChevronDown, ChevronUp, X, Loader } from 'lucide-react'
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Switch } from './switch'

export default function Search() {
  const [formData, setFormData] = useState({
    keyword: '',
    category: 'Default',
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
    
    // Show loading state
    setIsSearching(true)
    
    // Simulate search (will be replaced with actual API call)
    setTimeout(() => {
      setIsSearching(false)
      console.log('Form submitted:', formData)
    }, 1500)
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
              <option value="Default">All</option>
              <option value="KZFzniwnSyZfZ7v7nJ">Music</option>
              <option value="KZFzniwnSyZfZ7v7nE">Sports</option>
              <option value="KZFzniwnSyZfZ7v7na">Arts & Theatre</option>
              <option value="KZFzniwnSyZfZ7v7nn">Film</option>
              <option value="KZFzniwnSyZfZ7v7n1">Miscellaneous</option>
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
            <Button type="submit" disabled={isSearching} className="bg-black hover:bg-gray-800 text-white px-6 py-1 h-8 disabled:opacity-70">
              {isSearching ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <SearchIcon className="w-4 h-4 mr-2" />
              )}
              {isSearching ? 'Searching...' : 'Search Events'}
            </Button>
          </div>
        </div>
      </form>

      {/* Results placeholder */}
      <div className="mt-2">
        <div className="text-center text-gray-500 py-12">
          {isSearching ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              <p className="text-xs text-gray-600">Searching for events...</p>
            </div>
          ) : (
            <>
              <SearchIcon className="w-8 h-8 mx-auto mb-4 text-gray-400" />
              <p className="text-xs">Enter search criteria and click the Search button to find events.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}