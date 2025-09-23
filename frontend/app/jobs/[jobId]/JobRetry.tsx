'use client'

import React from 'react'
import { 
  Button, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  useDisclosure
} from '@nextui-org/react'
import { RotateCcw, AlertTriangle } from 'lucide-react'

interface JobRetryProps {
  jobId: string
  onRetry: (urlIds?: string[]) => Promise<void>
  selectedUrls: Set<string>
  isRetrying: boolean
}

export function JobRetry({ jobId, onRetry, selectedUrls, isRetrying }: JobRetryProps) {
  const { isOpen, onOpen, onClose } = useDisclosure()

  const handleRetry = async () => {
    const urlIds = selectedUrls.size > 0 ? Array.from(selectedUrls) : undefined
    await onRetry(urlIds)
    onClose()
  }

  const retryCount = selectedUrls.size

  return (
    <>
      <Button
        color="warning"
        variant="flat"
        startContent={<RotateCcw className="w-4 h-4" />}
        onPress={onOpen}
        isDisabled={isRetrying}
        aria-label="Retry failed URLs"
      >
        {retryCount > 0 ? `Retry ${retryCount} URLs` : 'Retry All Failed'}
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Retry Failed URLs
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-3">
              <p className="text-sm text-default-600">
                {retryCount > 0 
                  ? `Are you sure you want to retry ${retryCount} selected failed URLs?`
                  : 'Are you sure you want to retry all failed URLs for this job?'
                }
              </p>
              <p className="text-xs text-default-500">
                This will re-queue the selected URLs for processing with the OpenAI API.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button 
              color="warning" 
              onPress={handleRetry}
              isLoading={isRetrying}
              startContent={!isRetrying && <RotateCcw className="w-4 h-4" />}
            >
              {isRetrying ? 'Retrying...' : 'Retry URLs'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
