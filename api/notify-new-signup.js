// api/notify-new-signup.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Verify this is a POST request from Supabase
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { record } = req.body;
    
    // Only process if user is NOT approved yet
    if (record.approved === true) {
      return res.status(200).json({ message: 'User already approved, skipping notification' });
    }

    const { id, email, full_name } = record;
    const levels = ['A2', 'B1', 'B2', 'C1', 'C2', 'Spanish'];
    
    // Build approval links
    const approvalLinks = levels.map(level => {
      const url = `https://app.perfect-english.org/api/approve-student?action=approve&userId=${id}&level=${level}`;
      return `<a href="${url}" style="display: inline-block; margin: 5px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-family: Arial, sans-serif;">${level}</a>`;
    }).join(' ');

    // Send approval email to you
    await resend.emails.send({
      from: 'Perfect English <james@perfect-english.org>',
      to: 'james@perfect-english.org',
      subject: `New Student Signup: ${full_name}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .info { margin: 20px 0; }
              .actions { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .actions h3 { margin-top: 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">New Student Signup 🎓</h2>
              </div>
              
              <div class="info">
                <p><strong>Name:</strong> ${full_name}</p>
                <p><strong>Email:</strong> ${email}</p>
              </div>
              
              <div class="actions">
                <h3>Approve and assign level:</h3>
                <p style="margin-bottom: 15px;">Click a level to approve this student:</p>
                ${approvalLinks}
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This student's account will remain inactive until you approve them.
              </p>
            </div>
          </body>
        </html>
      `
    });

    return res.status(200).json({ message: 'Notification sent' });
  } catch (error) {
    console.error('Error processing signup:', error);
    return res.status(500).json({ error: error.message });
  }
}// Force rebuild
