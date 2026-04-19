const express = require('express');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(express.json());

const PROJECT_ID = 'ice-smarthealth';
const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

// Service account JSON อยู่ใน env var GOOGLE_SERVICE_ACCOUNT (เป็น JSON string)
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

app.post('/send-call', async (req, res) => {
  const { fcmToken, callId, callerName, roomId } = req.body;
  if (!fcmToken || !callId || !callerName || !roomId) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          android: { priority: 'high' },
          data: { type: 'incoming_call', callId, callerName, roomId },
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('FCM error:', result);
      return res.status(500).json({ error: result });
    }
    return res.json({ success: true, messageId: result.name });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FCM server running on port ${PORT}`);
  // Self-ping ทุก 10 นาที เพื่อป้องกัน Render.com free tier หลับ
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`)
      .then(() => console.log('self-ping ok'))
      .catch(() => {});
  }, 10 * 60 * 1000);
});
