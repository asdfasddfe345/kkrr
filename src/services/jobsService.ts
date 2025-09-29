// src/services/jobsService.ts
import { supabase } from '../lib/supabaseClient';
import { JobListing, JobFilters, AutoApplyResult, ApplicationHistory, OptimizedResume } from '../types/jobs';
import { sampleJobs, fetchJobListings } from './sampleJobsData';
import { ResumeData } from '../types/resume';
import { exportToPDF } from '../utils/exportUtils';
import { supabase } from '../lib/supabaseClient';

class JobsService {
  // Create a new job listing (Admin only)
  async createJobListing(jobData: Partial<JobListing>): Promise<JobListing> {
    try {
      console.log('JobsService: Creating new job listing...');
      
      // Validate required fields
      if (!jobData.company_name || !jobData.role_title || !jobData.domain || 
          !jobData.location_type || !jobData.experience_required || 
          !jobData.qualification || !jobData.short_description || 
          !jobData.full_description || !jobData.application_link) {
        throw new Error('Missing required job listing fields');
      }

      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Prepare job data with default values
      const insertData = {
        company_name: jobData.company_name,
        company_logo_url: jobData.company_logo_url || null,
        role_title: jobData.role_title,
        package_amount: jobData.package_amount || null,
        package_type: jobData.package_type || null,
        domain: jobData.domain,
        location_type: jobData.location_type,
        location_city: jobData.location_city || null,
        experience_required: jobData.experience_required,
        qualification: jobData.qualification,
        short_description: jobData.short_description,
        full_description: jobData.full_description,
        application_link: jobData.application_link,
        posted_date: new Date().toISOString(),
        source_api: 'manual_admin',
        is_active: jobData.is_active !== undefined ? jobData.is_active : true,
      };

      console.log('JobsService: Inserting job data:', insertData);

      const { data: newJob, error } = await supabase
        .from('job_listings')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('JobsService: Error creating job listing:', error);
        throw new Error(`Failed to create job listing: ${error.message}`);
      }

      console.log('JobsService: Job listing created successfully with ID:', newJob.id);
      return newJob;
    } catch (error) {
      console.error('JobsService: Error in createJobListing:', error);
      throw error;
    }
  }

  // Get a single job listing by ID
  async getJobListingById(jobId: string): Promise<JobListing | null> {
    try {
      // First try to get from actual database
      const { data: job, error } = await supabase
        .from('job_listings')
        .select('*')
        .eq('id', jobId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching job listing:', error);
        // Fallback to sample data
        return sampleJobs.find(job => job.id === jobId) || null;
      }

      if (job) {
        return job;
      }

      // Fallback to sample data if not found in database
      return sampleJobs.find(job => job.id === jobId) || null;
    } catch (error) {
      console.error('Error in getJobListingById:', error);
      // Final fallback to sample data
      return sampleJobs.find(job => job.id === jobId) || null;
    }
  }

  // Store optimized resume data and generate file URLs
  async storeOptimizedResume(
    userId: string, 
    jobId: string, 
    resumeData: ResumeData
  ): Promise<string> {
    try {
      console.log('JobsService: Storing optimized resume for user:', userId, 'job:', jobId);

      // Calculate optimization score (placeholder logic)
      const optimizationScore = Math.floor(Math.random() * 20) + 80; // 80-100

      // For now, we'll store placeholder URLs for PDF and DOCX
      // In production, you would:
      // 1. Generate actual PDF using exportToPDF
      // 2. Upload to Supabase Storage
      // 3. Store the public URLs
      const placeholderPdfUrl = `https://example.com/resumes/optimized_${userId}_${jobId}.pdf`;
      const placeholderDocxUrl = `https://example.com/resumes/optimized_${userId}_${jobId}.docx`;

      const { data: optimizedResume, error } = await supabase
        .from('optimized_resumes')
        .insert({
          user_id: userId,
          job_listing_id: jobId,
          resume_content: resumeData,
          pdf_url: placeholderPdfUrl,
          docx_url: placeholderDocxUrl,
          optimization_score: optimizationScore
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error storing optimized resume:', error);
        throw new Error('Failed to store optimized resume');
      }

      console.log('JobsService: Optimized resume stored with ID:', optimizedResume.id);
      return optimizedResume.id;
    } catch (error) {
      console.error('Error in storeOptimizedResume:', error);
      throw error;
    }
  }

  // Get optimized resume by ID
  async getOptimizedResumeById(optimizedResumeId: string): Promise<OptimizedResume | null> {
    try {
      const { data: optimizedResume, error } = await supabase
        .from('optimized_resumes')
        .select('*')
        .eq('id', optimizedResumeId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching optimized resume:', error);
        return null;
      }

      return optimizedResume;
    } catch (error) {
      console.error('Error in getOptimizedResumeById:', error);
      return null;
    }
  }

  // Fetch job listings with filters
  async getJobListings(filters: JobFilters = {}, limit = 20, offset = 0): Promise<{
    jobs: JobListing[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // For demo purposes, use sample data
      // In production, this would call the Edge Function
      const result = await fetchJobListings(filters, limit, offset);
      return result;

      /* Production code (uncomment when Edge Function is ready):
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(filters.domain && { domain: filters.domain }),
        ...(filters.location_type && { location_type: filters.location_type }),
        ...(filters.experience_required && { experience_required: filters.experience_required }),
        ...(filters.package_min && { package_min: filters.package_min.toString() }),
        ...(filters.package_max && { package_max: filters.package_max.toString() }),
        ...(filters.search && { search: filters.search }),
        ...(filters.sort_by && { sort_by: filters.sort_by }),
        ...(filters.sort_order && { sort_order: filters.sort_order }),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-jobs?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        jobs: data.jobs || [],
        total: data.total || 0,
        hasMore: data.pagination?.hasMore || false
      };
      */
    } catch (error) {
      console.error('Error fetching job listings:', error);
      throw new Error('Failed to fetch job listings');
    }
  }

  // Optimize resume for a specific job
  async optimizeResumeForJob(jobId: string, userResumeText?: string): Promise<OptimizedResume> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-resume-for-job`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            userResumeText
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize resume');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Resume optimization failed');
      }

      return {
        id: data.resumeId,
        user_id: session.user.id,
        job_listing_id: jobId,
        resume_content: data.resumeContent,
        pdf_url: data.pdfUrl,
        docx_url: data.docxUrl,
        optimization_score: data.optimizationScore,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error optimizing resume for job:', error);
      throw error;
    }
  }

  // Manual apply - log the application
  async logManualApplication(jobId: string, optimizedResumeId: string, redirectUrl: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const { error } = await supabase
        .from('manual_apply_logs')
        .insert({
          user_id: session.user.id,
          job_listing_id: jobId,
          optimized_resume_id: optimizedResumeId,
          application_date: new Date().toISOString(),
          status: 'submitted',
          redirect_url: redirectUrl
        });

      if (error) {
        console.error('Error logging manual application:', error);
        throw new Error('Failed to log manual application');
      }
    } catch (error) {
      console.error('Error in logManualApplication:', error);
      throw error;
    }
  }

  // Auto apply for a job
  async autoApplyForJob(jobId: string, optimizedResumeId: string): Promise<AutoApplyResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            optimizedResumeId
          }),
        }
      );

      const data = await response.json();
      
      return {
        success: data.success,
        message: data.message,
        applicationId: data.applicationId,
        status: data.status,
        screenshotUrl: data.screenshotUrl,
        resumeUrl: data.resumeUrl,
        fallbackUrl: data.fallbackUrl,
        error: data.error
      };
    } catch (error) {
      console.error('Error in auto apply:', error);
      throw new Error('Auto-apply failed');
    }
  }

  // Get user's application history
  async getApplicationHistory(filters: { status?: string; method?: string } = {}): Promise<ApplicationHistory> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.method && { method: filters.method }),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-application-history?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch application history: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching application history:', error);
      throw new Error('Failed to fetch application history');
    }
  }

  // Get available filter options
  async getFilterOptions(): Promise<{
    domains: string[];
    locationTypes: string[];
    experienceLevels: string[];
    packageRanges: { min: number; max: number };
  }> {
    try {
      // Get distinct values for filters from job_listings
      const { data: domains } = await supabase
        .from('job_listings')
        .select('domain')
        .eq('is_active', true);

      const { data: locations } = await supabase
        .from('job_listings')
        .select('location_type')
        .eq('is_active', true);

      const { data: experiences } = await supabase
        .from('job_listings')
        .select('experience_required')
        .eq('is_active', true);

      const { data: packages } = await supabase
        .from('job_listings')
        .select('package_amount')
        .eq('is_active', true)
        .not('package_amount', 'is', null);

      const uniqueDomains = [...new Set(domains?.map(d => d.domain) || [])];
      const uniqueLocations = [...new Set(locations?.map(l => l.location_type) || [])];
      const uniqueExperiences = [...new Set(experiences?.map(e => e.experience_required) || [])];
      
      const packageAmounts = packages?.map(p => p.package_amount).filter(Boolean) || [];
      const packageRanges = {
        min: Math.min(...packageAmounts, 0),
        max: Math.max(...packageAmounts, 1000000)
      };

      return {
        domains: uniqueDomains,
        locationTypes: uniqueLocations,
        experienceLevels: uniqueExperiences,
        packageRanges
      };
    } catch (error) {
      console.error('Error getting filter options:', error);
      // Return sample filter options for demo
      return {
        domains: ['SDE', 'Data Science', 'Product', 'Marketing', 'Analytics'],
        locationTypes: ['Remote', 'Onsite', 'Hybrid'],
        experienceLevels: ['0-1 years', '0-2 years', '1-2 years', '1-3 years', '2-4 years', '3-5 years'],
        packageRanges: { min: 0, max: 1000000 }
      };
    }
  }
}

export const jobsService = new JobsService();