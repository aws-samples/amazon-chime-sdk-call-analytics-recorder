import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  S3Resources,
  CognitoResources,
  DatabaseResources,
  DistributionResources,
  LambdaResources,
  VPCResources,
  VCResources,
  ApiGatewayResources,
  ServerResources,
  MediaPipelineResources,
  recorderEnvValidator,
  AppSyncResources,
  EventBridgeResources,
} from './';

config();

export interface AmazonChimeSDKCallAnalyticsRecordingStackProps
  extends StackProps {
  createSageMakerOnStart: string;
  modelName: string;
  endpointName: string;
  cohereInstanceType: string;
  modelPackageArn: string;
  logLevel: string;
  allowedDomain?: string;
  userPool?: string;
  userPoolClient?: string;
  userPoolRegion?: string;
  publicSshKey: string;
}
export class AmazonChimeSDKCallAnalyticsRecording extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
  ) {
    super(scope, id, props);

    recorderEnvValidator(props);

    const s3Resources = new S3Resources(this, 'S3Resources');

    const cognitoResource = new CognitoResources(this, 'Cognito', {
      allowedDomain: props.allowedDomain || '',
      recordingBucket: s3Resources.recordingBucket,
    });

    const dataBaseResources = new DatabaseResources(this, 'DatabaseResources');

    const appSyncResources = new AppSyncResources(this, 'AppSyncResources', {
      userPool: cognitoResource.userPool,
      callTable: dataBaseResources.callTable,
    });

    new EventBridgeResources(this, 'EventBridgeResources', {
      graphqlEndpoint: appSyncResources.graphqlEndpoint,
    });
    const mediaPipelineResources = new MediaPipelineResources(
      this,
      'MediaPipelineResources',
      {
        s3SinkBucket: s3Resources.recordingBucket,
      },
    );

    const vpcResources = new VPCResources(this, 'VPCResources');

    const vcResources = new VCResources(this, 'VCResources', {
      mediaInsightsConfiguration:
        mediaPipelineResources.s3RecordingSinkConfiguration,
      serverEip: vpcResources.serverEip,
    });

    const lambdaResources = new LambdaResources(this, 'LambdaResources', {
      logLevel: props.logLevel,
      endpointName: props.endpointName,
      modelPackageArn: props.modelPackageArn,
      cohereInstanceType: props.cohereInstanceType,
      modelName: props.modelName,
      createSageMakerOnStart: props.createSageMakerOnStart,
      recordingBucket: s3Resources.recordingBucket,
      graphqlEndpoint: appSyncResources.graphqlEndpoint,
      voiceConnectorId: vcResources.voiceConnector.voiceConnectorId,
    });

    const apiGatewayResources = new ApiGatewayResources(
      this,
      'apiGatewayResources',
      {
        startSummarizationLambda: lambdaResources.startSummarizationLambda,
        logLevel: props.logLevel,
        controlSageMakerLambda: lambdaResources.controlSageMakerLambda,
      },
    );

    new ServerResources(this, 'ServerResources', {
      vpc: vpcResources.vpc,
      serverEip: vpcResources.serverEip,
      voiceSecurityGroup: vpcResources.voiceSecurityGroup,
      albSecurityGroup: vpcResources.albSecurityGroup,
      sshSecurityGroup: vpcResources.sshSecurityGroup,
      applicationLoadBalancer: vpcResources.applicationLoadBalancer,
      phoneNumber: vcResources.phoneNumber!,
      voiceConnector: vcResources.voiceConnector,
      userPool: cognitoResource.userPool,
      userPoolClient: cognitoResource.userPoolClient,
      userPoolRegion: cognitoResource.userPoolRegion,
      logLevel: props.logLevel,
      controlSageMakerApi: apiGatewayResources.controlSageMakerApi,
      graphqlEndpoint: appSyncResources.graphqlEndpoint,
      publicSshKey: props.publicSshKey,
      recordingBucket: s3Resources.recordingBucket,
      identityPool: cognitoResource.identityPool,
    });

    const distributionResources = new DistributionResources(
      this,
      'DistributionResources',
      {
        applicationLoadBalancer: vpcResources.applicationLoadBalancer,
      },
    );

    new CfnOutput(this, 'PhoneNumber', {
      value: vcResources!.phoneNumber!.phoneNumber!,
    });

    new CfnOutput(this, 'OutputBucket', {
      value: s3Resources.recordingBucket.bucketName,
    });

    new CfnOutput(this, 'VoiceConnector', {
      value: vcResources.voiceConnector.voiceConnectorId,
    });

    new CfnOutput(this, 'DistributionUrl', {
      value: distributionResources.distribution.domainName,
    });

    new CfnOutput(this, 'GraphQLApi', {
      value: appSyncResources.graphqlEndpoint.graphqlUrl,
    });

    new CfnOutput(this, 'ssh command', {
      value: `ssh ubunut@${vpcResources.serverEip.ref}`,
    });
  }
}

const app = new App();

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

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

new AmazonChimeSDKCallAnalyticsRecording(
  app,
  'amazon-chime-sdk-call-analytics-recording',
  { ...stackProps, env: devEnv },
);

app.synth();
