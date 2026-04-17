'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'backdrop-blur-md border-b border-white/5' : ''
      }`}
      style={{ backgroundColor: isScrolled ? 'rgba(6,8,26,0.92)' : 'transparent' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/icons/icon-192.png"
              alt="Le Rush"
              width={32}
              height={32}
              className="rounded-rush-md"
            />
            <span className="font-display text-white text-lg tracking-wide">Le Rush</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#fonctionnalites"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Fonctionnalités
            </Link>
            <Link
              href="/#comment-ca-marche"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Comment ça marche
            </Link>
            <Link
              href="/#haccp"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              HACCP
            </Link>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">
              Blog
            </Link>
            <Link href="/#faq" className="text-sm text-gray-400 hover:text-white transition-colors">
              FAQ
            </Link>
          </div>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-rush-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: '#ED2939' }}
            >
              Demander une démo
              <span aria-hidden>→</span>
            </Link>

            {/* Hamburger mobile */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div
            className="md:hidden border-t border-white/10 py-4 flex flex-col gap-3"
            style={{ backgroundColor: 'rgba(6,8,26,0.98)' }}
          >
            {[
              { href: '/#fonctionnalites', label: 'Fonctionnalités' },
              { href: '/#comment-ca-marche', label: 'Comment ça marche' },
              { href: '/#haccp', label: 'HACCP' },
              { href: '/blog', label: 'Blog' },
              { href: '/#faq', label: 'FAQ' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-300 hover:text-white px-4 py-1.5 text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/demo"
              className="mx-4 mt-2 py-3 rounded-rush-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: '#ED2939' }}
              onClick={() => setIsMenuOpen(false)}
            >
              Demander une démo →
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
