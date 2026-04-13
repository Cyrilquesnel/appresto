import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: restaurantUser } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, restaurants(nom)')
    .eq('user_id', user.id)
    .single()

  const restaurant = restaurantUser?.restaurants
  const nom = Array.isArray(restaurant) ? restaurant[0]?.nom : restaurant?.nom

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">
        {nom ?? 'Mon Restaurant'}
      </h1>
      <p className="text-gray-500 mt-2">Tableau de bord — en construction</p>
    </div>
  )
}
