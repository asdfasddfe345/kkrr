// src/components/UserProfileManagement.tsx
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  GraduationCap,
  Briefcase,
  Target,
  Award,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  Users,
  Wallet,
  Copy,
  Gift,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  CreditCard,
  UserCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';
import { FileUpload } from './FileUpload';
import { optimizeResume } from '../services/geminiService';
import { ExtractionResult, ResumeData } from '../types/resume';

// Form validation schemas
const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  school: z.string().min(1, 'School/University is required'),
  year: z.string().min(1, 'Year is required'),
  cgpa: z.string().optional(),
  location: z.string().optional(),
});

const workExperienceSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  company: z.string().min(1, 'Company is required'),
  year: z.string().min(1, 'Duration is required'),
  bullets: z.array(z.string()).min(1, 'At least one responsibility is required'),
});

const skillCategorySchema = z.object({
  category: z.string().min(1, 'Category is required'),
  list: z.array(z.string()).min(1, 'At least one skill is required'),
});

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  bullets: z.array(z.string()).min(1, 'At least one detail is required'),
  githubUrl: z.string().optional(),
});

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email_address: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  linkedin_profile_url: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  github_profile_url: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  current_location: z.string().optional(),
  resume_headline: z.string().optional(),
  education_details: z.array(educationSchema).optional(),
  experience_details: z.array(workExperienceSchema).optional(),
  skills_details: z.array(skillCategorySchema).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileManagementProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'profile' | 'wallet';
  walletRefreshKey?: number;
  setWalletRefreshKey?: React.Dispatch<React.SetStateAction<number>>;
}

