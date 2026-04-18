import { defineObject, FieldType, RelationType } from 'twenty-sdk';

export const STATUS_FIELD_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-00000000000c';
export const TOKEN_FIELD_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-00000000000d';
export const SURVEY_RELATION_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-00000000000e';
export const PERSON_RELATION_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000005';
export const RESPONSES_RELATION_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-00000000000f';

export enum DistributionStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  OPENED = 'OPENED',
  COMPLETED = 'COMPLETED',
}

export default defineObject({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000004',
  nameSingular: 'sm133788Distribution',
  namePlural: 'sm133788Distributions',
  labelSingular: 'Distribution',
  labelPlural: 'Distributions',
  labelIdentifierFieldMetadataUniversalIdentifier: STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  icon: 'IconSend',
  fields: [
    {
      universalIdentifier: STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'status',
      label: 'Status',
      defaultValue: `'${DistributionStatus.PENDING}'`,
    },
    {
      universalIdentifier: TOKEN_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'token',
      label: 'Token',
      description: 'Unique token for the survey link',
    },
    {
      universalIdentifier: SURVEY_RELATION_UNIVERSAL_IDENTIFIER,
      name: 'survey',
      type: FieldType.RELATION,
      label: 'Survey',
      relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000010',
      relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000011',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'surveyId',
      },
    },
    {
      universalIdentifier: PERSON_RELATION_UNIVERSAL_IDENTIFIER,
      name: 'person',
      type: FieldType.RELATION,
      label: 'Person',
      relationTargetObjectMetadataUniversalIdentifier: '20202020-e674-48e5-a542-72570eee7213',
      relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000003',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'personId',
      },
    },
    {
        universalIdentifier: RESPONSES_RELATION_UNIVERSAL_IDENTIFIER,
        name: 'responses',
        type: FieldType.RELATION,
        label: 'Responses',
        relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000012',
        relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000013',
        universalSettings: {
            relationType: RelationType.ONE_TO_MANY,
        },
    }
  ],
});
