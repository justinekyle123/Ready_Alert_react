export interface SmsApiResult {
  success: boolean;
  sent?: number;
  failed?: number;
  messageId?: string;
  error?: string;
}

const smsApiUrl = import.meta.env.VITE_SMS_API_URL?.trim() || '/api/sms';
const smsApiKey = import.meta.env.VITE_SMS_API_KEY?.trim() || '';

export const sendAlertSms = async (params: {
  message: string;
  numbers: string[];
}): Promise<SmsApiResult> => {
  if (!smsApiUrl) {
    return { success: false, sent: 0, failed: params.numbers.length, error: 'SMS API URL is not configured.' };
  }

  const response = await fetch(smsApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Key': smsApiKey,
    },
    body: JSON.stringify(params),
  });

  const result = (await response.json()) as SmsApiResult;
  if (!response.ok || !result.success) {
    throw new Error(result.error || `SMS API failed with status ${response.status}.`);
  }

  return result;
};