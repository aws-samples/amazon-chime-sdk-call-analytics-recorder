import { API, graphqlOperation } from 'aws-amplify';
import { GraphQLSubscription } from '@aws-amplify/api';
import {
  onCreateCall,
  onUpdateCall,
  onDeleteCall,
  addQueryToCall,
} from './graphql/subscriptions';
import { useContext, useEffect } from 'react';
import { CallContext } from './CallContext';

type OnCreateCall = {
  onCreateCall?: {
    callId: string;
    transactionId: string;
    fromNumber: string;
    toNumber: string;
    callStartTime: string;
    callEndTime: string;
    status: string;
    wavFile: string;
    transcriptionFile: string;
    transcription: string;
    queries: string;
  };
};

type OnUpdateCall = {
  onUpdateCall?: {
    callId: string;
    transactionId: string;
    fromNumber: string;
    toNumber: string;
    callStartTime: string;
    callEndTime: string;
    status: string;
    wavFile: string;
    transcriptionFile: string;
    transcription: string;
    queries: string;
  };
};

type OnDeleteCall = {
  onDeleteCall?: {
    callId: string;
    transactionId: string;
    fromNumber: string;
    toNumber: string;
    callStartTime: string;
    callEndTime: string;
    status: string;
    wavFile: string;
    transcriptionFile: string;
    transcription: string;
    queries: string;
  };
};

type AddQueryToCall = {
  addQueryToCall?: {
    queries: string;
    transactionId: string;
  };
};

export const Subscription: React.FC = () => {
  const callContext = useContext(CallContext);

  useEffect(() => {
    const createCallSubscription = API.graphql<
      GraphQLSubscription<OnCreateCall>
    >(graphqlOperation(onCreateCall)).subscribe({
      next: ({ provider, value }) => {
        console.log({ provider, value });
        const createdCall = value.data?.onCreateCall;
        if (createdCall) {
          console.log('New call created:', createdCall);
          callContext.addCall(createdCall);
        }
      },
      error: (error) => {
        console.warn('Error subscribing to onCreateCall:', error);
      },
    });

    const updateCallSubscription = API.graphql<
      GraphQLSubscription<OnUpdateCall>
    >(graphqlOperation(onUpdateCall)).subscribe({
      next: ({ provider, value }) => {
        console.log({ provider, value });
        const updatedCall = value.data?.onUpdateCall;
        if (updatedCall) {
          console.log('Call updated:', updatedCall);
          callContext.updateCall(updatedCall);
        }
      },
      error: (error) => {
        console.warn('Error subscribing to onUpdateCall:', error);
      },
    });

    const deleteCallSubscription = API.graphql<
      GraphQLSubscription<OnDeleteCall>
    >(graphqlOperation(onDeleteCall)).subscribe({
      next: ({ provider, value }) => {
        console.log({ provider, value });
        const deletedCall = value.data?.onDeleteCall;
        if (deletedCall) {
          console.log('Call deleted:', deletedCall);
          // Handle the deleted call data
        }
      },
      error: (error) => {
        console.warn('Error subscribing to onDeleteCall:', error);
      },
    });

    const addQueryToCallSubscription = API.graphql<
      GraphQLSubscription<AddQueryToCall>
    >(graphqlOperation(addQueryToCall)).subscribe({
      next: ({ provider, value }) => {
        console.log({ provider, value });
        const updatedCall = value.data?.addQueryToCall;
        if (updatedCall) {
          console.log('Query added to call:', updatedCall);
          callContext.addQueryToCall(updatedCall);
        }
      },
      error: (error) => {
        console.warn('Error subscribing to addQueryToCall:', error);
      },
    });

    return () => {
      createCallSubscription.unsubscribe();
      updateCallSubscription.unsubscribe();
      deleteCallSubscription.unsubscribe();
      addQueryToCallSubscription.unsubscribe();
    };
  }, []);

  return null;
};
