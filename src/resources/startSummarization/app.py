from cohere_sagemaker import Client
import boto3
import json
import string
import os
import logging
import uuid
from datetime import datetime, timedelta

s3 = boto3.client('s3')
dynamodb_client = boto3.client('dynamodb')
# Set LOG_LEVEL using environment variable, fallback to INFO if not present
logger = logging.getLogger()
try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

DEFAULT_QUESTION = "What is the customer calling about and what are the next steps?"
ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
MODEL_PACKAGE_ARN= os.environ['MODEL_PACKAGE_ARN']
SAGEMAKER_ROLE= os.environ['SAGEMAKER_ROLE']
OUTPUT_BUCKET= os.environ['OUTPUT_BUCKET']
OUTPUT_BUCKET_PREFIX= os.environ['OUTPUT_BUCKET_PREFIX']
STATUS_TABLE = os.environ['STATUS_TABLE']


co = Client(endpoint_name=ENDPOINT_NAME)


# Combine Transcription
def chunk_transcription(transcript):
    words = transcript['results']['items']
    punctuation = set(string.punctuation)
    punctuation.add('')

    part_template = {
        "speaker_label": -1,
        "words": ''
    }
    part, parts = part_template.copy(), []
    for word in words:
        if word['speaker_label'] != part['speaker_label']:

            if part['speaker_label']!= -1:
                parts.append(part)
            part = part_template.copy()

        part['speaker_label'] = word['speaker_label']
        w = word['alternatives'][0]['content']
        if len(part['words'])>0 and w not in punctuation:
            part['words'] += ' '
        part['words'] += w
    return parts

# Set Speaker names
def rename_speakers(chunks):
    speaker_mapping = {}
    for i in range(20):
        speaker_mapping["spk_%i" %i] = "Speaker %i" %i
    for c in chunks:
        c['speaker_label'] = speaker_mapping[c['speaker_label']]
    return chunks

# Build Lines
def build_lines_speakers(transcript):
    chunks = chunk_transcription(transcript)
    chunks = rename_speakers(chunks)

    lines = []
    for c in chunks:
        lines.append("%s: %s" %(c['speaker_label'], c['words']))

    call = ''
    for line in lines:
        call += line + '\n'
    return call


def load_transcript(s3_object):
    logger.info('%s Loading transcript from S3 object: %s', LOG_PREFIX, s3_object)
    content = s3_object['Body'].read().decode('utf-8')
    return json.loads(content)

# This is the creation of the Prompt.
def get_cohere_prompt(transcript):
    logger.info('%s Building prompt from transcript: %s', LOG_PREFIX, transcript)
    lines = build_lines_speakers(transcript)
    prompt = """Call: 
%s

What is the customer calling about and what are the next steps?""" %lines
    return prompt

def get_cohere_response(prompt):
    logger.info('%s Generating response using cohere: %s', LOG_PREFIX, prompt)
    cohere_response = co.generate(prompt=prompt, max_tokens=100, temperature=0.9, return_likelihoods='GENERATION')
    cohere_text = cohere_response.generations[0].text
    cohere_text = '.'.join(cohere_text.split('.')[:-1]) + '.'

    return cohere_text

def prepare_response(prompt, response, call_metadata=None):
    logger.info('%s Preparing response: %s', LOG_PREFIX, response)
    result  = {
        'time': datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "service-type": "MediaInsights",
        "detail-type": "LargeLanguageModelSummary",
        "summaryEvent": {
            'prompt': prompt,
            'response': response,
        }
    }

    if call_metadata is not None:
        result['metadata'] = call_metadata
    return result

def put_summary(summary_event,prompt_id):
    logger.info('%s Putting summary event: %s', LOG_PREFIX, summary_event)
    summary_event = json.dumps(summary_event)
    key = OUTPUT_BUCKET_PREFIX + '/' + prompt_id + '.json'
    s3.put_object(Bucket=OUTPUT_BUCKET, Key=key, Body=summary_event)

def update_database(prompt_id):
    logger.info('%s Updating database: %s', LOG_PREFIX, prompt_id)
    prompt_id = str(uuid.uuid4())
    timestamp = int(datetime.utcnow().timestamp())
    ttl = int((datetime.utcnow() + timedelta(hours=6)).timestamp())
    dynamodb_client.put_item(
        TableName=STATUS_TABLE,
        Item={
            'prompt_id': {'S': prompt_id},
            'summarization_time': {'N': str(timestamp)},
            'ttl': {'N': str(ttl)},
        }
    )


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartSummarization Notification: '

    logger.info('%s Received event: %s', LOG_PREFIX, json.dumps(event, indent=2))
    key = event['Payload']['body']['key']
    bucket = event['Payload']['body']['bucket']

    logger.info('%s Received object: %s', LOG_PREFIX, key)
    logger.info('%s Received bucket: %s', LOG_PREFIX, bucket)

    if not key.lower().endswith('.json') and not key.lower().endswith('.ogg'):
        logger.info('%s Skipping non-JSON object: %s', LOG_PREFIX, key)
        return


    s3_object = s3.get_object(Bucket=bucket, Key=key)
    transcript = load_transcript(s3_object)
    logger.info('%s Transcript: %s', LOG_PREFIX, transcript)
    prompt_id = str(uuid.uuid4())
    logger.info('%s Prompt ID: %s', LOG_PREFIX, prompt_id)
    prompt = get_cohere_prompt(transcript)
    cohere_text = get_cohere_response(prompt)
    summary_event = prepare_response(prompt, cohere_text)
    update_database(prompt_id)
    put_summary(summary_event,prompt_id)

