import os
import logging
from sagemaker import ModelPackage
import sagemaker as sage

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
MODEL_PACKAGE_ARN = os.environ['MODEL_PACKAGE_ARN']
SAGEMAKER_ROLE = os.environ['SAGEMAKER_ROLE']
COHERE_INSTANCE_TYPE = os.environ['COHERE_INSTANCE_TYPE']

def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartSagemaker Notification: '

    logger.info('%s Event Received %s ', LOG_PREFIX, event)
    key = event['Payload']['body']['key']
    bucket = event['Payload']['body']['bucket']

    sagemaker_session = sage.Session()
    cohere_model = ModelPackage(role=SAGEMAKER_ROLE, model_package_arn=MODEL_PACKAGE_ARN, sagemaker_session=sagemaker_session)
    logger.info('%s Starting Sagemaker Instance', LOG_PREFIX)
    cohere_model.deploy(
      initial_instance_count=1,
      instance_type=COHERE_INSTANCE_TYPE,
      endpoint_name=ENDPOINT_NAME)

    return {
        'statusCode': 200,
        'body': {'message': 'Sagemaker Instance Started', 'bucket': bucket, 'key': key}
    }
    