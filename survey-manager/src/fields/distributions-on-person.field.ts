import { defineField, FieldType, RelationType } from 'twenty-sdk';

export const DISTRIBUTIONS_ON_PERSON_FIELD_ID = 'd7bcbea5-baad-400d-8000-000000000003';

export default defineField({
  universalIdentifier: DISTRIBUTIONS_ON_PERSON_FIELD_ID,
  objectUniversalIdentifier: '20202020-e674-48e5-a542-72570eee7213', // Person
  type: FieldType.RELATION,
  name: 'surveyDistributions',
  label: 'Survey Distributions',
  relationTargetObjectMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000004', // Distribution
  relationTargetFieldMetadataUniversalIdentifier: 'd7bcbea5-baad-400d-8000-000000000005', // person relation in Distribution
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
