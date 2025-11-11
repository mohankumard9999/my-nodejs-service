import { useState, useEffect, useRef } from 'react'
import { Search as SearchIcon } from 'lucide-react'
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
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

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
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    console.log('Form submitted:', formData)
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
        <div className="flex items-end gap-4">
          {/* Keywords */}
          <div className="flex-1">
            <Label htmlFor="keyword" className="text-xs font-medium mb-2 block">
              Keywords <span className="text-red-500">*</span>
            </Label>
            <div ref={containerRef} className="relative">
              <Input
                id="keyword"
                placeholder="Search for events..."
                value={formData.keyword}
                onChange={(e) => setFormData({...formData, keyword: e.target.value})}
                onKeyDown={handleKeywordKeyDown}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
                className="w-full px-2 py-1 h-8"
                autoComplete="off"
              />

              {showSuggestions && (
                <ul className="absolute left-0 right-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm text-sm">
                  {loadingSuggestions && (
                    <li className="p-2 text-gray-500">Loading...</li>
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
          </div>

          {/* Category */}
          <div className="w-40">
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
            {/* Location */}
            <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="location" className="text-xs text-black font-medium">
                    Location <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                    <Label htmlFor="autoDetect" className="text-xs font-medium whitespace-nowrap">
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
                className="px-2 py-1 h-8"
            />
            </div>

          {/* Distance */}
          <div className="w-40">
            <Label htmlFor="distance" className="text-xs font-medium mb-2 block">
              Distance <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="distance"
                type="number"
                placeholder="10"
                value={formData.distance}
                onChange={(e) => setFormData({...formData, distance: e.target.value})}
                className="w-full pr-12 h-8 text-xs"
              />
              {/* Text inside the input */}
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
              miles
              </span>
            </div>
          </div>

          {/* Search Button */}
          <div>
            <Button type="submit" className="bg-black hover:bg-gray-800 text-white px-6 py-1 h-8">
              <SearchIcon className="w-4 h-4 mr-2" />
              Search Events
            </Button>
          </div>
        </div>
      </form>

      {/* Results placeholder */}
      <div className="mt-2">
        <div className="text-center text-gray-500 py-12">
          <SearchIcon className="w-8 h-8 mx-auto mb-4 text-gray-400" />
          <p className="text-xs">Enter search criteria and click the Search button to find events.</p>
        </div>
      </div>
    </div>
  )
}