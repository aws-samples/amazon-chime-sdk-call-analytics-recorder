import os
import logging
import boto3
import uuid
import botocore
from datetime import datetime, timedelta
# from sagemaker import ModelPackage, Session

dynamodb_client = boto3.client('dynamodb')
sagemaker_client = boto3.client('sagemaker')

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

STATUS_TABLE = os.environ['STATUS_TABLE']
ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
SAGEMAKER_ROLE = os.environ['SAGEMAKER_ROLE']
MODEL_PACKAGE_ARN = os.environ['MODEL_PACKAGE_ARN']

# sagemaker_session = Session()
# co = Client(endpoint_name=ENDPOINT_NAME)
# cohere_model = ModelPackage(role=SAGEMAKER_ROLE, model_package_arn=MODEL_PACKAGE_ARN, sagemaker_session=sagemaker_session)

def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'CheckStatus Notification: '

    logger.info('%s Event Received %s ', LOG_PREFIX, event)
    # Get the bucket name and key from the event object
    
    twenty_minutes_ago = int((datetime.utcnow() - timedelta(minutes=20)).timestamp())

    try:
        response = dynamodb_client.scan(
            TableName=STATUS_TABLE,
            FilterExpression='summarization_time >= :t',
            ExpressionAttributeValues={
                ':t': {'N': str(twenty_minutes_ago)}
            }
        )
        logger.info('%s Records found: %s', LOG_PREFIX, response['Items'])
        items = response['Items']
        if len(items) > 0:
            logger.info('%s Found %s records with timestamp less than 20 minutes ago.', LOG_PREFIX, len(items))
        else:
            logger.info('%s No records found with timestamp less than 20 minutes ago.', LOG_PREFIX)
            logger.info('%s Terminating Sagemaker instance', LOG_PREFIX)
            delete_sagemaker()

    except Exception as error:
        logger.error("%s Error: %s", LOG_PREFIX, error)


def delete_sagemaker():
    try:
        response = sagemaker_client.describe_endpoint(EndpointName=ENDPOINT_NAME)
        endpoint_status = response['EndpointStatus']
    except botocore.exceptions.ClientError as error:
        if error.response['Error']['Code'] == 'ValidationException':
            endpoint_status = 'NonExistent'
        else:
            raise error

    logger.info('%s Endpoint Status: %s', LOG_PREFIX, endpoint_status)


    if endpoint_status != 'NonExistent':
        try:
            response = sagemaker_client.describe_endpoint_config(EndpointConfigName=ENDPOINT_NAME)
            model_name = response['ProductionVariants'][0]['ModelName']
            sagemaker_client.delete_endpoint(EndpointName=ENDPOINT_NAME)
            sagemaker_client.delete_endpoint_config(EndpointConfigName=ENDPOINT_NAME)
            sagemaker_client.delete_model(ModelName=model_name)
        except Exception as error:
            logger.error('%s Failed to delete Sagemaker instance: %s', LOG_PREFIX, error)
        finally:
            logger.info('%s Deleted Sagemaker endpoint %s', LOG_PREFIX, ENDPOINT_NAME)
    else:
        logger.info('%s Sagemaker endpoint %s does not exist', LOG_PREFIX, ENDPOINT_NAME)


def update_database():
    prompt_id = str(uuid.uuid4())
    timestamp = int(datetime.utcnow().timestamp())
    ttl = int((datetime.utcnow() + timedelta(hours=6)).timestamp())
    dynamodb_client.put_item(
        TableName=STATUS_TABLE,
        Item={
            'prompt_id': {'S': prompt_id},
            'summarization_time': {'N': str(timestamp)},
            'ttl': {'N': str(ttl)},
            'status': {'S': 'Check Status Placeholder'}
        }
    )