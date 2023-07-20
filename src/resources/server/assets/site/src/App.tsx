import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween,
  AppLayout,
} from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import { Subscription } from './Subscription';
import CallTable from './CallTable';
import { CallProvider } from './CallContext';
import { AmplifyConfig } from './Config';
import { Auth, Amplify, API } from 'aws-amplify';
import { CognitoUserSession } from 'amazon-cognito-identity-js';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Status } from './Status';

Amplify.configure(AmplifyConfig);
API.configure(AmplifyConfig);
Amplify.Logger.LOG_LEVEL = 'DEBUG';

const App: React.FC = () => {
  useEffect(() => {
    async function getAuth() {
      try {
        const cognitoUser = await Auth.currentAuthenticatedUser();
        const currentSession = await Auth.currentSession();
        cognitoUser.refreshSession(
          currentSession.getRefreshToken(),
          (err: Error, session: CognitoUserSession) => {
            console.log('session', err, session);
          },
        );
      } catch (e) {
        console.log('Unable to refresh Token', e);
      }
    }
    getAuth();
  }, []);

  async function signOut() {
    try {
      await Auth.signOut();
    } catch (error) {
      console.log('error signing out: ', error);
    }
  }

  const formFields = {
    signUp: {
      email: {
        order: 1,
        isRequired: true,
      },
      password: {
        order: 2,
      },
      confirm_password: {
        order: 3,
      },
    },
  };

  return (
    <Authenticator loginMechanisms={['email']} formFields={formFields}>
      {({ signOut, user }) => (
        <AppLayout
          content={
            <ContentLayout
              header={
                <Header variant='h1'>
                  Amazon Chime SDK Call Analytics - Post Call Summarizer
                </Header>
              }
            >
              <CallProvider>
                <SpaceBetween size='xl'>
                  <Status />
                  <Subscription />
                  <CallTable />
                </SpaceBetween>
              </CallProvider>
            </ContentLayout>
          }
          navigationHide={true}
          toolsHide={true}
        />
      )}
    </Authenticator>
  );
};

export default App;
