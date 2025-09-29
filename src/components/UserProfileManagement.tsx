```tsx
// src/components/UserProfileManagement.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Wallet,
  RefreshCw,
  Copy,
  Share2,
  ArrowRight,
  Info,
  Eye,
  EyeOff,
  Upload,
  Target,
  MapPin,
  Calendar,
  Banknote,
  CreditCard,
  QrCode,
  History,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { paymentService } from '../services/paymentService';
import { ExtractionResult, ResumeData, UserType } from '../types/resume';
import { parseFile } from '../utils/fileParser';
import { AlertModal } from './AlertModal';

// --- Zod Schemas for Validation ---
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

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  bullets: z.array(z.string().min(1, 'Bullet cannot be empty')).min(1, 'At least one bullet is required'),
  githubUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

const skillSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  list: z.array(z.string().min(1, 'Skill cannot be empty')).min(1, 'At least one skill is required'),
});

const certificationSchema = z.object({
  title: z.string().min(1, 'Certification title is required'),
  description: z.string().optional(),
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
  projects_details: z.array(projectSchema).optional(),
  certifications_details: z.array(certificationSchema).optional(),
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
  viewMode: initialViewMode = 'profile',
  walletRefreshKey,
  setWalletRefreshKey,
}) => {
  const { user, revalidateUserSession } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentView, setCurrentView] = useState<'profile' | 'wallet'>(initialViewMode);
  const [walletBalance, setWalletBalance] = useState<number>(0); // In Rupees
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redeemDetails, setRedeemDetails] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [showTransactionDetails, setShowTransactionDetails] = useState<Set<string>>(new Set());
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);

  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showResumeUpload, setShowResumeUpload] = useState(false);

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
      projects_details: [], // Assuming projects are not directly in user object yet
      certifications_details: [], // Assuming certifications are not directly in user object yet
    },
  });

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({
    control,
    name: 'education_details',
  });
  const { fields: experienceFields, append: appendExperience, remove: removeExperience } = useFieldArray({
    control,
    name: 'experience_details',
  });
  const { fields: skillsFields, append: appendSkill, remove: removeSkill } = useFieldArray({
    control,
    name: 'skills_details',
  });
  const { fields: projectFields, append: appendProject, remove: removeProject } = useFieldArray({
    control,
    name: 'projects_details',
  });
  const { fields: certificationFields, append: appendCertification, remove: removeCertification } = useFieldArray({
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
        // Projects and certifications are not directly on the user object yet,
        // so they won't be pre-filled from  `user` unless added to the AuthContext User type.
        projects_details: [],
        certifications_details: [],
      });
      setReferralCode(user.referralCode || null);
    }
  }, [user, reset]);

  useEffect(() => {
    setCurrentView(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (user && isOpen && currentView === 'wallet') {
      fetchWalletBalance();
      fetchWalletTransactions();
    }
  }, [user, isOpen, currentView, walletRefreshKey]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
      setWalletBalance(balance); // Stored in Rupees
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  const fetchWalletTransactions = async () => {
    if (!user) return;
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching wallet transactions:', error);
        return;
      }
      setWalletTransactions(data || []);
    } catch (err) {
      console.error('Error fetching wallet transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

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
        projects_details: data.projects_details,
        certifications_details: data.certifications_details,
        has_seen_profile_prompt: true, // Mark as seen once they save their profile
      });
      await revalidateUserSession(); // Refresh user context in AuthProvider
      setSaveSuccess(true);
      reset(data); // Reset form with new data to clear isDirty state
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateReferralCode = async () => {
    if (!user) return;
    setIsGeneratingReferral(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required to generate referral code.');
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
      if (response.ok && result.success) {
        setReferralCode(result.referralCode);
        await revalidateUserSession(); // Update user context with new referral code
      } else {
        throw new Error(result.error || 'Failed to generate referral code.');
      }
    } catch (err) {
      console.error('Error generating referral code:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to generate referral code.');
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

  const handleRedeemRequest = async () => {
    if (!user) return;
    if (parseFloat(redeemAmount) < 100) {
      setRedeemError('Minimum redemption amount is ₹100.');
      return;
    }
    if (parseFloat(redeemAmount) > walletBalance) {
      setRedeemError('Redemption amount exceeds wallet balance.');
      return;
    }
    if (!redeemDetails.trim()) {
      setRedeemError('Redemption details are required.');
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(false);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required to redeem.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-redemption-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          amount: parseFloat(redeemAmount),
          redeemMethod,
          redeemDetails,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setRedeemSuccess(true);
        setRedeemAmount('');
        setRedeemDetails('');
        if (setWalletRefreshKey) setWalletRefreshKey(prev => prev + 1);
        setTimeout(() => {
          setRedeemSuccess(false);
          setShowRedeemModal(false);
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to submit redemption request.');
      }
    } catch (err) {
      console.error('Error redeeming:', err);
      setRedeemError(err instanceof Error ? err.message : 'Failed to submit redemption request.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleResumeFileUpload = async (result: ExtractionResult) => {
    if (!user) {
      setUploadError('User not authenticated.');
      return;
    }
    setIsUploadingResume(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const resumeData: ResumeData = await paymentService.parseResumeWithAI(result.text, user.id);

      // Map ResumeData to form fields
      reset({
        full_name: resumeData.name || user.name,
        email_address: resumeData.email || user.email,
        phone: resumeData.phone || user.phone,
        linkedin_profile: resumeData.linkedin || user.linkedin,
        github_profile: resumeData.github || user.github,
        resume_headline: resumeData.summary || resumeData.careerObjective || user.resumeHeadline,
        current_location: resumeData.location || user.currentLocation,
        education_details: resumeData.education || [],
        experience_details: resumeData.workExperience || [],
        skills_details: resumeData.skills || [],
        projects_details: resumeData.projects || [],
        certifications_details: resumeData.certifications?.map(cert =>
          typeof cert === 'string' ? { title: cert, description: '' } : cert
        ) || [],
      });
      setUploadSuccess(true);
      setShowResumeUpload(false); // Close upload section after successful parsing
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Error parsing resume for profile:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to extract data from resume.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const toggleTransactionDetails = (id: string) => {
    setShowTransactionDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const renderProfileManagement = () => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <p className="text-red-700 text-sm font-medium">{saveError}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
          <p className="text-green-700 text-sm font-medium">Profile updated successfully!</p>
        </div>
      )}
      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <p className="text-red-700 text-sm font-medium">{uploadError}</p>
        </div>
      )}
      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
          <p className="text-green-700 text-sm font-medium">Resume data extracted and pre-filled!</p>
        </div>
      )}

      {/* Resume Upload Section */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <button
          type="button"
          onClick={() => setShowResumeUpload(!showResumeUpload)}
          className="w-full flex items-center justify-between text-lg font-semibold text-gray-900"
        >
          <span className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <span>Upload Resume to Pre-fill Profile</span>
          </span>
          {showResumeUpload ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {showResumeUpload && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Upload your resume (PDF, DOCX, TXT) and our AI will extract the information to pre-fill your profile fields.
            </p>
            <FileUpload onFileUpload={handleResumeFileUpload} />
            {isUploadingResume && (
              <div className="flex items-center justify-center mt-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm text-gray-600">Extracting data from resume...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Basic Information */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-600" />
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Resume Headline / Summary</label>
            <textarea {...register('resume_headline')} className="input-base h-24 resize-y" />
            {errors.resume_headline && <p className="text-red-500 text-sm mt-1">{errors.resume_headline.message}</p>}
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Link className="w-5 h-5 mr-2 text-purple-600" />
          Social Links
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Education Details */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <GraduationCap className="w-5 h-5 mr-2 text-green-600" />
          Education
        </h3>
        {educationFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeEducation(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Degree</label>
              <input type="text" {...register(`education_details.${index}.degree`)} className="input-base" />
              {errors.education_details?.[index]?.degree && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.degree?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School/University</label>
              <input type="text" {...register(`education_details.${index}.school`)} className="input-base" />
              {errors.education_details?.[index]?.school && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.school?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="text" {...register(`education_details.${index}.year`)} className="input-base" />
              {errors.education_details?.[index]?.year && <p className="text-red-500 text-sm mt-1">{errors.education_details[index]?.year?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CGPA/GPA (Optional)</label>
              <input type="text" {...register(`education_details.${index}.cgpa`)} className="input-base" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
              <input type="text" {...register(`education_details.${index}.location`)} className="input-base" />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendEducation({ degree: '', school: '', year: '', cgpa: '', location: '' })}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-3"
        >
          <Plus className="w-5 h-5" />
          <span>Add Education</span>
        </button>
      </div>

      {/* Work Experience Details */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Briefcase className="w-5 h-5 mr-2 text-orange-600" />
          Work Experience
        </h3>
        {experienceFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeExperience(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input type="text" {...register(`experience_details.${index}.role`)} className="input-base" />
              {errors.experience_details?.[index]?.role && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.role?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input type="text" {...register(`experience_details.${index}.company`)} className="input-base" />
              {errors.experience_details?.[index]?.company && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.company?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year/Duration</label>
              <input type="text" {...register(`experience_details.${index}.year`)} className="input-base" />
              {errors.experience_details?.[index]?.year && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.year?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsibilities/Achievements (Bullets)</label>
              {field.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex space-x-2 mb-1">
                  <input type="text" {...register(`experience_details.${index}.bullets.${bulletIndex}`)} className="input-base flex-1" />
                  <button type="button" onClick={() => {
                    const currentBullets = control._fields.experience_details?.[index]?.bullets;
                    if (currentBullets && currentBullets.length > 1) {
                      const newBullets = [...currentBullets];
                      newBullets.splice(bulletIndex, 1);
                      control.setValue(`experience_details.${index}.bullets`, newBullets as any);
                    }
                  }} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const currentBullets = control._fields.experience_details?.[index]?.bullets || [];
                  control.setValue(`experience_details.${index}.bullets`, [...currentBullets, ''] as any);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm mt-1"
              >
                + Add Bullet
              </button>
              {errors.experience_details?.[index]?.bullets && <p className="text-red-500 text-sm mt-1">{errors.experience_details[index]?.bullets?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
              <input type="text" {...register(`experience_details.${index}.location`)} className="input-base" />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendExperience({ role: '', company: '', year: '', bullets: [''], location: '' })}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-3"
        >
          <Plus className="w-5 h-5" />
          <span>Add Experience</span>
        </button>
      </div>

      {/* Skills Details */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Code className="w-5 h-5 mr-2 text-teal-600" />
          Skills
        </h3>
        {skillsFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeSkill(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input type="text" {...register(`skills_details.${index}.category`)} className="input-base" />
              {errors.skills_details?.[index]?.category && <p className="text-red-500 text-sm mt-1">{errors.skills_details[index]?.category?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
              <input
                type="text"
                {...register(`skills_details.${index}.list`, {
                  setValueAs: (value: string) => value.split(',').map(s => s.trim()).filter(Boolean),
                })}
                defaultValue={field.list?.join(', ') || ''}
                className="input-base"
              />
              {errors.skills_details?.[index]?.list && <p className="text-red-500 text-sm mt-1">{errors.skills_details[index]?.list?.message}</p>}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendSkill({ category: '', list: [] })}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-3"
        >
          <Plus className="w-5 h-5" />
          <span>Add Skill Category</span>
        </button>
      </div>

      {/* Projects Details */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="w-5 h-5 mr-2 text-blue-600" />
          Projects
        </h3>
        {projectFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeProject(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
              <input type="text" {...register(`projects_details.${index}.title`)} className="input-base" />
              {errors.projects_details?.[index]?.title && <p className="text-red-500 text-sm mt-1">{errors.projects_details[index]?.title?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL (Optional)</label>
              <input type="url" {...register(`projects_details.${index}.githubUrl`)} className="input-base" />
              {errors.projects_details?.[index]?.githubUrl && <p className="text-red-500 text-sm mt-1">{errors.projects_details[index]?.githubUrl?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Bullets)</label>
              {field.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex space-x-2 mb-1">
                  <input type="text" {...register(`projects_details.${index}.bullets.${bulletIndex}`)} className="input-base flex-1" />
                  <button type="button" onClick={() => {
                    const currentBullets = control._fields.projects_details?.[index]?.bullets;
                    if (currentBullets && currentBullets.length > 1) {
                      const newBullets = [...currentBullets];
                      newBullets.splice(bulletIndex, 1);
                      control.setValue(`projects_details.${index}.bullets`, newBullets as any);
                    }
                  }} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const currentBullets = control._fields.projects_details?.[index]?.bullets || [];
                  control.setValue(`projects_details.${index}.bullets`, [...currentBullets, ''] as any);
                }}
                className="text-blue-600 hover:text-blue-700 text-sm mt-1"
              >
                + Add Bullet
              </button>
              {errors.projects_details?.[index]?.bullets && <p className="text-red-500 text-sm mt-1">{errors.projects_details[index]?.bullets?.message}</p>}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendProject({ title: '', bullets: [''], githubUrl: '' })}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-3"
        >
          <Plus className="w-5 h-5" />
          <span>Add Project</span>
        </button>
      </div>

      {/* Certifications Details */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-yellow-600" />
          Certifications
        </h3>
        {certificationFields.map((field, index) => (
          <div key={field.id} className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2">
            <div className="flex justify-end">
              <button type="button" onClick={() => removeCertification(index)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input type="text" {...register(`certifications_details.${index}.title`)} className="input-base" />
              {errors.certifications_details?.[index]?.title && <p className="text-red-500 text-sm mt-1">{errors.certifications_details[index]?.title?.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea {...register(`certifications_details.${index}.description`)} className="input-base h-16 resize-y" />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => appendCertification({ title: '', description: '' })}
          className="btn-secondary w-full flex items-center justify-center space-x-2 mt-3"
        >
          <Plus className="w-5 h-5" />
          <span>Add Certification</span>
        </button>
      </div>

      <button
        type="submit"
        disabled={isSaving || !isDirty}
        className="btn-primary w-full flex items-center justify-center space-x-2 mt-6"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Saving Profile...</span>
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>Save Profile</span>
          </>
        )}
      </button>
    </form>
  );

  const renderWalletManagement = () => (
    <>
      {/* Wallet Balance */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Wallet className="w-5 h-5 mr-2 text-green-600" />
          Your Wallet Balance
        </h3>
        {loadingWallet ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-gray-600">Loading balance...</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-gray-900">₹{walletBalance.toFixed(2)}</span>
            <button onClick={fetchWalletBalance} className="btn-secondary flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        )}
        <button onClick={() => setShowRedeemModal(true)} disabled={walletBalance < 100} className="btn-primary w-full mt-4 flex items-center justify-center space-x-2">
          <Banknote className="w-5 h-5" />
          <span>Redeem Earnings</span>
        </button>
        {walletBalance < 100 && (
          <p className="text-sm text-red-500 mt-2">Minimum balance for redemption is ₹100.</p>
        )}
      </div>

      {/* Referral Code */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Share2 className="w-5 h-5 mr-2 text-blue-600" />
          Your Referral Code
        </h3>
        {referralCode ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={referralCode}
              readOnly
              className="input-base flex-1 bg-gray-100 cursor-text"
            />
            <button onClick={handleCopyReferralCode} className="btn-secondary flex items-center space-x-2">
              <Copy className="w-4 h-4" />
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        ) : (
          <button onClick={handleGenerateReferralCode} disabled={isGeneratingReferral} className="btn-primary w-full flex items-center justify-center space-x-2">
            {isGeneratingReferral ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Generate Code</span>
              </>
            )}
          </button>
        )}
        <p className="text-sm text-gray-600 mt-2">Share this code with friends. You earn 10% of their first purchase!</p>
      </div>

      {/* Wallet Transactions */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <History className="w-5 h-5 mr-2 text-purple-600" />
          Transaction History
        </h3>
        {loadingTransactions ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-gray-600">Loading transactions...</span>
          </div>
        ) : walletTransactions.length === 0 ? (
          <p className="text-gray-600">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {walletTransactions.map((transaction) => (
              <div key={transaction.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{transaction.type.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-gray-600">{new Date(transaction.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`font-bold text-lg ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{transaction.amount.toFixed(2)}
                  </div>
                </div>
                <button onClick={() => toggleTransactionDetails(transaction.id)} className="text-blue-600 text-sm mt-2 flex items-center space-x-1">
                  <span>{showTransactionDetails.has(transaction.id) ? 'Hide Details' : 'View Details'}</span>
                  {showTransactionDetails.has(transaction.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showTransactionDetails.has(transaction.id) && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-700 space-y-1">
                    {transaction.redeem_method && <p>Method: {transaction.redeem_method}</p>}
                    {transaction.redeem_details && <p>Details: {JSON.stringify(transaction.redeem_details)}</p>}
                    {transaction.transaction_ref && <p>Ref: {transaction.transaction_ref}</p>}
                    {transaction.source_user_id && <p>From User: {transaction.source_user_id}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      <AlertModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        title="Redeem Wallet Balance"
        message=""
        type="info"
      >
        <div className="space-y-4">
          {redeemError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
              <p className="text-red-700 text-sm font-medium">{redeemError}</p>
            </div>
          )}
          {redeemSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
              <p className="text-green-700 text-sm font-medium">Redemption request submitted!</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="Min ₹100"
              min="100"
              max={walletBalance}
              className="input-base"
            />
            <p className="text-xs text-gray-500 mt-1">Available: ₹{walletBalance.toFixed(2)}</p>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Details ({redeemMethod === 'upi' ? 'UPI ID' : 'Bank Account No, IFSC, Name'})</label>
            <textarea
              value={redeemDetails}
              onChange={(e) => setRedeemDetails(e.target.value)}
              placeholder={redeemMethod === 'upi' ? 'yourupi@bank' : 'Account No: XXX, IFSC: YYY, Name: ZZZ'}
              className="input-base h-24 resize-y"
            />
          </div>
          <button onClick={handleRedeemRequest} disabled={isRedeeming} className="btn-primary w-full flex items-center justify-center space-x-2">
            {isRedeeming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Banknote className="w-5 h-5" />
                <span>Submit Request</span>
              </>
            )}
          </button>
        </div>
      </AlertModal>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto dark:bg-dark-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {currentView === 'profile' ? 'Manage Your Profile' : 'Wallet & Referrals'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {currentView === 'profile' ? 'Update your personal information, education, and experience.' : 'View your earnings, referral code, and transaction history.'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-dark-300">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setCurrentView('profile')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                currentView === 'profile'
                  ? 'border-blue-500 text-blue-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-dark-200'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setCurrentView('wallet')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                currentView === 'wallet'
                  ? 'border-blue-500 text-blue-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-dark-200'
              }`}
            >
              Wallet & Referrals
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentView === 'profile' ? renderProfileManagement() : renderWalletManagement()}
        </div>
      </div>
    </div>
  );
};
```