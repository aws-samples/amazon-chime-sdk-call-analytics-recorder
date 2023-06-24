import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween,
  AppLayout,
} from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import { Subscription } from './Subscription';
import { CallDetail } from './CallDetail';
import { CallProvider } from './CallContext';
import { AmplifyConfig } from './Config';
import { Auth, Amplify, API } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Status } from './Status';

Amplify.configure(AmplifyConfig);
API.configure(AmplifyConfig);
Amplify.Logger.LOG_LEVEL = 'DEBUG';

const App: React.FC = () => {
  const [currentCredentials, setCurrentCredentials] = useState({});
  const [currentSession, setCurrentSession] = useState({});

  useEffect(() => {
    async function getAuth() {
      setCurrentSession(await Auth.currentSession());
      setCurrentCredentials(await Auth.currentUserCredentials());
      console.log(`authState: ${JSON.stringify(currentSession)}`);
      console.log(`currentCredentials: ${JSON.stringify(currentCredentials)}`);
    }
    getAuth();
  }, []);

  const formFields = {
    signUp: {
      email: {
        order: 1,
        isRequired: true,
      },
      given_name: {
        order: 2,
        isRequired: true,
        placeholder: 'Name',
      },
      phone_number: {
        order: 3,
        isRequired: true,
        placeholder: 'Phone Number',
      },
      password: {
        order: 4,
      },
      confirm_password: {
        order: 5,
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
              <SpaceBetween size='l'>
                <CallProvider>
                  <Status />
                  <Subscription />
                  <CallDetail />
                </CallProvider>
              </SpaceBetween>
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
