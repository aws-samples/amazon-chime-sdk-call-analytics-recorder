import boto3
import logging
import os
import json

STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']

logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

client = boto3.client('stepfunctions')

def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartStateMachine Notification: '

    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    if not key.lower().endswith('.json'):
        print('File is not a json file')
        return
    
    state_machine_input = {
        'bucket': bucket,
        'key': key
    }

    logger.info('%s Event: %s', LOG_PREFIX, event)
    client.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        input=json.dumps(state_machine_input)
    )

