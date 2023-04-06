import { Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Code, Function } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { MediaInsightsPipeline } from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface EventBridgeProps {
  callTable: Table;
  recordingBucket: IBucket;
  recordingBucketPrefix: string;
  mediaPipeline: MediaInsightsPipeline;
  logLevel: string;
  voiceConnectorId: string;
}

export class EventBridgeResources extends Construct {
  constructor(scope: Construct, id: string, props: EventBridgeProps) {
    super(scope, id);

    const startRecordRole = new Role(this, 'startRecordRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:CreateMediaInsightsPipeline'],
            }),
          ],
        }),

        ['kvsPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['kinesisvideo:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const startRecordLambda = new Function(this, 'startRecordLambda', {
      code: Code.fromAsset('src/resources/startRecord', {
        bundling: {
          image: Runtime.PYTHON_3_9.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output',
          ],
        },
      }),
      handler: 'index.handler',
      environment: {
        CALL_TABLE: props.callTable.tableName,
        RECORDING_BUCKET: props.recordingBucket.bucketName,
        LOG_LEVEL: 'INFO',
        RECORDING_BUCKET_PREFIX: props.recordingBucketPrefix,
        MEDIA_INSIGHT_PIPELINE_ARN:
          props.mediaPipeline.mediaInsightsPipelineConfigurationArn,
      },
      role: startRecordRole,
      runtime: Runtime.PYTHON_3_9,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(15),
    });

    const chimeSdkRule = new Rule(this, 'chimeSdkRule', {
      eventPattern: {
        source: ['aws.chime'],
      },
    });
    chimeSdkRule.addTarget(new LambdaFunction(startRecordLambda));

    props.callTable.grantReadWriteData(startRecordLambda);
    props.recordingBucket.grantReadWrite(startRecordLambda);
  }
}
