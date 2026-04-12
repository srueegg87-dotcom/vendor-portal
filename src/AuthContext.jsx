import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVendor(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVendor(session.user.id)
      else { setVendor(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchVendor(userId) {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    setVendor(data)
    setLoading(false)
  }

  async function signUp(email, password, name) {
    return supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    })
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, vendor, loading, signUp, signIn, signOut, fetchVendor }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
