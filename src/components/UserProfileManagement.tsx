import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  MapPin,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Sparkles,
  Save,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wallet,
  DollarSign,
  RefreshCw,
  Send,
  CheckCircle,
  Info,
  Copy,
  ExternalLink,
  Share2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { parseFile } from '../utils/fileParser';
import { optimizeResume } from '../services/geminiService';
import { FileUpload } from './FileUpload';
import { paymentService } from '../services/paymentService';
import { supabase } from '../lib/supabaseClient';
import { User as AuthUser } from '../types/auth';
import { Education, WorkExperience, Skill, Project, Certification, ResumeData, ExtractionResult } from '../types/resume';

// Zod Schemas for nested objects
const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  school: z.string().min(1, 'School is required'),
  year: z.string().min(1, 'Year is required'),
  cgpa: z.string().optional(),
  location: z.string().optional(),
});

const workExperienceSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  company: z.string().min(1, 'Company is required'),
  year: z.string().min(1, 'Year is required'),
  bullets: z.array(z.string().min(1, 'Bullet cannot be empty')).min(1, 'At least one bullet point is required'),
});

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  bullets: z.array(z.string().min(1, 'Bullet cannot be empty')).min(1, 'At least one bullet point is required'),
  githubUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  demoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

const skillSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  list: z.array(z.string().min(1, 'Skill cannot be empty')).min(1, 'At least one skill is required'),
});

const certificationSchema = z.object({
  title: z.string().min(1, 'Certification title is required'),
  description: z.string().optional(),
  issuer: z.string().optional(),
  year: z.string().optional(),
});

