import os
import logging
# from sagemaker import ModelPackage
# import sagemaker as sage
import boto3
import botocore

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

sagemaker_client=boto3.client('sagemaker')

ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
MODEL_PACKAGE_ARN = os.environ['MODEL_PACKAGE_ARN']
SAGEMAKER_ROLE = os.environ['SAGEMAKER_ROLE']
COHERE_INSTANCE_TYPE = os.environ['COHERE_INSTANCE_TYPE']
MODEL_NAME = os.environ['MODEL_NAME']

def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartSagemaker Notification: '

    logger.info('%s Event Received %s ', LOG_PREFIX, event)
    key = event['Payload']['body']['key']
    bucket = event['Payload']['body']['bucket']

    logger.info('%s Starting Sagemaker Instance', LOG_PREFIX)

    try:
        sagemaker_client.describe_model(ModelName=MODEL_NAME)
        logger.info('%s Model %s already exists', LOG_PREFIX, MODEL_NAME)
    except botocore.exceptions.ClientError as error:
        logger.info('%s Error: %s', LOG_PREFIX, error)
        logger.info('%s Creating model: %s', LOG_PREFIX, MODEL_NAME)
        sagemaker_client.create_model(
            ModelName=MODEL_NAME,
            Containers=[
                {
                    'ModelPackageName': MODEL_PACKAGE_ARN
                }
            ],
            ExecutionRoleArn=SAGEMAKER_ROLE,
            EnableNetworkIsolation=True,
        )

    try:
        sagemaker_client.describe_endpoint_config(EndpointConfigName=ENDPOINT_NAME)
        logger.info('%s Endpoint configuration %s already exists', LOG_PREFIX, ENDPOINT_NAME)
    except botocore.exceptions.ClientError as error:
        logger.info('%s Error: %s', LOG_PREFIX, error)
        logger.info('%s Creating EndpointConfiguration: %s', LOG_PREFIX, ENDPOINT_NAME)
        sagemaker_client.create_endpoint_config(
            EndpointConfigName=ENDPOINT_NAME,
            ProductionVariants=[
                {
                    'ModelName': MODEL_NAME,
                    'VariantName': 'AllTraffic',
                    'InitialInstanceCount': 1,
                    'InstanceType': COHERE_INSTANCE_TYPE,
                    'InitialVariantWeight': 1
                }
            ]
        )


    try:
        sagemaker_client.describe_endpoint(EndpointName=ENDPOINT_NAME)
        logger.info('%s Endpoint %s already exists', LOG_PREFIX, ENDPOINT_NAME)
    except botocore.exceptions.ClientError as error:
        logger.info('%s Creating Endpoint: %s', LOG_PREFIX, ENDPOINT_NAME)
        logger.info('%s Error: %s', LOG_PREFIX, error)
        sagemaker_client.create_endpoint(
            EndpointName=ENDPOINT_NAME,
            EndpointConfigName=ENDPOINT_NAME
        )


    return {
        'statusCode': 200,
        'body': {'message': 'Sagemaker Instance Started', 'bucket': bucket, 'key': key}
    }
