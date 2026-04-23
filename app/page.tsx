"use client"

import Link from "next/link"
import { Header } from "@/components/header"
import { useAuthContext } from "@/lib/contexts/auth-context"
import { Sparkles, Ruler, Sun, CheckCircle, Upload, Clock, Download, Camera, ArrowRight, Star } from "lucide-react"
import { BeforeAfterSlider } from "@/components/before-after-slider"

// Rebuild trigger for v0 environment
export default function Home() {
  const { isAuthenticated } = useAuthContext()

  return (
    <div>
      <Header />

      <section className="flex items-center justify-center px-6 py-20 pt-32">
        <div className="max-w-5xl w-full text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-balance leading-tight">
            Instantly Transform Your Airbnb Photos Into
          </h1>
          <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-amber-400 mb-8">5-Star Conversion Magnets</p>

          <div className="mb-6 max-w-4xl mx-auto">
            <div className="aspect-[4/3] w-full">
              <BeforeAfterSlider
                beforeImage="/images/before.jpeg"
                afterImage="/images/after.png"
                beforeAlt="Bathroom before enhancement"
                afterAlt="Bathroom after 5star.photos enhancement"
              />
            </div>
            <p className="text-sm text-[#C9CCDA] mt-4">Drag the slider to see the difference</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link href={isAuthenticated ? "/library" : "/enhance"}>
              <button className="group relative px-12 py-6 rounded-full gradient-magenta-violet glow-magenta hover:scale-105 transition-all duration-300 text-2xl font-bold text-white shadow-2xl">
                {isAuthenticated ? "Go to My Library" : "Enhance My Photos"}
                <ArrowRight className="inline-block ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>

            <a href="#examples" className="text-[#C9CCDA] hover:text-white transition-colors text-lg underline">
              See examples first
            </a>
          </div>

          {!isAuthenticated && (
            <p className="text-sm text-[#C9CCDA] flex items-center justify-center gap-4 flex-wrap mb-8">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-[#27D980]" />
                No login required
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-[#27D980]" />
                No credit card
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-[#27D980]" />
                Works in seconds
              </span>
            </p>
          )}

          <p className="text-xl md:text-2xl text-[#C9CCDA] max-w-3xl mx-auto text-balance leading-relaxed">
            Upload just one photo — 5star.photos fixes lighting, color, clarity, and composition automatically. Your
            home has never looked this good… with almost zero effort.
          </p>
        </div>
      </section>

      <section className="py-20 px-6" id="examples">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 text-balance">
            Your Photos Are 90% of Your Airbnb Success. Make Them Look UNDENIABLE.
          </h2>
          <p className="text-xl text-[#C9CCDA] max-w-3xl mx-auto leading-relaxed">
            5star.photos gives your listing the visual polish of a pro photographer — without the shoot, the scheduling,
            or the expense.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="glass-card rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 rounded-2xl gradient-magenta-violet flex items-center justify-center mb-6 glow-magenta">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Fixes Bad Lighting</h3>
            <p className="text-[#C9CCDA] leading-relaxed">
              Automatically corrects color temperature, brightness, shadows, and blown highlights.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 rounded-2xl gradient-violet-blue flex items-center justify-center mb-6 glow-violet">
              <Ruler className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Straightens & Sharpens</h3>
            <p className="text-[#C9CCDA] leading-relaxed">
              Perfect verticals, crisp details, and natural textures — zero distortion.
            </p>
          </div>

          <div className="glass-card rounded-3xl p-8 hover:scale-105 transition-transform duration-300">
            <div className="w-16 h-16 rounded-2xl gradient-blue-teal flex items-center justify-center mb-6 glow-teal">
              <Sun className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Sky & Exterior Magic</h3>
            <p className="text-[#C9CCDA] leading-relaxed">
              A brighter daytime look or soft cotton-candy dusk, without looking fake.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card-strong rounded-3xl p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-[#FFB341] text-[#FFB341]" />
                ))}
              </div>
              <p className="text-lg text-white mb-4 leading-relaxed">
                "I more than doubled my Airbnb clicks and conversions with almost zero effort."
              </p>
              <p className="text-sm text-[#C9CCDA]">— Actual host, early access user</p>
            </div>

            <div className="glass-card-strong rounded-3xl p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-[#FFB341] text-[#FFB341]" />
                ))}
              </div>
              <p className="text-lg text-white mb-4 leading-relaxed">
                "The fastest upgrade I've made to any of my listings."
              </p>
              <p className="text-sm text-[#C9CCDA]">— STR Host</p>
            </div>

            <div className="glass-card-strong rounded-3xl p-8">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-[#FFB341] text-[#FFB341]" />
                ))}
              </div>
              <p className="text-lg text-white mb-4 leading-relaxed">
                "My photos finally look like the high-end listings they're competing with."
              </p>
              <p className="text-sm text-[#C9CCDA]">— Airbnb Host</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-b from-transparent to-[#0B0D1A]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-16">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full gradient-magenta-violet flex items-center justify-center mx-auto mb-6 glow-magenta">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">1. Upload</h3>
              <p className="text-[#C9CCDA]">Drop your photos or paste a Google Drive link. We handle the rest.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 rounded-full gradient-violet-blue flex items-center justify-center mx-auto mb-6 glow-violet">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">2. Process</h3>
              <p className="text-[#C9CCDA]">AI analyzes and enhances each photo in seconds. No waiting.</p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 rounded-full gradient-blue-teal flex items-center justify-center mx-auto mb-6 glow-teal">
                <Download className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">3. Download</h3>
              <p className="text-[#C9CCDA]">Get your stunning photos ready to upload to your listing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto glass-card rounded-3xl p-12 text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-8 h-8 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Make Your Listing Stand Out?</h2>
          <p className="text-xl text-[#C9CCDA] mb-8">
            Join thousands of hosts who've transformed their photos with 5star.photos
          </p>
          <Link href={isAuthenticated ? "/library" : "/enhance"}>
            <button className="px-10 py-5 rounded-full gradient-magenta-violet glow-magenta hover:scale-105 transition-all duration-300 text-xl font-bold text-white">
              {isAuthenticated ? "Go to My Library" : "Get Started Free"}
            </button>
          </Link>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#FF3EDB]" />
            <span className="text-lg font-bold text-white">5star.photos</span>
          </div>
          <p className="text-[#C9CCDA] text-sm">© 2025 5star.photos. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[#C9CCDA] hover:text-white text-sm transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-[#C9CCDA] hover:text-white text-sm transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
