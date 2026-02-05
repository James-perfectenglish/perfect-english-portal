// api/approve-student.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = 'https://dyxmgicedabvmsbuvxny.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, userId, level } = req.query;

  // Handle approval action
  if (action === 'approve' && userId && level) {
    try {
      // Update the profile
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          approved: true, 
          level: level 
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email to student
      try {
        await resend.emails.send({
          from: 'James at Perfect English <james@perfect-english.org>',
          to: data.email,
          subject: 'Welcome to Perfect English! Your account is ready',
          html: `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
      .header { background: #3b82f6; color: white; padding: 30px 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 28px; }
      .content { padding: 30px 20px; }
      .welcome { margin-bottom: 30px; }
      .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
      .privacy { background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #3b82f6; }
      .privacy h2 { margin-top: 0; color: #3b82f6; font-size: 20px; }
      .privacy p { margin: 12px 0; font-size: 14px; line-height: 1.7; }
      .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; border-top: 1px solid #e5e7eb; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Welcome to Perfect English!</h1>
    </div>
    
    <div class="content">
      <div class="welcome">
        <p>Hi ${data.full_name},</p>
        
        <p>I'm delighted to welcome you to Perfect English! Your account has been approved and you're all set to begin.</p>
        
        <p><strong>Your assigned level: ${level}</strong></p>
        
        <p>The app contains personalised exercises and materials tailored to your level. You can work through them at your own pace, and I'll be here to support you along the way.</p>
        
        <a href="https://app.perfect-english.org" class="button">Access the App</a>
        
        <p>If you have any questions or need help with anything, just reply to this email. I'm here to help!</p>
        
        <p>Looking forward to working together,<br>
        <strong>James</strong></p>
      </div>
      
      <div class="privacy">
        <h2>Your Data Privacy</h2>
        
        <p><strong>What information do we collect?</strong></p>
        <p>We collect your name and email address when you sign up, along with your performance data on exercises (scores, completion times, and progress).</p>
        
        <p><strong>How do we use your information?</strong></p>
        <p>Your data helps me track your progress, identify areas where you might need extra support, and tailor materials to your learning needs. I may use your performance data to improve exercises and create new content.</p>
        
        <p><strong>Who has access to your data?</strong></p>
        <p>Only I (James) have access to your personal information and learning data. Your data is stored securely using Supabase, a trusted data platform. I will never share or sell your information to third parties.</p>
        
        <p><strong>Your rights:</strong></p>
        <p>You can request to view, update, or delete your data at any time by contacting me at james@perfect-english.org. You can also stop using the app whenever you wish.</p>
        
        <p><strong>Data security:</strong></p>
        <p>Your information is stored securely and protected. However, no system is 100% secure, so I can't guarantee absolute security—but I do everything possible to keep your data safe.</p>
        
        <p style="margin-top: 20px;"><em>If you have questions about how your data is used, please don't hesitate to reach out!</em></p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Perfect English</strong><br>
      james@perfect-english.org<br>
      <a href="https://app.perfect-english.org" style="color: #3b82f6; text-decoration: none;">app.perfect-english.org</a></p>
    </div>
  </body>
</html>
          `
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f9fafb; }
              .success { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .icon { font-size: 48px; margin-bottom: 20px; }
              .title { color: #10b981; font-size: 24px; margin-bottom: 20px; }
              .details { color: #666; font-size: 16px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="success">
              <div class="icon">✓</div>
              <div class="title">Student Approved!</div>
              <div class="details">
                <strong>${data.full_name}</strong><br>
                ${data.email}<br><br>
                Level: <strong>${level}</strong><br><br>
                They've been sent a confirmation email and can now access the app.
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error approving student:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(400).json({ error: 'Invalid request' });
}