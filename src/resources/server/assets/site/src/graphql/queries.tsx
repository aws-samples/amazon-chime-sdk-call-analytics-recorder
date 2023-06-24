import gql from 'graphql-tag';

export const listCallsQuery = gql`
  query ListCalls {
    listCalls {
      items {
        callId
        transactionId
        fromNumber
        toNumber
        callStartTime
        callEndTime
        status
        wavFile
        transcriptionFile
        queries
      }
    }
  }
`;

export const getCallQuery = gql`
  query GetCall($callId: String!) {
    getCall(callId: $callId) {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcriptionFile
      queries
    }
  }
`;
