'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronDown, Check, Compass, Search, Database, AlertTriangle, TrendingUp, Cpu } from 'lucide-react'
import TrendGlobe from '@/components/3d/TrendGlobe'
import PageTransition from '@/components/motion/PageTransition'

export default function LandingPage() {
  const features = [
    {
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      title: "Cross-Platform Ingestion",
      desc: "Monitor over 50+ platforms simultaneously including Reddit, Twitter, Discord, Hacker News, and custom APIs."
    },
    {
      icon: <Search className="w-5 h-5 text-indigo-400" />,
      title: "Advanced Vector Search",
      desc: "Perform sub-second similarity matching across billions of document chunks using FAISS and pgvector."
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-indigo-400" />,
      title: "Anomaly Tracking",
      desc: "Instantly flag volume spikes, unusual keyword growth, and velocity shifts before they spread."
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-indigo-400" />,
      title: "Propagation Forecasting",
      desc: "Map the path of signals as they travel from niche developer hubs into mainstream social spheres."
    },
    {
      icon: <Compass className="w-5 h-5 text-indigo-400" />,
      title: "Trend Classification",
      desc: "Categorize signals dynamically using lightweight multilingual NLP models based on velocity and size."
    },
    {
      icon: <Cpu className="w-5 h-5 text-indigo-400" />,
      title: "Ensemble Modeling",
      desc: "Deploy XGBoost and LightGBM models trained on verified historical post-exam datasets."
    }
  ]

  const pricingTiers = [
    {
      name: "Starter",
      price: "$0",
      period: "forever",
      desc: "For individual researchers and hobbyists.",
      features: [
        "Track up to 5 custom keyword nodes",
        "Standard ingestion latency (6 hours)",
        "Basic vector search queries",
        "Public community support"
      ],
      cta: "Start for free",
      popular: false
    },
    {
      name: "Pro",
      price: "$29",
      period: "month",
      desc: "For active content creators and analysts.",
      features: [
        "Track up to 100 active keyword nodes",
        "Real-time stream connection (websockets)",
        "Historical projection charting",
        "Priority anomaly alerts",
        "Email support response under 2 hours"
      ],
      cta: "Upgrade to Pro",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "tailored",
      desc: "For institutional signal tracking teams.",
      features: [
        "Unlimited keyword tracking nodes",
        "Dedicated isolated database instances",
        "Custom classification training models",
        "99.9% uptime SLA guarantee",
        "Dedicated developer integrations"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ]

  return (
    <PageTransition>
      <div className="relative min-h-screen bg-[#050508] text-[#f8fafc]">
        
        {/* HERO SECTION */}
        <section className="relative w-full h-[95vh] flex items-center justify-center overflow-hidden border-b border-[var(--color-border)] px-6">
          {/* Globe Backdrop Layer */}
          <div className="absolute inset-0 z-0 pointer-events-none select-none">
            <TrendGlobe interactive={false} opacity={0.3} />
          </div>

          {/* Glowing gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent z-1 pointer-events-none" />

          {/* Hero Content */}
          <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl text-center">
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-xs font-mono tracking-[0.3em] uppercase text-[var(--color-text-secondary)] mb-6"
            >
              SIGNAL INTELLIGENCE PLATFORM
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.15] mb-8"
            >
              Predict trends <br />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
                before they happen.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-base md:text-lg text-[var(--color-text-secondary)] max-w-lg mx-auto mb-10 leading-relaxed"
            >
              Foresight monitors 50+ platforms and gives you 1–3 weeks of advance warning before a trend reaches mainstream audiences.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 mb-16 justify-center w-full max-w-sm sm:max-w-none"
            >
              <Link
                href="/dashboard"
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-[var(--shadow-glow-indigo)] border border-indigo-400/20 text-center"
              >
                Get early access →
              </Link>
              <a
                href="#features"
                className="border border-[var(--color-border)] hover:border-[var(--color-border-active)] bg-white/5 hover:bg-white/10 text-[var(--color-text-primary)] px-8 py-3 rounded-xl font-medium transition-all duration-200 text-center"
              >
                See how it works
              </a>
            </motion.div>

            {/* Social Proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.8 }}
              className="flex items-center gap-3.5 select-none"
            >
              <div className="flex -space-x-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="w-full h-full bg-gradient-to-br from-[#6366f1] to-purple-800 opacity-70" />
                  </div>
                ))}
              </div>
              <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                Trusted by 10,000+ creators & researchers
              </span>
            </motion.div>

          </div>

          {/* Scroll Down */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 select-none opacity-40 animate-bounce">
            <ChevronDown className="w-6 h-6 text-white" />
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto border-b border-[var(--color-border)]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono tracking-widest text-[#6366f1] uppercase bg-[#6366f1]/10 px-3 py-1 rounded-full border border-indigo-500/20">
              CORE FEATURES
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-4">
              A comprehensive signal toolkit
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">
              Powerful ingestion engines and machine learning classifiers built to surface rising topics before they break out.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-active)] hover:shadow-[0_0_30px_rgba(99,102,241,0.05)] rounded-2xl p-6 transition-all duration-300 flex flex-col gap-4 group hover:-translate-y-1"
              >
                <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center border border-indigo-500/20 group-hover:bg-[#6366f1]/20 transition-all duration-300">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-[#6366f1] transition-colors duration-200">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-24 px-6 max-w-7xl mx-auto border-b border-[var(--color-border)]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono tracking-widest text-[#6366f1] uppercase">
              WORKFLOW
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-2">
              From signal to prediction
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#12121e] border border-[var(--color-border)] flex items-center justify-center font-mono text-sm font-semibold text-[#6366f1] shadow-[var(--shadow-glow-indigo)]">
                01
              </div>
              <h4 className="text-sm font-semibold text-white">Ingest Streams</h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
                Aggregating real-time text and metric activity feeds from 50+ mainstream and developer sources daily.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#12121e] border border-[var(--color-border)] flex items-center justify-center font-mono text-sm font-semibold text-[#8b5cf6] shadow-[var(--shadow-glow-indigo)]">
                02
              </div>
              <h4 className="text-sm font-semibold text-white">Analyze Clusters</h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
                Vectorizing text chunks and mapping cluster densities to detect abnormal acceleration metrics.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full bg-[#12121e] border border-[var(--color-border)] flex items-center justify-center font-mono text-sm font-semibold text-[#10b981] shadow-[var(--shadow-glow-emerald)]">
                03
              </div>
              <h4 className="text-sm font-semibold text-white">Forecast Outbreak</h4>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
                Projecting velocity bounds and issuing early-access alerts prior to mainstream platform saturation.
              </p>
            </div>
            
          </div>
        </section>

        {/* PRICING PLANS */}
        <section className="py-24 px-6 max-w-6xl mx-auto border-b border-[var(--color-border)]">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono tracking-widest text-[#6366f1] uppercase bg-[#6366f1]/10 px-3 py-1 rounded-full border border-indigo-500/20">
              PRICING
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-4">
              Flexible tiers for any scale
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {pricingTiers.map((tier, idx) => (
              <div
                key={idx}
                className={`relative bg-[var(--color-bg-surface)] rounded-2xl p-6 flex flex-col justify-between border transition-all duration-300 ${
                  tier.popular
                    ? 'border-[#6366f1] shadow-[var(--shadow-glow-indigo)] md:scale-105 z-10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-active)]'
                }`}
              >
                {tier.popular && (
                  <span className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-[#6366f1] text-white text-[9px] uppercase font-mono tracking-wider font-extrabold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                )}
                
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase font-mono tracking-wider">
                    {tier.name}
                  </h4>
                  <div className="flex items-baseline gap-1 mt-4">
                    <span className="text-4xl font-bold text-white tracking-tight">{tier.price}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] font-mono">/{tier.period}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                    {tier.desc}
                  </p>
                  
                  <ul className="flex flex-col gap-3 mt-6 border-t border-[var(--color-border)] pt-6">
                    {tier.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs text-[var(--color-text-secondary)]">
                        <Check className="w-4 h-4 text-[#10b981] flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  <Link
                    href="/dashboard"
                    className={`block w-full text-center px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                      tier.popular
                        ? 'bg-[#6366f1] hover:bg-[#4f46e5] text-white border-indigo-400/20 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-active)] bg-white/5 hover:bg-white/10 text-[var(--color-text-primary)]'
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-12 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-[var(--color-text-muted)] border-t border-transparent">
          <div className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--color-text-primary)] tracking-widest">
            FORESIGHT
          </div>
          <div>
            &copy; {new Date().getFullYear()} FORESIGHT. Developed by Shlok Tiwari. All rights reserved.
          </div>
        </footer>

      </div>
    </PageTransition>
  )
}
