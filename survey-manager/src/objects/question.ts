import { defineObject, FieldType, RelationType } from 'twenty-sdk';

export const TITLE_FIELD_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000014';
export const QUESTION_TYPE_FIELD_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000015';
export const SURVEY_RELATION_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000016';

export default defineObject({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000017',
  nameSingular: 'sm133788Question',
  namePlural: 'sm133788Questions',
  labelSingular: 'Question',
  labelPlural: 'Questions',
  labelIdentifierFieldMetadataUniversalIdentifier: TITLE_FIELD_UNIVERSAL_IDENTIFIER,
  icon: 'IconQuestionMark',
  fields: [
    {
      universalIdentifier: TITLE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'title',
      label: 'Title',
    },
    {
      universalIdentifier: QUESTION_TYPE_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'questionType',
      label: 'Question Type',
    },
    {
      universalIdentifier: SURVEY_RELATION_UNIVERSAL_IDENTIFIER,
      name: 'survey',
      type: FieldType.RELATION,
      label: 'Survey',
      relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000010',
      relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000018',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'surveyId',
      },
    },
  ],
});
