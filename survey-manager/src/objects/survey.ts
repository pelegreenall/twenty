import { defineObject, FieldType, RelationType } from 'twenty-sdk';

export const SURVEY_NAME_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001a';
export const SURVEY_DESCRIPTION_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001b';
export const SURVEY_JSON_FIELD_ID = 'd7bcbea5-baad-400d-8000-00000000001c';
export const SURVEY_DISTRIBUTIONS_RELATION_ID = 'd7bcbea5-baad-400d-8000-000000000011';
export const SURVEY_QUESTIONS_RELATION_ID = 'd7bcbea5-baad-400d-8000-000000000018';

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
    }
  ],
});
