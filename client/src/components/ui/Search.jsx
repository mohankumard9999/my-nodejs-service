import { useState } from 'react'
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
            <Input
              id="keyword"
              placeholder="Search for events..."
              value={formData.keyword}
              onChange={(e) => setFormData({...formData, keyword: e.target.value})}
              className="w-full px-2 py-1 h-8"
            />
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