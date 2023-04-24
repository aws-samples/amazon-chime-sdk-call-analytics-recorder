import {
  AmazonChimeSDKCallAnalyticsRecordingStackProps,
  AmazonChimeSDKCallAnalyticsSummarizationProps,
} from './amazon-chime-sdk-call-analytics-recording';
import { InstanceTypes, ModelArns } from './cohereInput';

const cidrRegex = /^(?:\d{1,3}\.){3}\d{1,3}\/(3[0-2]|[2-9]|[1-2][0-9])$/;
const rfc1918Regex =
  /^10(\.\d{1,3}){3}|^172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|^192\.168(\.\d{1,3}){2}$/;
const s3BucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function recorderEnvValidator(
  props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
) {
  if (props.buildAsterisk) {
    if (
      props.buildAsterisk.toLowerCase() !== 'true' &&
      props.buildAsterisk.toLowerCase() !== 'false'
    ) {
      throw new Error('BUILD_ASTERISK must be true or false');
    }
  }

  if (props.outputBucket) {
    if (!s3BucketNameRegex.test(props.outputBucket)) {
      throw new Error('OUTPUT_BUCKET must be a valid S3 bucket name');
    }
  }

  if (props.selectiveRecording) {
    if (
      props.selectiveRecording.toLowerCase() !== 'true' &&
      props.selectiveRecording.toLowerCase() !== 'false'
    ) {
      throw new Error('SELECTIVE_RECORDING must be true or false');
    }
  }

  if (props.logLevel) {
    if (
      props.logLevel.toLowerCase() !== 'error' &&
      props.logLevel.toLowerCase() !== 'warn' &&
      props.logLevel.toLowerCase() !== 'debug' &&
      props.logLevel.toLowerCase() !== 'info'
    ) {
      throw new Error('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
    }
  }

  if (props.removalPolicy) {
    if (
      props.removalPolicy.toLowerCase() !== 'destroy' &&
      props.removalPolicy.toLowerCase() !== 'retain' &&
      props.removalPolicy.toLocaleLowerCase() !== 'snapshot'
    ) {
      throw new Error('REMOVAL_POLICY must be DESTROY, SNAPSHOT, or RETAIN');
    }
  }

  if (props.buildAsterisk.toLowerCase() === 'true' && props.sipRecCidrs) {
    throw new Error('BUILD_ASTERISK and SIPREC_CIDRS cannot both be true');
  }

  if (props.sipRecCidrs) {
    const cidrBlocks = props.sipRecCidrs.split(',');

    if (cidrBlocks.length > 10) {
      throw new Error('SIPREC_CIDRS must not contain more than 10 CIDRs');
    }
    for (const cidr of cidrBlocks) {
      const trimmedCidr = cidr.trim();
      if (!cidrRegex.test(trimmedCidr)) {
        throw new Error(`Invalid CIDR block: ${trimmedCidr}`);
      }
      const ipAddress = trimmedCidr.split('/')[0];
      if (rfc1918Regex.test(ipAddress)) {
        throw new Error(
          `CIDR block ${trimmedCidr} contains an RFC 1918 private IP address`,
        );
      }
    }
  }

  return true;
}

export function summarizerEnvValidator(
  props: AmazonChimeSDKCallAnalyticsSummarizationProps,
) {
  if (!Object.values(ModelArns).includes(props.modelPackageArn as ModelArns)) {
    throw new Error(
      'Invalid Model Arn.  Valid Model Arns are: ' + Object.values(ModelArns),
    );
  }

  if (
    !Object.values(InstanceTypes).includes(
      props.cohereInstanceType as InstanceTypes,
    )
  ) {
    throw new Error(
      'Invalid Instance Type.  Valid types are: ' +
        Object.values(InstanceTypes),
    );
  }

  if (props.selectiveRecording) {
    if (
      props.selectiveRecording.toLowerCase() !== 'true' &&
      props.selectiveRecording.toLowerCase() !== 'false'
    ) {
      throw new Error('SELECTIVE_RECORDING must be true or false');
    }
  }
}
