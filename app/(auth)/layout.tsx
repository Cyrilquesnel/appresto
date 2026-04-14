export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1
          className="text-2xl font-bold text-center mb-8"
          style={{ color: 'var(--color-primary)' }}
        >
          Mise en Place
        </h1>
        {children}
      </div>
    </div>
  )
}
