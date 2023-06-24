/* eslint-disable import/no-extraneous-dependencies */
// import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
// import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
// import { Duration } from 'aws-cdk-lib';
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
// import { Table } from 'aws-cdk-lib/aws-dynamodb';
// import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
// import { Runtime, Architecture, IFunction } from 'aws-cdk-lib/aws-lambda';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
// import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

interface apiGatewayResourcesProps {
  // connectionTable: Table;
  logLevel: string;
  controlSageMakerLambda: IFunction;
}

export class ApiGatewayResources extends Construct {
  // public webSocketApi: WebSocketApi;
  // public webSocketStage: WebSocketStage;
  public controlSageMakerApi: RestApi;

  constructor(scope: Construct, id: string, props: apiGatewayResourcesProps) {
    super(scope, id);

    // this.webSocketApi = new WebSocketApi(this, 'webSocketApi', {
    //   apiName: 'summarizerWebSocketApi',
    // });

    // this.webSocketStage = new WebSocketStage(this, 'webSocketStage', {
    //   webSocketApi: this.webSocketApi,
    //   stageName: 'dev',
    //   autoDeploy: true,
    // });

    // const webSocketLambdaRole = new Role(this, 'webSocketLambdaRole', {
    //   assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    //   managedPolicies: [
    //     ManagedPolicy.fromAwsManagedPolicyName(
    //       'service-role/AWSLambdaBasicExecutionRole',
    //     ),
    //   ],
    // });

    // const webSocketLambda = new NodejsFunction(this, 'kdsConsumerLambda', {
    //   handler: 'index.handler',
    //   entry: 'src/resources/kdsConsumer/index.ts',
    //   architecture: Architecture.ARM_64,
    //   timeout: Duration.minutes(1),
    //   runtime: Runtime.NODEJS_18_X,
    //   role: webSocketLambdaRole,
    //   environment: {
    //     CONNECTION_TABLE: props.connectionTable.tableName,
    //     API_GATEWAY_ENDPOINT: `https://${this.webSocketApi.apiId}.execute-api.${this.webSocketApi.stack.region}.amazonaws.com/${this.webSocketStage.stageName}`,
    //     LOG_LEVEL: props.logLevel,
    //   },
    // });

    // this.webSocketApi.addRoute('$connect', {
    //   integration: new WebSocketLambdaIntegration(
    //     'ConnectIntegration',
    //     webSocketLambda,
    //   ),
    // });
    // this.webSocketApi.addRoute('$disconnect', {
    //   integration: new WebSocketLambdaIntegration(
    //     'DisconnectIntegration',
    //     webSocketLambda,
    //   ),
    // });
    // this.webSocketApi.addRoute('$default', {
    //   integration: new WebSocketLambdaIntegration(
    //     'DefaultIntegration',
    //     webSocketLambda,
    //   ),
    // });

    // this.webSocketStage.grantManagementApiAccess(webSocketLambda);
    // this.webSocketApi.grantManageConnections(webSocketLambda);

    const api = new RestApi(this, 'controlSageMakerApi', {
      restApiName: 'controlSageMakerApi',
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'POST'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const action = api.root.addResource('action');

    const actionIntegration = new LambdaIntegration(
      props.controlSageMakerLambda,
    );

    action.addMethod('POST', actionIntegration, {});

    this.controlSageMakerApi = api;
  }
}
