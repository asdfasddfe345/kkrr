// src/components/UserProfileManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User as UserIcon,
  Mail,
  Phone,
  Linkedin,
  Github,
  Briefcase,
  Code,
  Award,
  GraduationCap,
  MapPin,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Wallet,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Info,
  Target,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { paymentService } from '../services/paymentService';
import { FileUpload } from './FileUpload';
import { ResumeData, ExtractionResult } from '../types/resume';
import { AlertModal } from './AlertModal';
import { DeviceManagement } from './security/DeviceManagement';
import { supabase } from '../lib/supabaseClient';

// ... (schemas and mocks unchanged)

// Inside the component
export const UserProfileManagement: React.FC<UserProfileManagementProps> = ({
  isOpen,
  onClose,
  viewMode = 'profile',
  walletRefreshKey,
  setWalletRefreshKey,
}) => {
  const { user, revalidateUserSession, markProfilePromptSeen } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'security'>(viewMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redeemDetails, setRedeemDetails] = useState<{ upiId?: string; bankAccount?: string; ifscCode?: string; accountHolderName?: string }>({});
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertContent, setAlertContent] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>({ title: '', message: '', type: 'info' });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue,
    getValues,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email_address: '',
      phone: '',
      linkedin_profile: '',
      github_profile: '',
      resume_headline: '',
      current_location: '',
      education_details: [],
      experience_details: [],
      projects_details: [],
      skills_details: [],
      certifications_details: [],
    },
  });

  // field arrays setup (unchanged)...

  // ---------------------------
  // FIXED Resume File Upload
  // ---------------------------
  const handleResumeFileUpload = async (result: ExtractionResult) => {
    if (!result.text.trim()) {
      setAlertContent({
        title: 'Upload Failed',
        message: result.extraction_mode === 'OCR'
          ? 'Failed to extract text from image-based PDF. Please upload a searchable PDF or a DOCX/TXT file.'
          : 'Could not extract text from the file. Please try another file or enter manually.',
        type: 'error'
      });
      setShowAlert(true);
      return;
    }

    try {
      console.log('Extracted text for parsing:', result.text);
      const resumeData: ResumeData = await mockPaymentService.parseResumeWithAI(result.text);
      console.log('Parsed Resume Data from mockPaymentService:', resumeData);

      // ✅ Prepare new form data directly
      const newFormData: ProfileFormData = {
        full_name: resumeData.name || '',
        email_address: resumeData.email || '',
        phone: resumeData.phone || '',
        linkedin_profile: resumeData.linkedin || '',
        github_profile: resumeData.github || '',
        resume_headline: resumeData.summary || resumeData.careerObjective || '',
        current_location: resumeData.location || '',
        education_details: resumeData.education || [],
        experience_details: resumeData.workExperience || [],
        projects_details: resumeData.projects || [],
        skills_details: resumeData.skills || [],
        certifications_details: resumeData.certifications?.map(cert =>
          typeof cert === 'string' ? { title: cert, description: '' } : cert
        ) || [],
      };

      console.log('New form data prepared for reset:', newFormData);

      // ✅ Reset entire form, replacing arrays (fixes duplication issue)
      reset(newFormData, { keepDefaultValues: false });

      console.log('Form data AFTER reset:', getValues());

      setAlertContent({
        title: 'Resume Parsed!',
        message: 'Your resume data has been pre-filled into the form.',
        type: 'success'
      });
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error parsing resume with AI:', error);
      setAlertContent({
        title: 'Parsing Failed',
        message: error.message || 'Failed to parse resume with AI. Please try again or fill manually.',
        type: 'error'
      });
      setShowAlert(true);
    }
  };

  // ... (rest of component remains unchanged: submit, redeem, UI rendering)
};
