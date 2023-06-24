import { App } from 'aws-cdk-lib';
import { AmazonChimeSDKCallAnalyticsRecording } from '../src/amazon-chime-sdk-call-analytics-recording';
import { InstanceTypes, ModelArns } from '../src/cohereInput';

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  publicSshKey: process.env.PUBLIC_SSH_KEY || '',
  userPool: process.env.USER_POOL || '',
  userPoolClient: process.env.USER_POOL_CLIENT || '',
  userPoolRegion: process.env.USER_POOL_REGION || '',
  allowedDomain: process.env.ALLOWED_DOMAIN || '',
  createSageMakerOnStart: process.env.CREATE_SAGEMAKER_ON_START || 'false',
  modelName: process.env.MODEL_NAME || 'deployed-cohere-gpt-medium',
  endpointName: process.env.ENDPOINT_NAME || 'deployed-cohere-gpt-medium',
  cohereInstanceType: process.env.COHERE_INSTANCE_TYPE || 'ml.g5.xlarge',
  modelPackageArn:
    process.env.MODEL_PACKAGE_ARN ||
    'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
};

test('Empty', () => {
  const app = new App();
  new AmazonChimeSDKCallAnalyticsRecording(app, 'IncludedBucket', {
    ...stackProps,
  });
});

test('BadLogLevel', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'BadLogLevel', {
      ...stackProps,
      logLevel: 'bad',
    });
  }).toThrow('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
});

test('InvalidModelArn', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(app, 'RecordingInvalidModelArn', {
      ...stackProps,
      modelPackageArn: 'badArn',
    });
  }).toThrow(
    'Invalid Model Arn.  Valid Model Arns are: ' + Object.values(ModelArns),
  );
});

test('InvalidInstanceType', () => {
  expect(() => {
    const app = new App();
    new AmazonChimeSDKCallAnalyticsRecording(
      app,
      'RecordingInvalidInstanceType',
      {
        ...stackProps,
        cohereInstanceType: 'badInstanceType',
      },
    );
  }).toThrow(
    'Invalid Instance Type.  Valid types are: ' + Object.values(InstanceTypes),
  );
});
