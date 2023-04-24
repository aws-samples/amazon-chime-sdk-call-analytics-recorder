import logging
import json
import decimal
import os
import datetime
import boto3
dynamodb = boto3.client('dynamodb')
media_pipelines = boto3.client("chime-sdk-media-pipelines")
# Initialize the S3 client
s3_client = boto3.client('s3')
CALL_TABLE = os.environ['CALL_TABLE']
RECORDING_BUCKET = os.environ['RECORDING_BUCKET']
try:
    RECORDING_BUCKET_PREFIX = os.environ['RECORDING_BUCKET_PREFIX']
    if RECORDING_BUCKET_PREFIX[-1] == '/':
        RECORDING_BUCKET_PREFIX = RECORDING_BUCKET_PREFIX[:-1]
    RECORDING_BUCKET_PREFIX = '/' + RECORDING_BUCKET_PREFIX
except BaseException:
    RECORDING_BUCKET_PREFIX = ''
MEDIA_INSIGHT_PIPELINE_ARN = os.environ['MEDIA_INSIGHT_PIPELINE_ARN']
VOICECONNECTOR_ID = os.environ['VOICECONNECTOR_ID']
# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return int(obj)
        return super(DecimalEncoder, self).default(obj)
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.strftime("%Y-%m-%d %H:%M:%S")
        return json.JSONEncoder.default(self, obj)
def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'EventBridge Notification: '
    if 'detail-type' in event:
        if event['detail-type'] == 'AWS API Call via CloudTrail':
            logger.info('%s Event Name: %s | Event Source: %s', LOG_PREFIX, event['detail']['eventName'], event['detail']['eventSource'])
            logger.debug('%s userIdentity: %s', LOG_PREFIX, json.dumps(event['detail']['userIdentity'],  cls=DecimalEncoder, indent=4))
            logger.debug('%s requestParameters: %s', LOG_PREFIX, json.dumps(event['detail']['requestParameters'],  cls=DecimalEncoder, indent=4))
            logger.debug('%s responseElements: %s', LOG_PREFIX, json.dumps(event['detail']['responseElements'],  cls=DecimalEncoder, indent=4))
        elif event['detail-type'] == 'Chime VoiceConnector Streaming Status':
            logger.info('%s Detail Type: %s | Streaming Status: %s', LOG_PREFIX, event['detail-type'], event['detail']['streamingStatus'])
            logger.info('%s  %s', LOG_PREFIX, json.dumps(event,  cls=DecimalEncoder, indent=4))
            if event['detail']['voiceConnectorId'] == VOICECONNECTOR_ID:
                if event['detail']['streamingStatus'] == 'STARTED':
                    start_time = datetime.datetime.fromisoformat(event['detail']['startTime'][:-1])
                    put_item(event['detail']['callId'], event['detail']['streamArn'], '1' if event['detail']['isCaller'] else '0', int(start_time.timestamp()))
                elif event['detail']['streamingStatus'] == 'ENDED' and event['detail']['isCaller']:
                    stream_arns = get_streams(event['detail']['callId'])
                    if stream_arns:
                        caller_stream_arn = stream_arns[0]['stream_arn']['S']
                        not_caller_stream_arn = stream_arns[1]['stream_arn']['S']
                        start_time = stream_arns[0]['start_time']['N']
                        end_time = datetime.datetime.fromisoformat(event['detail']['endTime'][:-1])
                        destination = 'arn:aws:s3:::' + RECORDING_BUCKET + RECORDING_BUCKET_PREFIX + "/" + event['detail']['callId'] + '.wav'
                        logger.info('%s Stream ARNS:  %s', LOG_PREFIX, json.dumps(stream_arns,  cls=DecimalEncoder, indent=4))
                        logger.info('%s End Time:  %s', LOG_PREFIX, end_time)
                        logger.info('%s Destination: %s', LOG_PREFIX, destination)
                        response = media_pipelines.create_media_insights_pipeline(
                            MediaInsightsPipelineConfigurationArn=MEDIA_INSIGHT_PIPELINE_ARN,
                            KinesisVideoStreamRecordingSourceRuntimeConfiguration={
                                "Streams": [
                                    {"StreamArn": caller_stream_arn},
                                    {"StreamArn": not_caller_stream_arn}
                                    ],
                                "FragmentSelector": {
                                    "FragmentSelectorType": "ProducerTimestamp",
                                    "TimestampRange": {
                                        "StartTimestamp": int(start_time),
                                        "EndTimestamp": int(end_time.timestamp())
                                        },
                                    }
                                },
                            S3RecordingSinkRuntimeConfiguration={
                                "Destination": destination,
                                "RecordingFileFormat": "Wav"
                            }
                        )
                        # Call the function with the JSON object and S3 client
                        write_call_details_to_s3(event)
                        logger.info('%s  %s', LOG_PREFIX, json.dumps(response,  cls=DateTimeEncoder, indent=4))
        elif event['detail-type'] == 'Media Insights State Change':
            if "failureReason" in event['detail']:
                logger.error('%s Detail Type: %s | Failure Reason: %s', LOG_PREFIX, event['detail-type'], event['detail']['failureReason'])
                logger.info('%s Detail Type: %s', LOG_PREFIX, event['detail-type'])
                logger.debug('%s  %s', LOG_PREFIX, json.dumps(event,  cls=DecimalEncoder, indent=4))
            else:
                logger.info('%s Detail Type: %s', LOG_PREFIX, event['detail-type'])
                logger.debug('%s  %s', LOG_PREFIX, json.dumps(event,  cls=DecimalEncoder, indent=4))
        else:
            logger.info('%s Detail Type: %s', LOG_PREFIX, event['detail-type'])
            logger.debug('%s  %s', LOG_PREFIX, json.dumps(event,  cls=DecimalEncoder, indent=4))


def put_item(call_id, stream_arn, is_caller, start_time):
    dynamodb.put_item(
        TableName=CALL_TABLE,
        Item={
            'call_id': {'S': call_id},
            'stream_arn': {'S': stream_arn},
            'is_caller': {'S': is_caller},
            'start_time': {'N': str(start_time)}
            }
    )


def get_streams(call_id):
    response = dynamodb.query(
        TableName=CALL_TABLE,
        KeyConditionExpression='call_id = :call_id',
        ExpressionAttributeValues={
            ':call_id': {'S': call_id}
            }
        )
    return response['Items'] if 'Items' in response else None


def write_call_details_to_s3(event):
    destination = RECORDING_BUCKET_PREFIX[1:] + "/" + event['detail']['callId'] + '.json'
    data = {
        'account': event['account'],
        'callId': event['detail']['callId'],
        'transactionId': event['detail']['transactionId'],
        'direction': event['detail']['direction'],
        'fromNumber': event['detail']['fromNumber'],
        'toNumber': event['detail']['toNumber'],
        'voiceConnectorId': event['detail']['voiceConnectorId'],
        'startTime': event['detail']['startTime'],
        'endTime': event['detail']['endTime']
    }
    json_data = json.dumps(data)
    response = s3_client.put_object(
        Bucket=RECORDING_BUCKET,
        Key=destination,
        Body=json_data
    )
    return response
