import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { DistributionStatus } from '../objects/distribution';

export const SEND_SURVEY_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-000000000006';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const PUBLIC_SURVEY_BASE_URL = process.env.PUBLIC_SURVEY_BASE_URL || 'http://localhost:3000/survey/';

export const handler = async ({ distributionId }: { distributionId: string }) => {
  const client = new CoreApiClient();

  // 1. Fetch distribution with related person and survey
  const result = await client.query({
    sm133788Distribution: {
      __args: {
        filter: { id: { eq: distributionId } }
      },
      id: true,
      status: true,
      token: true,
      person: {
        id: true,
        name: {
            firstName: true,
            lastName: true,
        },
        emails: {
            primaryEmail: true
        }
      },
      survey: {
        id: true,
        name: true
      }
    }
  } as any);

  const distribution = (result as any)?.sm133788Distribution;

  if (!distribution) throw new Error('Distribution not found');
  if (!distribution.person) throw new Error('Recipient not found');

  // 2. Generate token if missing
  let token = distribution.token;
  if (!token) {
    token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await client.mutation({
      updateSm133788Distribution: {
        __args: {
            id: distribution.id,
            data: { token } as any
        },
        id: true
      }
    } as any);
  }

  // 3. Send email via Brevo
  const emailPayload = {
    sender: { name: 'Twenty CRM', email: 'noreply@twenty.com' },
    to: [{ email: distribution.person.emails.primaryEmail, name: `${distribution.person.name.firstName} ${distribution.person.name.lastName}` }],
    subject: `New Survey: ${distribution.survey.name}`,
    htmlContent: `
      <h2>Hello ${distribution.person.name.firstName}!</h2>
      <p>Please take a few minutes to fill out our survey about <strong>${distribution.survey.name}</strong>.</p>
      <div style="margin: 20px 0;">
        <a href="${PUBLIC_SURVEY_BASE_URL}${token}" style="background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Take Survey</a>
      </div>
      <p>Thank you!</p>
    `
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY || '',
      'content-type': 'application/json'
    },
    body: JSON.stringify(emailPayload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Brevo API Error: ${JSON.stringify(errorData)}`);
  }

  // 4. Update status to SENT
  await client.mutation({
    updateSm133788Distribution: {
      __args: {
        id: distribution.id,
        data: { status: DistributionStatus.SENT } as any
      },
      id: true
    }
  } as any);

  return { success: true, messageId: (await response.json()).messageId };
};

export default defineLogicFunction({
  universalIdentifier: SEND_SURVEY_FUNCTION_ID,
  name: 'send-survey',
  description: 'Sends a survey email distribution to a person using Brevo SMTP',
  httpRouteTriggerSettings: {
    path: '/send-survey',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: true,
  },
  handler: handler as any,
});
