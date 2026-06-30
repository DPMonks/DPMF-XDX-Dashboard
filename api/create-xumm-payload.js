// /api/create-xumm-payload.js
import { XummSdk } from 'xumm-sdk'

export default async function handler(req, res) {
  try {
    console.log("ENV CHECK:", {
      key: process.env.XUMM_API_KEY ? "OK" : "MISSING",
      secret: process.env.XUMM_API_SECRET ? "OK" : "MISSING"
    });

    const xumm = new XummSdk(
      process.env.XUMM_API_KEY,
      process.env.XUMM_API_SECRET
    );

    const payload = await xumm.payload.create({
      txjson: { TransactionType: 'SignIn' }
    });

    console.log('Payload response:', {
      uuid: payload.uuid,
      qr: payload.refs?.qr_png,
      websocket: payload.refs?.websocket_status
    });

    return res.status(200).json({
      qr: payload.refs?.qr_png || null,
      uuid: payload.uuid || null,
      websocket: payload.refs?.websocket_status || null
    });

  } catch (err) {
    console.error('Xumm API error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to create payload',
      details: err.message || 'Unknown error'
    });
  }
}
