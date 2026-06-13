export default function AdminGroupPage({ params }: { params: { id: string } }) {
  return (
    <div className="text-sm text-gray-500">
      Gestión de grupo <code className="font-mono bg-gray-100 px-1 rounded">{params.id}</code> — próximamente
    </div>
  )
}
