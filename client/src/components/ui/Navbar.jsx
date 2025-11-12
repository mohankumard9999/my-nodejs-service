import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search as SearchIcon, Heart, Menu, X as XIcon, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Navbar() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

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
  const outerClasses = `sticky top-0 z-50 transition-colors duration-300 border-b ${scrolled ? 'backdrop-blur-md bg-white/70' : 'bg-white/90 backdrop-blur-none'} border-gray-200`

  return (
    <>
      <div className={outerClasses}>
        <div className="px-4 md:px-16 lg:px-64 py-3">
          <div className="flex items-center justify-between">
          {/* Title */}
          <h1 className="text-xl font-bold text-black">Events Around</h1>

          {/* Navigation: hidden on mobile, visible from md and up */}
          <div className="hidden md:flex items-center gap-8">
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
              } catch (e) {
                // ignore parse errors
              }
              return (
                <Link
                  to="/search"
                  state={snapshot ? { restore: snapshot } : undefined}
                  className={`flex items-center gap-2 text-sm transition-colors focus:outline-none focus-visible:outline-none ${
                    location.pathname === '/search' ? 'text-black' : 'text-gray-500 hover:text-gray-700'
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
                location.pathname === '/favorites' ? 'text-black' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
            </Link>
          </div>

          {/* Mobile menu icon */}
          <button
            className="md:hidden p-2 rounded bg-transparent"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          </div>
        </div>
      </div>

      {/* Render mobile overlay controlled by Navbar's state */}
      <MobileNavOverlay open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}

// Mobile full-screen menu overlay (rendered at end so it's easy to find)
export function MobileNavOverlay({ open, onClose }) {
  const navigate = useNavigate()

  const location = useLocation()
  const isSearch = location.pathname === '/search'
  const isFavorites = location.pathname === '/favorites'
  const isEventPage = location.pathname.startsWith('/event/')

  if (!open) return null

  function go(path) {
    onClose()
    navigate(path)
  }

  const overlay = (
    // Dropdown panel anchored at top (full-width) so it overlays the search form beneath like the screenshot
    <div className="fixed top-0 left-0 right-0 z-[9999] md:hidden">
      {/* Shadow applied to the whole menu panel so it appears under the opened hamburger menu, not under the title */}
      <div className="bg-white shadow-md">
  {/* Match base navbar height to avoid title shift when opening menu */}
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          {/* Match base navbar title sizing so it doesn't appear to resize when menu opens */}
          <h1 className="text-xl font-bold text-black">Events Around</h1>
          <button
            className="p-2 rounded bg-white flex items-center justify-center"
            aria-label="Close menu"
            onClick={onClose}
          >
            <XIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

  {/* Divider removed per updated request for a clean header-to-list transition */}

  <div className="space-y-1 py-1 px-4">
          {/* Search-like input row */}
            <button
              onClick={() => go('/search')}
              className={`w-full flex items-center justify-between gap-3 rounded-lg text-left pl-3 pr-4 py-1.5 ${(isSearch || isEventPage) ? 'bg-white' : 'bg-gray-100'}`}
            >
            <div className="flex items-center gap-3">
              <SearchIcon className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">Search</span>
            </div>
          </button>

          {/* Favorites row */}
            <button
              onClick={() => go('/favorites')}
              className={`w-full flex items-center gap-3 rounded-lg text-left pl-3 pr-4 py-1.5 ${(isFavorites || isEventPage) ? 'bg-white' : 'bg-gray-100'}`}
            >
            <Heart className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-700">Favorites</span>
          </button>
        </div>
      </div>
    </div>
  )

  // Render overlay into document.body to avoid stacking context / transform issues
  if (typeof document !== 'undefined') {
    return createPortal(overlay, document.body)
  }

  return overlay
}

// Export default remains the main Navbar; render MobileNavOverlay in parent layout if desired.
// Render the overlay from Navbar so the mobile menu actually appears when opened.
// This keeps usage simple: the overlay is controlled internally by the Navbar component.
/* NOTE: Mobile overlay is rendered directly by Navbar above. No additional wrapper needed. */