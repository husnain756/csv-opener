'use client'

import { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Slider,
  Switch,
  Divider,
  Card,
  CardBody,
  CardHeader
} from '@nextui-org/react'
import { Settings, Info } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const modelOptions = [
  { key: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
  { key: 'gpt-4', label: 'GPT-4', description: 'Higher quality, more expensive' },
  { key: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Latest model with improved performance' }
]

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState({
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 100,
    maxConcurrency: 10,
    retryAttempts: 3,
    retryDelay: 1000,
    enableCostTracking: true,
    enableDetailedLogs: false
  })

  const handleSave = () => {
    // Save settings to localStorage or send to backend
    localStorage.setItem('csv-opener-settings', JSON.stringify(settings))
    onClose()
  }

  const handleReset = () => {
    setSettings({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 100,
      maxConcurrency: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCostTracking: true,
      enableDetailedLogs: false
    })
  }

  const estimatedCost = (settings.maxTokens * 0.0015) / 1000 // Rough estimate

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </ModalHeader>
        <ModalBody className="space-y-6">
          {/* OpenAI Configuration */}
          <Card>
            <CardHeader className="card-header-shadow">
              <h3 className="text-lg font-semibold">OpenAI Configuration</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Select
                label="Model"
                placeholder="Select OpenAI model"
                selectedKeys={[settings.model]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string
                  if (selected) setSettings(prev => ({ ...prev, model: selected }))
                }}
              >
                {modelOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key} textValue={option.label}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-default-500">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </Select>

              <div className="space-y-2">
                <label className="text-sm font-medium">Temperature: {settings.temperature}</label>
                <Slider
                  value={settings.temperature}
                  onChange={(value) => setSettings(prev => ({ ...prev, temperature: value as number }))}
                  minValue={0}
                  maxValue={1}
                  step={0.1}
                  color="primary"
                  className="w-full"
                />
                <p className="text-xs text-default-500">
                  Lower values make responses more focused, higher values more creative
                </p>
              </div>

              <Input
                label="Max Tokens"
                type="number"
                value={settings.maxTokens.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 100 }))}
                min={50}
                max={500}
                description="Maximum tokens per response (50-500)"
              />
            </CardBody>
          </Card>

          {/* Processing Configuration */}
          <Card>
            <CardHeader className="card-header-shadow">
              <h3 className="text-lg font-semibold">Processing Configuration</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Max Concurrency"
                type="number"
                value={settings.maxConcurrency.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, maxConcurrency: parseInt(e.target.value) || 10 }))}
                min={1}
                max={50}
                description="Number of concurrent requests (1-50)"
              />

              <Input
                label="Retry Attempts"
                type="number"
                value={settings.retryAttempts.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) || 3 }))}
                min={1}
                max={10}
                description="Number of retry attempts for failed requests"
              />

              <Input
                label="Retry Delay (ms)"
                type="number"
                value={settings.retryDelay.toString()}
                onChange={(e) => setSettings(prev => ({ ...prev, retryDelay: parseInt(e.target.value) || 1000 }))}
                min={500}
                max={10000}
                description="Delay between retry attempts in milliseconds"
              />
            </CardBody>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader className="card-header-shadow">
              <h3 className="text-lg font-semibold">Features</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <Switch
                isSelected={settings.enableCostTracking}
                onValueChange={(value) => setSettings(prev => ({ ...prev, enableCostTracking: value }))}
              >
                <div>
                  <div className="font-medium">Cost Tracking</div>
                  <div className="text-xs text-default-500">Track token usage and estimated costs</div>
                </div>
              </Switch>

              <Switch
                isSelected={settings.enableDetailedLogs}
                onValueChange={(value) => setSettings(prev => ({ ...prev, enableDetailedLogs: value }))}
              >
                <div>
                  <div className="font-medium">Detailed Logs</div>
                  <div className="text-xs text-default-500">Enable detailed logging for debugging</div>
                </div>
              </Switch>
            </CardBody>
          </Card>

          {/* Cost Estimation */}
          <Card className="bg-primary-50 border-primary-200">
            <CardBody>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="font-medium text-primary">Cost Estimation</span>
              </div>
              <p className="text-sm text-primary-700">
                Estimated cost per 1,000 URLs: <span className="font-semibold">${(estimatedCost * 1000).toFixed(2)}</span>
              </p>
              <p className="text-xs text-primary-600 mt-1">
                Based on current settings. Actual costs may vary.
              </p>
            </CardBody>
          </Card>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onPress={handleReset}>
            Reset to Defaults
          </Button>
          <Button color="primary" onPress={handleSave}>
            Save Settings
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

