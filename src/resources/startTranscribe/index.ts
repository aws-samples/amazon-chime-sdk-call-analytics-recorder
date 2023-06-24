/* eslint-disable import/no-extraneous-dependencies */
import {
  StartTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { S3EventRecord } from 'aws-lambda';
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

const transcribe = new TranscribeClient({ region: process.env.AWS_REGION });

const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET;
let OUTPUT_BUCKET_PREFIX = '';
if (process.env.OUTPUT_BUCKET_PREFIX) {
  OUTPUT_BUCKET_PREFIX = process.env.OUTPUT_BUCKET_PREFIX?.endsWith('/')
    ? process.env.OUTPUT_BUCKET_PREFIX
    : process.env.OUTPUT_BUCKET_PREFIX + '/';
} else {
  OUTPUT_BUCKET_PREFIX = '';
}

let LOG_PREFIX = 'StartTranscribe Notification: ';

const startTranscriptionMutation = gql`
  mutation StartTranscription($input: UpdateCallInput!) {
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
      queries
    }
  }
`;

export const handler = async (event: { Records: S3EventRecord[] }) => {
  console.log(`${LOG_PREFIX} Event Received ${JSON.stringify(event)}`);

  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  console.log(`${LOG_PREFIX} Bucket: ${bucket} Key: ${key}`);

  if (
    !key.toLowerCase().endsWith('.wav') &&
    !key.toLowerCase().endsWith('.ogg')
  ) {
    console.log('File is not a WAV or OGG file');
    return;
  }

  const job_name = key.split('/')[1].split('_')[0];

  const output_key = `${OUTPUT_BUCKET_PREFIX}${job_name}.json`;
  const media_format = key.toLowerCase().endsWith('.wav') ? 'wav' : 'ogg';

  console.log(`${LOG_PREFIX} Media Format: ${media_format}`);
  console.log(`${LOG_PREFIX} Output Key: ${output_key}`);
  console.log(`${LOG_PREFIX} Output Bucket: ${OUTPUT_BUCKET}`);
  console.log(`${LOG_PREFIX} Transcription Job Name: ${job_name}`);

  await transcribe.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: job_name,
      Media: { MediaFileUri: `s3://${bucket}/${key}` },
      Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: 2 },
      MediaFormat: media_format,
      LanguageCode: 'en-US',
      OutputBucketName: OUTPUT_BUCKET,
      OutputKey: output_key,
    }),
  );

  const variables = {
    input: {
      transactionId: job_name,
      status: 'Transcribing',
      wavFile: `s3://${bucket}/${key}`,
    },
  };

  try {
    const result = await graphQLClient.request(
      startTranscriptionMutation,
      variables,
    );
    console.log(`Transcription job "${job_name}" started`);

    console.log('API response:', result);
  } catch (error) {
    console.error('Error writing to API:', error);
  }
};
