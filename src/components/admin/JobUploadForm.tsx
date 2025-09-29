// src/components/admin/JobUploadForm.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Briefcase,
  MapPin,
  Clock,
  GraduationCap,
  IndianRupee,
  ExternalLink,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Plus,
  Globe,
  Target,
  FileText,
  Image
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jobsService } from '../../services/jobsService';
import { JobListing } from '../../types/jobs';

// Zod schema for job listing validation
const jobListingSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_title: z.string().min(1, 'Role title is required'),
  package_amount: z.number().positive('Package amount must be positive').optional(),
  package_type: z.enum(['CTC', 'stipend', 'hourly']).optional(),
  domain: z.string().min(1, 'Domain is required'),
  location_type: z.enum(['Remote', 'Onsite', 'Hybrid']),
  location_city: z.string().optional(),
  experience_required: z.string().min(1, 'Experience requirement is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  short_description: z.string().min(50, 'Short description must be at least 50 characters'),
  full_description: z.string().min(100, 'Full description must be at least 100 characters'),
  application_link: z.string().url('Must be a valid URL'),
  is_active: z.boolean().default(true),
});

type JobFormData = z.infer<typeof jobListingSchema>;

export const JobUploadForm: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobListingSchema),
    defaultValues: {
      is_active: true,
      package_type: 'CTC',
      location_type: 'Remote',
    },
  });

  const watchedPackageType = watch('package_type');
  const watchedLocationType = watch('location_type');

  const onSubmit = async (data: JobFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const jobData: Partial<JobListing> = {
        company_name: data.company_name,
        company_logo_url: data.company_logo_url || undefined,
        role_title: data.role_title,
        package_amount: data.package_amount || undefined,
        package_type: data.package_type || undefined,
        domain: data.domain,
        location_type: data.location_type,
        location_city: data.location_city || undefined,
        experience_required: data.experience_required,
        qualification: data.qualification,
        short_description: data.short_description,
        full_description: data.full_description,
        application_link: data.application_link,
        is_active: data.is_active,
      };

      await jobsService.createJobListing(jobData);
      setSubmitSuccess(true);
      reset(); // Clear form on success
      setTimeout(() => {
        setSubmitSuccess(false);
        navigate('/jobs'); // Redirect to jobs page after success
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create job listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const domainOptions = [
    'SDE', 'Data Science', 'Product', 'Design', 'Marketing', 'Sales', 
    'Analytics', 'AI', 'DevOps', 'Mobile', 'Frontend', 'Backend', 
    'Full-Stack', 'QA', 'Content', 'HR', 'Finance', 'Operations'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin - Upload Job Listing</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Plus className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Create New Job Listing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Add a new job opportunity to help candidates find their dream role
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                Job Details
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Fill in all the required information for the job listing</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">{submitError}</p>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                    <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">
                      Job listing created successfully! Redirecting to jobs page...
                    </p>
                  </div>
                </div>
              )}

              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Company Name *
                  </label>
                  <input
                    type="text"
                    {...register('company_name')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Google, Microsoft, Startup Inc."
                  />
                  {errors.company_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Image className="w-4 h-4 inline mr-1" />
                    Company Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    {...register('company_logo_url')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="https://example.com/logo.png"
                  />
                  {errors.company_logo_url && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_logo_url.message}</p>
                  )}
                </div>
              </div>

              {/* Job Role Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Role Title *
                  </label>
                  <input
                    type="text"
                    {...register('role_title')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Senior Software Engineer, Product Manager"
                  />
                  {errors.role_title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.role_title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    Domain *
                  </label>
                  <select
                    {...register('domain')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="">Select Domain</option>
                    {domainOptions.map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.domain.message}</p>
                  )}
                </div>
              </div>

              {/* Package Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Package Amount (Optional)
                  </label>
                  <input
                    type="number"
                    {...register('package_amount', { valueAsNumber: true })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 1200000"
                    min="0"
                  />
                  {errors.package_amount && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_amount.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Package Type
                  </label>
                  <select
                    {...register('package_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="">Select Type</option>
                    <option value="CTC">CTC (Annual)</option>
                    <option value="stipend">Stipend (Monthly)</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                  {errors.package_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_type.message}</p>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location Type *
                  </label>
                  <select
                    {...register('location_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                  {errors.location_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_type.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    City (Optional)
                  </label>
                  <input
                    type="text"
                    {...register('location_city')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Bangalore, Mumbai, Delhi"
                    disabled={watchedLocationType === 'Remote'}
                  />
                  {errors.location_city && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_city.message}</p>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Experience Required *
                  </label>
                  <input
                    type="text"
                    {...register('experience_required')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 0-2 years, 3-5 years, 5+ years"
                  />
                  {errors.experience_required && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.experience_required.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <GraduationCap className="w-4 h-4 inline mr-1" />
                    Qualification *
                  </label>
                  <input
                    type="text"
                    {...register('qualification')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., B.Tech/B.E in Computer Science, MBA"
                  />
                  {errors.qualification && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.qualification.message}</p>
                  )}
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Short Description *
                </label>
                <textarea
                  {...register('short_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Brief overview of the role and company (50+ characters)"
                />
                {errors.short_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.short_description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Full Job Description *
                </label>
                <textarea
                  {...register('full_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Complete job description including responsibilities, requirements, skills, and benefits (100+ characters)"
                />
                {errors.full_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_description.message}</p>
                )}
              </div>

              {/* Application Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <ExternalLink className="w-4 h-4 inline mr-1" />
                  Application Link *
                </label>
                <input
                  type="url"
                  {...register('application_link')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="https://company.com/careers/apply"
                />
                {errors.application_link && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.application_link.message}</p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  id="is_active"
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job is active and accepting applications
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-dark-300">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                    isSubmitting || !isDirty
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Job...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Create Job Listing</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};