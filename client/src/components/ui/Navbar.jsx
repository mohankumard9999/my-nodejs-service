import { Link, useLocation } from 'react-router-dom'
import { Search as SearchIcon, Heart } from 'lucide-react'

export default function Navbar() {
  const location = useLocation()
  
  return (
    <div className="border-b border-gray-200">
      <div className="px-4 md:px-16 lg:px-64 py-3">
        <div className="flex items-center justify-between">
          {/* Title */}
          <h1 className="text-xl font-bold text-black-900">
            Events Around
          </h1>
          
          {/* Navigation */}
          <div className="flex items-center gap-8">
            <Link
              to="/search"
               className={`flex items-center gap-2 text-sm transition-colors focus:outline-none ${
                location.pathname === '/search'
                  ? 'text-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <SearchIcon className="w-5 h-5" />
              <span>Search</span>
            </Link>
            
            <Link
              to="/favorites"
              className={`flex items-center gap-2 text-sm transition-colors ${
                location.pathname === '/favorites'
                  ? 'text-black'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}