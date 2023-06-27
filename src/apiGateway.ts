/* eslint-disable import/no-extraneous-dependencies */
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface apiGatewayResourcesProps {
  logLevel: string;
  controlSageMakerLambda: IFunction;
  startSummarizationLambda: IFunction;
}

export class ApiGatewayResources extends Construct {
  public controlSageMakerApi: RestApi;

  constructor(scope: Construct, id: string, props: apiGatewayResourcesProps) {
    super(scope, id);
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
    const query = api.root.addResource('query');

    const actionIntegration = new LambdaIntegration(
      props.controlSageMakerLambda,
    );

    const queryIntegration = new LambdaIntegration(
      props.startSummarizationLambda,
    );

    action.addMethod('POST', actionIntegration, {});
    query.addMethod('POST', queryIntegration, {});

    this.controlSageMakerApi = api;
  }
}