// Main Profile Schema
const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  emailAddress: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  linkedinProfileUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  githubProfileUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  resumeHeadline: z.string().optional(),
  currentLocation: z.string().optional(),
  educationDetails: z.array(educationSchema).optional(),
  experienceDetails: z.array(workExperienceSchema).optional(),
  skillsDetails: z.array(skillSchema).optional(),
  projectsDetails: z.array(projectSchema).optional(),
  certificationsDetails: z.array(certificationSchema).optional(),
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
  walletRefreshKey,
  setWalletRefreshKey
}) => {
  const { user, revalidateUserSession, markProfilePromptSeen } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>(viewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0); // In Rupees
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer' | ''>('');
  const [redeemDetails, setRedeemDetails] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['personal', 'social']));
  
  // Resume upload states
  const [isProcessingResume, setIsProcessingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.name || '',
      emailAddress: user?.email || '',
      phone: user?.phone || '',
      linkedinProfileUrl: user?.linkedin || '',
      githubProfileUrl: user?.github || '',
      resumeHeadline: user?.resumeHeadline || '',
      currentLocation: user?.currentLocation || '',
      educationDetails: user?.educationDetails || [],
      experienceDetails: user?.experienceDetails || [],
      skillsDetails: user?.skillsDetails || [],
      projectsDetails: user?.projectsDetails || [],
      certificationsDetails: user?.certificationsDetails || [],
    },
  });

  // Field arrays for dynamic lists
  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control,
    name: 'educationDetails',
  });
  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control,
    name: 'experienceDetails',
  });
  const { fields: skillsFields, append: appendSkill, remove: removeSkill } = useFieldArray({
    control,
    name: 'skillsDetails',
  });
  const { fields: projectsFields, append: appendProject, remove: removeProject } = useFieldArray({
    control,
    name: 'projectsDetails',
  });
  const { fields: certificationsFields, append: appendCertification, remove: removeCertification } = useFieldArray({
    control,
    name: 'certificationsDetails',
  });

  // Watch for changes in dynamic fields to update nested field arrays
  const watchedEducation = watch('educationDetails');
  const watchedExperience = watch('experienceDetails');
  const watchedSkills = watch('skillsDetails');
  const watchedProjects = watch('projectsDetails');
  const watchedCertifications = watch('certificationsDetails');

  useEffect(() => {
    if (isOpen && user) {
      reset({
        fullName: user.name || '',
        emailAddress: user.email || '',
        phone: user.phone || '',
        linkedinProfileUrl: user.linkedin || '',
        githubProfileUrl: user.github || '',
        resumeHeadline: user.resumeHeadline || '',
        currentLocation: user.currentLocation || '',
        educationDetails: user.educationDetails || [],
        experienceDetails: user.experienceDetails || [],
        skillsDetails: user.skillsDetails || [],
        projectsDetails: user.projectsDetails || [],
        certificationsDetails: user.certificationsDetails || [],
      });
      setActiveTab(viewMode);
      fetchWalletBalance();
      setReferralCode(user.referralCode || null);
    }
  }, [isOpen, user, reset, viewMode, walletRefreshKey]);

  const fetchWalletBalance = async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, status')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error fetching wallet balance:', error);
        return;
      }
      const completed = (transactions || []).filter((t: any) => t.status === 'completed');
      const balance = completed.reduce((sum: number, tr: any) => sum + parseFloat(tr.amount), 0);
      setWalletBalance(Math.max(0, balance));
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await authService.updateUserProfile(user.id, {
        full_name: data.fullName,
        email_address: data.emailAddress,
        phone: data.phone,
        linkedin_profile: data.linkedinProfileUrl,
        github_profile: data.githubProfileUrl,
        resume_headline: data.resumeHeadline,
        current_location: data.currentLocation,
        education_details: data.educationDetails,
        experience_details: data.experienceDetails,
        skills_details: data.skillsDetails,
        projects_details: data.projectsDetails,
        certifications_details: data.certificationsDetails,
        has_seen_profile_prompt: true, // Mark prompt as seen after saving profile
      });
      await revalidateUserSession(); // Refresh user data in context
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      markProfilePromptSeen(); // Ensure the prompt is marked as seen
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedeem = async () => {
    if (!user) return;
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      setRedeemError('Please enter a valid amount.');
      setIsRedeeming(false);
      return;
    }
    if (amount > walletBalance) {
      setRedeemError('Insufficient wallet balance.');
      setIsRedeeming(false);
      return;
    }
    if (amount < 100) {
      setRedeemError('Minimum redemption amount is ₹100.');
      setIsRedeeming(false);
      return;
    }
    if (!redeemMethod) {
      setRedeemError('Please select a redemption method.');
      setIsRedeeming(false);
      return;
    }
    if (!redeemDetails.trim()) {
      setRedeemError('Please provide redemption details (e.g., UPI ID or Bank Account No.).');
      setIsRedeeming(false);
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-redemption-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amount,
          redeemMethod: redeemMethod,
          redeemDetails: redeemDetails,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit redemption request.');
      }

      setRedeemSuccess(result.message);
      setRedeemAmount('');
      setRedeemMethod('');
      setRedeemDetails('');
      setShowRedeemForm(false);
      fetchWalletBalance(); // Refresh balance after redemption
      if (setWalletRefreshKey) {
        setWalletRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleGenerateReferralCode = async () => {
    if (!user) return;
    setIsGeneratingReferral(true);
    setReferralError(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-referral-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate referral code.');
      }
      setReferralCode(result.referralCode);
    } catch (err) {
      setReferralError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsGeneratingReferral(false);
    }
  };

  const handleCopyReferralCode = async () => {
    if (referralCode) {
      try {
        await navigator.clipboard.writeText(referralCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy referral code:', err);
      }
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Handle resume upload and data extraction
  const handleResumeUpload = async (extractionResult: ExtractionResult) => {
    if (!user || !extractionResult.text.trim()) {
      setResumeUploadError('No valid resume content found');
      return;
    }

    setIsProcessingResume(true);
    setResumeUploadError(null);
    setResumeUploadSuccess(false);

    try {
      console.log('UserProfileManagement: Processing uploaded resume...');
      
      // Use optimizeResume to parse the resume structure
      // For profile extraction, we don't need a job description
      const parsedResumeData = await optimizeResume(
        extractionResult.text,
        '', // Empty job description for profile parsing
        'experienced', // Default user type for parsing
        user.name,
        user.email,
        user.phone || '',
        user.linkedin || '',
        user.github || '',
        undefined,
        undefined,
        undefined // No target role for profile parsing
      );

      console.log('UserProfileManagement: Resume parsed successfully:', parsedResumeData);

      // Map ResumeData to ProfileFormData and pre-fill the form
      const profileData: Partial<ProfileFormData> = {
        fullName: parsedResumeData.name || user.name,
        emailAddress: parsedResumeData.email || user.email,
        phone: parsedResumeData.phone || user.phone || '',
        linkedinProfileUrl: parsedResumeData.linkedin || user.linkedin || '',
        githubProfileUrl: parsedResumeData.github || user.github || '',
        resumeHeadline: parsedResumeData.summary || parsedResumeData.careerObjective || user.resumeHeadline || '',
        currentLocation: parsedResumeData.location || user.currentLocation || '',
        educationDetails: parsedResumeData.education || [],
        experienceDetails: parsedResumeData.workExperience || [],
        skillsDetails: parsedResumeData.skills || [],
        projectsDetails: parsedResumeData.projects || [],
        certificationsDetails: (parsedResumeData.certifications || []).map(cert => {
          if (typeof cert === 'string') {
            return { title: cert, description: '', issuer: '', year: '' };
          }
          return cert;
        }),
      };

      // Reset form with extracted data
      reset(profileData);

      // Expand all sections to show the pre-filled data
      setExpandedSections(new Set(['personal', 'social', 'education', 'experience', 'skills', 'projects', 'certifications']));
      
      setResumeUploadSuccess(true);
      setTimeout(() => setResumeUploadSuccess(false), 5000);

    } catch (error) {
      console.error('UserProfileManagement: Error processing resume:', error);
      setResumeUploadError(error instanceof Error ? error.message : 'Failed to process resume');
    } finally {
      setIsProcessingResume(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm dark:bg-black/80">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col dark:bg-dark-100 dark:shadow-dark-xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-3 sm:px-6 py-4 sm:py-8 border-b border-gray-100 flex-shrink-0 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center max-w-4xl mx-auto px-8">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-3xl flex items-center justify-center mx-auto mb-3 sm:mb-6 shadow-lg dark:shadow-neon-cyan">
              {activeTab === 'profile' ? (
                <User className="w-6 h-6 sm:w-10 h-10 text-white" />
              ) : (
                <Wallet className="w-6 h-6 sm:w-10 h-10 text-white" />
              )}
            </div>
            <h1 className="text-lg sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
              {activeTab === 'profile' ? 'Manage Your Profile' : 'Referral & Wallet'}
            </h1>
            <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-3 sm:mb-6">
              {activeTab === 'profile' ? 'Update your personal and resume details' : 'Earn and redeem rewards'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-dark-300">
          <div className="flex justify-center -mb-px">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-3 px-6 text-sm font-medium transition-colors duration-200 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Profile Details
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`py-3 px-6 text-sm font-medium transition-colors duration-200 ${
                activeTab === 'wallet'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Wallet & Referrals
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {saveError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start dark:bg-red-900/20 dark:border-red-500/50">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                  <p className="text-red-700 dark:text-red-300 text-sm font-medium">{saveError}</p>
                </div>
              )}
              {saveSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                  <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">Profile updated successfully!</p>
                </div>
              )}

              {/* Personal Information */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('personal')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400" />
                    <span>Personal Information</span>
                  </div>
                  {expandedSections.has('personal') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('personal') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    <div>
                      <label className="input-label">Full Name</label>
                      <input type="text" {...register('fullName')} className="input-base" />
                      {errors.fullName && <p className="input-error">{errors.fullName.message}</p>}
                    </div>
                    <div>
                      <label className="input-label">Email Address</label>
                      <input type="email" {...register('emailAddress')} className="input-base" disabled />
                      {errors.emailAddress && <p className="input-error">{errors.emailAddress.message}</p>}
                    </div>
                    <div>
                      <label className="input-label">Phone Number</label>
                      <input type="tel" {...register('phone')} className="input-base" />
                      {errors.phone && <p className="input-error">{errors.phone.message}</p>}
                    </div>
                    <div>
                      <label className="input-label">Resume Headline / Career Objective</label>
                      <textarea {...register('resumeHeadline')} className="input-base h-24" placeholder="e.g., Experienced Software Engineer | AI/ML Enthusiast"></textarea>
                      {errors.resumeHeadline && <p className="input-error">{errors.resumeHeadline.message}</p>}
                    </div>
                    <div>
                      <label className="input-label">Current Location</label>
                      <input type="text" {...register('currentLocation')} className="input-base" placeholder="e.g., Bangalore, India" />
                      {errors.currentLocation && <p className="input-error">{errors.currentLocation.message}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Social Profiles */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('social')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <Linkedin className="w-5 h-5 text-purple-600 dark:text-neon-purple-400" />
                    <span>Social Profiles</span>
                  </div>
                  {expandedSections.has('social') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('social') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    <div>
                      <label className="input-label">LinkedIn Profile URL</label>
                      <input type="url" {...register('linkedinProfileUrl')} className="input-base" />
                      {errors.linkedinProfileUrl && <p className="input-error">{errors.linkedinProfileUrl.message}</p>}
                    </div>
                    <div>
                      <label className="input-label">GitHub Profile URL</label>
                      <input type="url" {...register('githubProfileUrl')} className="input-base" />
                      {errors.githubProfileUrl && <p className="input-error">{errors.githubProfileUrl.message}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Education */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('education')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <GraduationCap className="w-5 h-5 text-green-600 dark:text-neon-green-400" />
                    <span>Education</span>
                  </div>
                  {expandedSections.has('education') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('education') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    {educationFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3 dark:border-dark-400">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Education #{index + 1}</h4>
                          <button type="button" onClick={() => removeEducation(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div>
                          <label className="input-label">Degree</label>
                          <input type="text" {...register(`educationDetails.${index}.degree`)} className="input-base" />
                          {errors.educationDetails?.[index]?.degree && <p className="input-error">{errors.educationDetails[index]?.degree?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">School/University</label>
                          <input type="text" {...register(`educationDetails.${index}.school`)} className="input-base" />
                          {errors.educationDetails?.[index]?.school && <p className="input-error">{errors.educationDetails[index]?.school?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Year</label>
                          <input type="text" {...register(`educationDetails.${index}.year`)} className="input-base" placeholder="e.g., 2020-2024" />
                          {errors.educationDetails?.[index]?.year && <p className="input-error">{errors.educationDetails[index]?.year?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">CGPA (Optional)</label>
                          <input type="text" {...register(`educationDetails.${index}.cgpa`)} className="input-base" />
                        </div>
                        <div>
                          <label className="input-label">Location (Optional)</label>
                          <input type="text" {...register(`educationDetails.${index}.location`)} className="input-base" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => appendEducation({ degree: '', school: '', year: '' })} className="btn-secondary w-full flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" /> <span>Add Education</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Work Experience */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('experience')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <Briefcase className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <span>Work Experience</span>
                  </div>
                  {expandedSections.has('experience') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('experience') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    {experienceFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3 dark:border-dark-400">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Experience #{index + 1}</h4>
                          <button type="button" onClick={() => removeExperience(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div>
                          <label className="input-label">Role</label>
                          <input type="text" {...register(`experienceDetails.${index}.role`)} className="input-base" />
                          {errors.experienceDetails?.[index]?.role && <p className="input-error">{errors.experienceDetails[index]?.role?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Company</label>
                          <input type="text" {...register(`experienceDetails.${index}.company`)} className="input-base" />
                          {errors.experienceDetails?.[index]?.company && <p className="input-error">{errors.experienceDetails[index]?.company?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Year</label>
                          <input type="text" {...register(`experienceDetails.${index}.year`)} className="input-base" placeholder="e.g., Jan 2023 - Present" />
                          {errors.experienceDetails?.[index]?.year && <p className="input-error">{errors.experienceDetails[index]?.year?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Responsibilities/Achievements (Bullet Points)</label>
                          {watchedExperience?.[index]?.bullets?.map((bullet, bulletIndex) => (
                            <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                              <input type="text" {...register(`experienceDetails.${index}.bullets.${bulletIndex}`)} className="input-base flex-grow" />
                              <button type="button" onClick={() => {
                                const currentBullets = watchedExperience[index].bullets;
                                if (currentBullets.length > 1) {
                                  const newBullets = currentBullets.filter((_, i) => i !== bulletIndex);
                                  // Manually update the form state for the specific field
                                  reset(prev => ({
                                    ...prev,
                                    experienceDetails: prev.experienceDetails?.map((exp, expIdx) =>
                                      expIdx === index ? { ...exp, bullets: newBullets } : exp
                                    )
                                  }));
                                }
                              }} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            const currentBullets = watchedExperience?.[index]?.bullets || [];
                            reset(prev => ({
                              ...prev,
                              experienceDetails: prev.experienceDetails?.map((exp, expIdx) =>
                                expIdx === index ? { ...exp, bullets: [...currentBullets, ''] } : exp
                              )
                            }));
                          }} className="btn-secondary btn-sm flex items-center space-x-1 mt-2">
                            <Plus className="w-4 h-4" /> <span>Add Bullet</span>
                          </button>
                          {errors.experienceDetails?.[index]?.bullets && <p className="input-error">{errors.experienceDetails[index]?.bullets?.message}</p>}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => appendExperience({ role: '', company: '', year: '', bullets: [''] })} className="btn-secondary w-full flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" /> <span>Add Experience</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Projects */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('projects')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <Code className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400" />
                    <span>Projects</span>
                  </div>
                  {expandedSections.has('projects') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('projects') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    {projectsFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3 dark:border-dark-400">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Project #{index + 1}</h4>
                          <button type="button" onClick={() => removeProject(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div>
                          <label className="input-label">Title</label>
                          <input type="text" {...register(`projectsDetails.${index}.title`)} className="input-base" />
                          {errors.projectsDetails?.[index]?.title && <p className="input-error">{errors.projectsDetails[index]?.title?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">GitHub URL (Optional)</label>
                          <input type="url" {...register(`projectsDetails.${index}.githubUrl`)} className="input-base" />
                          {errors.projectsDetails?.[index]?.githubUrl && <p className="input-error">{errors.projectsDetails[index]?.githubUrl?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Demo URL (Optional)</label>
                          <input type="url" {...register(`projectsDetails.${index}.demoUrl`)} className="input-base" />
                          {errors.projectsDetails?.[index]?.demoUrl && <p className="input-error">{errors.projectsDetails[index]?.demoUrl?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Description (Bullet Points)</label>
                          {watchedProjects?.[index]?.bullets?.map((bullet, bulletIndex) => (
                            <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                              <input type="text" {...register(`projectsDetails.${index}.bullets.${bulletIndex}`)} className="input-base flex-grow" />
                              <button type="button" onClick={() => {
                                const currentBullets = watchedProjects[index].bullets;
                                if (currentBullets.length > 1) {
                                  const newBullets = currentBullets.filter((_, i) => i !== bulletIndex);
                                  reset(prev => ({
                                    ...prev,
                                    projectsDetails: prev.projectsDetails?.map((proj, projIdx) =>
                                      projIdx === index ? { ...proj, bullets: newBullets } : proj
                                    )
                                  }));
                                }
                              }} className="text-red-600 hover:text-red-700">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            const currentBullets = watchedProjects?.[index]?.bullets || [];
                            reset(prev => ({
                              ...prev,
                              projectsDetails: prev.projectsDetails?.map((proj, projIdx) =>
                                projIdx === index ? { ...proj, bullets: [...currentBullets, ''] } : proj
                              )
                            }));
                          }} className="btn-secondary btn-sm flex items-center space-x-1 mt-2">
                            <Plus className="w-4 h-4" /> <span>Add Bullet</span>
                          </button>
                          {errors.projectsDetails?.[index]?.bullets && <p className="input-error">{errors.projectsDetails[index]?.bullets?.message}</p>}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => appendProject({ title: '', bullets: [''] })} className="btn-secondary w-full flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" /> <span>Add Project</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('skills')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <Sparkles className="w-5 h-5 text-pink-600 dark:text-neon-pink-400" />
                    <span>Skills</span>
                  </div>
                  {expandedSections.has('skills') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('skills') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    {skillsFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3 dark:border-dark-400">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Skill Category #{index + 1}</h4>
                          <button type="button" onClick={() => removeSkill(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div>
                          <label className="input-label">Category Name</label>
                          <input type="text" {...register(`skillsDetails.${index}.category`)} className="input-base" placeholder="e.g., Programming Languages" />
                          {errors.skillsDetails?.[index]?.category && <p className="input-error">{errors.skillsDetails[index]?.category?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Skills (comma-separated)</label>
                          <textarea
                            {...register(`skillsDetails.${index}.list`, {
                              setValueAs: (val: string) => val.split(',').map(s => s.trim()).filter(Boolean),
                              validate: (val) => val.length > 0 || 'At least one skill is required',
                            })}
                            className="input-base h-24"
                            placeholder="e.g., JavaScript, Python, React, Node.js"
                            defaultValue={watchedSkills?.[index]?.list?.join(', ') || ''}
                            onBlur={(e) => {
                              const newSkills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              reset(prev => ({
                                ...prev,
                                skillsDetails: prev.skillsDetails?.map((skillCat, skillCatIdx) =>
                                  skillCatIdx === index ? { ...skillCat, list: newSkills } : skillCat
                                )
                              }));
                            }}
                          ></textarea>
                          {errors.skillsDetails?.[index]?.list && <p className="input-error">{errors.skillsDetails[index]?.list?.message}</p>}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => appendSkill({ category: '', list: [] })} className="btn-secondary w-full flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" /> <span>Add Skill Category</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Certifications */}
              <div className="card">
                <button type="button" onClick={() => toggleSection('certifications')} className="w-full flex justify-between items-center p-4 sm:p-6 font-semibold text-lg text-gray-900 dark:text-gray-100">
                  <div className="flex items-center space-x-3">
                    <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span>Certifications</span>
                  </div>
                  {expandedSections.has('certifications') ? <ChevronUp /> : <ChevronDown />}
                </button>
                {expandedSections.has('certifications') && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-300 space-y-4">
                    {certificationsFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-3 dark:border-dark-400">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">Certification #{index + 1}</h4>
                          <button type="button" onClick={() => removeCertification(index)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div>
                          <label className="input-label">Title</label>
                          <input type="text" {...register(`certificationsDetails.${index}.title`)} className="input-base" />
                          {errors.certificationsDetails?.[index]?.title && <p className="input-error">{errors.certificationsDetails[index]?.title?.message}</p>}
                        </div>
                        <div>
                          <label className="input-label">Description (Optional)</label>
                          <textarea {...register(`certificationsDetails.${index}.description`)} className="input-base h-20"></textarea>
                        </div>
                        <div>
                          <label className="input-label">Issuer (Optional)</label>
                          <input type="text" {...register(`certificationsDetails.${index}.issuer`)} className="input-base" />
                        </div>
                        <div>
                          <label className="input-label">Year (Optional)</label>
                          <input type="text" {...register(`certificationsDetails.${index}.year`)} className="input-base" placeholder="e.g., 2023" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => appendCertification({ title: '' })} className="btn-secondary w-full flex items-center justify-center space-x-2">
                      <Plus className="w-5 h-5" /> <span>Add Certification</span>
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" disabled={isSaving || !isDirty} className="btn-primary w-full flex items-center justify-center space-x-2">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>{isSaving ? 'Saving Profile...' : 'Save Profile'}</span>
              </button>
            </form>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Wallet Balance */}
              <div className="card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Wallet className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
                    <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">Your Wallet Balance</h3>
                  </div>
                  <button onClick={fetchWalletBalance} disabled={loadingWallet} className="btn-secondary btn-sm flex items-center space-x-2">
                    {loadingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>Refresh</span>
                  </button>
                </div>
                <div className="text-center">
                  {loadingWallet ? (
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  ) : (
                    <p className="text-5xl font-bold text-green-600 dark:text-green-400">₹{walletBalance.toFixed(2)}</p>
                  )}
                  <p className="text-gray-600 dark:text-gray-300 mt-2">Available for redemption or purchases</p>
                </div>
                <button onClick={() => setShowRedeemForm(!showRedeemForm)} className="btn-primary w-full mt-4 flex items-center justify-center space-x-2">
                  <DollarSign className="w-5 h-5" /> <span>{showRedeemForm ? 'Hide Redemption Form' : 'Redeem Earnings'}</span>
                </button>
              </div>

              {/* Redemption Form */}
              {showRedeemForm && (
                <div className="card p-4 sm:p-6 animate-fadeIn">
                  <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                    <Send className="w-6 h-6 text-purple-600 dark:text-neon-purple-400" />
                    <span>Redeem Your Earnings</span>
                  </h3>
                  {redeemError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start mb-4 dark:bg-red-900/20 dark:border-red-500/50">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                      <p className="text-red-700 dark:text-red-300 text-sm font-medium">{redeemError}</p>
                    </div>
                  )}
                  {redeemSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-start mb-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                      <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">{redeemSuccess}</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="input-label">Amount (₹)</label>
                      <input
                        type="number"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                        className="input-base"
                        placeholder="Minimum ₹100"
                        min="100"
                        step="any"
                      />
                    </div>
                    <div>
                      <label className="input-label">Redemption Method</label>
                      <select
                        value={redeemMethod}
                        onChange={(e) => setRedeemMethod(e.target.value as 'upi' | 'bank_transfer' | '')}
                        className="input-base"
                      >
                        <option value="">Select Method</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="input-label">Details ({redeemMethod === 'upi' ? 'UPI ID' : 'Bank Account No. & IFSC'})</label>
                      <input
                        type="text"
                        value={redeemDetails}
                        onChange={(e) => setRedeemDetails(e.target.value)}
                        className="input-base"
                        placeholder={redeemMethod === 'upi' ? 'your_upi_id@bank' : 'Account No., IFSC Code, Account Holder Name'}
                      />
                    </div>
                    <button onClick={handleRedeem} disabled={isRedeeming} className="btn-primary w-full flex items-center justify-center space-x-2">
                      {isRedeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      <span>{isRedeeming ? 'Submitting Request...' : 'Submit Redemption Request'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Referral Program */}
              <div className="card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Share2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-xl text-gray-900 dark:text-gray-100">Referral Program</h3>
                  </div>
                </div>
                {referralError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start mb-4 dark:bg-red-900/20 dark:border-red-500/50">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">{referralError}</p>
                  </div>
                )}
                {referralCode ? (
                  <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">Share your unique referral code and earn rewards!</p>
                    <div className="flex items-center space-x-2">
                      <input type="text" value={referralCode} readOnly className="input-base flex-grow" />
                      <button onClick={handleCopyReferralCode} className="btn-secondary flex items-center space-x-2">
                        {copySuccess ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                        <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Earn ₹10 for every friend who signs up using your code and completes their first purchase.
                    </p>
                  </div>
                ) : (
                  <button onClick={handleGenerateReferralCode} disabled={isGeneratingReferral} className="btn-primary w-full flex items-center justify-center space-x-2">
                    {isGeneratingReferral ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    <span>{isGeneratingReferral ? 'Generating Code...' : 'Generate My Referral Code'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
