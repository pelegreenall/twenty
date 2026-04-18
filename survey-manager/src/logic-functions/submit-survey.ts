import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { DistributionStatus } from '../objects/distribution';

export const SUBMIT_SURVEY_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-00000000000b';

export const handler = async ({ token, answers }: { token: string; answers: any }) => {
  const client = new CoreApiClient();

  // 1. Find distribution by token
  const distResult = await client.query({
    sm133788Distributions: {
      __args: {
        filter: { token: { eq: token } } as any // casting filter part to any
      },
      id: true,
      status: true,
    },
  } as any);

  const distribution = (distResult as any)?.sm133788Distributions?.[0];

  if (!distribution) {
    throw new Error('Invalid token');
  }

  // 2. Create Response record
  await client.mutation({
    createSm133788Response: {
      __args: {
        data: {
          answersJson: JSON.stringify(answers),
          distributionId: distribution.id,
        } as any
      },
      id: true,
    },
  } as any);

  // 3. Update distribution status to COMPLETED
  await client.mutation({
    updateSm133788Distribution: {
      __args: {
        id: distribution.id,
        data: { status: DistributionStatus.COMPLETED } as any
      },
      id: true,
    },
  } as any);

  return { success: true, message: 'Thank you for your response!' };
};

export default defineLogicFunction({
  universalIdentifier: SUBMIT_SURVEY_FUNCTION_ID,
  name: 'submit-survey',
  description: 'Public endpoint to submit survey responses',
  httpRouteTriggerSettings: {
    path: '/submit-survey',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: false, // This is public!
  },
  handler: handler as any,
});
