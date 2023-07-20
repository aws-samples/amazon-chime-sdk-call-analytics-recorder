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
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
} from '@aws-sdk/client-sagemaker';
import {
  CdkCustomResourceEvent,
  CdkCustomResourceResponse,
  Context,
} from 'aws-lambda';

const client = new SageMakerClient({ region: 'us-east-1' });

const endpointName = process.env.ENDPOINT_NAME;
const modelPackageArn = process.env.MODEL_PACKAGE_ARN;
const sagemakerRole = process.env.SAGEMAKER_ROLE;
const cohereInstanceType = process.env.COHERE_INSTANCE_TYPE;
const modelName = process.env.MODEL_NAME;

const response: CdkCustomResourceResponse = {};

export const handler = async (
  event: CdkCustomResourceEvent,
  context: Context,
): Promise<CdkCustomResourceResponse> => {
  console.info('Event Received', event);
  const requestType = event.RequestType;
  const resourceProperties = event.ResourceProperties;

  response.StackId = event.StackId;
  response.RequestId = event.RequestId;
  response.LogicalResourceId = event.LogicalResourceId;
  response.PhysicalResourceId = context.logGroupName;

  switch (requestType) {
    case 'Create':
      if (resourceProperties.CreateOnStart === 'true') {
        console.info('Creating Sagemaker Instance');
        await createSagemakerInstance();
      } else {
        console.info('Not creating Sagemaker Instance');
      }
      break;
    case 'Update':
      console.log('Nothing to do on Update');
      break;
    case 'Delete':
      console.log('Deleting Sagemaker Instance');
      await deleteSagemakerInstance();
      break;
  }

  console.log(`Response: ${JSON.stringify(response)}`);
  return response;
};

async function createSagemakerInstance() {
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
    console.error('Error:', error);
    console.info(`Creating Endpoint: ${endpointName}`);
    await client.send(
      new CreateEndpointCommand({
        EndpointName: endpointName,
        EndpointConfigName: endpointName,
      }),
    );
  }
}

async function deleteSagemakerInstance() {
  console.info('Deleting Sagemaker Endpoint');
  try {
    await client.send(
      new DeleteEndpointCommand({ EndpointName: endpointName }),
    );
    console.info(`Endpoint ${endpointName} deleted`);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error Deleting Endpoint');
  }

  console.info('Deleting Sagemaker Endpoint Configuration');
  try {
    await client.send(
      new DeleteEndpointConfigCommand({ EndpointConfigName: endpointName }),
    );
    console.info(`Endpoint Configuration ${endpointName} deleted`);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error Deleting Endpoint Configuration');
  }

  console.info('Deleting Sagemaker Model');
  try {
    await client.send(new DeleteModelCommand({ ModelName: modelName }));
    console.info(`Model ${modelName} deleted`);
  } catch (error) {
    console.error('Error:', error);
    throw new Error('Error Deleting Model');
  }
}
