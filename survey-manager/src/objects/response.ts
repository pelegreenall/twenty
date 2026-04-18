import { defineObject, FieldType, RelationType } from 'twenty-sdk';

export const ANSWERS_FIELD_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000019';
export const DISTRIBUTION_RELATION_UNIVERSAL_IDENTIFIER = 'd7bcbea5-baad-400d-8000-000000000013';

export default defineObject({
  universalIdentifier: 'd7bcbea5-baad-400d-8000-000000000012',
  nameSingular: 'sm133788Response',
  namePlural: 'sm133788Responses',
  labelSingular: 'Response',
  labelPlural: 'Responses',
  labelIdentifierFieldMetadataUniversalIdentifier: ANSWERS_FIELD_UNIVERSAL_IDENTIFIER,
  icon: 'IconMessage',
  fields: [
    {
      universalIdentifier: ANSWERS_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'answersJson',
      label: 'Answers JSON',
      description: 'The response payload in JSON format',
    },
    {
      universalIdentifier: DISTRIBUTION_RELATION_UNIVERSAL_IDENTIFIER,
      name: 'distribution',
      type: FieldType.RELATION,
      label: 'Distribution',
      relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000004',
      relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-00000000000f',
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        joinColumnName: 'distributionId',
      },
    },
  ],
});
