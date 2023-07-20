import { Duration, Stack } from 'aws-cdk-lib';
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

interface EventBridgeResourceProps {
  graphqlEndpoint: GraphqlApi;
}

export class EventBridgeResources extends Construct {
  constructor(scope: Construct, id: string, props: EventBridgeResourceProps) {
    super(scope, id);

    const notificationLambdaRole = new Role(this, 'notificationLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
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

    const notificationLambda = new NodejsFunction(this, 'notificationLambda', {
      entry: 'src/resources/notificationLambda/index.ts',
      functionName: 'amazon-chime-sdk-recorder-notification',
      handler: 'handler',
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      role: notificationLambdaRole,
      timeout: Duration.seconds(60),
      environment: {
        GRAPHQL_ENDPOINT: props.graphqlEndpoint.graphqlUrl,
        AWS_ACCOUNT_ID: Stack.of(this).account,
        GRAPHQL_API_KEY: props.graphqlEndpoint.apiKey ?? '',
      },
    });

    props.graphqlEndpoint.grantMutation(notificationLambdaRole);

    const streamingStartRule = new Rule(this, 'streamingStartRule', {
      eventPattern: {
        source: ['aws.chime'],
        detailType: ['Chime VoiceConnector Streaming Status'],
      },
    });

    streamingStartRule.addTarget(new LambdaFunction(notificationLambda));
  }
}
