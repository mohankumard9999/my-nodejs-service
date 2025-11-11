import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/ui/Navbar'
import Search from './components/ui/Search'
import EventDetails from './components/ui/EventDetails'
import Favorites from './components/ui/Favorites'
import { Toaster } from './components/ui/sonner'

function App() {
  return (
    <div className="w-screen min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<Search />} />
        <Route path="/event/:id" element={<EventDetails />} />
        <Route path="/favorites" element={<Favorites />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </div>
  )
}

export default App