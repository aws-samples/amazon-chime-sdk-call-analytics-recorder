import os
import re
import logging
import boto3

s3 = boto3.client('s3')
transcribe = boto3.client('transcribe')

# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

OUTPUT_BUCKET = os.environ['OUTPUT_BUCKET']
try:
    OUTPUT_BUCKET_PREFIX = os.environ['OUTPUT_BUCKET_PREFIX']
    if OUTPUT_BUCKET_PREFIX[-1] != '/':
          OUTPUT_BUCKET_PREFIX = OUTPUT_BUCKET_PREFIX + '/'
except BaseException:
    OUTPUT_BUCKET_PREFIX = ''


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartTranscribe Notification: '

    logger.info('%s Event Received %s ', LOG_PREFIX, event)
    # Get the bucket name and key from the event object
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    logger.info('%s Bucket: %s Key: %s', LOG_PREFIX, bucket, key)
    # Check if the file uploaded is a WAV file
    if not key.lower().endswith('.wav') and not key.lower().endswith('.ogg'):
        print('File is not a WAV or OGG file')
        return

    # Set the name of the transcription job
    job_name = re.sub(r'[^a-zA-Z0-9-_]', '', os.path.splitext(os.path.basename(key))[0].replace(' ', '_'))

    # Set the output path for the transcription results
    output_key =  OUTPUT_BUCKET_PREFIX  + job_name + '.json'
    media_format = 'wav' if key.lower().endswith('.wav') else 'ogg'

    logger.info('%s Media Format: %s', LOG_PREFIX, media_format)

    logger.info('%s Output Key: %s', LOG_PREFIX, output_key)
    logger.info('%s Output Bucket: %s', LOG_PREFIX, OUTPUT_BUCKET)

    logger.info('%s Transcription Job Name: %s', LOG_PREFIX, job_name)
    # Start the transcription job
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={'MediaFileUri': f's3://{bucket}/{key}'},
        Settings= {"ShowSpeakerLabels": True, "MaxSpeakerLabels":2},
        MediaFormat=media_format,
        LanguageCode='en-US',
        OutputBucketName=OUTPUT_BUCKET,
        OutputKey=output_key
    )

    print(f'Transcription job "{job_name}" started')

