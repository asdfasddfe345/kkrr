```typescript
// src/components/UserProfileManagement.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Wallet,
  Gift,
  RefreshCw,
  Copy,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Banknote,
  CreditCard,
  Info,
  Upload,
  FileText,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';
import { paymentService } from '../services/paymentService';
import { Education, WorkExperience, Skill, Certification, ResumeData } from '../types/resume';
import { FileUpload } from './FileUpload';
import { ExtractionResult } from '../types/resume';
import { optimizeResume } from '../services/geminiService';

// Zod Schemas for validation
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
  bullets: z.array(z.string().min(1, 'Bullet cannot be empty')).min(1, 'At least one bullet is required'),
  location: z.string().optional(),
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

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email_address: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  linkedin_profile: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  github_profile: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  resume_headline: z.string().optional(),
  current_location: z.string().optional(),
  education_details: z.array(educationSchema).optional(),
  experience_details: z.array(workExperienceSchema).optional(),
  skills_details: z.array(skillSchema).optional(),
  certifications_details: z.array(certificationSchema).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileManagementProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'profile' | 'wallet';
  walletRefreshKey: number;
  setWalletRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}

export const UserProfileManagement: React.FC<UserProfileManagementProps> = ({
  isOpen,
  onClose,
  viewMode: initialViewMode = 'profile',
  walletRefreshKey,
  setWalletRefreshKey,
}) => {
  const { user, revalidateUserSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet'>(initialViewMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0); // In Rupees
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState<number | ''>('');
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redeemDetails, setRedeemDetails] = useState({
    upiId: '',
    bankAccount: '',
    ifscCode: '',
    accountHolderName: '',
  });
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showResumeUpload, setShowResumeUpload] = useState(false);
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [resumeExtractionError, setResumeExtractionError] = useState<string | null>(null);
  const [resumeExtractionSuccess, setResumeExtractionSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.name || '',
      email_address: user?.email || '',
      phone: user?.phone || '',
      linkedin_profile: user?.linkedin || '',
      github_profile: user?.github || '',
      resume_headline: user?.resumeHeadline || '',
      current_location: user?.currentLocation || '',
      education_details: user?.educationDetails || [],
      experience_details: user?.experienceDetails || [],
      skills_details: user?.skillsDetails || [],
      certifications_details: [], // Assuming this is part of profile, initialize empty
    },
  });

  const {
    fields: educationFields,
    append: appendEducation,
    remove: removeEducation,
  } = useFieldArray({
    control,
    name: 'education_details',
  });

  const {
    fields: experienceFields,
    append: appendExperience,
    remove: removeExperience,
  } = useFieldArray({
    control,
    name: 'experience_details',
  });

  const {
    fields: skillsFields,
    append: appendSkill,
    remove: removeSkill,
  } = useFieldArray({
    control,
    name: 'skills_details',
  });

  const {
    fields: certificationsFields,
    append: appendCertification,
    remove: removeCertification,
  } = useFieldArray({
    control,
    name: 'certifications_details',
  });

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.name || '',
        email_address: user.email || '',
        phone: user.phone || '',
        linkedin_profile: user.linkedin || '',
        github_profile: user.github || '',
        resume_headline: user.resumeHeadline || '',
        current_location: user.currentLocation || '',
        education_details: user.educationDetails || [],
        experience_details: user.experienceDetails || [],
        skills_details: user.skillsDetails || [],
        certifications_details: [], // Assuming this is part of profile, initialize empty
      });
      fetchWalletData();
      fetchReferralCode();
    }
  }, [user, reset, walletRefreshKey]);

  useEffect(() => {
    setActiveTab(initialViewMode);
  }, [initialViewMode]);

  const fetchWalletData = useCallback(async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, type, status, created_at, transaction_ref, redeem_method, redeem_details, source_user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching wallet transactions:', error);
        return;
      }

      const completedTransactions = (transactions || []).filter((t: any) => t.status === 'completed');
      const balance = completedTransactions.reduce((sum: number, tr: any) => sum + parseFloat(tr.amount), 0);
      setWalletBalance(balance);
      setWalletTransactions(transactions || []);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  }, [user]);

  const fetchReferralCode = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('generate-referral-code', {
        body: { userId: user.id },
      });

      if (error) {
        console.error('Error generating referral code:', error);
        return;
      }
      setReferralCode(data.referralCode);
    } catch (err) {
      console.error('Error fetching referral code:', err);
    }
  }, [user]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      await authService.updateUserProfile(user.id, {
        full_name: data.full_name,
        email_address: data.email_address,
        phone: data.phone,
        linkedin_profile: data.linkedin_profile,
        github_profile: data.github_profile,
        resume_headline: data.resume_headline,
        current_location: data.current_location,
        education_details: data.education_details,
        experience_details: data.experience_details,
        skills_details: data.skills_details,
        certifications_details: data.certifications_details,
        has_seen_profile_prompt: true, // Mark prompt as seen on first save
      });
      await revalidateUserSession(); // Update user context
      setSubmitSuccess(true);
      // Reset dirty state after successful submission
      reset(data, { keepValues: true, keepDirty: false });
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReferralCode = async () => {
    if (referralCode) {
      await navigator.clipboard.writeText(referralCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleRedeem = async () => {
    if (!user) return;
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(false);

    if (!redeemAmount || redeemAmount <= 0 || redeemAmount > walletBalance) {
      setRedeemError('Please enter a valid amount within your balance.');
      setIsRedeeming(false);
      return;
    }
    if (redeemAmount < 100) {
      setRedeemError('Minimum redemption amount is ₹100.');
      setIsRedeeming(false);
      return;
    }

    let details: any = {};
    if (redeemMethod === 'upi') {
      if (!redeemDetails.upiId) {
        setRedeemError('UPI ID is required.');
        setIsRedeeming(false);
        return;
      }
      details = { upiId: redeemDetails.upiId };
    } else {
      if (!redeemDetails.bankAccount || !redeemDetails.ifscCode || !redeemDetails.accountHolderName) {
        setRedeemError('All bank transfer details are required.');
        setIsRedeeming(false);
        return;
      }
      details = {
        bankAccount: redeemDetails.bankAccount,
        ifscCode: redeemDetails.ifscCode,
        accountHolderName: redeemDetails.accountHolderName,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-redemption-email', {
        body: {
          userId: user.id,
          amount: redeemAmount,
          redeemMethod,
          redeemDetails: details,
        },
      });

      if (error) {
        console.error('Redemption error:', error);
        setRedeemError(error.message);
        return;
      }

      if (!data.success) {
        setRedeemError(data.error || 'Redemption failed.');
        return;
      }

      setRedeemSuccess(true);
      setWalletRefreshKey((prev) => prev + 1); // Trigger wallet refresh
      setTimeout(() => {
        setShowRedeemForm(false);
        setRedeemSuccess(false);
        setRedeemAmount('');
        setRedeemDetails({
          upiId: '',
          bankAccount: '',
          ifscCode: '',
          accountHolderName: '',
        });
      }, 3000);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'An unexpected error occurred during redemption.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleFileUpload = async (result: ExtractionResult) => {
    if (!user) {
      setResumeExtractionError('User not authenticated.');
      return;
    }
    setIsExtractingResume(true);
    setResumeExtractionError(null);
    setResumeExtractionSuccess(false);

    try {
      // Use optimizeResume to parse the text into structured ResumeData
      const parsedResume = await optimizeResume(
        result.text,
        '', // No job description needed for profile pre-fill
        'fresher', // Default user type for initial parsing
        user.name || '',
        user.email || '',
        user.phone || '',
        user.linkedin || '',
        user.github || '',
      );

      // Map ResumeData to ProfileFormData and reset the form
      const newFormData: ProfileFormData = {
        full_name: parsedResume.name || user.name || '',
        email_address: parsedResume.email || user.email || '',
        phone: parsedResume.phone || user.phone || '',
        linkedin_profile: parsedResume.linkedin || user.linkedin || '',
        github_profile: parsedResume.github || user.github || '',
        resume_headline: parsedResume.summary || parsedResume.careerObjective || user.resumeHeadline || '',
        current_location: parsedResume.location || user.currentLocation || '',
        education_details: parsedResume.education || [],
        experience_details: parsedResume.workExperience || [],
        skills_details: parsedResume.skills || [],
        certifications_details: parsedResume.certifications.map(cert =>
          typeof cert === 'string' ? { title: cert } : cert
        ) || [],
      };

      reset(newFormData);
      setResumeExtractionSuccess(true);
      setShowResumeUpload(false); // Close upload section on success
      setTimeout(() => setResumeExtractionSuccess(false), 3000);
    } catch (error) {
      console.error('Error extracting resume data:', error);
      setResumeExtractionError(error instanceof Error ? error.message : 'Failed to extract resume data.');
    } finally {
      setIsExtractingResume(false);
    }
  };

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderProfileManagement = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-4 sm:p-6">
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <p className="text-red-700 text-sm font-medium">{submitError}</p>
        </div>
      )}
      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
          <p className="text-green-700 text-sm font-medium">Profile updated successfully!</p>
        </div>
      )}

      {/* Resume Upload Section */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <button
          type="button"
          onClick={() => setShowResumeUpload(!showResumeUpload)}
          className="w-full flex items-center justify-between text-lg font-semibold text-gray-900"
        >
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Upload Resume to Pre-fill Profile</span>
          </div>
          {showResumeUpload ? <ChevronUp /> : <ChevronDown />}
        </button>
        {showResumeUpload && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {isExtractingResume ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                <p className="text-gray-600">Extracting data from your resume...</p>
              </div>
            ) : resumeExtractionError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                {resumeExtractionError}
              </div>
            ) : resumeExtractionSuccess ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Resume data extracted and pre-filled!
              </div>
            ) : (
              <FileUpload onFileUpload={handleFileUpload} />
            )}
          </div>
        )}
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <User className="w-5 h-5 text-blue-600" />
          <span>Basic Information</span>
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input type="text" {...register('full_name')} className="input-base" />
          {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input type="email" {...register('email_address')} className="input-base" disabled />
          {errors.email_address && <p className="text-red-500 text-sm mt-1">{errors.email_address.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="tel" {...register('phone')} className="input-base" />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Location</label>
          <input type="text" {...register('current_location')} className="input-base" />
          {errors.current_location && <p className="text-red-500 text-sm mt-1">{errors.current_location.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resume Headline / Summary</label>
          <textarea {...register('resume_headline')} className="input-base h-24 resize-y" />
          {errors.resume_headline && <p className="text-red-500 text-sm mt-1">{errors.resume_headline.message}</p>}
        </div>
      </div>

      {/* Social Links */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Linkedin className="w-5 h-5 text-purple-600" />
          <span>Social Links</span>
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
          <input type="url" {...register('linkedin_profile')} className="input-base" />
          {errors.linkedin_profile && <p className="text-red-500 text-sm mt-1">{errors.linkedin_profile.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Profile URL</label>
          <input type="url" {...register('github_profile')} className="input-base" />
          {errors.github_profile && <p className="text-red-500 text-sm mt-1">{errors.github_profile.message}</p>}
        </div>
      </div>

      {/* Education */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <GraduationCap className="w-5 h-5 text-green-600" />
          <span>Education</span>
        </h3>
        {educationFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-900">Education #{index + 1}</h4>
              <button type="button" onClick={() => removeEducation(index)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
              <input type="text" {...register(`education_details.${index}.degree`)} className="input-base" />
              {errors.education_details?.[index]?.degree && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.degree?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School/University</label>
              <input type="text" {...register(\`education_details.${index}.school`)} className="input-base" />
              {errors.education_details?.[index]?.school && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.school?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="text" {...register(\`education_details.${index}.year`)} className="input-base" />
              {errors.education_details?.[index]?.year && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.year?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CGPA/GPA (Optional)</label>
              <input type="text" {...register(\`education_details.${index}.cgpa`)} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
              <input type="text" {...register(\`education_details.${index}.location`)} className="input-base" />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => appendEducation({ degree: '', school: '', year: '' })} className="btn-secondary w-full flex items-center justify-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Add Education</span>
        </button>
      </div>

      {/* Work Experience */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Briefcase className="w-5 h-5 text-orange-600" />
          <span>Work Experience</span>
        </h3>
        {experienceFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-900">Experience #{index + 1}</h4>
              <button type="button" onClick={() => removeExperience(index)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input type="text" {...register(\`experience_details.${index}.role`)} className="input-base" />
              {errors.experience_details?.[index]?.role && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.role?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input type="text" {...register(\`experience_details.${index}.company`)} className="input-base" />
              {errors.experience_details?.[index]?.company && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.company?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="text" {...register(\`experience_details.${index}.year`)} className="input-base" />
              {errors.experience_details?.[index]?.year && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.year?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
              <input type="text" {...register(\`experience_details.${index}.location`)} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsibilities/Achievements</label>
              {/* Nested Field Array for bullets */}
              <ul className="space-y-2">
                {/* This part needs a nested useFieldArray or manual state management for bullets */}
                {/* For simplicity, let's assume a single textarea for now, or implement nested field array */}
                <textarea
                  {...register(\`experience_details.${index}.bullets.0`)} // Assuming first bullet is main
                  className="input-base h-24 resize-y"
                  placeholder="Enter responsibilities/achievements, one per line"
                  defaultValue={field.bullets?.join('\n')}
                  onChange={(e) => {
                    const updatedBullets = e.target.value.split('\n').map(b => b.trim()).filter(Boolean);
                    // Manually update the form state for bullets
                    // This is a simplified approach; a nested useFieldArray is more robust
                    const currentExperience = experienceFields[index] as WorkExperience;
                    currentExperience.bullets = updatedBullets;
                  }}
                />
              </ul>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => appendExperience({ role: '', company: '', year: '', bullets: [''] })} className="btn-secondary w-full flex items-center justify-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Add Experience</span>
        </button>
      </div>

      {/* Skills */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Code className="w-5 h-5 text-teal-600" />
          <span>Skills</span>
        </h3>
        {skillsFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-900">Skill Category #{index + 1}</h4>
              <button type="button" onClick={() => removeSkill(index)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input type="text" {...register(\`skills_details.${index}.category`)} className="input-base" />
              {errors.skills_details?.[index]?.category && <p className="text-red-500 text-sm mt-1">{errors.skills_details[index]?.category?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
              <textarea
                {...register(\`skills_details.${index}.list.0`)} // Assuming first item in list is main
                className="input-base h-24 resize-y"
                placeholder="e.g., JavaScript, React, Node.js"
                defaultValue={field.list?.join(', ')}
                onChange={(e) => {
                  const updatedSkills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  // Manually update the form state for skills list
                  const currentSkill = skillsFields[index] as Skill;
                  currentSkill.list = updatedSkills;
                }}
              />
              {errors.skills_details?.[index]?.list && <p className="text-red-500 text-sm mt-1">{errors.skills_details[index]?.list?.message}</p>}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => appendSkill({ category: '', list: [''] })} className="btn-secondary w-full flex items-center justify-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Add Skill Category</span>
        </button>
      </div>

      {/* Certifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <Award className="w-5 h-5 text-yellow-600" />
          <span>Certifications</span>
        </h3>
        {certificationsFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-gray-900">Certification #{index + 1}</h4>
              <button type="button" onClick={() => removeCertification(index)} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" {...register(\`certifications_details.${index}.title`)} className="input-base" />
              {errors.certifications_details?.[index]?.title && <p className="text-red-500 text-sm mt-1">{errors.certifications_details[index]?.title?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issuer (Optional)</label>
              <input type="text" {...register(\`certifications_details.${index}.issuer`)} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year (Optional)</label>
              <input type="text" {...register(\`certifications_details.${index}.year`)} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea {...register(\`certifications_details.${index}.description`)} className="input-base h-20 resize-y" />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => appendCertification({ title: '' })} className="btn-secondary w-full flex items-center justify-center space-x-2">
          <Plus className="w-5 h-5" />
          <span>Add Certification</span>
        </button>
      </div>

      <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary">
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </form>
  );

  const renderWalletManagement = () => (
    <> {/* Added React Fragment here */}
      <div className="space-y-6 p-4 sm:p-6">
        {/* Wallet Balance */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <Wallet className="w-6 h-6" />
              <span>My Wallet Balance</span>
            </h3>
            <button onClick={fetchWalletData} disabled={loadingWallet} className="text-white/80 hover:text-white">
              <RefreshCw className={\`w-5 h-5 ${loadingWallet ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-4xl font-extrabold">₹{walletBalance.toFixed(2)}</p>
          <p className="text-sm text-white/80">Available for redemption or purchases</p>
        </div>

        {/* Referral Code */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2 mb-3">
            <Gift className="w-5 h-5 text-green-600" />
            <span>Your Referral Code</span>
          </h3>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={referralCode || 'Generating...'}
              readOnly
              className="input-base flex-grow bg-white cursor-text"
            />
            <button onClick={handleCopyReferralCode} className="btn-secondary px-4 py-2">
              {copySuccess ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">Share this code to earn rewards!</p>
        </div>

        {/* Redeem Section */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <button
            onClick={() => setShowRedeemForm(!showRedeemForm)}
            className="w-full flex items-center justify-between text-lg font-semibold text-gray-900"
          >
            <div className="flex items-center space-x-2">
              <Banknote className="w-5 h-5 text-teal-600" />
              <span>Redeem Wallet Balance</span>
            </div>
            {showRedeemForm ? <ChevronUp /> : <ChevronDown />}
          </button>
          {showRedeemForm && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
              {redeemError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  {redeemError}
                </div>
              )}
              {redeemSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Redemption request submitted! Money will be credited within 2 hours.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Redeem (₹)</label>
                <input
                  type="number"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(parseFloat(e.target.value))}
                  className="input-base"
                  min="100"
                  max={walletBalance}
                />
                <p className="text-xs text-gray-500 mt-1">Minimum redemption: ₹100</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Method</label>
                <select
                  value={redeemMethod}
                  onChange={(e) => setRedeemMethod(e.target.value as 'upi' | 'bank_transfer')}
                  className="input-base"
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              {redeemMethod === 'upi' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={redeemDetails.upiId}
                    onChange={(e) => setRedeemDetails({ ...redeemDetails, upiId: e.target.value })}
                    className="input-base"
                    placeholder="e.g., yourname@bank"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      value={redeemDetails.bankAccount}
                      onChange={(e) => setRedeemDetails({ ...redeemDetails, bankAccount: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={redeemDetails.ifscCode}
                      onChange={(e) => setRedeemDetails({ ...redeemDetails, ifscCode: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={redeemDetails.accountHolderName}
                      onChange={(e) => setRedeemDetails({ ...redeemDetails, accountHolderName: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>
              )}
              <button onClick={handleRedeem} disabled={isRedeeming || !redeemAmount} className="btn-primary w-full">
                {isRedeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Banknote className="w-5 h-5" />}
                <span>{isRedeeming ? 'Processing...' : 'Redeem Now'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2 mb-3">
            <CreditCard className="w-5 h-5 text-blue-600" />
            <span>Transaction History</span>
          </h3>
          {loadingTransactions ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : walletTransactions.length === 0 ? (
            <p className="text-gray-600 text-sm">No transactions yet.</p>
          ) : (
            <ul className="space-y-2">
              {walletTransactions.map((transaction) => (
                <li key={transaction.transaction_ref || transaction.created_at} className="flex justify-between items-center text-sm text-gray-700">
                  <div>
                    <p className="font-medium capitalize">{transaction.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{new Date(transaction.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={\`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{transaction.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-3 sm:px-6 py-4 sm:py-8 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px]"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center max-w-4xl mx-auto px-8">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-3xl flex items-center justify-center mx-auto mb-3 sm:mb-6 shadow-lg">
              <User className="w-6 h-6 sm:w-10 h-10 text-white" />
            </div>
            <h1 className="text-lg sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              {activeTab === 'profile' ? 'Manage Your Profile' : 'Wallet & Referrals'}
            </h1>
            <p className="text-sm sm:text-lg lg:text-xl text-gray-600 mb-3 sm:mb-6">
              {activeTab === 'profile' ? 'Keep your information up-to-date for best results.' : 'Track your earnings and redeem rewards.'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200">
          <div className="flex justify-center">
            <button
              onClick={() => setActiveTab('profile')}
              className={\`py-3 px-6 text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={\`py-3 px-6 text-sm font-medium transition-colors ${
                activeTab === 'wallet'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Wallet
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto">
          {activeTab === 'profile' ? renderProfileManagement() : renderWalletManagement()}
        </div>
      </div>
    </div>
  );
};
```