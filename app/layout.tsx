"use client"

import { useEffect } from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault()
    document.addEventListener("contextmenu", prevent)
    return () => document.removeEventListener("contextmenu", prevent)
  }, [])

  return (
    <html lang="ko">
      <body className="font-sans antialiased min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: 'oklch(0.17 0.02 260)',
              border: '1px solid oklch(0.28 0.02 260)',
              color: 'oklch(0.95 0.01 260)',
            },
          }}
        />
      </body>
    </html>
  )
}