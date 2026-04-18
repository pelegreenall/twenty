import { defineLogicFunction, HTTPMethod } from 'twenty-sdk';
import { CoreApiClient } from 'twenty-client-sdk/core';

export const AGGREGATE_RESULTS_FUNCTION_ID = 'd7bcbea5-baad-400d-8000-00000000000a';

export const handler = async ({ surveyId }: { surveyId: string }) => {
  const client = new CoreApiClient();

  // Query 1: survey metadata (name + question definitions)
  const surveyResult = await client.query({
    sm133788Survey: {
      __args: { filter: { id: { eq: surveyId } } },
      id: true,
      name: true,
      surveyJsJson: true,
    },
  } as never);

  const survey = (surveyResult as any)?.sm133788Survey;
  if (!survey) throw new Error('Survey not found');

  // Query 2: distributions for this survey — person info + responses
  // ONE level of One-to-Many (distributions → responses) is allowed.
  // We filter distributions by surveyId (scalar FK, not relation).
  const distResult = await client.query({
    sm133788Distributions: {
      __args: { filter: { surveyId: { eq: surveyId } } },
      edges: {
        node: {
          id: true,
          status: true,
          token: true,
          person: {
            id: true,
            name: { firstName: true, lastName: true },
            emails: { primaryEmail: true },
          },
          responses: {
            edges: {
              node: {
                id: true,
                answersJson: true,
              },
            },
          },
        },
      },
    },
  } as never);

  const distributions = ((distResult as any)?.sm133788Distributions?.edges ?? []).map(
    (e: any) => e.node,
  ) as any[];

  // Parse survey questions from JSON to resolve question titles
  let questions: Array<{ name: string; title?: string; type?: string }> = [];
  try {
    const surveyDef = JSON.parse(survey.surveyJsJson || '{}');
    questions = (surveyDef.pages ?? []).flatMap((p: any) => p.elements ?? []);
  } catch {}

  const questionsByName = Object.fromEntries(questions.map((q) => [q.name, q]));

  const totalDistributions = distributions.length;
  const sent = distributions.filter((d) => d.status === 'SENT' || d.status === 'COMPLETED').length;
  const completed = distributions.filter((d) => d.status === 'COMPLETED').length;
  const responseRate = totalDistributions > 0 ? Math.round((completed / totalDistributions) * 100) : 0;

  // Build per-person response records
  const personResponses = distributions
    .filter((d) => (d.responses?.edges ?? []).length > 0)
    .map((d) => {
      const distResponses = (d.responses?.edges ?? []).map((e: any) => e.node);
      const latestResponse = distResponses[distResponses.length - 1];

      let answers: Record<string, unknown> = {};
      try {
        answers = JSON.parse(latestResponse?.answersJson || '{}');
      } catch {}

      const enrichedAnswers = Object.entries(answers).map(([key, value]) => ({
        questionName: key,
        questionTitle: questionsByName[key]?.title ?? key,
        questionType: questionsByName[key]?.type ?? 'unknown',
        answer: value,
      }));

      return {
        personId: d.person?.id,
        personName: `${d.person?.name?.firstName ?? ''} ${d.person?.name?.lastName ?? ''}`.trim(),
        personEmail: d.person?.emails?.primaryEmail ?? '',
        distributionId: d.id,
        answers: enrichedAnswers,
        rawAnswers: answers,
      };
    });

  const stats = {
    totalDistributions,
    totalSent: sent,
    totalCompleted: completed,
    responseRate,
    responses: personResponses,
  };

  return { success: true, surveyId, surveyName: survey.name, stats };
};

export default defineLogicFunction({
  universalIdentifier: AGGREGATE_RESULTS_FUNCTION_ID,
  name: 'aggregate-results',
  description: 'Aggregates survey results and distributions by person',
  httpRouteTriggerSettings: {
    path: '/aggregate-results',
    httpMethod: HTTPMethod.GET,
    isAuthRequired: true,
  },
  handler: handler as any,
});
