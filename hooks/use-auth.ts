'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuth(requireAuth: boolean = true) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (requireAuth && !user) {
        router.push('/login')
        return
      }

      setUser(user)
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        } else if (session?.user) {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router, requireAuth])

  return { user, loading }
}
