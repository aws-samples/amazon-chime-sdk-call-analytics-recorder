import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  S3Resources,
  RecordingDatabaseResources,
  RecordingLambdaResources,
  VPCResources,
  VCResources,
  ECSResources,
  MediaPipelineResources,
  EventBridgeResources,
  SummarizationStateMachineResources,
  SummarizationDatabaseResources,
  SummarizationLambdaResources,
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
  public recordingBucket: IBucket;

  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
  ) {
    super(scope, id, props);

    envValidator(props);

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
      this.recordingBucket = s3Resources.recordingBucket;
    } else {
      // istanbul ignore next
      this.recordingBucket = Bucket.fromBucketName(
        this,
        'OutputBucketResource',
        props.outputBucket,
      );
    }

    const dataBaseResources = new RecordingDatabaseResources(
      this,
      'DatabaseResources',
    );
    const mediaPipelineResources = new MediaPipelineResources(
      this,
      'MediaPipelineResources',
      {
        s3SinkBucket: this.recordingBucket,
      },
    );

    new RecordingLambdaResources(this, 'LambdaResources', {
      callTable: dataBaseResources.callTable,
      recordingBucket: this.recordingBucket,
      recordingBucketPrefix: props.recordingBucketPrefix,
      mediaPipeline: mediaPipelineResources.s3RecordingSinkConfiguration,
      logLevel: props.logLevel,
      voiceConnectorId: vcResources.voiceConnector.voiceConnectorId,
    });

    new CfnOutput(this, 'OutputBucket', {
      value: this.recordingBucket.bucketName,
    });

    new CfnOutput(this, 'VoiceConnector', {
      value: vcResources.voiceConnector!.voiceConnectorId,
    });
  }
}

export interface AmazonChimeSDKCallAnalyticsSummarizationProps
  extends StackProps {
  recordingBucket: IBucket;
  logLevel: string;
  endpointName: string;
  cohereInstanceType: string;
  modelPackageArn: string;
}

export class AmazonChimeSDKCallAnalyticsSummarization extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsSummarizationProps,
  ) {
    super(scope, id, props);

    const summarizationDatabaseResources = new SummarizationDatabaseResources(
      this,
      'RecordingDatabaseResources',
    );
    const recordingBucket = Bucket.fromBucketName(
      this,
      'RecordingBucket',
      props.recordingBucket.bucketName,
    );

    const summarizationLambdaResources = new SummarizationLambdaResources(
      this,
      'summarizationLambdaResources',
      {
        recordingBucket: recordingBucket,
        statusTable: summarizationDatabaseResources.statusTable,
        endpointName: props.endpointName,
        modelPackageArn: props.modelPackageArn,
        logLevel: props.logLevel,
        cohereInstanceType: props.cohereInstanceType,
      },
    );

    new SummarizationStateMachineResources(
      this,
      'SummarizationStateMachineResources',
      {
        startSagemakerLambda: summarizationLambdaResources.startSagemakerLambda,
        checkEndpointLambda: summarizationLambdaResources.checkEndpointLambda,
        startSummarizationLambda:
          summarizationLambdaResources.startSummarizationLambda,
        recordingBucket: recordingBucket,
        endpointName: props.endpointName,
        logLevel: props.logLevel,
      },
    );

    new EventBridgeResources(this, 'EventBridgeResources', {
      checkStatus: summarizationLambdaResources.checkStatusLambda,
    });
  }
}

const app = new App();

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackProps = {
  outputBucket: process.env.OUTPUT_BUCKET || '',
  recordingBucketPrefix: process.env.RECORDING_BUCKET_PREFIX || 'originalAudio',
  buildAsterisk: process.env.BUILD_ASTERISK || 'true',
  sipRecCidrs: process.env.SIPREC_CIDRS || '',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  removalPolicy: process.env.REMOVAL_POLICY || 'DESTROY',
};

const amazonChimeSDKCallAnalyticsRecording =
  new AmazonChimeSDKCallAnalyticsRecording(
    app,
    'amazon-chime-sdk-call-analytics-recording',
    { ...stackProps, env: devEnv },
  );

const summarizationStackProps = {
  recordingBucket: amazonChimeSDKCallAnalyticsRecording.recordingBucket,
  logLevel: process.env.LOG_LEVEL || 'INFO',
  endpointName: process.env.ENDPOINT_NAME || 'cohere-gpt-medium',
  cohereInstanceType: process.env.COHERE_INSTANCE_TYPE || 'ml.g5.xlarge',
  modelPackageArn:
    process.env.MODEL_PACKAGE_ARN ||
    'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-4-825b877abfd53d7ca65fd7b4b262c421',
};

new AmazonChimeSDKCallAnalyticsSummarization(
  app,
  'amazon-chime-sdk-call-analytics-summarization',
  {
    ...summarizationStackProps,
    env: devEnv,
  },
);

app.synth();
