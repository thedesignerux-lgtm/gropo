export default function GrupoPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm">Grupo: {params.id} — próximamente</p>
    </main>
  )
}
