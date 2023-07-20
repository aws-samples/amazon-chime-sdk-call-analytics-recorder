/* eslint-disable import/no-extraneous-dependencies */
import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
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
  DockerImageFunction,
  DockerImageCode,
  IFunction,
} from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface LambdaResourcesProps {
  logLevel: string;
  endpointName: string;
  modelPackageArn: string;
  cohereInstanceType: string;
  modelName: string;
  createSageMakerOnStart: string;
  recordingBucket: Bucket;
  graphqlEndpoint: GraphqlApi;
  voiceConnectorId: string;
}

export class LambdaResources extends Construct {
  controlSageMakerLambda: IFunction;
  sageMakerRole: Role;
  startSummarizationLambda: IFunction;

  constructor(scope: Construct, id: string, props: LambdaResourcesProps) {
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
        ['graphqlPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['appsync:GraphQL'],
              resources: [props.graphqlEndpoint.arn],
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

    const startTranscribeLambda = new NodejsFunction(
      this,
      'startTranscribeLambda',
      {
        handler: 'index.handler',
        functionName: 'amazon-chime-sdk-recorder-startTranscribe',
        entry: 'src/resources/startTranscribe/index.ts',
        timeout: Duration.minutes(1),
        runtime: Runtime.NODEJS_18_X,
        role: startTranscribeRole,
        environment: {
          LOG_LEVEL: props.logLevel,
          OUTPUT_BUCKET: props.recordingBucket.bucketName,
          OUTPUT_BUCKET_PREFIX: 'transcribeOutput',
          GRAPHQL_ENDPOINT: props.graphqlEndpoint.graphqlUrl,
          GRAPHQL_API_KEY: props.graphqlEndpoint.apiKey || '',
        },
      },
    );

    props.recordingBucket.grantReadWrite(startTranscribeLambda);
    props.graphqlEndpoint.grantMutation(startTranscribeRole);

    props.recordingBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(startTranscribeLambda),
      { prefix: props.voiceConnectorId },
    );

    const sageMakerRole = new Role(this, 'sagemakerRole', {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

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
        ['graphqlPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['appsync:GraphQL'],
              resources: [props.graphqlEndpoint.arn],
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
        functionName: 'amazon-chime-sdk-recorder-startSummarization',
        role: startSummarizationRole,
        timeout: Duration.minutes(15),
        environment: {
          LOG_LEVEL: props.logLevel,
          MODEL_NAME: props.modelName,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: sageMakerRole.roleArn,
          OUTPUT_BUCKET: props.recordingBucket.bucketName,
          OUTPUT_BUCKET_PREFIX: 'summaryOutput',
          GRAPHQL_ENDPOINT: props.graphqlEndpoint.graphqlUrl,
          GRAPHQL_API_KEY: props.graphqlEndpoint.apiKey || '',
        },
      },
    );
    props.recordingBucket.grantReadWrite(this.startSummarizationLambda);

    props.graphqlEndpoint.grantMutation(startSummarizationRole);

    props.recordingBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(this.startSummarizationLambda),
      { prefix: 'transcribeOutput' },
    );

    const sageMakerLambdaRole = new Role(this, 'controlSageMakerLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    const sageMakerCustomResourceRole = new Role(
      this,
      'sageMakerCustomResourceRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
          ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
        ],
      },
    );

    this.sageMakerRole = new Role(this, 'sageMakerRole', {
      assumedBy: new ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });

    this.controlSageMakerLambda = new NodejsFunction(
      this,
      'controlSageMakerLambda',
      {
        handler: 'index.handler',
        functionName: 'amazon-chime-sdk-recorder-controlSageMaker',
        entry: 'src/resources/controlSageMaker/index.ts',
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(1),
        runtime: Runtime.NODEJS_18_X,
        role: sageMakerLambdaRole,
        environment: {
          LOG_LEVEL: props.logLevel,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: this.sageMakerRole.roleArn,
          COHERE_INSTANCE_TYPE: props.cohereInstanceType,
          MODEL_NAME: props.modelName,
        },
      },
    );

    const sageMakerCustomResource = new NodejsFunction(
      this,
      'sageMakerCustomResourceLambda',
      {
        handler: 'index.handler',
        entry: 'src/resources/sageMakerCustomResource/index.ts',
        functionName: 'amazon-chime-sdk-recorder-sageMakerCustomResource',
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(1),
        runtime: Runtime.NODEJS_18_X,
        role: sageMakerLambdaRole,
        environment: {
          LOG_LEVEL: props.logLevel,
          ENDPOINT_NAME: props.endpointName,
          MODEL_PACKAGE_ARN: props.modelPackageArn,
          SAGEMAKER_ROLE: this.sageMakerRole.roleArn,
          COHERE_INSTANCE_TYPE: props.cohereInstanceType,
          MODEL_NAME: props.modelName,
        },
      },
    );

    const sageMakerCustomResourceProvider = new Provider(
      this,
      'sageMakerCustomResourceProvider',
      {
        onEventHandler: sageMakerCustomResource,
        logRetention: RetentionDays.ONE_WEEK,
        role: sageMakerCustomResourceRole,
      },
    );

    new CustomResource(this, 'sageMakerCustomResource', {
      serviceToken: sageMakerCustomResourceProvider.serviceToken,
      properties: {
        CreateOnStart: props.createSageMakerOnStart,
      },
    });
  }
}
