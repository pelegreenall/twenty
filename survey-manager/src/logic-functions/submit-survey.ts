import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { DistributionStatus } from '../objects/distribution';

export const SUBMIT_SURVEY_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-00000000000b';

export const handler = async (event: Record<string, any>) => {
  // Works both when called via HTTP POST (body contains the data)
  // and when invoked directly via executeOneLogicFunction (top-level props)
  const body = (event.body as Record<string, unknown> | null | undefined) ?? event;
  const token = (body?.token ?? event.queryStringParameters?.token) as string | undefined;
  const answers = body?.answers ?? event.answers;

  if (!token) {
    throw new Error('token is required');
  }

  const client = new CoreApiClient();

  // 1. Find distribution by token (singular query returns single record)
  const distResult = await client.query({
    sm133788Distribution: {
      __args: { filter: { token: { eq: token } } },
      id: true,
      status: true,
    },
  } as never);

  const distribution = (distResult as any)?.sm133788Distribution;

  if (!distribution) {
    throw new Error('Invalid survey token');
  }

  if (distribution.status === DistributionStatus.COMPLETED) {
    return { success: false, message: 'Survey already completed' };
  }

  // 2. Create Response record
  await client.mutation({
    createSm133788Response: {
      __args: {
        data: {
          answersJson: JSON.stringify(answers ?? {}),
          distributionId: distribution.id,
        } as any,
      },
      id: true,
    },
  } as never);

  // 3. Update distribution status to COMPLETED
  await client.mutation({
    updateSm133788Distribution: {
      __args: {
        id: distribution.id,
        data: { status: DistributionStatus.COMPLETED } as any,
      },
      id: true,
    },
  } as never);

  return { success: true, message: 'Thank you for your response!' };
};

export default defineLogicFunction({
  universalIdentifier: SUBMIT_SURVEY_FUNCTION_ID,
  name: 'submit-survey',
  description: 'Public endpoint to submit survey responses',
  httpRouteTriggerSettings: {
    path: '/submit-survey',
    httpMethod: HTTPMethod.POST,
    isAuthRequired: false,
  },
  handler: handler as any,
});
