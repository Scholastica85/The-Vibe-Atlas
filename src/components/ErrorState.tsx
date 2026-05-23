interface ErrorStateProps {
  message: string
  onRetry: () => void
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="max-w-xl mx-auto px-4 pb-16">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 mb-4">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-brand-white mb-1">
          Failed to load images
        </h3>
        <p className="text-sm text-brand-slate-400 mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-full bg-brand-neon-500 text-white text-sm font-medium
                     cursor-pointer hover:bg-brand-neon-400 transition-all duration-300
                     shadow-lg shadow-brand-neon-500/25"
        >
          Try again
        </button>
      </div>
    </section>
  )
}

export default ErrorState
