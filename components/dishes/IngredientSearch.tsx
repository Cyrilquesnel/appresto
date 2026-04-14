'use client'
import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { trpc } from '@/lib/trpc/client'

interface IngredientSearchResult {
  id: string
  nom: string
  source: string
  allergenes: string[]
  score: number
}

interface IngredientSearchProps {
  onSelect: (ingredient: { id: string; nom: string; allergenes: string[] }) => void
  placeholder?: string
}

export function IngredientSearch({
  onSelect,
  placeholder = 'Rechercher un ingrédient...',
}: IngredientSearchProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const { data: results, isLoading } = trpc.plats.searchIngredients.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent"
        data-testid="ingredient-search-input"
      />
      {isLoading && <div className="absolute right-3 top-3 text-gray-400 text-sm">...</div>}
      {results && results.length > 0 && query.length >= 2 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.map((item: IngredientSearchResult) => (
            <li
              key={item.id}
              onClick={() => {
                onSelect({ id: item.id, nom: item.nom, allergenes: item.allergenes ?? [] })
                setQuery('')
              }}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
              data-testid={`ingredient-suggestion-${item.nom}`}
            >
              <span className="text-gray-900">{item.nom}</span>
              <span className="text-xs text-gray-400 capitalize">{item.source}</span>
            </li>
          ))}
        </ul>
      )}
      {results?.length === 0 && debouncedQuery.length >= 2 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow p-3 text-sm text-gray-500">
          Aucun résultat — l&apos;ingrédient sera créé manuellement
        </div>
      )}
    </div>
  )
}
