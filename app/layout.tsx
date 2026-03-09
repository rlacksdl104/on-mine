import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '마인스위퍼온라인-지뢰계찾기',
  description: '개발자 : 김찬',
  verfication: {
    other : {
      'naver-site-verification': '49eca4baced270eebb85a1df01873dbd5f3aad11',
    }
  },
};


export const viewport: Viewport = {
  themeColor: '#1a1a2e',
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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
