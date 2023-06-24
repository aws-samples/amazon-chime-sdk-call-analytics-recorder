const USER_POOL_REGION = process.env.USER_POOL_REGION;
const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
const API_GATEWAY_URL = process.env.API_URL;

import { Auth } from 'aws-amplify';
export const AmplifyConfig = {
  Auth: {
    region: USER_POOL_REGION,
    userPoolId: USER_POOL_ID,
    userPoolWebClientId: USER_POOL_CLIENT_ID,
    mandatorySignIn: true,
    cookieStorage: {
      domain: `${window.location.hostname}`,
      path: '/',
      expires: 365,
      secure: true,
    },
  },
  aws_appsync_region: 'us-east-1',
  aws_appsync_graphqlEndpoint: GRAPHQL_ENDPOINT,
  aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
  API: {
    endpoints: [
      {
        name: 'sessionContext',
        endpoint: API_GATEWAY_URL,
        custom_header: async () => {
          return {
            Authorization: `${(await Auth.currentSession())
              .getIdToken()
              .getJwtToken()}`,
          };
        },
      },
    ],
  },
};
