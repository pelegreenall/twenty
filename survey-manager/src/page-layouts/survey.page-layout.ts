import { definePageLayout } from 'twenty-sdk';

export default definePageLayout({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-00000000001d',
  name: 'survey-record-page',
  type: 'RECORD_PAGE',
  objectUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000010',
  tabs: [
    {
      universalIdentifier: 'd7bcbea5-baad-400d-8000-00000000001e',
      title: 'Survey Management',
      position: 0,
      widgets: [
        {
          universalIdentifier: 'd7bcbea5-baad-400d-8000-00000000001f',
          title: 'Survey Builder',
          type: 'FRONT_COMPONENT',
          // Full width, 14 rows × 55px = 770px — enough for SurveyJS Creator
          gridPosition: { row: 0, column: 0, rowSpan: 14, columnSpan: 12 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000009',
          },
        },
        {
          universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000021',
          title: 'Distribution Panel',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 14, column: 0, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000007',
          },
        },
        {
          universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000022',
          title: 'Results Widget',
          type: 'FRONT_COMPONENT',
          gridPosition: { row: 14, column: 6, rowSpan: 6, columnSpan: 6 },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000008',
          },
        },
      ],
    },
  ],
});
