import { cookies } from 'next/headers'
import AdminLoginForm from './AdminLoginForm'
import { adminLogout } from './actions'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = cookies().get('admin_auth')?.value
  const secret = process.env.ADMIN_SECRET
  const isAuth = !!secret && auth === secret

  if (!isAuth) return <AdminLoginForm />

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-gray-900 text-base">Gropo Admin</span>
        <form action={adminLogout}>
          <button
            type="submit"
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
