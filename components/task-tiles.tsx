'use client'

import { Sun, Crop, Sparkles, Mountain } from 'lucide-react'

interface TaskTilesProps {
  stage: 'idle' | 'uploading' | 'processing'
}

export function TaskTiles({ stage }: TaskTilesProps) {
  const tasks = [
    {
      id: 'lighting',
      icon: Sun,
      title: 'Lighting & Color',
      subtitle: 'Balance exposure & white balance',
      gradient: 'from-[#FFB341] to-[#FF3EDB]'
    },
    {
      id: 'composition',
      icon: Crop,
      title: 'Composition',
      subtitle: 'Straighten & crop perfectly',
      gradient: 'from-[#FF3EDB] to-[#6A1FBF]'
    },
    {
      id: 'cleanup',
      icon: Sparkles,
      title: 'Cleanup',
      subtitle: 'Remove unwanted objects',
      gradient: 'from-[#6A1FBF] to-[#2F7BFF]'
    },
    {
      id: 'sky',
      icon: Mountain,
      title: 'Sky & Grounds',
      subtitle: 'Enhance sky and landscape',
      gradient: 'from-[#2F7BFF] to-[#16B2A5]'
    }
  ]

  const getStatus = () => {
    if (stage === 'uploading') return 'Uploading...'
    if (stage === 'processing') return 'Processing...'
    return 'Ready'
  }

  return (
    <div className="glass-card rounded-3xl p-8 mb-6">
      <h2 className="text-2xl font-semibold text-white mb-6">Enhancement tasks</h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tasks.map((task) => {
          const Icon = task.icon
          const isActive = stage === 'processing'
          
          return (
            <div
              key={task.id}
              className={`glass-card rounded-2xl p-6 transition-all duration-300 ${
                isActive ? 'animate-pulse' : ''
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${task.gradient} flex items-center justify-center mb-4`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-1">{task.title}</h3>
              <p className="text-sm text-[#C9CCDA] mb-3">{task.subtitle}</p>
              
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                stage === 'processing'
                  ? 'bg-[#FF3EDB]/20 text-[#FF3EDB]'
                  : stage === 'uploading'
                  ? 'bg-[#FFB341]/20 text-[#FFB341]'
                  : 'bg-[#27D980]/20 text-[#27D980]'
              }`}>
                {getStatus()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
