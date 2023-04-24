/* eslint-disable import/no-extraneous-dependencies */
import { Stack } from 'aws-cdk-lib';
import {
  ChimePhoneNumber,
  PhoneProductType,
  PhoneNumberType,
  ChimeVoiceConnector,
  PhoneCountry,
  NotificationTargetType,
  MediaInsightsPipeline,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface VCResourcesProps {
  buildAsterisk: string;
  sipRecCidrs: string;
  selectiveRecording: string;
  mediaInsightsConfiguration: MediaInsightsPipeline;
}
export class VCResources extends Construct {
  public readonly phoneNumber?: ChimePhoneNumber;
  public readonly voiceConnector: ChimeVoiceConnector;

  constructor(scope: Construct, id: string, props: VCResourcesProps) {
    super(scope, id);

    this.voiceConnector = new ChimeVoiceConnector(this, 'voiceConnector', {
      region: Stack.of(this).region,
      encryption: false,
      termination: {
        callingRegions: ['US'],
        terminationCidrs: props.sipRecCidrs
          ? props.sipRecCidrs.split(',')
          : ['198.51.100.0/27'],
      },
      streaming: {
        enabled: true,
        dataRetention: 24,
        notificationTargets: [NotificationTargetType.EVENTBRIDGE],
        mediaInsightsConfiguration: {
          disabled: !Boolean(props.selectiveRecording),
          configurationArn:
            props.mediaInsightsConfiguration
              .mediaInsightsPipelineConfigurationArn,
        },
      },
    });

    if (props.buildAsterisk == 'true' && !props.sipRecCidrs) {
      this.phoneNumber = new ChimePhoneNumber(this, 'phoneNumber', {
        phoneState: 'AZ',
        phoneCountry: PhoneCountry.US,
        phoneNumberType: PhoneNumberType.LOCAL,
        phoneProductType: PhoneProductType.VC,
      });

      this.phoneNumber.associateWithVoiceConnector(this.voiceConnector);
    }
  }
}
