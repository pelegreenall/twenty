import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { DistributionStatus } from '../objects/distribution';

export const SEND_SURVEY_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-000000000006';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// The Twenty server URL — used to build the survey link
const TWENTY_API_URL = process.env.TWENTY_API_URL || 'http://localhost:3000';

// Cryptographically secure token generation
const generateToken = (): string => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const handler = async ({ distributionId }: { distributionId: string }) => {
  const client = new CoreApiClient();

  // 1. Fetch distribution with related person and survey
  const result = await client.query({
    sm133788Distribution: {
      __args: { filter: { id: { eq: distributionId } } },
      id: true,
      status: true,
      token: true,
      person: {
        id: true,
        name: { firstName: true, lastName: true },
        emails: { primaryEmail: true },
      },
      survey: {
        id: true,
        name: true,
      },
    },
  } as never);

  const distribution = (result as any)?.sm133788Distribution;

  if (!distribution) throw new Error('Distribution not found');
  if (!distribution.person) throw new Error('Recipient not found');

  const email = distribution.person.emails?.primaryEmail;
  if (!email) throw new Error('Recipient has no email address');

  // 2. Generate a secure token if missing
  let token: string = distribution.token;
  if (!token) {
    token = generateToken();
    await client.mutation({
      updateOneSm133788Distribution: {
        __args: {
          id: distribution.id,
          data: { token } as any,
        },
        id: true,
      },
    } as never);
  }

  // 3. Build the unique survey link (served by our serve-survey-page logic function)
  const surveyLink = `${TWENTY_API_URL}/s/survey-page?token=${token}`;

  const firstName = distribution.person.name?.firstName ?? '';
  const greeting = firstName ? `Hello ${firstName}!` : 'Hello!';
  const surveyName = distribution.survey?.name ?? 'Survey';

  // 4. Send email via Brevo
  const emailPayload = {
    sender: { name: 'Twenty CRM', email: 'noreply@twenty.com' },
    to: [
      {
        email,
        name: `${firstName} ${distribution.person.name?.lastName ?? ''}`.trim(),
      },
    ],
    subject: `You've been invited to fill out: ${surveyName}`,
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#0070f3;padding:24px 32px;color:#fff;font-size:22px;font-weight:700">${surveyName}</td></tr>
        <tr><td style="padding:32px">
          <p style="font-size:16px;color:#1e293b;margin:0 0 16px">${greeting}</p>
          <p style="font-size:15px;color:#475569;margin:0 0 28px">
            You have been invited to complete a short survey. Please click the button below to get started.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${surveyLink}"
               style="background:#0070f3;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block">
              Take the Survey →
            </a>
          </div>
          <p style="font-size:13px;color:#94a3b8;margin:28px 0 0;text-align:center">
            Or copy this link into your browser:<br>
            <a href="${surveyLink}" style="color:#0070f3;word-break:break-all">${surveyLink}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8">
          Sent via Twenty CRM
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': BREVO_API_KEY || '',
      'content-type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = JSON.stringify(errorData);
    } catch {}
    throw new Error(`Brevo API error: ${errorMsg}`);
  }

  // 5. Update distribution status to SENT
  await client.mutation({
    updateOneSm133788Distribution: {
      __args: {
        id: distribution.id,
        data: { status: DistributionStatus.SENT } as any,
      },
      id: true,
    },
  } as never);

  const responseData = await response.json();
  return { success: true, messageId: responseData.messageId, surveyLink };
};

export default defineLogicFunction({
  universalIdentifier: SEND_SURVEY_FUNCTION_ID,
  name: 'send-survey',
  description: 'Sends a survey email invitation with a unique link via Brevo',
  httpRouteTriggerSettings: {
    path: '/send-survey',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler: handler as any,
});
