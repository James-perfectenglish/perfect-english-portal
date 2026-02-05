// api/notify-new-signup.js
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
      const url = `https://your-app.vercel.app/api/approve-student?action=approve&userId=${id}&level=${level}`;
      return `<a href="${url}" style="display: inline-block; margin: 5px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">${level}</a>`;
    }).join(' ');

    // TODO: Send email via Resend (we'll add this after Resend verification)
    // For now, just log it
    console.log('New signup:', { full_name, email, approvalLinks });

    return res.status(200).json({ message: 'Notification queued' });
  } catch (error) {
    console.error('Error processing signup:', error);
    return res.status(500).json({ error: error.message });
  }
}