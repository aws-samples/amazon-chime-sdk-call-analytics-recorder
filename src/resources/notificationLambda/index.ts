/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable quote-props */
import { GraphQLClient, gql } from 'graphql-request';

const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT;
const graphqlApiKey = process.env.GRAPHQL_API_KEY;

const graphQLClient = new GraphQLClient(graphqlEndpoint!, {
  headers: {
    'x-api-key': graphqlApiKey!,
  },
});

console.log('graphqlEndpoint', graphqlEndpoint);
console.log('graphqlApiKey', graphqlApiKey);

const startRecordingMutation = gql`
  mutation StartRecording($input: CreateCallInput!) {
    createCall(input: $input) {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcriptionFile
      transcription
      queries
    }
  }
`;

const stopRecordingMutation = gql`
  mutation StopRecording($input: UpdateCallInput!) {
    updateCall(input: $input) {
      callId
      transactionId
      fromNumber
      toNumber
      callStartTime
      callEndTime
      status
      wavFile
      transcriptionFile
      transcription
      queries
    }
  }
`;

interface Detail {
  version: '0';
  callId: string;
  direction: number;
  fromNumber: string;
  inviteHeaders: InviteHeaders;
  isCaller: boolean;
  mediaType: string;
  sdp: SDP;
  siprecMetadata: string;
  startFragmentNumbers: string;
  startTime: string;
  endTime: string;
  streamArn: string;
  toNumber: string;
  transactionId: string;
  voiceConnectorId: string;
  streamingStatus: StreamingStatus;
}
interface InviteHeaders {
  'from': string;
  'to': string;
  'call-id': string;
  'cseq': string;
  'contact': string;
  'content-type': string;
  'content-length': string;
}
interface SDP {
  mediaIndex: number;
  mediaLabel: string;
}
interface EventBridge {
  'version': '0';
  'id': string;
  'detail-type': string;
  'source': 'aws.chime';
  'account': string;
  'time': string;
  'region': string;
  'resources': [];
  'detail': Detail;
}

enum StreamingStatus {
  FAILED = 'FAILED',
  STARTED = 'STARTED',
  ENDED = 'ENDED',
  UPDATED = 'UPDATED',
}
export const handler = async (event: EventBridge): Promise<null> => {
  console.info(event);

  switch (event.detail.streamingStatus) {
    case StreamingStatus.STARTED:
      console.log('Streaming Started');
      if (event.detail.isCaller) {
        await startRecording(event);
      }
      break;
    case StreamingStatus.ENDED:
      console.log('Streaming Ended');
      if (event.detail.isCaller) {
        await stopRecording(event);
      }
  }
  return null;
};

async function startRecording(event: EventBridge) {
  const { transactionId, callId, fromNumber, toNumber, startTime } =
    event.detail;

  let status = 'Call in progress';

  const variables = {
    input: {
      transactionId,
      callId,
      fromNumber,
      toNumber,
      callStartTime: startTime,
      status,
    },
  };
  console.log(variables);
  try {
    console.log('Writing to AppSync');
    const result = await graphQLClient.request(
      startRecordingMutation,
      variables,
    );
    console.log(result);

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function stopRecording(event: EventBridge) {
  const { transactionId, callId, endTime } = event.detail;

  let status = 'Call ended';
  const variables = {
    input: {
      transactionId,
      callId,
      callEndTime: endTime,
      status,
    },
  };
  console.log(variables);
  try {
    console.log('Writing to AppSync');
    const result = await graphQLClient.request(
      stopRecordingMutation,
      variables,
    );
    console.log(result);
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
