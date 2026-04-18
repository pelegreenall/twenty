import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';

export const AGGREGATE_RESULTS_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-00000000000a';

export const handler = async ({ surveyId }: { surveyId: string }) => {
  const client = new CoreApiClient();

  // 1. Fetch survey and related responses
  const result = await client.query({
    sm133788Survey: {
      __args: {
        filter: { id: { eq: surveyId } },
      },
      id: true,
      name: true,
      distributions: {
        edges: {
          node: {
            id: true,
            status: true,
            responses: {
              edges: {
                node: {
                  id: true,
                  answersJson: true,
                }
              }
            },
          }
        }
      },
    },
  } as any);

  const survey = (result as any)?.sm133788Survey;

  if (!survey) {
    throw new Error('Survey not found');
  }

  const distributions = (survey.distributions?.edges?.map((e: any) => e.node) || []) as any[];
  const responses = distributions
    .flatMap((d: any) => d.responses?.edges?.map((e: any) => e.node) || [])
    .filter((r: any) => !!r) as any[];

  // 2. Simple aggregation (count responses by status)
  const stats = {
    totalSent: distributions.filter((d: any) => d.status === 'SENT').length,
    totalOpened: distributions.filter((d: any) => d.status === 'OPENED').length,
    totalCompleted: responses.length,
    responses: responses.map(r => JSON.parse(r.answersJson || '{}')),
  };

  return { success: true, surveyId, surveyName: survey.name, stats };
};

export default defineLogicFunction({
  universalIdentifier: AGGREGATE_RESULTS_FUNCTION_ID,
  name: 'aggregate-results',
  description: 'Aggregates survey results and summaries distributions',
  httpRouteTriggerSettings: {
    path: '/aggregate-results',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: true,
  },
  handler: handler as any,
});
