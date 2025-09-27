'use client'

import React from 'react'
import { Button } from '@nextui-org/react'
import { FileText, Settings, Upload } from 'lucide-react'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useRouter, usePathname } from 'next/navigation'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const handleManageJobs = () => {
    router.push('/jobs')
  }

  const handleUploadCSV = () => {
    router.push('/')
  }

  const handleGoHome = () => {
    router.push('/')
  }

  // Determine which page we're on
  const isOnJobsPage = pathname === '/jobs' || pathname.startsWith('/jobs/')
  const isOnHomePage = pathname === '/'
  
  // Debug logging
  console.log('Header Debug:', { pathname, isOnHomePage, isOnJobsPage })

  return (
    <header className="border-b border-divider/50 bg-background/95 backdrop-blur-md shadow-bubbly sticky top-0 z-50 glow-primary">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-6 cursor-pointer"
          onClick={handleGoHome}
        >
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-bubbly flex items-center justify-center shadow-bubbly">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">CSV Opener</h1>
            <p className="text-base text-foreground/70 font-medium mt-1">AI-powered CSV processing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            startContent={<Upload className="w-4 h-4" />}
            onPress={handleUploadCSV}
            className={`rounded-bubbly transition-all duration-200 ${
              isOnHomePage 
                ? "border-2 border-primary bg-primary/10" 
                : "hover:bg-secondary/50"
            }`}
            aria-label="Upload CSV"
          >
            Upload CSV
          </Button>
          <Button
            variant="ghost"
            startContent={<Settings className="w-4 h-4" />}
            onPress={handleManageJobs}
            className={`rounded-bubbly transition-all duration-200 ${
              isOnJobsPage 
                ? "border-2 border-primary bg-primary/10" 
                : "hover:bg-secondary/50"
            }`}
            aria-label="Manage jobs"
          >
            Manage Jobs
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
