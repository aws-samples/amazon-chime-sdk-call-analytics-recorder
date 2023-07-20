/* eslint-disable import/no-extraneous-dependencies */
import {
  SageMakerClient,
  CreateModelCommand,
  DescribeModelCommand,
  DescribeEndpointConfigCommand,
  CreateEndpointConfigCommand,
  DescribeEndpointCommand,
  CreateEndpointCommand,
  DeleteEndpointCommand,
} from '@aws-sdk/client-sagemaker';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new SageMakerClient({ region: 'us-east-1' });

const endpointName = process.env.ENDPOINT_NAME;
const modelPackageArn = process.env.MODEL_PACKAGE_ARN;
const sagemakerRole = process.env.SAGEMAKER_ROLE;
const cohereInstanceType = process.env.COHERE_INSTANCE_TYPE;
const modelName = process.env.MODEL_NAME;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.info('Event Received', event);
  const body = JSON.parse(event.body || '{}');
  const action = body.action;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Access-Control-Allow-Credentials': true,
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (action === 'start') {
    console.info('Starting Sagemaker Instance');

    try {
      await client.send(new DescribeModelCommand({ ModelName: modelName }));
      console.info(`Model ${modelName} already exists`);
    } catch (error) {
      console.error('Error:', error);
      console.info(`Creating model: ${modelName}`);
      await client.send(
        new CreateModelCommand({
          ModelName: modelName,
          Containers: [{ ModelPackageName: modelPackageArn }],
          ExecutionRoleArn: sagemakerRole,
          EnableNetworkIsolation: true,
        }),
      );
    }
    try {
      await client.send(
        new DescribeEndpointConfigCommand({ EndpointConfigName: endpointName }),
      );
      console.info(`Endpoint configuration ${endpointName} already exists`);
    } catch (error) {
      console.error('Error:', error);
      console.info(`Creating EndpointConfiguration: ${endpointName}`);
      await client.send(
        new CreateEndpointConfigCommand({
          EndpointConfigName: endpointName,
          ProductionVariants: [
            {
              ModelName: modelName,
              VariantName: 'AllTraffic',
              InitialInstanceCount: 1,
              InstanceType: cohereInstanceType,
              InitialVariantWeight: 1,
            },
          ],
        }),
      );
    }
    try {
      await client.send(
        new DescribeEndpointCommand({ EndpointName: endpointName }),
      );
      console.info(`Endpoint ${endpointName} already exists`);
    } catch (error) {
      console.info(`Creating Endpoint: ${endpointName}`);
      console.error('Error:', error);
      await client.send(
        new CreateEndpointCommand({
          EndpointName: endpointName,
          EndpointConfigName: endpointName,
        }),
      );
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Sagemaker Instance Started',
      }),
    };
  } else if (action === 'stop') {
    console.info('Stopping Sagemaker Instance');

    try {
      await client.send(
        new DeleteEndpointCommand({ EndpointName: endpointName }),
      );
      console.info(`Endpoint ${endpointName} deleted`);
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({
          message: error,
        }),
      };
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Sagemaker Instance Stopped',
      }),
    };
  } else if (action === 'query') {
    console.info('Querying Sagemaker Instance Status');
    try {
      const endpointStatus = await client.send(
        new DescribeEndpointCommand({ EndpointName: endpointName }),
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: endpointStatus.EndpointStatus,
        }),
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Endpoint disabled',
        }),
      };
    }
  } else {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message:
          'Invalid action. Please provide either "start" or "stop" as the action.',
      }),
    };
  }
};
