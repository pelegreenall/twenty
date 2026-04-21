import { defineObject, FieldType, RelationType } from 'twenty-sdk';

export const SURVEY_NAME_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001a';
export const SURVEY_DESCRIPTION_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001b';
export const SURVEY_JSON_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001c';
export const SURVEY_DISTRIBUTIONS_RELATION_ID = 'd7bcbea5-baad-400d-8000-000000000011';
export const SURVEY_QUESTIONS_RELATION_ID = 'd7bcbea5-baad-400d-8000-000000000018';
export const SURVEY_PRIMARY_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000030';
export const SURVEY_HEADER_BG_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000031';
export const SURVEY_HEADER_TEXT_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000032';
export const SURVEY_CUSTOM_CSS_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000033';
export const SURVEY_BG_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000034';
export const SURVEY_CARD_BG_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000035';
export const SURVEY_QUESTION_TEXT_COLOR_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000036';
export const SURVEY_REDIRECT_URL_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000040';
export const SURVEY_REDIRECT_DELAY_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000041';


export default defineObject({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000010',
  nameSingular: 'sm133788Survey',
  namePlural: 'sm133788Surveys',
  labelSingular: 'Survey',
  labelPlural: 'Surveys',
  labelIdentifierFieldMetadataUniversalIdentifier: SURVEY_NAME_FIELD_ID,
  icon: 'IconReport',
  fields: [
    {
      universalIdentifier: SURVEY_NAME_FIELD_ID,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      description: 'Name of the survey',
    },
    {
      universalIdentifier: SURVEY_DESCRIPTION_FIELD_ID,
      type: FieldType.TEXT,
      name: 'description',
      label: 'Description',
      description: 'Internal description of the survey',
    },
    {
      universalIdentifier: SURVEY_JSON_FIELD_ID,
      type: FieldType.TEXT,
      name: 'surveyJsJson',
      label: 'SurveyJS JSON',
      description: 'The JSON definition of the survey from SurveyJS',
    },
    {
        universalIdentifier: SURVEY_DISTRIBUTIONS_RELATION_ID,
        name: 'distributions',
        type: FieldType.RELATION,
        label: 'Distributions',
        relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000004',
        relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-00000000000e',
        universalSettings: {
            relationType: RelationType.ONE_TO_MANY,
        },
    },
    {
        universalIdentifier: SURVEY_QUESTIONS_RELATION_ID,
        name: 'questions',
        type: FieldType.RELATION,
        label: 'Questions',
        relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000017',
        relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000016',
        universalSettings: {
            relationType: RelationType.ONE_TO_MANY,
        },
    },
    {
      universalIdentifier: SURVEY_PRIMARY_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'primaryColor',
      label: 'Primary Color',
      description: 'The main brand color for the survey buttons and accents',
      defaultValue: "'#0070f3'",
    },
    {
      universalIdentifier: SURVEY_HEADER_BG_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'headerBackgroundColor',
      label: 'Header Background Color',
      description: 'Background color for the survey header',
      defaultValue: "'#0070f3'",
    },
    {
      universalIdentifier: SURVEY_HEADER_TEXT_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'headerTextColor',
      label: 'Header Text Color',
      description: 'Text color for the survey header',
      defaultValue: "'#ffffff'",
    },
    {
      universalIdentifier: SURVEY_CUSTOM_CSS_FIELD_ID,
      type: FieldType.TEXT,
      name: 'customCss',
      label: 'Custom CSS',
      description: 'Custom CSS to inject into the live survey page',
    },
    {
      universalIdentifier: SURVEY_BG_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'backgroundColor',
      label: 'Background Color',
      description: 'Background color for the survey page',
      defaultValue: "'#f0f4f8'",
    },
    {
      universalIdentifier: SURVEY_CARD_BG_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'cardBackgroundColor',
      label: 'Card Background Color',
      description: 'Background color for the survey card',
      defaultValue: "'#ffffff'",
    },
    {
      universalIdentifier: SURVEY_QUESTION_TEXT_COLOR_FIELD_ID,
      type: FieldType.TEXT,
      name: 'questionTextColor',
      label: 'Question Text Color',
      description: 'Text color for the survey questions',
      defaultValue: "'#0f172a'",
    },
    {
      universalIdentifier: SURVEY_REDIRECT_URL_FIELD_ID,
      type: FieldType.TEXT,
      name: 'redirectUrl',
      label: 'Redirect URL',
      description: 'URL to redirect to after survey completion',
    },
    {
      universalIdentifier: SURVEY_REDIRECT_DELAY_FIELD_ID,
      type: FieldType.NUMBER,
      name: 'redirectDelay',
      label: 'Redirect Delay (seconds)',
      description: 'How many seconds to wait before redirecting',
      defaultValue: 5,
    }
  ],
});
