import json
import logging
import os
import string
import uuid
from datetime import datetime
import requests
import boto3
from cohere_sagemaker import Client as CohereClient

graphql_endpoint = os.environ.get('GRAPHQL_ENDPOINT')
graphql_api_key = os.environ.get('GRAPHQL_API_KEY')

update_call_mutation = '''
mutation UpdateCall($input: UpdateCallInput!) {
    updateCall(input: $input) {
    callId
    transactionId
    fromNumber
    toNumber
    callStartTime
    callEndTime
    status
    wavFile
    transcriptionFile
    queries
    transcription
    }
}
'''

add_query_mutation = '''
mutation AddQueryToCall($input: AddQueryToCallInput!) {
    addQueryToCall(input: $input) {
    transactionId
    queries
    }
}
'''

query_transcription_file = '''
query GetTranscriptionFile($transactionId: String!) {
  getCall(transactionId: $transactionId) {
    transcriptionFile
  }
}
'''


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

try:
    SUMMARY_QUESTION = os.environ['SUMMARY_QUESTION']
except BaseException:
    SUMMARY_QUESTION = "What is the customer calling about and what are the next steps?"
ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
MODEL_PACKAGE_ARN = os.environ['MODEL_PACKAGE_ARN']
MODEL_NAME = os.environ['MODEL_NAME']
SAGEMAKER_ROLE = os.environ['SAGEMAKER_ROLE']
OUTPUT_BUCKET = os.environ['OUTPUT_BUCKET']
OUTPUT_BUCKET_PREFIX = os.environ['OUTPUT_BUCKET_PREFIX']

co = CohereClient(endpoint_name=ENDPOINT_NAME)

##
# Break the transcription into dialogue chunks


def chunk_transcription(transcript):
    """
    Read the transcription JSON, break into chunks of dialogue spoken by individual.
    This function returns a list of chunks.
    Each chunk is a dictionary that has 2 (key, value) pairs.
        "speaker_label": string, current speaker. This will probably be ("spk_0", "spk_1", etc)
        "words": string, the words spoken in this chunk of dialogue.

    """
    words = transcript['results']['items']
    punctuation = set(string.punctuation)
    punctuation.add('')

    part_template = {
        "speaker_label": -1,
        "words": ''
    }
    part, parts = part_template.copy(), []
    full_count, part_count = 0, 0
    for word in words:
        if word['speaker_label'] != part['speaker_label']:
            part_count = 0
            if part['speaker_label'] != -1:
                parts.append(part)
            part = part_template.copy()

        part['speaker_label'] = word['speaker_label']
        w = word['alternatives'][0]['content']
        if len(part['words']) > 0 and w not in punctuation:
            part['words'] += ' '
        part['words'] += w

    parts.append(part)
    return parts

# # Set Speaker names
# def rename_speakers(chunks):
#     speaker_mapping = {}
#     for i in range(20):
#         speaker_mapping["spk_%i" %i] = "Speaker %i" %i
#     for c in chunks:
#         c['speaker_label'] = speaker_mapping[c['speaker_label']]
#     return chunks


def rename_speakers(chunks):
    """
    Replaces the spk_0, spk_1 with more human-readable identifiers.
    """
    speaker_mapping = {'spk_0': 'Agent', 'spk_1': 'Customer'}
    for i in range(2, 20):
        speaker_mapping[f'spk_{i}'] = f'Speaker {i}'

    for c in chunks:
        c['speaker_label'] = speaker_mapping.get(c['speaker_label'], c['speaker_label'])

    return chunks

# Build Lines


def build_lines(chunks):
    lines = []
    for c in chunks:
        lines.append("%s: %s" % (c['speaker_label'], c['words']))

    call_part = ''
    for line in lines:
        call_part += line + '\n'

    return call_part

# Break call into partitions that


