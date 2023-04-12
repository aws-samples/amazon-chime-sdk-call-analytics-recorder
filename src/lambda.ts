import { Duration, Stack } from 'aws-cdk-lib';
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
import {
  Architecture,
  Runtime,
  Code,
  Function,
  DockerImageFunction,
  DockerImageCode,
} from 'aws-cdk-lib/aws-lambda';
import { IBucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { MediaInsightsPipeline } from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface RecordingLambdaResourcesProps {
  callTable: Table;
  recordingBucket: IBucket;
  recordingBucketPrefix: string;
  mediaPipeline: MediaInsightsPipeline;
  logLevel: string;
  voiceConnectorId: string;
}

export class RecordingLambdaResources extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: RecordingLambdaResourcesProps,
  ) {
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
        VOICECONNECTOR_ID: props.voiceConnectorId,
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

interface SummarizationLambdaResourcesProps {
  recordingBucket: IBucket;
  statusTable: Table;
  endpointName: string;
  modelPackageArn: string;
  logLevel: string;
  cohereInstanceType: string;
}

export class SummarizationLambdaResources extends Construct {
  public checkStatusLambda: Function;
  public startSagemakerLambda: Function;
  public startSummarizationLambda: Function;
  public checkEndpointLambda: Function;

  constructor(
    scope: Construct,
    id: string,
    props: SummarizationLambdaResourcesProps,
  ) {
    super(scope, id);

    const startTranscribeRole = new Role(this, 'startTranscribeRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['transcribePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['transcribe:StartTranscriptionJob'],
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

    const startTranscribeLambda = new Function(this, 'startTranscribeLambda', {
      code: Code.fromAsset('src/resources/startTranscribe'),
      handler: 'index.handler',
      role: startTranscribeRole,
      runtime: Runtime.PYTHON_3_9,
      environment: {
        LOG_LEVEL: props.logLevel,
        OUTPUT_BUCKET: props.recordingBucket.bucketName,
        OUTPUT_BUCKET_PREFIX: 'transcribeOutput',
      },
    });

    props.recordingBucket.grantReadWrite(startTranscribeLambda);
    props.recordingBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(startTranscribeLambda),
      { prefix: 'originalAudio' },
    );

    const sageMakerRole = new Role(this, 'sagemakerRole', {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    const checkEndpointRole = new Role(this, 'checkEndpointRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['stateMachinePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['sagemaker:DescribeEndpoint'],
              resources: ['*'],
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

    this.checkEndpointLambda = new Function(this, 'checkEndpointLambda', {
      code: Code.fromAsset('src/resources/checkEndpoint'),
      handler: 'index.handler',
      role: checkEndpointRole,
      runtime: Runtime.PYTHON_3_9,
      environment: {
        LOG_LEVEL: props.logLevel,
        ENDPOINT_NAME: props.endpointName,
      },
    });

    const checkStatusRole = new Role(this, 'checkStatusRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['stateMachinePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: [
                'sagemaker:DeleteEndpoint',
                'sagemaker:DeleteEndpointConfig',
                'sagemaker:DeleteModel',
                'sagemaker:DescribeEndpoint',
                'sagemaker:DescribeEndpointConfig',
              ],
              resources: [
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint/${props.endpointName}`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint-config/${props.endpointName}`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:model/*`,
              ],
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

    this.checkStatusLambda = new DockerImageFunction(
      this,
      'checkStatusLambda',
      {
        code: DockerImageCode.fromImageAsset('src/resources/checkStatus'),
        timeout: Duration.minutes(1),
        role: checkStatusRole,
        environment: {
          STATUS_TABLE: props.statusTable.tableName,
          LOG_LEVEL: props.logLevel,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: sageMakerRole.roleName,
        },
      },
    );

    props.statusTable.grantReadWriteData(this.checkStatusLambda);

    const startSagemakerRole = new Role(this, 'startSagemakerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['stateMachinePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['sagemaker:*'],
              resources: [
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint/${props.endpointName}`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint-config/*`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:model/*`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:model-package/*`,
                'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-4-825b877abfd53d7ca65fd7b4b262c421',
              ],
            }),
            new PolicyStatement({
              actions: ['iam:GetRole', 'iam:PassRole'],
              resources: ['*'],
            }),
          ],
        }),
        ['ssmPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['sagemaker:*'],
              resources: [
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint/${props.endpointName}`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:model/*`,
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:model-package/*`,
                'arn:aws:sagemaker:us-east-1:865070037744:model-package/cohere-gpt-medium-v1-4-825b877abfd53d7ca65fd7b4b262c421',
              ],
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

    this.startSagemakerLambda = new DockerImageFunction(
      this,
      'startSagemakerLambda',
      {
        code: DockerImageCode.fromImageAsset('src/resources/startSagemaker'),
        timeout: Duration.minutes(15),
        role: startSagemakerRole,
        environment: {
          LOG_LEVEL: props.logLevel,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: sageMakerRole.roleName,
          COHERE_INSTANCE_TYPE: props.cohereInstanceType,
        },
      },
    );

    const startSummarizationRole = new Role(this, 'startSummarizationRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['sagemakerPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [
                `arn:aws:sagemaker:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:endpoint/${props.endpointName}`,
              ],
              actions: ['sagemaker:InvokeEndpoint'],
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

    this.startSummarizationLambda = new DockerImageFunction(
      this,
      'startSummarizationLambda',
      {
        code: DockerImageCode.fromImageAsset(
          'src/resources/startSummarization',
        ),
        role: startSummarizationRole,
        timeout: Duration.minutes(15),
        environment: {
          LOG_LEVEL: props.logLevel,
          STATUS_TABLE: props.statusTable.tableName,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: sageMakerRole.roleName,
          OUTPUT_BUCKET: props.recordingBucket.bucketName,
          OUTPUT_BUCKET_PREFIX: 'summaryOutput',
        },
      },
    );
    props.statusTable.grantReadWriteData(this.startSummarizationLambda);
    props.recordingBucket.grantReadWrite(this.startSummarizationLambda);
  }
}
