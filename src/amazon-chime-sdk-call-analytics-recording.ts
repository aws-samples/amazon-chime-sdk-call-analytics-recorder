import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { IBucket, Bucket } from 'aws-cdk-lib/aws-s3';
import { ChimeVoiceConnector } from 'cdk-amazon-chime-resources';
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
  recorderEnvValidator,
  summarizerEnvValidator,
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
  selectiveRecording: string;
}
export class AmazonChimeSDKCallAnalyticsRecording extends Stack {
  public recordingBucket: IBucket;
  public voiceConnector: ChimeVoiceConnector;

  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
  ) {
    super(scope, id, props);

    recorderEnvValidator(props);

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

    const mediaPipelineResources = new MediaPipelineResources(
      this,
      'MediaPipelineResources',
      {
        s3SinkBucket: this.recordingBucket,
      },
    );

    const vcResources = new VCResources(this, 'VCResources', {
      buildAsterisk: props.buildAsterisk,
      sipRecCidrs: props.sipRecCidrs,
      selectiveRecording: props.selectiveRecording,
      mediaInsightsConfiguration:
        mediaPipelineResources.s3RecordingSinkConfiguration,
    });

    this.voiceConnector = vcResources.voiceConnector;

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

      new CfnOutput(this, 'Service', {
        value: 'SERVICE=' + ecsResources.service.serviceName,
      });

      new CfnOutput(this, 'DisableService', {
        value:
          'aws ecs update-service --cluster $CLUSTER --service $SERVICE --desired-count 0',
      });

      new CfnOutput(this, 'EnableService', {
        value:
          'aws ecs update-service --cluster $CLUSTER --service $SERVICE --desired-count 1',
      });
    }

    if (props.selectiveRecording === 'true') {
      const dataBaseResources = new RecordingDatabaseResources(
        this,
        'DatabaseResources',
      );

      new RecordingLambdaResources(this, 'LambdaResources', {
        callTable: dataBaseResources.callTable,
        recordingBucket: this.recordingBucket,
        recordingBucketPrefix: props.recordingBucketPrefix,
        mediaPipeline: mediaPipelineResources.s3RecordingSinkConfiguration,
        logLevel: props.logLevel,
        voiceConnectorId: vcResources.voiceConnector.voiceConnectorId,
      });
    }

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
  modelName: string;
  voiceConnector: ChimeVoiceConnector;
  recordingBucketPrefix: string;
  selectiveRecording: string;
}

export class AmazonChimeSDKCallAnalyticsSummarization extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKCallAnalyticsSummarizationProps,
  ) {
    super(scope, id, props);

    summarizerEnvValidator(props);
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
        modelName: props.modelName,
        recordingBucketPrefix:
          props.selectiveRecording === 'false'
            ? props.voiceConnector.voiceConnectorId
            : props.recordingBucketPrefix,
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

const recorderStackProps = {
  outputBucket: process.env.OUTPUT_BUCKET || '',
  recordingBucketPrefix: process.env.RECORDING_BUCKET_PREFIX || 'originalAudio',
  buildAsterisk: process.env.BUILD_ASTERISK || 'true',
  sipRecCidrs: process.env.SIPREC_CIDRS || '',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  removalPolicy: process.env.REMOVAL_POLICY || 'DESTROY',
  selectiveRecording: process.env.SELECTIVE_RECORDING || 'false',
};

const amazonChimeSDKCallAnalyticsRecording =
  new AmazonChimeSDKCallAnalyticsRecording(
    app,
    'amazon-chime-sdk-call-analytics-recording',
    { ...recorderStackProps, env: devEnv },
  );

const summarizationStackProps = {
  recordingBucket: amazonChimeSDKCallAnalyticsRecording.recordingBucket,
  voiceConnector: amazonChimeSDKCallAnalyticsRecording.voiceConnector,
  recordingBucketPrefix: process.env.RECORDING_BUCKET_PREFIX || 'originalAudio',
  selectiveRecording: process.env.SELECTIVE_RECORDING || 'false',
  modelName: process.env.MODEL_NAME || 'deployed-cohere-gpt-medium',
  logLevel: process.env.LOG_LEVEL || 'INFO',
  endpointName: process.env.ENDPOINT_NAME || 'deployed-cohere-gpt-medium',
  cohereInstanceType: process.env.COHERE_INSTANCE_TYPE || 'ml.g5.xlarge',
  modelPackageArn:
    process.env.MODEL_PACKAGE_ARN ||
    'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-5-15e34931a06235b7bac32dca396a970a',
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
