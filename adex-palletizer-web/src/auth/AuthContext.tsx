import { createContext, useContext, type ReactNode } from 'react'
import type { AuthUser } from './authApi'

interface AuthContextValue {
  user: AuthUser
  logout: () => Promise<void>
  logoutPending: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  value: AuthContextValue
  children: ReactNode
}

export function AuthProvider({ value, children }: AuthProviderProps) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
