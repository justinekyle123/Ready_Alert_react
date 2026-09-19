import type { VercelRequest, VercelResponse } from '@vercel/node';
import Client from 'android-sms-gateway';

const sendJson = (response: VercelResponse, status: number, body: Record<string, unknown>) => {
  response.status(status).json(body);
};

const normalizePhilippineNumber = (value: unknown): string | null => {
  let number = String(value ?? '').replace(/[^0-9+]/g, '');

  if (number.startsWith('09') && number.length === 11) number = `+63${number.slice(1)}`;
  else if (/^9\d{9}$/.test(number)) number = `+63${number}`;
  else if (/^63\d{10}$/.test(number)) number = `+${number}`;

  return /^\+639\d{9}$/.test(number) ? number : null;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Demo-Key');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return sendJson(response, 405, { success: false, error: 'Use POST.' });

  const apiKey = process.env.READY_ALERT_SMS_API_KEY || '';
  if (!apiKey || request.headers['x-demo-key'] !== apiKey) {
    return sendJson(response, 401, { success: false, error: 'Unauthorized.' });
  }

  const username = process.env.SMS_GATEWAY_USERNAME || '';
  const password = process.env.SMS_GATEWAY_PASSWORD || '';
  if (!username || !password) {
    return sendJson(response, 500, { success: false, error: 'SMS server is not configured.' });
  }

  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  const numbers = Array.isArray(request.body?.numbers) ? request.body.numbers : [];

  if (!message || message.length > 480) {
    return sendJson(response, 422, { success: false, error: 'Message is required and must be 480 characters or fewer.' });
  }
  if (numbers.length === 0 || numbers.length > 50) {
    return sendJson(response, 422, { success: false, error: 'Provide between 1 and 50 phone numbers.' });
  }

  const recipients: string[] = [];
  for (const number of numbers) {
    const normalized = normalizePhilippineNumber(number);
    if (normalized && !recipients.includes(normalized)) recipients.push(normalized);
  }
  if (recipients.length === 0) {
    return sendJson(response, 422, { success: false, error: 'No valid Philippine mobile numbers were provided.' });
  }

  try {
    const client = new Client(username, password);
    const state = await client.send({ phoneNumbers: recipients, message, withDeliveryReport: true });
    return sendJson(response, 200, {
      success: true,
      sent: recipients.length,
      failed: 0,
      messageId: state.id,
    });
  } catch (error) {
    console.error('ReadyAlert SMS send failed:', error);
    return sendJson(response, 502, { success: false, error: 'The SMS gateway rejected the request.' });
  }
}