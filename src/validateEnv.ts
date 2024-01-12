import { AmazonChimeSDKCallAnalyticsRecordingStackProps } from './amazon-chime-sdk-call-analytics-recording';
import { InstanceTypes, ModelArns } from './cohereInput';

export function recorderEnvValidator(
  props: AmazonChimeSDKCallAnalyticsRecordingStackProps,
) {
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

  return true;
}
