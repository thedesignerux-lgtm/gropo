'use client'

import { useFormState } from 'react-dom'
import { adminLogin } from './actions'

export default function AdminLoginForm() {
  const [error, formAction] = useFormState(adminLogin, null)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Vonda Admin</h1>
        <p className="text-sm text-gray-500 mb-6">Acceso restringido</p>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoFocus
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-brand text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-dark transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
