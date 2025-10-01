# CSV Opener Frontend

A modern Next.js 14 application for processing CSV files and generating AI-powered outreach openers using OpenAI or Hugging Face services.

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── providers.tsx             # Context providers (theme, store, etc.)
│   └── jobs/                     # "Jobs" feature
│       ├── page.tsx              # Jobs listing page
│       ├── JobProgress.tsx       # Job-specific component
│       ├── CSVUploader.tsx       # CSV upload form
│       ├── CSVPreview.tsx        # CSV preview form
│       └── [jobId]/              # Dynamic job details
│           ├── page.tsx          # Job detail page
│           └── JobRetry.tsx      # Retry UI for failed jobs
├── components/                   # Global reusable UI
│   ├── ThemeToggle.tsx
│   ├── SettingsModal.tsx
│   └── index.ts                  # Barrel exports
├── hooks/                        # Custom React hooks
│   ├── useJobSSE.ts
│   ├── useLocalStorage.ts
│   └── index.ts
├── lib/                          # Utilities and configurations
│   ├── appStore.ts               # Zustand store
│   ├── constants.ts              # App constants
│   ├── utils.ts                  # General utilities
│   ├── csvUtils.ts               # CSV helpers
│   └── index.ts                  # Library exports
├── services/                     # API and business logic layer
│   ├── apiClient.ts              # Axios/fetch wrapper
│   ├── jobService.ts             # Job-related API calls
│   └── index.ts                  # Service exports
├── types/                        # TypeScript type definitions
│   ├── api.ts                    # API response types
│   ├── app.ts                    # Application types
│   └── index.ts                  # Type exports
├── public/                       # Static assets (logos, samples, etc.)
│   └── sample.csv                # Sample CSV file
└── README.md                     # Documentation
```

## Architecture Principles

### 1. **Feature-Based Organization**
- **Jobs Feature**: All job-related components, pages, and logic in `/app/jobs/`
- **Global Components**: Reusable UI components in `/components/`
- **Services Layer**: API calls and business logic in `/services/`
- **Shared Utilities**: Common functions and stores in `/lib/`

### 2. **Import Strategy**
- Use barrel exports (`index.ts`) for clean imports
- Prefer absolute imports with `@/` alias
- Group imports: external libraries, internal modules, relative imports

### 3. **Type Safety**
- Separate API types from application types
- Use strict TypeScript configuration
- Export types through barrel files

### 4. **State Management**
- Zustand for global state
- React hooks for local state
- Persistent storage for user preferences

## Key Features

- **File Upload**: Drag-and-drop CSV file upload
- **Job Management**: Real-time job monitoring and management
- **Progress Tracking**: Real-time progress updates with Server-Sent Events
- **Error Handling**: Comprehensive error states and recovery
- **Responsive Design**: Mobile-first responsive layout
- **Accessibility**: ARIA labels and keyboard navigation
- **Theme Support**: Light/dark mode toggle

## Development Guidelines

### Component Structure
```typescript
// 1. Imports (external, internal, relative)
import { useState } from 'react'
import { Button } from '@nextui-org/react'
import { useAppStore } from '@/lib'

// 2. Types/Interfaces
interface ComponentProps {
  // ...
}

// 3. Component
export function Component({ ...props }: ComponentProps) {
  // 4. Hooks
  // 5. State
  // 6. Effects
  // 7. Handlers
  // 8. Render
}
```

### Naming Conventions
- **Components**: PascalCase (`CSVUploader`)
- **Files**: PascalCase for components, camelCase for utilities
- **Hooks**: camelCase starting with `use` (`useJobSSE`)
- **Types**: PascalCase (`JobStatus`, `ContentType`)

### Performance Considerations
- Use React.memo for expensive components
- Implement proper loading states
- Optimize re-renders with useCallback/useMemo
- Lazy load heavy components when possible

## Getting Started

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000)

## Import Examples

```typescript
// Clean, organized imports
import { ThemeToggle, SettingsModal } from '@/components'
import { useAppStore } from '@/lib'
import { jobService } from '@/services'
import { useJobSSE } from '@/hooks'
import { Job, ContentType } from '@/types'

// Feature-specific imports
import { CSVUploader } from './jobs/CSVUploader'
import { JobProgress } from './jobs/JobProgress'
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + NextUI
- **State**: Zustand
- **Icons**: Lucide React
- **TypeScript**: Strict mode
- **Linting**: ESLint + Prettier
