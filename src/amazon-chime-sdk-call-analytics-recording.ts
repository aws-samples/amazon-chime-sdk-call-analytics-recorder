import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  S3Resources,
  DatabaseResources,
  EventBridgeResources,
  VPCResources,
  VCResources,
  ECSResources,
  MediaPipelineResources,
  envValidator,
} from './';

config();

export interface AmazonChimeSDKCallAnalyticsRecordingStackProps
  extends StackProps {
  outputBucket: string;
  recordingBucketPrefix: string;
  buildAsterisk: string;
  sipRecCidrs: string;
  logLevel: string;
  removalPolicy: string;
}
export class AmazonChimeSDKCallAnalyticsRecording extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
  ) {
    super(scope, id, props);

    envValidator(props);
    let recordingBucket: IBucket;

    const vcResources = new VCResources(this, 'VCResources', {
      buildAsterisk: props.buildAsterisk,
      sipRecCidrs: props.sipRecCidrs,
    });

    if (props.buildAsterisk === 'true') {
      const vpcResources = new VPCResources(this, 'VPCResources');

      const ecsResources = new ECSResources(this, 'ECSResources', {
        vpc: vpcResources.vpc,
        securityGroup: vpcResources.securityGroup,
        phoneNumber: vcResources.phoneNumber!,
        voiceConnector: vcResources.voiceConnector,
        logLevel: props.logLevel,
      });
      new CfnOutput(this, 'ClusterArn', {
        value: 'CLUSTER=' + ecsResources.cluster.clusterArn,
      });
      new CfnOutput(this, 'getTask', {
        value:
          'TASK=$( aws ecs list-tasks --cluster $CLUSTER --query taskArns --output text )',
      });

      new CfnOutput(this, 'ecsExecute', {
        value:
          'aws ecs execute-command --cluster $CLUSTER --task $TASK --command "asterisk -rvvvvvv" --interactive',
      });

      new CfnOutput(this, 'PhoneNumber', {
        value: vcResources!.phoneNumber!.phoneNumber!,
      });
    }

    if (props.outputBucket === '') {
      const s3Resources = new S3Resources(this, 'S3Resources', {
        removalPolicy: props.removalPolicy,
      });
      recordingBucket = s3Resources.recordingBucket;
    } else {
      // istanbul ignore next
      recordingBucket = Bucket.fromBucketName(
        this,
        'OutputBucketResource',
        props.outputBucket,
      );
    }

    const dataBaseResources = new DatabaseResources(this, 'DatabaseResources');
    const mediaPipelineResources = new MediaPipelineResources(
      this,
      'MediaPipelineResources',
      {
        s3SinkBucket: recordingBucket,
      },
    );

    new EventBridgeResources(this, 'EventBridgeResources', {
      callTable: dataBaseResources.callTable,
      recordingBucket: recordingBucket,
      recordingBucketPrefix: props.recordingBucketPrefix,
      mediaPipeline: mediaPipelineResources.s3RecordingSinkConfiguration,
      logLevel: props.logLevel,
      voiceConnectorId: vcResources.voiceConnector.voiceConnectorId,
    });

    new CfnOutput(this, 'OutputBucket', { value: recordingBucket.bucketName });

    new CfnOutput(this, 'VoiceConnector', {
      value: vcResources.voiceConnector!.voiceConnectorId,
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackProps = {
  outputBucket: process.env.OUTPUT_BUCKET || '',
  recordingBucketPrefix: process.env.RECORDING_BUCKET_PREFIX || '',
  buildAsterisk: process.env.BUILD_ASTERISK || 'true',
  sipRecCidrs: process.env.SIPREC_CIDRS || '',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  removalPolicy: process.env.REMOVAL_POLICY || 'DESTROY',
};

const app = new App();

new AmazonChimeSDKCallAnalyticsRecording(
  app,
  'amazon-chime-sdk-call-analytics-recording',
  { ...stackProps, env: devEnv },
);

app.synth();
