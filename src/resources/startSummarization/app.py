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
SUMMARY_QUESTION = DEFAULT_QUESTION[:]
ENDPOINT_NAME = os.environ['ENDPOINT_NAME']
MODEL_PACKAGE_ARN= os.environ['MODEL_PACKAGE_ARN']
SAGEMAKER_ROLE= os.environ['SAGEMAKER_ROLE']
OUTPUT_BUCKET= os.environ['OUTPUT_BUCKET']
OUTPUT_BUCKET_PREFIX= os.environ['OUTPUT_BUCKET_PREFIX']
STATUS_TABLE = os.environ['STATUS_TABLE']


co = Client(endpoint_name=ENDPOINT_NAME)


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
            if part['speaker_label']!= -1: 
                parts.append(part)
            part = part_template.copy()
            
        part['speaker_label'] = word['speaker_label']
        w = word['alternatives'][0]['content']
        if len(part['words'])>0 and w not in punctuation:
            part['words'] += ' '
        part['words'] += w
    
    parts.append(part)
    return parts

# Set Speaker names
def rename_speakers(chunks):
    speaker_mapping = {}
    for i in range(20):
        speaker_mapping["spk_%i" %i] = "Speaker %i" %i
    for c in chunks:
        c['speaker_label'] = speaker_mapping[c['speaker_label']]
    return chunks

# This makes speakers more human readable
def rename_speakers(chunks):
    """
    Replaces the spk_0, spk_1 with a more human-readable version.
    """
    speaker_mapping = {} # if you have a proper speaker_mapping, then replace here
    for i in range(20):
        speaker_mapping["spk_%i" %i] = "Speaker %i" %i
        
    for c in chunks:
        c['speaker_label'] = speaker_mapping[c['speaker_label']]
    return chunks

# Build Lines
def build_lines(chunks):
    lines = []
    for c in chunks:
        lines.append("%s: %s" %(c['speaker_label'], c['words']))
    
    call_part = ''
    for line in lines:
        call_part += line + '\n'
    
    return call_part

# Break call into partitions that 
def partition_call(chunks, max_word_count=1500, overlap_percentage=0.2):
    """
    Inpts:
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
    
    
    part_count = 0 #number of words in current partition
    i, j = 0, 0 #pointers
    partition_ends = [] #start, end of each partition
    while j < len(counts):
        part_count += counts[j]
        if part_count >= max_word_count:
            partition_ends.append([i, j])
            while part_count > (max_word_count * overlap_percentage):
                i += 1
                part_count -= counts[i]
        j += 1
    partition_ends.append([i, j])
    
    #with list of partition_ends, build partitions
    partitions = []
    for pe in partition_ends:
        part = chunks[pe[0]:pe[1]]
        partition = build_lines(part)
        partitions.append(partition)
        
    return partitions


##
# Build prompt(s)
def get_call_prompt(lines, question=DEFAULT_QUESTION):
    prompt = """Call: 
%s

%s""" %(lines, question)
    return prompt

def get_call_prompts(partitions, question=DEFAULT_QUESTION):
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


def summarize_summaries(summaries, question=DEFAULT_QUESTION):
    
    if len(summaries) == 1:
        return summaries[0], None
    
    prompt = """Summaries:"""
    for t in summaries:
        prompt += """

%s""" %t
    
    prompt += """

Combine the summaries and answer this question: %s""" %question
    
    full_summary = get_response(prompt)
    
    return full_summary, prompt


def run_call(transcript, question=DEFAULT_QUESTION, verbose=False):

    # break call into dialogue lines
    chunks = chunk_transcription(transcript)
    chunks = rename_speakers(chunks)
    
    # break dialogue lines into partitions
    partitions = partition_call(chunks, 1000, 0.3)
    prompts = get_call_prompts(partitions, question)
    
    # Print Option
    if verbose:
        print('Prompt for Partition 1:')
        print(prompts[0])
              
    # Partition Summary
    summaries = get_responses(prompts)
    
    # Combined Summary
    summary, summary_prompt = summarize_summaries(summaries)
    
    # Print Option
    if verbose:
        print('Full Summary:')
        print(summary)
        
    summary_dict = {
            'list_prompt': prompts,
            'summary_prompt': summary_prompt,
            'final_summary': summary,
            'question': question,
            'model': MODEL,
            'model_arn': MODEL_PACKAGE_ARN,
        }
    
    return summary_dict

def prepare_summary(summary_dict, call_metadata=None):
    result  = { 
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
    prompt_id = str(uuid.uuid4())
    logger.info('%s Transcript: %s', LOG_PREFIX, transcript)
    logger.info('%s Prompt ID: %s', LOG_PREFIX, prompt_id)

    summary_dict = run_call(transcript, question=SUMMARY_QUESTION)
    summary_event = prepare_summary(summary_dict)

    summary_event["summaryEvent"]['prompt_id'] = prompt_id
    
    update_database(prompt_id)
    put_summary(summary_event,prompt_id)

