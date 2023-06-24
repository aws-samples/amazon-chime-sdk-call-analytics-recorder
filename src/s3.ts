import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class S3Resources extends Construct {
  public readonly recordingBucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.recordingBucket = new Bucket(this, 'recordingBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: BucketEncryption.S3_MANAGED,
      eventBridgeEnabled: true,
    });
  }
}
