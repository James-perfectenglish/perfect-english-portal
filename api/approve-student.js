// api/approve-student.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dyxmgicedabvmsbuvxny.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

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

      // TODO: Send confirmation email to student here (we'll add this later with Resend)

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
              .success { color: #10b981; font-size: 24px; margin-bottom: 20px; }
              .details { color: #666; font-size: 16px; }
            </style>
          </head>
          <body>
            <div class="success">✓ Student Approved!</div>
            <div class="details">
              <strong>${data.full_name}</strong> (${data.email})<br>
              Level: <strong>${level}</strong><br><br>
              They can now access the app.
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