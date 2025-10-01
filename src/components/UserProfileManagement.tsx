// src/components/UserProfileManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User as UserIcon,
  Linkedin,
  Github,
  Briefcase,
  Code,
  Award,
  GraduationCap,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Wallet,
  Sparkles,
  ArrowRight,
  Target,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { FileUpload } from './FileUpload';
import { ResumeData, ExtractionResult } from '../types/resume';
import { AlertModal } from './AlertModal';
import { DeviceManagement } from './security/DeviceManagement';
import { supabase } from '../lib/supabaseClient';

// Mock parsing service
const mockPaymentService = {
  parseResumeWithAI: async (resumeText: string): Promise<ResumeData> => {
    return {
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john.doe@example.com',
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
      location: 'San Francisco, CA',
      targetRole: 'Software Engineer',
      summary: 'Highly motivated software engineer with 5 years of experience in web development.',
      education: [
        { degree: 'M.Sc. Computer Science', school: 'University of Example', year: '2020', cgpa: '3.9', location: 'Example City' },
      ],
      workExperience: [
        { role: 'Senior Software Engineer', company: 'Tech Solutions Inc.', year: '2022 - Present', bullets: ['Developed scalable microservices'] },
      ],
      projects: [
        { title: 'E-commerce Platform', bullets: ['Developed a full-stack e-commerce platform'] },
      ],
      skills: [
        { category: 'Languages', count: 3, list: ['JavaScript', 'Python', 'Java'] },
      ],
      certifications: [{ title: 'AWS Certified Developer', description: 'Certified in AWS development practices.' }],
      achievements: ['Awarded Employee of the Year'],
    };
  },
};

// Zod Schemas
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
  bullets: z.array(z.string().min(1, 'Bullet point cannot be empty')).min(1, 'At least one bullet point is required'),
});

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  bullets: z.array(z.string().min(1, 'Bullet point cannot be empty')).min(1, 'At least one bullet point is required'),
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
  education_details: z.array(educationSchema),
  experience_details: z.array(workExperienceSchema),
  projects_details: z.array(projectSchema),
  skills_details: z.array(skillSchema),
  certifications_details: z.array(certificationSchema),
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

  const { fields: educationFields, append: appendEducation, remove: removeEducation } = useFieldArray({ control, name: 'education_details' });
  const { fields: experienceFields, append: appendExperience, remove: removeExperience, update: updateExperience } = useFieldArray({ control, name: 'experience_details' });
  const { fields: projectFields, append: appendProject, remove: removeProject, update: updateProject } = useFieldArray({ control, name: 'projects_details' });
  const { fields: skillFields, append: appendSkill, remove: removeSkill, update: updateSkill } = useFieldArray({ control, name: 'skills_details' });
  const { fields: certificationFields, append: appendCertification, remove: removeCertification } = useFieldArray({ control, name: 'certifications_details' });

  useEffect(() => {
    if (viewMode) {
      setActiveTab(viewMode);
    }
  }, [viewMode]);

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
      const resumeData: ResumeData = await mockPaymentService.parseResumeWithAI(result.text);

      const newFormData: ProfileFormData = {
        full_name: resumeData.name || '',
        email_address: resumeData.email || '',
        phone: resumeData.phone || '',
        linkedin_profile: resumeData.linkedin || '',
        github_profile: resumeData.github || '',
        resume_headline: resumeData.summary || '',
        current_location: resumeData.location || '',
        education_details: resumeData.education || [],
        experience_details: resumeData.workExperience || [],
        projects_details: resumeData.projects || [],
        skills_details: resumeData.skills || [],
        certifications_details: resumeData.certifications?.map(cert =>
          typeof cert === 'string' ? { title: cert, description: '' } : cert
        ) || [],
      };

      // ✅ Reset entire form — replaces arrays instead of appending
      reset(newFormData, { keepDefaultValues: false });

      setAlertContent({
        title: 'Resume Parsed!',
        message: 'Your resume data has been pre-filled into the form.',
        type: 'success'
      });
      setShowAlert(true);
    } catch (error: any) {
      setAlertContent({
        title: 'Parsing Failed',
        message: error.message || 'Failed to parse resume with AI. Please try again or fill manually.',
        type: 'error'
      });
      setShowAlert(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header, Tabs, Form, Wallet, Security */}
        {/* ... keep your original UI rendering logic here ... */}
      </div>
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertContent.title}
        message={alertContent.message}
        type={alertContent.type}
      />
    </div>
  );
};
