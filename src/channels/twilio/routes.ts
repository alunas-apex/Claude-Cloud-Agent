import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { IncomingMessage } from '../base.js';

export function createTwilioRouter(
  onMessage: (msg: IncomingMessage) => Promise<string>
): Router {
  const router = Router();

  router.post('/webhook/sms', async (req: Request, res: Response) => {
    // Validate Twilio signature in production
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken) {
      const twilioSignature = req.headers['x-twilio-signature'] as string;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const isValid = twilio.validateRequest(authToken, twilioSignature, url, req.body);

      if (!isValid) {
        res.status(403).send('Forbidden');
        return;
      }
    }

    const from: string = req.body.From ?? '';
    const body: string = req.body.Body ?? '';

    if (!from || !body.trim()) {
      res.status(200).send('<Response></Response>');
      return;
    }

    try {
      // Process asynchronously and send reply via Twilio API (not TwiML)
      // This avoids the 15-second TwiML response timeout for long agent runs
      res.status(200).set('Content-Type', 'text/xml').send('<Response></Response>');

      const incomingMsg: IncomingMessage = {
        channel: 'twilio',
        userId: from,
        text: body.trim(),
        raw: req.body,
      };

      const reply = await onMessage(incomingMsg);

      // Send the reply via Twilio API (imported dynamically to avoid circular deps)
      const { sendSms } = await import('./index.js');
      await sendSms(from, reply);
    } catch (err) {
      console.error('[Twilio] Error processing message:', err);
    }
  });

  return router;
}
