/* eslint-disable import/no-extraneous-dependencies */
import { Stack } from 'aws-cdk-lib';
import { CfnEIP } from 'aws-cdk-lib/aws-ec2';
import {
  ChimePhoneNumber,
  PhoneProductType,
  PhoneNumberType,
  ChimeVoiceConnector,
  PhoneCountry,
  NotificationTargetType,
  MediaInsightsPipeline,
  Protocol,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface VCResourcesProps {
  mediaInsightsConfiguration: MediaInsightsPipeline;
  serverEip: CfnEIP;
}
export class VCResources extends Construct {
  public readonly phoneNumber?: ChimePhoneNumber;
  public readonly voiceConnector: ChimeVoiceConnector;

  constructor(scope: Construct, id: string, props: VCResourcesProps) {
    super(scope, id);

    this.voiceConnector = new ChimeVoiceConnector(this, 'voiceConnector', {
      region: Stack.of(this).region,
      name: 'amazon-chime-sdk-recorder',
      encryption: false,
      origination: [
        {
          host: props.serverEip.ref,
          port: 5060,
          protocol: Protocol.UDP,
          priority: 1,
          weight: 1,
        },
      ],
      termination: {
        callingRegions: ['US'],
        terminationCidrs: [`${props.serverEip.ref}/32`],
      },
      streaming: {
        enabled: true,
        dataRetention: 24,
        notificationTargets: [NotificationTargetType.EVENTBRIDGE],
        mediaInsightsConfiguration: {
          disabled: false,
          configurationArn:
            props.mediaInsightsConfiguration
              .mediaInsightsPipelineConfigurationArn,
        },
      },
    });

    this.phoneNumber = new ChimePhoneNumber(this, 'phoneNumber', {
      phoneState: 'AZ',
      phoneCountry: PhoneCountry.US,
      phoneNumberType: PhoneNumberType.LOCAL,
      phoneProductType: PhoneProductType.VC,
    });

    this.phoneNumber.associateWithVoiceConnector(this.voiceConnector);
  }
}
