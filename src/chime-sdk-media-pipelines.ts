import { Stack, StackProps } from 'aws-cdk-lib';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
  PrincipalWithConditions,
} from 'aws-cdk-lib/aws-iam';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  ElementsType,
  MediaInsightsPipeline,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

function generateRandomString(length = 8): string {
  return Array.from({ length }, () =>
    (Math.random() * 36).toString(36).toUpperCase().charAt(0),
  ).join('');
}

interface MediaPipelineResourcesProps extends StackProps {
  s3SinkBucket: IBucket;
}

export class MediaPipelineResources extends Construct {
  public s3RecordingSinkConfiguration: MediaInsightsPipeline;

  constructor(
    scope: Construct,
    id: string,
    props: MediaPipelineResourcesProps,
  ) {
    super(scope, id);

    const s3SinkPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          resources: [`${props.s3SinkBucket.bucketArn}/*`],
          actions: ['s3:PutObject', 's3:PutObjectAcl', 's3:PutObjectTagging'],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:kinesisvideo:${Stack.of(this).region}:${
              Stack.of(this).account
            }:stream/*`,
          ],
          actions: [
            'kinesisvideo:GetDataEndpoint',
            'kinesisvideo:ListFragments',
            'kinesisvideo:GetMediaForFragmentList',
          ],
          conditions: {
            StringLike: { 'aws:ResourceTag/AWSServiceName': 'ChimeSDK' },
          },
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:kinesisvideo:${Stack.of(this).region}:${
              Stack.of(this).account
            }:stream/Chime*`,
          ],
          actions: [
            'kinesisvideo:ListFragments',
            'kinesisvideo:GetMediaForFragmentList',
          ],
        }),
        new PolicyStatement({
          resources: [
            `arn:aws:kms:${Stack.of(this).region}:${
              Stack.of(this).account
            }:key/*`,
          ],
          actions: ['kms:GenerateDataKey'],
          conditions: {
            StringLike: { 'aws:ResourceTag/AWSServiceName': 'ChimeSDK' },
          },
        }),
      ],
    });

    const resourceAccessRole = new Role(this, 'resourceAccessRole', {
      assumedBy: new PrincipalWithConditions(
        new ServicePrincipal('mediapipelines.chime.amazonaws.com'),
        {
          StringEquals: {
            'aws:SourceAccount': Stack.of(this).account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:chime:*:${Stack.of(this).account}:*`,
          },
        },
      ),
      inlinePolicies: {
        ['mediaInsightsPolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: [
                'transcribe:StartCallAnalyticsStreamTranscription',
                'transcribe:StartStreamTranscription',
              ],
            }),
            new PolicyStatement({
              resources: [
                `arn:aws:kinesisvideo:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:stream/Chime*`,
              ],
              actions: [
                'kinesisvideo:GetDataEndpoint',
                'kinesisvideo:GetMedia',
              ],
            }),
            new PolicyStatement({
              resources: [
                `arn:aws:kinesisvideo:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:stream/*`,
              ],
              actions: [
                'kinesisvideo:GetDataEndpoint',
                'kinesisvideo:GetMedia',
              ],
              conditions: {
                StringLike: { 'aws:ResourceTag/AWSServiceName': 'ChimeSDK' },
              },
            }),
            new PolicyStatement({
              resources: [
                `arn:aws:kms:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:key/*`,
              ],
              actions: ['kms:Decrypt'],
              conditions: {
                StringLike: { 'aws:ResourceTag/AWSServiceName': 'ChimeSDK' },
              },
            }),
          ],
        }),
        ['s3RecordingSinkPolicy']: s3SinkPolicy,
      },
    });

    this.s3RecordingSinkConfiguration = new MediaInsightsPipeline(
      this,
      's3RecordingSinkConfiguration',
      {
        resourceAccessRoleArn: resourceAccessRole.roleArn,
        mediaInsightsPipelineConfigurationName: `s3RecordingSinkConfiguration${generateRandomString()}`,
        elements: [
          {
            type: ElementsType.S3_RECORDING_SINK,
            s3RecordingSinkConfiguration: {
              destination: props.s3SinkBucket.bucketArn,
            },
          },
        ],
      },
    );
  }
}
