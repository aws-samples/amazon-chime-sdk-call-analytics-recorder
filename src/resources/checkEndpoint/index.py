import json
import boto3
import logging
from botocore.exceptions import ClientError
import os

sagemaker = boto3.client('sagemaker')

logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

ENDPOINT_NAME = os.environ['ENDPOINT_NAME']

def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'CheckEndpoint Notification: '


    if "Payload" in event:
        key = event['Payload']['body']['key']
        bucket = event['Payload']['body']['bucket']
        logger.info('%s Received object: %s', LOG_PREFIX, key)
        logger.info('%s Received bucket: %s', LOG_PREFIX, bucket)
        logger.info('%s event: %s', LOG_PREFIX, event)
    else:
        key = event['key']
        bucket = event['bucket']
        logger.info('%s Received object: %s', LOG_PREFIX, key)
        logger.info('%s Received bucket: %s', LOG_PREFIX, bucket)
        logger.info('%s event: %s', LOG_PREFIX, event)


    try:
        response = sagemaker.describe_endpoint(EndpointName=ENDPOINT_NAME)
        logger.info('%s endpoint: %s', LOG_PREFIX, response)
        status = response['EndpointStatus']
        logger.info('%s endpoint status: %s', LOG_PREFIX, status)
        return {
            'statusCode': 200,
            'body': {'endpoint_status': status, 'bucket': bucket, 'key':key}
        }
    except ClientError as error:
        if error.response['Error']['Code'] == 'ValidationException':
            logger.info('%s endpoint not found', LOG_PREFIX)
            return {
                'statusCode': 404,
                'body': {'endpoint_status': 'NotFound', 'bucket': bucket, 'key': key},
            }
    except Exception as error:
        logger.error('%s error checking endpoint status: %s', LOG_PREFIX, str(error))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': f'Error checking endpoint status: {str(error)}'}),
        }