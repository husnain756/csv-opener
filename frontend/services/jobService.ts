import { apiClient, ApiError } from './apiClient'
import { Job, JobDetails, UrlRecord, JobResults } from '@/types'

export class JobService {
  // Get all jobs
  async getAllJobs(): Promise<Job[]> {
    try {
      return await apiClient.get<Job[]>('/api/jobs')
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // Return empty array for rate limits to avoid breaking the UI
        return []
      }
      throw error
    }
  }

  // Get job details
  async getJobDetails(jobId: string): Promise<JobDetails> {
    try {
      return await apiClient.get<JobDetails>(`/api/jobs/${jobId}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // Throw a specific rate limit error that the UI can catch
        throw new Error('Rate limited - please try again later')
      }
      throw error
    }
  }

  // Get job results (URLs)
  async getJobResults(jobId: string): Promise<JobResults> {
    try {
      return await apiClient.get<JobResults>(`/api/jobs/${jobId}/results`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // Throw a specific rate limit error that the UI can catch
        throw new Error('Rate limited - please try again later')
      }
      throw error
    }
  }

  // Upload CSV file and start processing
  async uploadAndProcessCSV(
    file: File,
    contentType: string
  ): Promise<{ jobId: string; message: string }> {
    return await apiClient.uploadFile<{ jobId: string; message: string }>(
      '/api/upload',
      file,
      { contentType }
    )
  }

  // Download job results
  async downloadResults(jobId: string): Promise<Blob> {
    const response = await fetch(`${apiClient['baseURL']}/api/jobs/${jobId}/download`)
    
    if (!response.ok) {
      throw new ApiError(
        `Failed to download results: ${response.statusText}`,
        response.status
      )
    }
    
    return response.blob()
  }

  // Retry failed URLs
  async retryFailedUrls(
    jobId: string,
    urlIds?: string[]
  ): Promise<{ message: string; retried: number; jobId: string }> {
    return await apiClient.post<{ message: string; retried: number; jobId: string }>(
      `/api/jobs/${jobId}/retry`,
      { urlIds }
    )
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<{ message: string }> {
    return await apiClient.post<{ message: string }>(`/api/jobs/${jobId}/cancel`)
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<{
    status: string
    progress: {
      total: number
      processed: number
      failed: number
      pending: number
    }
  }> {
    try {
      return await apiClient.get<{
        status: string
        progress: {
          total: number
          processed: number
          failed: number
          pending: number
        }
      }>(`/api/jobs/${jobId}/status`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        // Return default status for rate limits
        return {
          status: 'unknown',
          progress: { total: 0, processed: 0, failed: 0, pending: 0 }
        }
      }
      throw error
    }
  }
}

export const jobService = new JobService()
