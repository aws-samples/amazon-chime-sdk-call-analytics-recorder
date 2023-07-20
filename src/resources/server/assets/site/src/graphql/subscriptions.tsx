import gql from 'graphql-tag';

export const onCreateCall = gql`
  subscription OnCreateCall {
    onCreateCall {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcription
      transcriptionFile
      queries
    }
  }
`;

export const onUpdateCall = gql`
  subscription OnUpdateCall {
    onUpdateCall {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcription
      transcriptionFile
      queries
    }
  }
`;

export const onDeleteCall = gql`
  subscription OnDeleteCall {
    onDeleteCall {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcription
      transcriptionFile
      queries
    }
  }
`;

export const addQueryToCall = gql`
  subscription AddQueryToCall {
    addQueryToCall {
      transactionId
      queries
    }
  }
`;
