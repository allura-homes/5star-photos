import { Sidebar } from '@/components/sidebar'
import { Sparkles, Zap, Shield, Cpu } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      
      <main className="flex-1 ml-20 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Hero Card */}
          <div className="glass-card-strong rounded-[32px] p-12 mb-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full gradient-magenta-violet flex items-center justify-center glow-magenta">
                <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-white mb-3">About 5star.photos</h1>
            <p className="text-lg text-[#C9CCDA] max-w-2xl text-balance">
              Professional photo enhancement powered by AI, built specifically for STR hosts.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="glass-card rounded-3xl p-8">
              <div className="w-16 h-16 rounded-2xl gradient-magenta-violet flex items-center justify-center mb-6 glow-magenta">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">5star.photos Standard</h3>
              <p className="text-[#C9CCDA] leading-relaxed">
                Every photo is enhanced following our strict aesthetic guidelines: neutral 4000K white balance, bright crisp exposure, pure whites, and realistic textures.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8">
              <div className="w-16 h-16 rounded-2xl gradient-blue-teal flex items-center justify-center mb-6 glow-blue">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Art Direction</h3>
              <p className="text-[#C9CCDA] leading-relaxed">
                Powered by ChatGPT, our Art Director analyzes each photo and provides precise editing instructions while our QA Curator ensures quality standards are met.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8">
              <div className="w-16 h-16 rounded-2xl gradient-orange-red flex items-center justify-center mb-6 glow-orange">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Fast & Simple</h3>
              <p className="text-[#C9CCDA] leading-relaxed">
                Upload your photos, choose a style mode, and let our AI handle the rest. Preview results before downloading the final high-resolution images.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8">
              <div className="w-16 h-16 rounded-2xl gradient-violet-blue flex items-center justify-center mb-6 glow-violet">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">STR Host-Friendly</h3>
              <p className="text-[#C9CCDA] leading-relaxed">
                Built specifically for Airbnb and short-term rental hosts. No furniture additions, no fake elements—just clean, professional enhancements that convert.
              </p>
            </div>
          </div>

          {/* Style Modes */}
          <div className="glass-card rounded-3xl p-8 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">Style Modes</h2>
            <div className="space-y-6">
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">Daylight 4000K</h4>
                <p className="text-[#C9CCDA] leading-relaxed">
                  Neutral, natural daylight look with crisp exposure. Perfect for interiors and standard listing photos. Whites stay pure, colors stay true.
                </p>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">Cotton Candy Dusk</h4>
                <p className="text-[#C9CCDA] leading-relaxed">
                  Soft pink/lavender/blue sky tones for exteriors. Creates an inviting, dreamy atmosphere while maintaining believability. Great for pools and outdoor spaces.
                </p>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">Full 5star Fix</h4>
                <p className="text-[#C9CCDA] leading-relaxed">
                  Maximum enhancement with vertical correction, advanced color grading, and texture optimization. The complete professional treatment for your best shots.
                </p>
              </div>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="glass-card rounded-3xl p-8 text-center">
            <p className="text-sm text-[#C9CCDA] mb-2">Powered by</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <span className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium">
                ChatGPT-5
              </span>
              <span className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium">
                Next.js 16
              </span>
              <span className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium">
                Supabase
              </span>
              <span className="px-4 py-2 rounded-xl bg-white/10 text-white font-medium">
                Vercel AI SDK
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
