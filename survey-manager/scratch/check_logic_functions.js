const { MetadataApiClient } = require('twenty-client-sdk/metadata');

async function checkLogicFunctions() {
  const client = new MetadataApiClient();
  try {
    const result = await client.query({
      applications: {
        id: true,
        name: true,
        logicFunctions: {
          id: true,
          name: true,
          universalIdentifier: true
        }
      }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkLogicFunctions();
