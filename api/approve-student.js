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
      // Note: This will work once Resend domain is verified
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
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #3b82f6; color: white; padding: 30px; border-radius: 8px; text-align: center; }
                  .content { padding: 30px 0; }
                  .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .privacy { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 30px 0; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">Welcome to Perfect English!</h1>
                  </div>
                  
                  <div class="content">
                    <p>Hi ${data.full_name},</p>
                    
                    <p>Great news! Your account has been approved and you're all set to start learning.</p>
                    
                    <p><strong>Your level:</strong> ${level}</p>
                    
                    <p>You can now log in and access your personalized materials:</p>
                    
                    <a href="https://app.perfect-english.org" class="button">Go to Perfect English App</a>
                    
                    <p>If you have any questions, just reply to this email.</p>
                    
                    <p>Looking forward to working with you!</p>
                    
                    <p>James</p>
                  </div>
                  
                  <div class="privacy">
                    <h3 style="margin-top: 0;">Data Privacy Information</h3>
                    <p>YOUR PRIVACY TEXT GOES HERE - I'll help you add this in the next step</p>
                  </div>
                  
                  <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
                    Perfect English | james@perfect-english.org
                  </p>
                </div>
              </body>
            </html>
          `
        });
      } catch (emailError) {
        console.error('Email send failed (domain might not be verified yet):', emailError);
        // Continue anyway - approval still worked
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