'use client'

import { Button } from '@nextui-org/react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        isIconOnly
        variant="ghost"
        className="w-10 h-10"
        aria-label="Theme toggle loading"
      >
        <div className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <Button
      isIconOnly
      variant="ghost"
      onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-10 h-10"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  )
}

