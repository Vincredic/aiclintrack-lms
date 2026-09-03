import { useEffect, useState } from 'react'
import { AdminShell } from './components/lms/AdminShell'
import { LmsShell } from './components/lms/LmsShell'
import { isAdminHash } from './lib/adminAuth'

export default function App() {
  const [admin, setAdmin] = useState(() =>
    typeof window !== 'undefined' ? isAdminHash() : false,
  )

  useEffect(() => {
    const sync = () => setAdmin(isAdminHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return admin ? <AdminShell /> : <LmsShell />
}
