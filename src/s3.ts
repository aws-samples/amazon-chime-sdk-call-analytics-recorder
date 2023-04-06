import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface S3ResourcesProps {
  removalPolicy: string;
}
export class S3Resources extends Construct {
  public readonly recordingBucket: Bucket;

  constructor(scope: Construct, id: string, props: S3ResourcesProps) {
    super(scope, id);

    let removalPolicy: RemovalPolicy;
    let autoDelete: boolean = false;
    switch (props.removalPolicy.toLowerCase()) {
      case 'retain':
        removalPolicy = RemovalPolicy.RETAIN;
        break;
      case 'destroy':
        removalPolicy = RemovalPolicy.DESTROY;
        autoDelete = true;
        break;
      case 'snapshot':
        removalPolicy = RemovalPolicy.SNAPSHOT;
        break;
      default:
        removalPolicy = RemovalPolicy.DESTROY;
    }

    this.recordingBucket = new Bucket(this, 'recordingBucket', {
      publicReadAccess: false,
      removalPolicy: removalPolicy,
      autoDeleteObjects: autoDelete,
      encryption: BucketEncryption.S3_MANAGED,
    });
  }
}
