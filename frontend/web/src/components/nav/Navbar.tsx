'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true)
      } else {
        setIsScrolled(false)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Trends', path: '/trends' },
    { name: 'Propagation', path: '/propagation' },
    { name: 'API', path: '/api-docs' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md ${
      isScrolled 
        ? 'bg-[#050508]/80 border-b border-[var(--color-border)] py-4' 
        : 'bg-[#050508]/40 border-b border-transparent py-5'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold tracking-[0.25em] text-[var(--color-text-primary)]">
            FORESIGHT
          </span>
          <div className="w-2 h-2 rounded-full bg-[#6366f1] pulse-dot"></div>
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.path
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`text-sm font-medium transition-colors duration-200 ${
                  isActive 
                    ? 'text-[var(--color-accent-primary)]' 
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {link.name}
              </Link>
            )
          })}
        </div>

        {/* Right Action Section */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase font-mono tracking-wider bg-[#6366f1]/15 text-[#8b5cf6] border border-[#6366f1]/30 px-2.5 py-1 rounded-full font-semibold">
            PRO ACCESS
          </span>
          <div className="w-8 h-8 rounded-full bg-[#12121e] border border-[var(--color-border)] flex items-center justify-between cursor-pointer hover:border-[var(--color-border-active)] transition-all duration-200 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-tr from-[#6366f1] to-[#8b5cf6] opacity-80" />
          </div>
        </div>
      </div>
    </nav>
  )
}