def partition_call(chunks, max_word_count=1500, overlap_percentage=0.2):
    """
    Inputs:
        chunks- transcription broken into dicts representing a single speaker's chunk
        max_word_count- LLM-defined limits of input.
                        We use word count here vs token count, assuming 1 word~1 token.
        overlap_percentage- LLMs perform better if they have some context of what was spoken.
                            This number controls the amount of context

    This breaks the call into partitions that are manageable by the LLM.
    It returns the individual sections that can be attached to a prompt and sent to the LLM.
    """

    # Count words in each chunk
    counts = [len(d['words'].split()) for d in chunks]
    part_count = 0  # number of words in current partition
    i, j = 0, 0  # pointers
    partition_ends = []  # start, end of each partition
    while j < len(counts):
        part_count += counts[j]
        if part_count >= max_word_count:
            partition_ends.append([i, j])
            while part_count > (max_word_count * overlap_percentage):
                i += 1
                part_count -= counts[i]
        j += 1
    partition_ends.append([i, j])

    # with list of partition_ends, build partitions
    partitions = []
    for pe in partition_ends:
        part = chunks[pe[0]:pe[1]]
        partition = build_lines(part)
        partitions.append(partition)

    return partitions


##
# Build prompt(s)
def get_call_prompt(lines, question=SUMMARY_QUESTION):
    prompt = """Call:
%s

%s""" % (lines, question)
    return prompt


def get_call_prompts(partitions, question=SUMMARY_QUESTION):
    prompts = []
    for partition in partitions:
        prompt = get_call_prompt(partition, question)
        prompts.append(prompt)

    return prompts

##
# Send to Cohere


def get_response(prompt):
    cohere_response = co.generate(prompt=prompt, max_tokens=200, temperature=0, return_likelihoods='GENERATION')
    cohere_text = cohere_response.generations[0].text
    cohere_text = '.'.join(cohere_text.split('.')[:-1]) + '.'

    return cohere_text


def get_responses(prompts):
    cohere_texts = []
    for prompt in prompts:
        cohere_texts.append(get_response(prompt))

    return cohere_texts


def summarize_summaries(summaries, question=SUMMARY_QUESTION):

    if len(summaries) == 1:
        return summaries[0], None

    prompt = """Summaries:"""
    for t in summaries:
        prompt += """

%s""" % t

    prompt += """

Combine the summaries and answer this question: %s""" % question

    full_summary = get_response(prompt)

    return full_summary, prompt


def run_call(transcript, question=SUMMARY_QUESTION):

    # break call into dialogue lines
    chunks = chunk_transcription(transcript)
    chunks = rename_speakers(chunks)

    logger.info('%s Chunks: %s', LOG_PREFIX, chunks)

    # combine all dictionaries in chunks into a single list
    combined_chunks = []
    for chunk in chunks:
        combined_chunks.append(chunk)

    logger.info('%s Combined Chunks: %s', LOG_PREFIX, combined_chunks)
    # break dialogue lines into partitions
    partitions = partition_call(chunks, 1000, 0.3)
    prompts = get_call_prompts(partitions, question)

    logger.info('%s Prompt for Partition 1: %s ', LOG_PREFIX, prompts[0])
    # Partition Summary
    summaries = get_responses(prompts)

    # Combined Summary
    summary, summary_prompt = summarize_summaries(summaries)

    logger.info('%s Full Summary: %s', LOG_PREFIX, summary)
    logger.info('%s Transcription: %s', LOG_PREFIX, combined_chunks)

    summary_dict = {
        'transcription': combined_chunks,
        'list_prompt': prompts,
        'summary_prompt': summary_prompt,
        'final_summary': summary,
        'question': question,
        'model_name': MODEL_NAME,
        'model_arn': MODEL_PACKAGE_ARN,
    }

    return summary_dict


def prepare_summary(summary_dict, call_metadata=None):
    result = {
        'time': datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "service-type": "MediaInsights",
        "detail-type": "LargeLanguageModelSummary",
        "summaryEvent": summary_dict
    }

    if call_metadata is not None:
        result['metadata'] = call_metadata

    return result


