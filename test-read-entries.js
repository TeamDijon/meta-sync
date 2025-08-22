// Test script to read metaobject entries using the same approach as your creation code
import dotenv from 'dotenv';
dotenv.config();

const shop = 'meta-sync-source.myshopify.com';
const accessToken = process.env.STAGING_STORE_TOKEN;

console.log('Shop:', shop);
console.log(
  'Access token length:',
  accessToken ? accessToken.length : 'undefined'
);

async function testReadMetaobjectEntries() {
  const endpoint = `https://${shop}/admin/api/unstable/graphql.json`;

  // Simple query to read metaobject entries
  const query = `
    query($type: String!, $first: Int!) {
      metaobjects(type: $type, first: $first) {
        edges {
          node {
            id
            handle
            type
            displayName
            updatedAt
            fields {
              key
              value
              type
            }
            capabilities {
              publishable {
                status
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const variables = {
    type: 'theme_color',
    first: 10,
  };

  console.log('Query:', query);
  console.log('Variables:', JSON.stringify(variables, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Full response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
    }

    if (data.data && data.data.metaobjects) {
      console.log(
        'Metaobject entries found:',
        data.data.metaobjects.edges.length
      );
      data.data.metaobjects.edges.forEach((edge, index) => {
        console.log(`Entry ${index + 1}:`, JSON.stringify(edge.node, null, 2));
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testReadMetaobjectEntries();
