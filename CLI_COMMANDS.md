## Amazon Chime SDK Call Analytics Deployment by AWS CLI

Amazon Chime SDK Call Analytics can be deployed in several ways. Configurations can be deployed through the AWS Console, through APIs, or through [AWS Command Line Interface](https://aws.amazon.com/cli/) (AWS CLI) commands.

Before starting, ensure that you're using the latest version of AWS CLI by [installing or updating](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html#getting-started-install-instructions).

### Get Bucket Information

In order to configure an Amazon Simple Storage Service (Amazon S3) recording Amazon Chime SDK Call Analytics Configuration, we will need to know the Bucket name. For example, if you've already deployed this AWS Cloud Development Kit (AWS CDK), you can use the below command to set an environment variable to the Bucket name. Otherwise, manually setting `OUTPUT_BUCKET` to your desired Bucket will help with later commands.

```bash
OUTPUT_BUCKET=$( aws cloudformation describe-stacks --stack-name amazon-chime-sdk-call-analytics-recording --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`OutputBucket`].OutputValue' --output text )
```

### Get AWS Account ID

As some of the commands we will be using reference your AWS Account ID, we will set that here.

```
AWS_ACCOUNT=$(aws sts get-caller-identity --query 'Account' --output text)
```

S3Policy## Create Amazon Chime SDK Media Insights Pipeline Configuration

### Create Access Role

The first step will be to create an AWS Identity and Access Management (IAM) Role. We will be using this Role to control what the Amazon Chime SDK Call Analytics Configuration has access to.

```bash
IAM_ROLE_ARN=$(aws iam create-role --role-name CallAnalyticsRecordRole \
--assume-role-policy-document  '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "mediapipelines.chime.amazonaws.com"
            },
            "Action": "sts:AssumeRole",
            "Condition": {
                "StringEquals": {
                    "aws:SourceAccount": "'$AWS_ACCOUNT'"
                },
                "ArnLike": {
                    "aws:SourceARN": "arn:aws:chime:*:'$AWS_ACCOUNT':*"
                }
            }
        }
    ]
}' --query 'Role.Arn' --output text)
```

### Add IAM Policies

Next, we will be attaching IAM Policies to the IAM Role we created. These Policies will be used by the Amazon Chime SDK Call Analytics Media Pipeline to access the necessary components.

```bash
aws iam put-role-policy --role-name CallAnalyticsRecordRole \
--policy-name S3Policy --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::'$OUTPUT_BUCKET'/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObjectTagging"
            ],
            "Resource": [
                "arn:aws:s3:::'$OUTPUT_BUCKET'/*"
            ],
            "Condition": {
                "ForAllValues:StringLike": {
                    "s3:RequestObjectTagKeys": [
                        "ChimeSDK:*"
                    ]
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesisvideo:ListFragments",
                "kinesisvideo:GetMediaForFragmentList"
            ],
            "Resource": [
                "arn:aws:kinesisvideo:us-east-1:'$AWS_ACCOUNT':stream/*"
            ],
            "Condition": {
                "StringLike": {
                    "aws:ResourceTag/AWSServiceName": "ChimeSDK"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesisvideo:ListFragments",
                "kinesisvideo:GetMediaForFragmentList"
            ],
            "Resource": [
                "arn:aws:kinesisvideo:us-east-1:'$AWS_ACCOUNT':stream/Chime*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:GenerateDataKey"
            ],
            "Resource": [
                "arn:aws:kms:us-east-1:'$AWS_ACCOUNT':key/*"
            ],
            "Condition": {
                "StringLike": {
                    "aws:ResourceTag/AWSServiceName": "ChimeSDK"
                }
            }
        }
    ]
}'
```

```bash
aws iam put-role-policy --role-name CallAnalyticsRecordRole \
--policy-name CallAnalyticsRole --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "transcribe:StartCallAnalyticsStreamTranscription",
                "transcribe:StartStreamTranscription"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesisvideo:GetDataEndpoint",
                "kinesisvideo:GetMedia"
            ],
            "Resource": [
                "arn:aws:kinesisvideo:us-east-1:'$AWS_ACCOUNT':stream/Chime*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kinesisvideo:GetDataEndpoint",
                "kinesisvideo:GetMedia"
            ],
            "Resource": [
                "arn:aws:kinesisvideo:us-east-1:'$AWS_ACCOUNT':stream/*"
            ],
            "Condition": {
                "StringLike": {
                    "aws:ResourceTag/AWSServiceName": "ChimeSDK"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": [
                "arn:aws:kms:us-east-1:'$AWS_ACCOUNT':key/*"
            ],
            "Condition": {
                "StringLike": {
                    "aws:ResourceTag/AWSServiceName": "ChimeSDK"
                }
            }
        }
    ]
}'
```

### Create Configuration

Next we'll be creating the Amazon Chime SDK Media Pipeline Configuration for an S3RecordingSink and attaching the previously created Role to it. Because there is only one option for an S3RecordingSink, this is a relatively simple command.

```bash
aws chime-sdk-media-pipelines create-media-insights-pipeline-configuration --media-insights-pipeline-configuration-name Record --resource-access-role-arn $IAM_ROLE_ARN --elements '[
  {
    "Type": "S3RecordingSink",
    "S3RecordingSinkConfiguration": {
      "Destination": "arn:aws:s3:::'$OUTPUT_BUCKET'"
    }
  }
]'
```

### Associate VoiceConnector with Configuration

Next we'll be associating an Amazon Chime SDK Voice Connector to the Amazon Chime SDK Media Pipeline Configuration. If you've deployed the CDK, this command will set the environment variable to the Amazon Chime SDK Voice Connector ID. Otherwise, you can set this manually to an Amazon Chimer SDK Voice Connector of your choosing.

```bash
VOICE_CONNECTOR=$( aws cloudformation describe-stacks --stack-name amazon-chime-sdk-call-analytics-recording --region us-east-1 --query 'Stacks[0].Outputs[?OutputKey==`VoiceConnector`].OutputValue' --output text )
```

This command will update the Streaming configuration of the selected Amazon Chime SDK Voice Connector.

```bash
aws chime-sdk-voice put-voice-connector-streaming-configuration --voice-connector-id $VOICE_CONNECTOR --streaming-configuration '{
  "DataRetentionInHours": 24,
  "Disabled": false,
  "StreamingNotificationTargets": [
    {
      "NotificationTarget": "EventBridge"
    }
  ],
  "MediaInsightsConfiguration": {
    "Disabled": false,
    "ConfigurationArn": "arn:aws:chime:us-east-1:'${AWS_ACCOUNT}':media-insights-pipeline-configuration/Record"
  }
}'
```

### Cleanup

If you need to delete any of the created resources:

```bash
aws chime-sdk-media-pipelines delete-media-insights-pipeline-configuration --identifier Record
```

```bash
aws iam delete-role-policy --role-name CallAnalyticsRecordRole --policy-name CallAnalyticsRole
aws iam delete-role-policy --role-name CallAnalyticsRecordRole --policy-name S3Policy
aws iam delete-role --role-name CallAnalyticsRecordRole
```