def load_transcript(s3_object):
    logger.info('%s Loading transcript from S3 object: %s', LOG_PREFIX, s3_object)
    content = s3_object['Body'].read().decode('utf-8')
    return json.loads(content)


def put_summary(summary_event, prompt_id):
    logger.info('%s Putting summary event: %s', LOG_PREFIX, summary_event)
    summary_event = json.dumps(summary_event)
    key = OUTPUT_BUCKET_PREFIX + '/' + prompt_id + '.json'
    s3.put_object(Bucket=OUTPUT_BUCKET, Key=key, Body=summary_event)


def update_call_in_graphql_api(transaction_id, status, **kwargs):
    logger.info('%s Updating call in GraphQL API: %s', LOG_PREFIX, transaction_id)
    variables = {
        'input': {
            'transactionId': transaction_id,
            'status': status,
        }
    }

    for key, value in kwargs.items():
        if value is not None:
            if key == 'transcription' or key == 'queries':
                value = json.dumps(value).replace('\\n', '\\\\n')
            elif key == 'transcriptionFile':
                value = json.dumps(value)
            variables['input'][key] = value
            logger.info('%s %s: %s', LOG_PREFIX, key.capitalize(), value)

    data = {
        'query': update_call_mutation,
        'variables': variables
    }

    headers = {
        'Content-Type': 'application/json',
        'x-api-key': graphql_api_key
    }
    logger.info('%s GraphQL Request: %s', LOG_PREFIX, data)
    response = requests.post(graphql_endpoint, json=data, headers=headers)

    if response.status_code == 200:
        result = response.json()
        logger.info('%s GraphQL Response: %s', LOG_PREFIX, result)
        if result and 'data' in result and 'updateCall' in result['data']:
            updated_call = result['data']['updateCall']
            logger.info('%s Call updated successfully: %s', LOG_PREFIX, updated_call)
        else:
            logger.error('%s Error updating call. Invalid response data: %s', LOG_PREFIX, result)
    else:
        logger.error('%s Error updating call. Status code: %s', LOG_PREFIX, response.status_code)
        logger.error('%s Response: %s', LOG_PREFIX, response.text)


def add_query_to_call(transaction_id, queries):
    logger.info('%s Adding query to call: %s', LOG_PREFIX, transaction_id)
    variables = {
        'input': {
            'transactionId': transaction_id,
            'queries': json.dumps(queries).replace('\\n', '\\\\n')
        }
    }

    data = {
        'query': add_query_mutation,
        'variables': variables
    }

    headers = {
        'Content-Type': 'application/json',
        'x-api-key': graphql_api_key
    }

    logger.info('%s GraphQL Request: %s', LOG_PREFIX, data)
    response = requests.post(graphql_endpoint, json=data, headers=headers)

    if response.status_code == 200:
        result = response.json()
        logger.info('%s GraphQL Response: %s', LOG_PREFIX, result)
        if result and 'data' in result and 'addQueryToCall' in result['data']:
            updated_call = result['data']['addQueryToCall']
            logger.info('%s Query added successfully: %s', LOG_PREFIX, updated_call)
        else:
            logger.error('%s Error adding query. Invalid response data: %s', LOG_PREFIX, result)
    else:
        logger.error('%s Error adding queries. Status code: %s', LOG_PREFIX, response.status_code)
        logger.error('%s Response: %s', LOG_PREFIX, response.text)


