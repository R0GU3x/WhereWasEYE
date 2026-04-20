import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'WhereWasEye Arena',
  description: 'Know where you were',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/wwe-128x128.png',
        sizes: '128x128',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/wwe-128x128.png',
        sizes: '128x128',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/wwe-original.png',
        type: 'image/png',
      },
    ],
    apple: '/wwe-original.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
