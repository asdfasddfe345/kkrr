import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wallet,
  CreditCard,
  ArrowUpRight,
  Banknote,
  Copy,
  Gift,
  TrendingUp,
  FileText,
  Plus,
  Briefcase,
  GraduationCap,
  Target,
  Award,
  MapPin,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';
import { Education, WorkExperience, Skill, Project, Certification } from '../types/resume';

// --- Zod Schema for Validation ---
const profileSchema = z.object({
  full_name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email_address: z.string()
    .email('Please enter a valid email address'),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), {
      message: 'Please enter a valid phone number',
    }),
  linkedin_profile: z.string()
    .optional()
    .refine((val) => !val || val.includes('linkedin.com'), {
      message: 'Please enter a valid LinkedIn URL',
    }),
  github_profile: z.string()
    .optional()
    .refine((val) => !val || /^https:\/\/github\.com\/[a-zA-Z0-9_-]+$/.test(val), {
      message: 'Please enter a valid GitHub URL (e.g., https://github.com/yourusername)',
    }),
  resume_headline: z.string().optional(),
  current_location: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileManagementProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'profile' | 'wallet';
  walletRefreshKey?: number;
  setWalletRefreshKey?: React.Dispatch<React.SetStateAction<number>>; // Add setter prop
}

export const UserProfileManagement: React.FC<UserProfileManagementProps> = ({
  isOpen,
  onClose,
  viewMode = 'profile',
  walletRefreshKey,
  setWalletRefreshKey // Destructure setter prop
}) => {
  console.log('UserProfileManagement: isOpen prop received:', isOpen); 
  const { user, revalidateUserSession, markProfilePromptSeen } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [pendingEarnings, setPendingEarnings] = useState<number>(0);
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redeemDetails, setRedeemDetails] = useState({
    upi_id: '',
    bank_account: '',
    ifsc_code: '',
    account_holder_name: ''
  });
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // NEW: State for resume details
  const [education, setEducation] = useState<Education[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [certifications, setCertifications] = useState<(string | Certification)[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['personal']));

  // Helper functions for managing dynamic lists
  const addEducation = () => {
    setEducation([...education, { degree: '', school: '', year: '', cgpa: '', location: '' }]);
  };

  const removeEducation = (index: number) => {
    if (education.length > 1) {
      setEducation(education.filter((_, i) => i !== index));
    }
  };

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
  };

  const addWorkExperience = () => {
    setWorkExperience([...workExperience, { role: '', company: '', year: '', bullets: [''] }]);
  };

  const removeWorkExperience = (index: number) => {
    if (workExperience.length > 1) {
      setWorkExperience(workExperience.filter((_, i) => i !== index));
    }
  };

  const updateWorkExperience = (index: number, field: keyof WorkExperience, value: any) => {
    const updated = [...workExperience];
    updated[index] = { ...updated[index], [field]: value };
    setWorkExperience(updated);
  };

  const addWorkBullet = (workIndex: number) => {
    const updated = [...workExperience];
    updated[workIndex].bullets.push('');
    setWorkExperience(updated);
  };

  const updateWorkBullet = (workIndex: number, bulletIndex: number, value: string) => {
    const updated = [...workExperience];
    updated[workIndex].bullets[bulletIndex] = value;
    setWorkExperience(updated);
  };

  const removeWorkBullet = (workIndex: number, bulletIndex: number) => {
    const updated = [...workExperience];
    if (updated[workIndex].bullets.length > 1) {
      updated[workIndex].bullets.splice(bulletIndex, 1);
      setWorkExperience(updated);
    }
  };

  const addSkillCategory = () => {
    setSkills([...skills, { category: '', count: 0, list: [] }]);
  };

  const removeSkillCategory = (index: number) => {
    if (skills.length > 1) {
      setSkills(skills.filter((_, i) => i !== index));
    }
  };

  const updateSkillCategory = (index: number, field: keyof Skill, value: any) => {
    const updated = [...skills];
    if (field === 'list') {
      updated[index] = { ...updated[index], [field]: value, count: value.length };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSkills(updated);
  };

  const addSkillToCategory = (categoryIndex: number, skill: string) => {
    if (skill.trim()) {
      const updated = [...skills];
      updated[categoryIndex].list.push(skill.trim());
      updated[categoryIndex].count = updated[categoryIndex].list.length;
      setSkills(updated);
    }
  };

  const removeSkillFromCategory = (categoryIndex: number, skillIndex: number) => {
    const updated = [...skills];
    updated[categoryIndex].list.splice(skillIndex, 1);
    updated[categoryIndex].count = updated[categoryIndex].list.length;
    setSkills(updated);
  };

  const addProject = () => {
    setProjects([...projects, { title: '', bullets: [''] }]);
  };

  const removeProject = (index: number) => {
    if (projects.length > 1) {
      setProjects(projects.filter((_, i) => i !== index));
    }
  };

  const updateProject = (index: number, field: keyof Project, value: any) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  };

  const addProjectBullet = (projectIndex: number) => {
    const updated = [...projects];
    updated[projectIndex].bullets.push('');
    setProjects(updated);
  };

  const updateProjectBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    const updated = [...projects];
    updated[projectIndex].bullets[bulletIndex] = value;
    setProjects(updated);
  };

  const removeProjectBullet = (projectIndex: number, bulletIndex: number) => {
    const updated = [...projects];
    if (updated[projectIndex].bullets.length > 1) {
      updated[projectIndex].bullets.splice(bulletIndex, 1);
      setProjects(updated);
    }
  };

  const addCertification = () => {
    setCertifications([...certifications, '']);
  };

  const removeCertification = (index: number) => {
    if (certifications.length > 1) {
      setCertifications(certifications.filter((_, i) => i !== index));
    }
  };

  const updateCertification = (index: number, value: string | Certification) => {
    const updated = [...certifications];
    updated[index] = value;
    setCertifications(updated);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Function to fetch wallet data from Supabase
  const fetchWalletData = async () => {
    if (!user) return;
    console.log('Fetching wallet data for user ID:', user.id);

    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching wallet data:', error);
        return;
      }
      console.log('Raw fetched transactions:', transactions);

      const completedTransactions = transactions?.filter(t => t.status === 'completed') || [];
      console.log('Filtered completed transactions (for balance):', completedTransactions);

      const balance = completedTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
      setWalletBalance(Math.max(0, balance));
      console.log('Calculated wallet balance:', balance);

      const pendingTransactions = transactions?.filter(t => t.status === 'pending' && parseFloat(t.amount) > 0) || [];
      console.log('Filtered pending transactions (for earnings):', pendingTransactions);

      const pending = pendingTransactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
      setPendingEarnings(pending);
      console.log('Calculated pending earnings:', pending);

    } catch (err) {
      console.error('Error fetching wallet data:', err);
    }
  };

  // Function to handle copying referral code to clipboard
  const handleCopyReferralCode = async () => {
    if (user?.referralCode) {
      try {
        await navigator.clipboard.writeText(user.referralCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy referral code:', err);
        const textArea = document.createElement('textarea');
        textArea.value = user.referralCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  // Pre-fill form with current user data when modal opens or user changes
  useEffect(() => {
    if (user && isOpen) {
      setValue('full_name', user.name);
      setValue('email_address', user.email);
      setValue('phone', user.phone || '');
      setValue('linkedin_profile', user.linkedin || '');
      setValue('github_profile', user.github || '');
      setValue('resume_headline', user.resumeHeadline || '');
      setValue('current_location', user.currentLocation || '');
      
      // Initialize resume details with existing data
      setEducation(user.educationDetails || [{ degree: '', school: '', year: '', cgpa: '', location: '' }]);
      setWorkExperience(user.experienceDetails || [{ role: '', company: '', year: '', bullets: [''] }]);
      setSkills(user.skillsDetails || [{ category: '', count: 0, list: [] }]);
      setProjects(user.projectsDetails || [{ title: '', bullets: [''] }]);
      setCertifications(user.certificationsDetails || ['']);
      
      // Initial fetch when modal opens
      fetchWalletData();
    } else if (!isOpen) {
        reset();
        setError(null);
        setSuccess(false);
        setShowRedeemForm(false);
        setRedeemSuccess(false);
        // Reset resume details
        setEducation([{ degree: '', school: '', year: '', cgpa: '', location: '' }]);
        setWorkExperience([{ role: '', company: '', year: '', bullets: [''] }]);
        setSkills([{ category: '', count: 0, list: [] }]);
        setProjects([{ title: '', bullets: [''] }]);
        setCertifications(['']);
        setExpandedSections(new Set(['personal']));
    }
  }, [user, isOpen, setValue, reset]);

  // NEW useEffect: Listen for walletRefreshKey changes to refetch wallet data
  useEffect(() => {
    // Only fetch if the modal is open and the key actually changes (and user exists)
    // Add walletRefreshKey !== undefined to prevent running on initial component mount if key is not provided yet
    if (user && isOpen && walletRefreshKey !== undefined) {
      console.log(`walletRefreshKey changed to ${walletRefreshKey}. Refetching wallet data.`);
      fetchWalletData();
    }
  }, [walletRefreshKey, user, isOpen]); // Add user and isOpen as dependencies

  // Effect for referral code generation
  useEffect(() => {
    const ensureReferralCode = async () => {
      if (user && isOpen && !user.referralCode) {
        console.log('User has no referral code, attempting to generate via Edge Function (fetch API)...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.error('No active session found for referral code generation.');
            setError('Authentication required to generate referral code.');
            return;
          }

          const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-referral-code`;
          if (!import.meta.env.VITE_SUPABASE_URL) {
            throw new Error('VITE_SUPABASE_URL is not defined in your environment variables.');
          }

          const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId: user.id }),
          });

          const result = await response.json();

          if (!response.ok) {
            console.error('Error generating referral code via Edge Function:', result.error || response.statusText);
            setError('Failed to generate referral code: ' + (result.error || response.statusText));
          } else {
            console.log('Referral code generated successfully via Edge Function:', result.referral_code);
            await revalidateUserSession();
          }
        } catch (err) {
          console.error('Fetch call to generate-referral-code Edge Function failed:', err);
          setError('An unexpected error occurred during referral code generation.');
        }
      }
    };

    if (isOpen) {
      ensureReferralCode();
    }
  }, [user, isOpen, revalidateUserSession]);


  const onSubmit = async (data: ProfileFormData) => {
    if (!user) {
      setError('User not authenticated. Please log in again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Filter out empty entries from arrays
      const cleanedEducation = education.filter(edu => 
        edu.degree.trim() && edu.school.trim() && edu.year.trim()
      );
      const cleanedWorkExperience = workExperience.filter(work => 
        work.role.trim() && work.company.trim() && work.year.trim()
      );
      const cleanedSkills = skills.filter(skill => 
        skill.category.trim() && skill.list.some(s => s.trim())
      ).map(skill => ({
        ...skill,
        list: skill.list.filter(s => s.trim()),
        count: skill.list.filter(s => s.trim()).length
      }));
      const cleanedProjects = projects.filter(project => 
        project.title.trim() && project.bullets.some(b => b.trim())
      ).map(project => ({
        ...project,
        bullets: project.bullets.filter(b => b.trim())
      }));
      const cleanedCertifications = certifications.filter(cert => {
        if (typeof cert === 'string') {
          return cert.trim();
        }
        return cert.title?.trim();
      });

      await authService.updateUserProfile(user.id, {
        full_name: data.full_name,
        email_address: data.email_address,
        phone: data.phone || undefined,
        linkedin_profile: data.linkedin_profile || undefined,
        github_profile: data.github_profile || undefined,
        resume_headline: data.resume_headline || undefined,
        current_location: data.current_location || undefined,
        education_details: cleanedEducation.length > 0 ? cleanedEducation : undefined,
        experience_details: cleanedWorkExperience.length > 0 ? cleanedWorkExperience : undefined,
        skills_details: cleanedSkills.length > 0 ? cleanedSkills : undefined,
        projects_details: cleanedProjects.length > 0 ? cleanedProjects : undefined,
        certifications_details: cleanedCertifications.length > 0 ? cleanedCertifications : undefined,
      });

      await revalidateUserSession();
      await markProfilePromptSeen();

      setSuccess(true);
      
      // Close the modal after successful update and state synchronization
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle redemption submission
  const handleRedeemSubmit = async () => {
    if (!user) {
      setError('User not authenticated. Please log in again.');
      return;
    }

    if (walletBalance < 100) {
      setError('Minimum redemption amount is ₹100.');
      return;
    }

    let redemptionData: any;
    if (redeemMethod === 'upi') {
      if (!redeemDetails.upi_id) {
        setError('UPI ID is required.');
        return;
      }
      redemptionData = { method: 'upi', details: { upi_id: redeemDetails.upi_id } };
    } else { // bank_transfer
      if (!redeemDetails.account_holder_name || !redeemDetails.bank_account || !redeemDetails.ifsc_code) {
        setError('All bank transfer details are required.');
        return;
      }
      redemptionData = { method: 'bank_transfer', details: redeemDetails };
    }

    setIsRedeeming(true);
    setError(null);
    setRedeemSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found for redemption.');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redeem-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          amount: walletBalance,
          method: redemptionData.method,
          details: redemptionData.details,
        }),
      });
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || response.statusText);
      }

      setWalletBalance(0);
      setPendingEarnings(prev => prev + walletBalance);

      setRedeemSuccess(true);
      setShowRedeemForm(false);

      setTimeout(() => {
        setRedeemSuccess(false);
      }, 5000);

      // Re-fetch wallet data to ensure it's fully up-to-date after redemption
      fetchWalletData();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit redemption request.');
      console.error('Redemption error:', err);
    } finally {
      setIsRedeeming(false);
    }
  };


  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm dark:bg-black/80" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto dark:bg-dark-100 dark:shadow-dark-xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-neon-cyan">
              {viewMode === 'profile' ? <User className="w-8 h-8 text-white" /> : <Wallet className="w-8 h-8 text-white" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {viewMode === 'profile' ? 'Profile Settings' : 'Referral & Wallet'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {viewMode === 'profile' ? 'Update your personal information and social profiles' : 'Manage your earnings and referral program'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Inline Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 flex-shrink-0 mt-0.5" />
                <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">Profile updated successfully!</p>
              </div>
            </div>
          )}

          {/* Redemption Success Message */}
          {redeemSuccess && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-neon-blue-500/10 dark:border-neon-blue-400/50">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-neon-blue-400 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-700 dark:text-neon-blue-300 text-sm font-medium">Redemption request submitted successfully!</p>
                  <p className="text-blue-600 dark:text-neon-blue-400 text-xs mt-1">The money will be credited to your account within 2 hours. We understand.</p>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Conditional rendering based on viewMode */}
          {viewMode === 'profile' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => toggleSection('personal')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Personal Information
                  </h3>
                  {expandedSections.has('personal') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('personal') && (
                <div className="space-y-4 pl-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          {...register('full_name')}
                          type="text"
                          placeholder="Enter your full name"
                          className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 ${
                            errors.full_name ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100'
                          }`}
                        />
                      </div>
                      {errors.full_name && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          {...register('email_address')}
                          type="email"
                          placeholder="your.email@example.com"
                          className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 ${
                            errors.email_address ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100'
                          }`}
                        />
                      </div>
                      {errors.email_address && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.email_address.message}
                        </p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          {...register('phone')}
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 ${
                            errors.phone ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100'
                          }`}
                        />
                      </div>
                      {errors.phone && (
                        <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    {/* Current Location */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Location
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <input
                          {...register('current_location')}
                          type="text"
                          placeholder="City, State/Country"
                          className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resume Headline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Professional Summary / Career Objective
                    </label>
                    <textarea
                      {...register('resume_headline')}
                      placeholder="Brief professional summary or career objective..."
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100 h-24 resize-none"
                    />
                  </div>
                </div>
                )}
              </div>

              {/* Social Profiles Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('social')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Linkedin className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Social Profiles
                  </h3>
                  {expandedSections.has('social') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('social') && (
                <div className="space-y-4 pl-4">
                  {/* LinkedIn */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      LinkedIn Profile URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Linkedin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        {...register('linkedin_profile')}
                        type="url"
                        placeholder="https://linkedin.com/in/yourprofile"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 ${
                          errors.linkedin_profile ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100'
                        }`}
                      />
                    </div>
                    {errors.linkedin_profile && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.linkedin_profile.message}
                      </p>
                    )}
                  </div>

                  {/* GitHub */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      GitHub Profile URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Github className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        {...register('github_profile')}
                        type="url"
                        placeholder="https://github.com/yourusername"
                        className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 dark:bg-dark-200 dark:text-gray-100 ${
                          errors.github_profile ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-300 bg-gray-50 focus:bg-white dark:border-dark-300 dark:focus:bg-dark-100'
                        }`}
                      />
                    </div>
                    {errors.github_profile && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.github_profile.message}
                      </p>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* Education Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('education')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <GraduationCap className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Education
                  </h3>
                  {expandedSections.has('education') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('education') && (
                <div className="space-y-4 pl-4">
                  {education.map((edu, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Education #{index + 1}</h4>
                        {education.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEducation(index)}
                            className="text-red-600 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                            placeholder="Bachelor of Technology"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Institution</label>
                          <input
                            type="text"
                            value={edu.school}
                            onChange={(e) => updateEducation(index, 'school', e.target.value)}
                            placeholder="University Name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year</label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={(e) => updateEducation(index, 'year', e.target.value)}
                            placeholder="2020-2024"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CGPA/GPA</label>
                          <input
                            type="text"
                            value={edu.cgpa || ''}
                            onChange={(e) => updateEducation(index, 'cgpa', e.target.value)}
                            placeholder="8.5/10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addEducation}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Another Education
                  </button>
                </div>
                )}
              </div>

              {/* Skills Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('skills')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Skills
                  </h3>
                  {expandedSections.has('skills') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('skills') && (
                <div className="space-y-4 pl-4">
                  {skills.map((skillCategory, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Skill Category #{index + 1}</h4>
                        {skills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSkillCategory(index)}
                            className="text-red-600 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category Name</label>
                        <input
                          type="text"
                          value={skillCategory.category}
                          onChange={(e) => updateSkillCategory(index, 'category', e.target.value)}
                          placeholder="e.g., Programming Languages, Frameworks"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills</label>
                        <div className="flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 border border-gray-300 rounded-lg dark:border-dark-300">
                          {skillCategory.list.map((skill, skillIndex) => (
                            <span
                              key={skillIndex}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => removeSkillFromCategory(index, skillIndex)}
                                className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a skill and press Enter"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.target as HTMLInputElement;
                                if (input.value.trim()) {
                                  addSkillToCategory(index, input.value.trim());
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                              if (input.value.trim()) {
                                addSkillToCategory(index, input.value.trim());
                                input.value = '';
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addSkillCategory}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Skill Category
                  </button>
                </div>
                )}
              </div>

              {/* Work Experience Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('experience')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Work Experience
                  </h3>
                  {expandedSections.has('experience') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('experience') && (
                <div className="space-y-4 pl-4">
                  {workExperience.map((work, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Experience #{index + 1}</h4>
                        {workExperience.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWorkExperience(index)}
                            className="text-red-600 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title</label>
                          <input
                            type="text"
                            value={work.role}
                            onChange={(e) => updateWorkExperience(index, 'role', e.target.value)}
                            placeholder="Software Engineer"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company</label>
                          <input
                            type="text"
                            value={work.company}
                            onChange={(e) => updateWorkExperience(index, 'company', e.target.value)}
                            placeholder="TechCorp Inc."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration</label>
                          <input
                            type="text"
                            value={work.year}
                            onChange={(e) => updateWorkExperience(index, 'year', e.target.value)}
                            placeholder="Jan 2023 - Present"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Responsibilities</label>
                        {work.bullets.map((bullet, bulletIndex) => (
                          <div key={bulletIndex} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => updateWorkBullet(index, bulletIndex, e.target.value)}
                              placeholder="Describe your responsibility/achievement"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                            />
                            {work.bullets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeWorkBullet(index, bulletIndex)}
                                className="text-red-600 hover:text-red-700 p-2"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addWorkBullet(index)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Responsibility
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addWorkExperience}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Work Experience
                  </button>
                </div>
                )}
              </div>

              {/* Projects Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('projects')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Projects
                  </h3>
                  {expandedSections.has('projects') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('projects') && (
                <div className="space-y-4 pl-4">
                  {projects.map((project, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">Project #{index + 1}</h4>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProject(index)}
                            className="text-red-600 hover:text-red-700 p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Title</label>
                          <input
                            type="text"
                            value={project.title}
                            onChange={(e) => updateProject(index, 'title', e.target.value)}
                            placeholder="E-commerce Website"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GitHub URL</label>
                          <input
                            type="url"
                            value={project.githubUrl || ''}
                            onChange={(e) => updateProject(index, 'githubUrl', e.target.value)}
                            placeholder="https://github.com/username/repo"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Details</label>
                        {project.bullets.map((bullet, bulletIndex) => (
                          <div key={bulletIndex} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => updateProjectBullet(index, bulletIndex, e.target.value)}
                              placeholder="Describe what you built/achieved"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                            />
                            {project.bullets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeProjectBullet(index, bulletIndex)}
                                className="text-red-600 hover:text-red-700 p-2"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addProjectBullet(index)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Detail
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addProject}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Project
                  </button>
                </div>
                )}
              </div>

              {/* Certifications Section */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleSection('certifications')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors dark:bg-dark-200 dark:hover:bg-dark-300"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Certifications
                  </h3>
                  {expandedSections.has('certifications') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {expandedSections.has('certifications') && (
                <div className="space-y-4 pl-4">
                  {certifications.map((cert, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={typeof cert === 'string' ? cert : cert.title}
                        onChange={(e) => updateCertification(index, e.target.value)}
                        placeholder="AWS Certified Solutions Architect"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      />
                      {certifications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCertification(index)}
                          className="text-red-600 hover:text-red-700 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addCertification}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Certification
                  </button>
                </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-6 border-t border-gray-200 dark:border-dark-300">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-neon-cyan ${
                    isLoading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 hover:shadow-neon-cyan'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Updating Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Complete Profile</span>
                    </>
                  )}
                </button>
              </div>

              {/* Usage Statistics Section - Show individual user stats */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Usage Statistics
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Personal Resume Count */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 dark:from-neon-cyan-500/10 dark:to-neon-blue-500/10 dark:border-neon-cyan-400/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-neon-cyan-300">My Resumes Created</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-neon-cyan-400">
                          {user?.resumesCreatedCount || 0}
                        </p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-full dark:bg-neon-cyan-500/20">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-gray-300 mt-2">
                      Your personal resume creation journey
                    </p>
                  </div>

                  {/* Member Since */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 dark:from-neon-purple-500/10 dark:to-neon-pink-500/10 dark:border-neon-purple-400/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700 dark:text-neon-purple-300">Member Since</p>
                        <p className="text-xl font-bold text-purple-900 dark:text-neon-purple-400">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short' 
                          }) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-full dark:bg-neon-purple-500/20">
                        <User className="w-6 h-6 text-purple-600 dark:text-neon-purple-400" />
                      </div>
                    </div>
                    <p className="text-xs text-purple-600 dark:text-gray-300 mt-2">
                      Part of the PrimoBoost family
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
          )} {/* End viewMode === 'profile' conditional block */}


          {/* Wallet Section */}
          {viewMode === 'wallet' && (
            <div className="space-y-6">
              {/* Referral Code Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Gift className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                  Your Referral Code
                </h3>

                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 mb-6 dark:from-dark-200 dark:to-dark-300 dark:border-neon-purple-400/50">
                  <div className="text-center">
                    <div className="bg-white border border-purple-300 rounded-lg p-4 mb-4 inline-block dark:bg-dark-100 dark:border-neon-purple-400">
                      <div className="text-2xl font-bold text-purple-700 dark:text-neon-purple-400 tracking-wider">
                        {user?.referralCode || 'Loading...'}
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={handleCopyReferralCode}
                        className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all min-h-[44px] shadow-lg ${
                          copySuccess
                            ? 'bg-green-600 text-white dark:bg-neon-cyan-500 dark:shadow-neon-cyan'
                            : 'bg-purple-600 hover:bg-purple-700 text-white dark:bg-neon-purple-500 dark:hover:bg-neon-purple-400 dark:shadow-neon-purple'
                        }`}
                      >
                        {copySuccess ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                      
                      {/* The "Share" button and its logic has been removed below */}
                      
                    </div>
                    
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        🎉 <strong>Earn 10%</strong> every time your friend purchases a plan with your code!
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Your friends also get ₹10 bonus when they use your referral code
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Wallet className="w-5 h-5 mr-2 text-green-600 dark:text-neon-cyan-400" />
                  Wallet & Earnings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Current Balance */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 dark:from-neon-cyan-500/10 dark:to-neon-cyan-500/20 dark:border-neon-cyan-400/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-neon-cyan-300">Current Balance</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-neon-cyan-400">₹{walletBalance.toFixed(2)}</p>
                      </div>
                      <div className="bg-green-100 p-3 rounded-full dark:bg-neon-cyan-500/20">
                        <Banknote className="w-6 h-6 text-green-600 dark:text-neon-cyan-400" />
                      </div>
                    </div>
                  </div>

                  {/* Pending Earnings */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 dark:from-neon-blue-500/10 dark:to-neon-blue-500/20 dark:border-neon-blue-400/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-neon-blue-300">Pending Earnings</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-neon-blue-400">₹{pendingEarnings.toFixed(2)}</p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-full dark:bg-neon-blue-500/20">
                        <CreditCard className="w-6 h-6 text-blue-600 dark:text-neon-blue-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Redemption Section */}
                {walletBalance >= 100 && !showRedeemForm && (
                  <button
                    onClick={() => setShowRedeemForm(true)}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl dark:from-neon-cyan-500 dark:to-neon-blue-500 dark:hover:from-neon-cyan-400 dark:hover:to-neon-blue-400 dark:shadow-neon-cyan"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                    <span>Redeem ₹{walletBalance.toFixed(2)}</span>
                  </button>
                )}

                {walletBalance < 100 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 dark:bg-orange-900/20 dark:border-orange-500/50">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-orange-800 dark:text-orange-300 font-medium">Minimum Redemption Amount</p>
                        <p className="text-orange-700 dark:text-orange-400 text-sm mt-1">
                          You need at least ₹100 to redeem your earnings. Current balance: ₹{walletBalance.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Redemption Form */}
                {showRedeemForm && (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 dark:bg-dark-200 dark:border-dark-300">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Redeem Earnings</h4>
                    
                    {/* Redemption Method Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Redemption Method
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button" // Important: Prevent form submission if inside a form
                          onClick={() => setRedeemMethod('upi')}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            redeemMethod === 'upi'
                              ? 'border-neon-cyan-500 bg-neon-cyan-50 text-neon-cyan-700 dark:bg-neon-cyan-500/20 dark:border-neon-cyan-400'
                              : 'border-gray-300 hover:border-neon-cyan-300 dark:border-dark-300 dark:hover:border-neon-cyan-400'
                          }`}
                        >
                          <div className="text-center">
                            <CreditCard className="w-6 h-6 mx-auto mb-2" />
                            <span className="font-medium">UPI</span>
                          </div>
                        </button>
                        <button
                          type="button" // Important: Prevent form submission if inside a form
                          onClick={() => setRedeemMethod('bank_transfer')}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            redeemMethod === 'bank_transfer'
                              ? 'border-neon-cyan-500 bg-neon-cyan-50 text-neon-cyan-700 dark:bg-neon-cyan-500/20 dark:border-neon-cyan-400'
                              : 'border-gray-300 hover:border-neon-cyan-300 dark:border-dark-300 dark:hover:border-neon-cyan-400'
                          }`}
                        >
                          <div className="text-center">
                            <Banknote className="w-6 h-6 mx-auto mb-2" />
                            <span className="font-medium">Bank Transfer</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* UPI Details */}
                    {redeemMethod === 'upi' && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          UPI ID
                        </label>
                        <input
                          type="text"
                          value={redeemDetails.upi_id}
                          onChange={(e) => setRedeemDetails(prev => ({ ...prev, upi_id: e.target.value }))}
                          placeholder="yourname@upi"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {/* Bank Transfer Details */}
                    {redeemMethod === 'bank_transfer' && (
                      <div className="space-y-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Account Holder Name
                          </label>
                          <input
                            type="text"
                            value={redeemDetails.account_holder_name}
                            onChange={(e) => setRedeemDetails(prev => ({ ...prev, account_holder_name: e.target.value }))}
                            placeholder="Full name as per bank account"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            value={redeemDetails.bank_account}
                            onChange={(e) => setRedeemDetails(prev => ({ ...prev, bank_account: e.target.value }))}
                            placeholder="Account number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={redeemDetails.ifsc_code}
                            onChange={(e) => setRedeemDetails(prev => ({ ...prev, ifsc_code: e.target.value }))}
                            placeholder="IFSC Code"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <button
                        type="button" // Important: Prevent default form submission
                        onClick={handleRedeemSubmit}
                        disabled={isRedeeming || (redeemMethod === 'upi' && !redeemDetails.upi_id) ||
                                 (redeemMethod === 'bank_transfer' && (!redeemDetails.account_holder_name || !redeemDetails.bank_account || !redeemDetails.ifsc_code))}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2 dark:bg-neon-cyan-500 dark:hover:bg-neon-cyan-400 dark:shadow-neon-cyan"
                      >
                        {isRedeeming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-5 h-5" />
                            <span>Submit Redemption</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button" // Important: Prevent default form submission
                        onClick={() => setShowRedeemForm(false)}
                        className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold rounded-xl transition-colors dark:bg-dark-300 dark:hover:bg-dark-400 dark:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )} {/* End viewMode === 'wallet' conditional block */}


          {/* Info Note (only visible in profile view) */}
          {viewMode === 'profile' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
              <div className="flex items-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2 flex-shrink-0 dark:bg-neon-cyan-400"></div>
                <div className="text-sm text-blue-800 dark:text-neon-cyan-300">
                  <p className="font-medium mb-1">📝 Auto-Resume Population</p>
                  <p className="text-blue-700 dark:text-gray-300">
                    These details will be automatically included in your generated resumes, saving you time during the optimization process.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};