def get_transcription_file(transaction_id):
    logger.info('%s Querying transcription file for transaction: %s', LOG_PREFIX, transaction_id)

    variables = {
        'transactionId': transaction_id
    }

    graphql_headers = {
        'Content-Type': 'application/json',
        'x-api-key': graphql_api_key
    }

    graphql_data = {
        'query': query_transcription_file,
        'variables': variables
    }

    response = requests.post(graphql_endpoint, json=graphql_data, headers=graphql_headers)
    logger.info('%s GraphQL Response: %s', LOG_PREFIX, response.text)
    if response.status_code == 200:
        result = response.json()
        if 'data' in result and 'getCall' in result['data']:
            transcription_object = json.loads(result['data']['getCall']['transcriptionFile'])
            logger.info('%s Transcription file retrieved successfully: %s', LOG_PREFIX, transcription_object)
            return transcription_object
        else:
            logger.error('%s Error retrieving call. Invalid response data: %s', LOG_PREFIX, result)
    else:
        logger.error('%s Error retrieving call. Status code: %s', LOG_PREFIX, response.status_code)
        logger.error('%s Response: %s', LOG_PREFIX, response.text)


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'StartSummarization Notification: '

    logger.info('%s Received event: %s', LOG_PREFIX, event)

    if 'Records' in event:
        # S3 Object creation event
        key = event['Records'][0]['s3']['object']['key']
        bucket = event['Records'][0]['s3']['bucket']['name']
        transaction_id = key.split('/')[1].split('_')[0].rstrip('.json')
        logger.info('%s Received object: %s', LOG_PREFIX, key)
        logger.info('%s Received bucket: %s', LOG_PREFIX, bucket)

        if not key.lower().endswith('.json') and not key.lower().endswith('.ogg'):
            logger.info('%s Skipping non-JSON object: %s', LOG_PREFIX, key)
            return

        s3_object = s3.get_object(Bucket=bucket, Key=key)
        transcription_object = {'bucket': bucket, 'key': key}
        transcript = load_transcript(s3_object)
        prompt_id = str(uuid.uuid4())
        logger.info('%s Transcript: %s', LOG_PREFIX, transcript)
        logger.info('%s Prompt ID: %s', LOG_PREFIX, prompt_id)
        update_call_in_graphql_api(transaction_id, "Summarizing", transcriptionFile=transcription_object)
        summary_dict = run_call(transcript, question=SUMMARY_QUESTION)
        summary_event = prepare_summary(summary_dict)
        summary_event["summaryEvent"]['prompt_id'] = prompt_id
        put_summary(summary_event, prompt_id)
        query = [{"prompt": summary_event['summaryEvent']['question'], "response": summary_event['summaryEvent']['final_summary']}]
        update_call_in_graphql_api(transaction_id, "Summarized", transcription=summary_dict['transcription'], queries=query)
        return summary_event
    elif 'body' in event:
        # API Gateway POST request
        body = json.loads(event['body'])
        transaction_id = body['transactionId']
        query = body['query']
        update_call_in_graphql_api(transaction_id, "Summarizing")
        transcription_object = get_transcription_file(transaction_id)

        if transcription_object is not None:
            s3_object = s3.get_object(Bucket=transcription_object['bucket'], Key=transcription_object['key'])
            transcript = load_transcript(s3_object)
            prompt_id = str(uuid.uuid4())
            logger.info('%s Transcript: %s', LOG_PREFIX, transcript)
            logger.info('%s Prompt ID: %s', LOG_PREFIX, prompt_id)
            summary_dict = run_call(transcript, question=query)
            summary_event = prepare_summary(summary_dict)
            summary_event["summaryEvent"]['prompt_id'] = prompt_id
            put_summary(summary_event, prompt_id)
            query = [{"prompt": summary_event['summaryEvent']['question'], "response": summary_event['summaryEvent']['final_summary']}]
            add_query_to_call(transaction_id, query)

            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Access-Control-Allow-Credentials': 'true',
            }

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(summary_event)
            }
        else:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': 'Error querying transcription file'
            }
    else:
        logger.error('%s Unsupported event type: %s', LOG_PREFIX, event)
        return {
            'statusCode': 400,
            'body': 'Unsupported event type'
        }
