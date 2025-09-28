import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AutoApplyRequest {
  jobId: string;
  optimizedResumeId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { jobId, optimizedResumeId }: AutoApplyRequest = await req.json()

    // Validate input
    if (!jobId || !optimizedResumeId) {
      throw new Error('Missing jobId or optimizedResumeId')
    }

    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error('Job not found')
    }

    // Get user profile for auto-apply
    const { data: userProfile, error: profileError } = await supabase
      .rpc('get_user_auto_apply_profile', { user_uuid: user.id })

    if (profileError || !userProfile || userProfile.length === 0) {
      throw new Error('User profile not found or incomplete')
    }

    const profile = userProfile[0]

    // Check if profile is complete for auto-apply
    const { data: isComplete, error: completeError } = await supabase
      .rpc('is_profile_complete_for_auto_apply', { user_uuid: user.id })

    if (completeError || !isComplete) {
      throw new Error('User profile is incomplete for auto-apply. Please complete your profile first.')
    }

    // Get optimized resume
    const { data: optimizedResume, error: resumeError } = await supabase
      .from('optimized_resumes')
      .select('*')
      .eq('id', optimizedResumeId)
      .eq('user_id', user.id)
      .single()

    if (resumeError || !optimizedResume) {
      throw new Error('Optimized resume not found')
    }

    // Create auto apply log entry (pending status)
    const { data: autoApplyLog, error: logError } = await supabase
      .from('auto_apply_logs')
      .insert({
        user_id: user.id,
        job_listing_id: jobId,
        optimized_resume_id: optimizedResumeId,
        application_date: new Date().toISOString(),
        status: 'pending',
        form_data_snapshot: {
          full_name: profile.full_name,
          email: profile.email_address,
          phone: profile.phone,
          linkedin: profile.linkedin_profile_url,
          github: profile.github_profile_url,
          headline: profile.resume_headline,
          location: profile.current_location,
          education: profile.education_details,
          experience: profile.experience_details,
          skills: profile.skills_details
        }
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating auto apply log:', logError)
      throw new Error('Failed to initiate auto-apply process')
    }

    // Simulate auto-apply process
    // In a real implementation, this would:
    // 1. Navigate to the application URL
    // 2. Fill out the form using the profile data
    // 3. Upload the optimized resume
    // 4. Submit the application
    // 5. Capture a screenshot of the confirmation
    // 6. Upload the screenshot to Supabase Storage

    try {
      // Simulate auto-apply success
      const applicationSuccess = Math.random() > 0.3 // 70% success rate for simulation

      if (applicationSuccess) {
        // Update status to submitted
        const { error: updateError } = await supabase
          .from('auto_apply_logs')
          .update({
            status: 'submitted',
            screenshot_url: `https://example.com/screenshots/success_${autoApplyLog.id}.png` // Placeholder
          })
          .eq('id', autoApplyLog.id)

        if (updateError) {
          console.error('Error updating auto apply log to submitted:', updateError)
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Application submitted successfully',
            applicationId: autoApplyLog.id,
            status: 'submitted',
            screenshotUrl: `https://example.com/screenshots/success_${autoApplyLog.id}.png`,
            resumeUrl: optimizedResume.pdf_url
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        )
      } else {
        // Update status to failed
        const { error: updateError } = await supabase
          .from('auto_apply_logs')
          .update({
            status: 'failed',
            error_message: 'Simulated application failure - website may be down or changed'
          })
          .eq('id', autoApplyLog.id)

        if (updateError) {
          console.error('Error updating auto apply log to failed:', updateError)
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Auto-apply failed. Please try manual apply.',
            applicationId: autoApplyLog.id,
            status: 'failed',
            error: 'Simulated application failure - website may be down or changed',
            fallbackUrl: job.application_link,
            resumeUrl: optimizedResume.pdf_url
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          },
        )
      }

    } catch (applyError) {
      console.error('Error during auto-apply process:', applyError)

      // Update status to failed
      await supabase
        .from('auto_apply_logs')
        .update({
          status: 'failed',
          error_message: applyError.message || 'Unknown error during auto-apply'
        })
        .eq('id', autoApplyLog.id)

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Auto-apply failed. Please try manual apply.',
          applicationId: autoApplyLog.id,
          status: 'failed',
          error: applyError.message || 'Unknown error during auto-apply',
          fallbackUrl: job.application_link,
          resumeUrl: optimizedResume.pdf_url
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        },
      )
    }

  } catch (error) {
    console.error('Error in auto-apply function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})