import type { Mood } from '../types'

interface MoodDockProps {
  moods: Mood[]
  activeMood: string | null
  disabled: boolean
  onSelect: (mood: Mood) => void
}

const moodLabels: Record<Mood, string> = {
  calm: 'Calm',
  loud: 'Loud',
  warm: 'Warm',
  lonely: 'Lonely',
  bright: 'Bright',
}

function MoodDock({ moods, activeMood, disabled, onSelect }: MoodDockProps) {
  return (
    <nav className="flex flex-wrap justify-center gap-3 px-4 py-6">
      {moods.map((mood) => {
        const isActive = activeMood === mood
        return (
          <button
            key={mood}
            onClick={() => onSelect(mood)}
            disabled={disabled && !isActive}
            className={`
              relative px-6 py-2.5 rounded-full text-sm font-medium tracking-wide
              transition-all duration-300 ease-out cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? 'bg-brand-neon-500 text-white shadow-lg shadow-brand-neon-500/30 scale-105'
                  : 'bg-white/5 text-brand-slate-300 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:text-brand-white hover:border-brand-neon-500/30 hover:scale-105'
              }
            `}
          >
            {moodLabels[mood]}
          </button>
        )
      })}
    </nav>
  )
}

export default MoodDock
