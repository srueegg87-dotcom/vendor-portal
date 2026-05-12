import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [vendor, setVendor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    // Supabase legt bei Recovery-Links den Token in window.location.hash
    // mit type=recovery — vor der ersten getSession() abfangen.
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setRecoveryMode(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVendor(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVendor(session.user.id)
      else { setVendor(null); setLoading(false) }
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  function clearRecoveryMode() { setRecoveryMode(false) }

  async function fetchVendor(userId) {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    setVendor(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword })
  }

  async function requestPasswordReset(email) {
    const redirectTo = `${window.location.origin}/`
    return supabase.auth.resetPasswordForEmail(email, { redirectTo })
  }

  return (
    <AuthContext.Provider value={{ user, vendor, loading, recoveryMode, clearRecoveryMode, signIn, signOut, fetchVendor, updatePassword, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
