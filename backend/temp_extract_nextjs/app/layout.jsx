import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'John Doe - Full Stack Developer',
  description: 'Portfolio website showcasing John Doe, a skilled Full-Stack JavaScript Developer with experience in React, Node.js, MongoDB, and related technologies.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}