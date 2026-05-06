import { createContext, useContext, type ReactNode } from 'react'
import type { AuthUser } from './authApi'
import type { DataTradeModuleAccess } from '../dataTrade/client'

export interface AuthContextValue {
  user: AuthUser
  accessToken: string | null
  modules: DataTradeModuleAccess[]
  canAccessModule: (moduleCode: string) => boolean
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