export const UserProfileManagement: React.FC<UserProfileManagementProps> = ({
  isOpen,
  onClose,
  viewMode = 'profile',
  walletRefreshKey = 0,
  setWalletRefreshKey,
}) => {
  const { user, revalidateUserSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>(viewMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Resume upload states
  const [isProcessingResume, setIsProcessingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState(false);

  // Wallet states
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [loadingReferralCode, setLoadingReferralCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showRedemptionForm, setShowRedemptionForm] = useState(false);
  const [redemptionAmount, setRedemptionAmount] = useState<string>('');
  const [redemptionMethod, setRedemptionMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redemptionDetails, setRedemptionDetails] = useState<{
    upiId?: string;
    accountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  }>({});
  const [submittingRedemption, setSubmittingRedemption] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
    watch,
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
  });

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control,
    name: 'education_details',
  });

  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control,
    name: 'experience_details',
  });

  const { fields: skillsFields, append: appendSkills, remove: removeSkills } = useFieldArray({
    control,
    name: 'skills_details',
  });

  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
      if (activeTab === 'wallet') {
        loadWalletData();
      }
    }
  }, [isOpen, user, activeTab, walletRefreshKey]);

  useEffect(() => {
    setActiveTab(viewMode);
  }, [viewMode]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const profile = await authService.fetchUserProfile(user.id);
      
      if (profile) {
        reset({
          full_name: profile.full_name || '',
          email_address: profile.email_address || '',
          phone: profile.phone || '',
          linkedin_profile_url: profile.linkedin_profile || '',
          github_profile_url: profile.wellfound_profile || '',
          current_location: profile.current_location || '',
          resume_headline: profile.resume_headline || '',
          education_details: profile.education_details || [],
          experience_details: profile.experience_details || [],
          skills_details: profile.skills_details || [],
        });
      }
    } catch (err) {
      setError('Failed to load profile data');
      console.error('Error loading profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWalletData = async () => {
    if (!user) return;
    
    setLoadingWallet(true);
    try {
      // Fetch wallet transactions
      const { data: transactions, error: transError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transError) throw transError;

      setWalletTransactions(transactions || []);

      // Calculate wallet balance
      const balance = (transactions || [])
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      setWalletBalance(Math.max(0, balance));

      // Load referral code
      if (user.referralCode) {
        setReferralCode(user.referralCode);
      } else {
        await generateReferralCode();
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  const generateReferralCode = async () => {
    if (!user) return;
    
    setLoadingReferralCode(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-referral-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();
      
      if (result.success) {
        setReferralCode(result.referralCode);
        await revalidateUserSession();
      }
    } catch (err) {
      console.error('Error generating referral code:', err);
    } finally {
      setLoadingReferralCode(false);
    }
  };

  // Resume upload handler
  const handleResumeUpload = async (extractionResult: ExtractionResult) => {
    if (!user || !extractionResult.text.trim()) {
      setResumeUploadError('No resume content extracted');
      return;
    }

    setIsProcessingResume(true);
    setResumeUploadError(null);
    setResumeUploadSuccess(false);

    try {
      console.log('UserProfileManagement: Processing uploaded resume...');
      
      // Use optimizeResume to parse the resume into structured data
      const resumeData: ResumeData = await optimizeResume(
        extractionResult.text,
        '', // Empty job description for profile parsing
        'experienced', // Default user type
        user.name,
        user.email,
        user.phone || '',
        user.linkedin || '',
        user.github || '',
        undefined,
        undefined,
        '' // Empty target role for profile parsing
      );

      console.log('UserProfileManagement: Resume data extracted:', resumeData);

      // Map ResumeData to ProfileFormData and pre-fill form
      const profileData: ProfileFormData = {
        full_name: resumeData.name || user.name,
        email_address: resumeData.email || user.email,
        phone: resumeData.phone || user.phone || '',
        linkedin_profile_url: resumeData.linkedin || user.linkedin || '',
        github_profile_url: resumeData.github || user.github || '',
        current_location: resumeData.location || '',
        resume_headline: resumeData.summary || resumeData.careerObjective || '',
        education_details: resumeData.education || [],
        experience_details: resumeData.workExperience || [],
        skills_details: resumeData.skills || [],
      };

      // Reset form with extracted data
      reset(profileData);
      
      setResumeUploadSuccess(true);
      setShowResumeUpload(false);
      
      setTimeout(() => {
        setResumeUploadSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error processing resume:', err);
      setResumeUploadError(err instanceof Error ? err.message : 'Failed to process resume');
    } finally {
      setIsProcessingResume(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    try {
      await authService.updateUserProfile(user.id, {
        full_name: data.full_name,
        email_address: data.email_address,
        phone: data.phone,
        linkedin_profile_url: data.linkedin_profile_url,
        github_profile_url: data.github_profile_url,
        current_location: data.current_location,
        resume_headline: data.resume_headline,
        education_details: data.education_details,
        experience_details: data.experience_details,
        skills_details: data.skills_details,
        has_seen_profile_prompt: true,
      });

      await revalidateUserSession();
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral code:', err);
    }
  };

  const handleRedemption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amount = parseFloat(redemptionAmount);
    if (amount < 100) {
      setError('Minimum redemption amount is ₹100');
      return;
    }

    if (amount > walletBalance) {
      setError('Insufficient wallet balance');
      return;
    }

    setSubmittingRedemption(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-redemption-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amount,
          redeemMethod: redemptionMethod,
          redeemDetails: redemptionDetails,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setShowSuccess(true);
        setShowRedemptionForm(false);
        setRedemptionAmount('');
        setRedemptionDetails({});
        await loadWalletData();
        
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        setError(result.error || 'Redemption request failed');
      }
    } catch (err) {
      setError('Failed to submit redemption request');
      console.error('Redemption error:', err);
    } finally {
      setSubmittingRedemption(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm safe-area dark:bg-black/80" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto dark:bg-dark-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-secondary-200 dark:border-dark-300">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg">
              {activeTab === 'profile' ? <User className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary-900 dark:text-gray-100">
                {activeTab === 'profile' ? 'Profile Management' : 'Referral & Wallet'}
              </h2>
              <p className="text-sm text-secondary-600 dark:text-gray-400">
                {activeTab === 'profile' ? 'Manage your personal information and resume details' : 'Track your referrals and manage wallet balance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-touch min-h-touch w-8 h-8 flex items-center justify-center text-secondary-400 hover:text-secondary-600 transition-colors rounded-full hover:bg-secondary-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-dark-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-secondary-200 dark:border-dark-300">
          <nav className="flex px-4 sm:px-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'profile'
                  ? 'border-neon-cyan-500 text-neon-cyan-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              Profile Settings
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'wallet'
                  ? 'border-neon-cyan-500 text-neon-cyan-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Wallet className="w-4 h-4 inline mr-2" />
              Referral & Wallet
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Success Message */}
              {showSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl animate-fadeIn dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3" />
                    <span className="font-medium text-green-800 dark:text-neon-cyan-300">Profile updated successfully!</span>
                  </div>
                </div>
              )}

              {/* Resume Upload Success */}
              {resumeUploadSuccess && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fadeIn dark:bg-neon-blue-500/10 dark:border-neon-blue-400/50">
                  <div className="flex items-center">
                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-neon-blue-400 mr-3" />
                    <span className="font-medium text-blue-800 dark:text-neon-blue-300">Resume data extracted and form pre-filled successfully!</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" />
                    <span className="font-medium text-red-800 dark:text-red-300">{error}</span>
                  </div>
                </div>
              )}

              {/* Resume Upload Section */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg dark:bg-neon-cyan-500/20">
                      <Upload className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Profile Setup</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Upload your resume to automatically fill your profile</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowResumeUpload(!showResumeUpload)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors dark:text-neon-cyan-400 dark:hover:text-neon-cyan-300"
                  >
                    <span className="text-sm font-medium">{showResumeUpload ? 'Hide' : 'Show'}</span>
                    {showResumeUpload ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {showResumeUpload && (
                  <div className="space-y-4">
                    {/* Resume Upload Error */}
                    {resumeUploadError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-500/50">
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                          <span className="text-sm text-red-700 dark:text-red-300">{resumeUploadError}</span>
                        </div>
                      </div>
                    )}

                    {/* Resume Processing Loader */}
                    {isProcessingResume && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                        <div className="flex items-center">
                          <Loader2 className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400 mr-3 animate-spin" />
                          <span className="text-sm text-blue-700 dark:text-neon-cyan-300">Processing your resume and extracting profile data...</span>
                        </div>
                      </div>
                    )}

                    {/* File Upload Component */}
                    {!isProcessingResume && (
                      <FileUpload onFileUpload={handleResumeUpload} />
                    )}

                    <div className="bg-blue-100 border border-blue-200 rounded-lg p-3 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                      <div className="flex items-start space-x-2">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-neon-cyan-400 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-neon-cyan-300">
                          <p className="font-medium mb-1">How it works:</p>
                          <ul className="text-blue-700 dark:text-gray-300 space-y-1">
                            <li>• Upload your current resume (PDF, DOCX, or TXT)</li>
                            <li>• Our AI extracts your information automatically</li>
                            <li>• Review and edit the pre-filled data below</li>
                            <li>• Save your complete profile</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Form */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
                  <span className="text-lg text-gray-600 dark:text-gray-300">Loading profile data...</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <User className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                      Basic Information
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Full Name *
                        </label>
                        <input
                          {...register('full_name')}
                          type="text"
                          className="input-base"
                          placeholder="Enter your full name"
                        />
                        {errors.full_name && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email Address *
                        </label>
                        <input
                          {...register('email_address')}
                          type="email"
                          className="input-base"
                          placeholder="your.email@example.com"
                        />
                        {errors.email_address && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email_address.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone Number
                        </label>
                        <input
                          {...register('phone')}
                          type="tel"
                          className="input-base"
                          placeholder="+91 9876543210"
                        />
                        {errors.phone && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.phone.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Current Location
                        </label>
                        <input
                          {...register('current_location')}
                          type="text"
                          className="input-base"
                          placeholder="City, State, Country"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          LinkedIn Profile
                        </label>
                        <input
                          {...register('linkedin_profile_url')}
                          type="url"
                          className="input-base"
                          placeholder="https://linkedin.com/in/yourprofile"
                        />
                        {errors.linkedin_profile_url && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.linkedin_profile_url.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          GitHub Profile
                        </label>
                        <input
                          {...register('github_profile_url')}
                          type="url"
                          className="input-base"
                          placeholder="https://github.com/yourusername"
                        />
                        {errors.github_profile_url && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.github_profile_url.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Professional Headline / Summary
                      </label>
                      <textarea
                        {...register('resume_headline')}
                        className="input-base h-24 resize-none"
                        placeholder="Brief professional summary or career objective..."
                      />
                    </div>
                  </div>

                  {/* Education */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <GraduationCap className="w-5 h-5 mr-2 text-green-600 dark:text-neon-green-400" />
                        Education
                      </h3>
                      <button
                        type="button"
                        onClick={() => appendEducation({ degree: '', school: '', year: '', cgpa: '', location: '' })}
                        className="btn-secondary text-sm flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Education</span>
                      </button>
                    </div>

                    {educationFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Education #{index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeEducation(index)}
                            className="text-red-600 hover:text-red-700 p-1 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Degree *</label>
                            <input
                              {...register(`education_details.${index}.degree`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., Bachelor of Technology"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School/University *</label>
                            <input
                              {...register(`education_details.${index}.school`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., University Name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year *</label>
                            <input
                              {...register(`education_details.${index}.year`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., 2020-2024"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CGPA/GPA</label>
                            <input
                              {...register(`education_details.${index}.cgpa`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., 8.5/10"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                          <input
                            {...register(`education_details.${index}.location`)}
                            type="text"
                            className="input-base"
                            placeholder="e.g., City, State"
                          />
                        </div>
                      </div>
                    ))}

                    {educationFields.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No education entries yet. Click "Add Education" to get started.</p>
                      </div>
                    )}
                  </div>

                  {/* Work Experience */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Briefcase className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                        Work Experience
                      </h3>
                      <button
                        type="button"
                        onClick={() => appendExperience({ role: '', company: '', year: '', bullets: [''] })}
                        className="btn-secondary text-sm flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Experience</span>
                      </button>
                    </div>

                    {experienceFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Experience #{index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeExperience(index)}
                            className="text-red-600 hover:text-red-700 p-1 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
                            <input
                              {...register(`experience_details.${index}.role`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., Software Engineer"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company *</label>
                            <input
                              {...register(`experience_details.${index}.company`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., TechCorp Inc."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration *</label>
                            <input
                              {...register(`experience_details.${index}.year`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., Jan 2022 - Present"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Responsibilities</label>
                          <textarea
                            {...register(`experience_details.${index}.bullets.0`)}
                            className="input-base h-20 resize-none"
                            placeholder="Describe your key responsibilities and achievements..."
                          />
                        </div>
                      </div>
                    ))}

                    {experienceFields.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No work experience entries yet. Click "Add Experience" to get started.</p>
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
                        Skills
                      </h3>
                      <button
                        type="button"
                        onClick={() => appendSkills({ category: '', list: [] })}
                        className="btn-secondary text-sm flex items-center space-x-1"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Skill Category</span>
                      </button>
                    </div>

                    {skillsFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Skill Category #{index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeSkills(index)}
                            className="text-red-600 hover:text-red-700 p-1 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                            <input
                              {...register(`skills_details.${index}.category`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., Programming Languages"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills (comma-separated) *</label>
                            <input
                              {...register(`skills_details.${index}.list`)}
                              type="text"
                              className="input-base"
                              placeholder="e.g., JavaScript, React, Node.js"
                              onChange={(e) => {
                                const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                setValue(`skills_details.${index}.list`, skills);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {skillsFields.length === 0 && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No skill categories yet. Click "Add Skill Category" to get started.</p>
                      </div>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-dark-300">
                    <button
                      type="button"
                      onClick={onClose}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors dark:bg-dark-300 dark:hover:bg-dark-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || !isDirty}
                      className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                        isSaving || !isDirty
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white shadow-lg hover:shadow-neon-cyan'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          <span>Save Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Wallet Tab Content */
            <div className="space-y-6">
              {loadingWallet ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600 mr-3" />
                  <span className="text-lg text-gray-600 dark:text-gray-300">Loading wallet data...</span>
                </div>
              ) : (
                <>
                  {/* Wallet Balance */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-3 rounded-full dark:bg-neon-cyan-500/20">
                          <Wallet className="w-6 h-6 text-green-600 dark:text-neon-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{walletBalance.toFixed(2)}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">Available Balance</p>
                        </div>
                      </div>
                      <button
                        onClick={() => loadWalletData()}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </div>

                    {walletBalance >= 100 && (
                      <button
                        onClick={() => setShowRedemptionForm(true)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                      >
                        Redeem Balance
                      </button>
                    )}
                  </div>

                  {/* Referral Code */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                      Referral Program
                    </h3>
                    
                    <div className="bg-blue-50 rounded-lg p-4 mb-4 dark:bg-neon-cyan-500/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-900 dark:text-neon-cyan-300">Your Referral Code</p>
                          <p className="text-sm text-blue-700 dark:text-gray-300">Share this code to earn ₹10 for each signup</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-white px-4 py-2 rounded-lg font-mono text-lg font-bold text-gray-900 dark:bg-dark-200 dark:text-gray-100">
                            {referralCode || 'Loading...'}
                          </span>
                          <button
                            onClick={handleCopyReferralCode}
                            className={`p-2 rounded-lg transition-colors ${
                              copySuccess
                                ? 'bg-green-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {copySuccess ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg dark:from-dark-200 dark:to-dark-300">
                        <div className="text-center">
                          <Gift className="w-8 h-8 text-blue-600 mx-auto mb-2 dark:text-neon-cyan-400" />
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">₹10</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">Per Referral</div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg dark:from-dark-200 dark:to-dark-300">
                        <div className="text-center">
                          <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2 dark:text-neon-green-400" />
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">₹{walletBalance.toFixed(2)}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">Total Earned</div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg dark:from-dark-200 dark:to-dark-300">
                        <div className="text-center">
                          <Users className="w-8 h-8 text-purple-600 mx-auto mb-2 dark:text-neon-purple-400" />
                          <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {Math.floor(walletBalance / 10)}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">Referrals</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transaction History</h3>
                      <button
                        onClick={() => setShowTransactions(!showTransactions)}
                        className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 dark:text-neon-cyan-400"
                      >
                        <span className="text-sm">{showTransactions ? 'Hide' : 'Show'}</span>
                        {showTransactions ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {showTransactions && (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {walletTransactions.length > 0 ? (
                          walletTransactions.map((transaction, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-dark-200">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-full ${
                                  transaction.type === 'referral' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                  {transaction.type === 'referral' ? <Users className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                                    {transaction.type.replace('_', ' ')}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {new Date(transaction.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${
                                  parseFloat(transaction.amount) > 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {parseFloat(transaction.amount) > 0 ? '+' : ''}₹{Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                                </p>
                                <p className={`text-xs capitalize ${
                                  transaction.status === 'completed' ? 'text-green-600' : 
                                  transaction.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {transaction.status}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No transactions yet. Start referring friends to earn money!</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Redemption Modal */}
        {showRedemptionForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Redeem Balance</h3>
                  <button
                    onClick={() => setShowRedemptionForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleRedemption} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
                    <input
                      type="number"
                      value={redemptionAmount}
                      onChange={(e) => setRedemptionAmount(e.target.value)}
                      min="100"
                      max={walletBalance}
                      step="1"
                      className="input-base"
                      placeholder="Minimum ₹100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Redemption Method</label>
                    <select
                      value={redemptionMethod}
                      onChange={(e) => setRedemptionMethod(e.target.value as 'upi' | 'bank_transfer')}
                      className="input-base"
                    >
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>

                  {redemptionMethod === 'upi' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                      <input
                        type="text"
                        value={redemptionDetails.upiId || ''}
                        onChange={(e) => setRedemptionDetails({...redemptionDetails, upiId: e.target.value})}
                        className="input-base"
                        placeholder="your-upi@paytm"
                        required
                      />
                    </div>
                  )}

                  {redemptionMethod === 'bank_transfer' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
                        <input
                          type="text"
                          value={redemptionDetails.accountHolderName || ''}
                          onChange={(e) => setRedemptionDetails({...redemptionDetails, accountHolderName: e.target.value})}
                          className="input-base"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                        <input
                          type="text"
                          value={redemptionDetails.accountNumber || ''}
                          onChange={(e) => setRedemptionDetails({...redemptionDetails, accountNumber: e.target.value})}
                          className="input-base"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
                        <input
                          type="text"
                          value={redemptionDetails.ifscCode || ''}
                          onChange={(e) => setRedemptionDetails({...redemptionDetails, ifscCode: e.target.value})}
                          className="input-base"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowRedemptionForm(false)}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingRedemption}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
                    >
                      {submittingRedemption ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        )}
      </div>
    </div>
  );
};