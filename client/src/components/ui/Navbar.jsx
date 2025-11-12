import { Link, useLocation } from 'react-router-dom'
import { Search as SearchIcon, Heart, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      // Consider any vertical scroll > 2px as scrolled for quicker visual feedback
      setScrolled(window.scrollY > 2)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // initialize state on mount
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Dynamic classes to achieve subtle translucent blur over content as user scrolls
  const outerClasses = `sticky top-0 z-50 transition-colors duration-300 border-b ${scrolled ? 'backdrop-blur-md bg-white/70' : 'bg-white/90 backdrop-blur-none'} border-gray-200` // subtle transparency & blur when scrolled

  return (
    <div className={outerClasses}>
      <div className="px-4 md:px-16 lg:px-64 py-3">
        <div className="flex items-center justify-between">
          {/* Title */}
          <h1 className="text-xl font-bold text-black">
            Events Around
          </h1>

          {/* Navigation */}
          <div className="flex items-center gap-8">
            {(() => {
              // Read latest persisted search snapshot each render so navigation always carries freshest state.
              let snapshot = null
              try {
                const raw = sessionStorage.getItem('searchSnapshot')
                if (raw) {
                  const parsed = JSON.parse(raw)
                  if (parsed && typeof parsed === 'object' && parsed.formData && Array.isArray(parsed.events)) {
                    snapshot = parsed
                  }
                }
              } catch {}
              return (
                <Link
                  to="/search"
                  state={snapshot ? { restore: snapshot } : undefined}
                  className={`flex items-center gap-2 text-sm transition-colors focus:outline-none focus-visible:outline-none ${
                    location.pathname === '/search'
                      ? 'text-black'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <SearchIcon className="w-5 h-5" />
                  <span>Search</span>
                </Link>
              )
            })()}

            <Link
              to="/favorites"
              className={`flex items-center gap-2 text-sm transition-colors focus:outline-none focus-visible:outline-none ${
                location.pathname === '/favorites'
                  ? 'text-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
            </Link>
          </div>
          {/* Mobile menu placeholder icon */}
          <button className="md:hidden p-2 rounded hover:bg-gray-100" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}