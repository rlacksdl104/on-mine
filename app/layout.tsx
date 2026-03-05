import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Minesweeper Online - 멀티플레이어 지뢰찾기',
  description: '친구들과 함께 즐기는 실시간 멀티플레이어 지뢰찾기 게임. 협동 모드와 대전 모드를 지원합니다.',
}

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
