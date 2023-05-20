import {
  SecurityGroup,
  CfnEIP,
  Peer,
  Port,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class VPCResources extends Construct {
  public asteriskEip: CfnEIP;
  public securityGroup: SecurityGroup;
  public vpc: Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.asteriskEip = new CfnEIP(this, 'asteriskEip');

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'AsteriskPublic',
          subnetType: SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
      ],
      maxAzs: 2,
    });

    this.securityGroup = new SecurityGroup(this, 'AsteriskSecurityGroup', {
      vpc: this.vpc,
      description: 'Security Group for Asterisk Instance',
      allowAllOutbound: true,
    });
    this.securityGroup.addIngressRule(
      Peer.ipv4('3.80.16.0/23'),
      Port.udp(5060),
      'Allow Chime Voice Connector Signaling Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('3.80.16.0/23'),
      Port.tcp(5060),
      'Allow Chime Voice Connector Signaling Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('99.77.253.0/24'),
      Port.udp(5060),
      'Allow Chime Voice Connector Signaling Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('99.77.253.0/24'),
      Port.tcp(5060),
      'Allow Chime Voice Connector Signaling Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('99.77.253.0/24'),
      Port.udpRange(5000, 65000),
      'Allow Chime Voice Connector Signaling Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('3.80.16.0/23'),
      Port.udpRange(5000, 65000),
      'Allow Chime Voice Connector Media Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('99.77.253.0/24'),
      Port.udpRange(5000, 65000),
      'Allow Chime Voice Connector Media Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('52.55.62.128/25'),
      Port.udpRange(1024, 65535),
      'Allow Chime Voice Connector Media Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('52.55.63.0/25'),
      Port.udpRange(1024, 65535),
      'Allow Chime Voice Connector Media Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('34.212.95.128/25'),
      Port.udpRange(1024, 65535),
      'Allow Chime Voice Connector Media Access',
    );
    this.securityGroup.addIngressRule(
      Peer.ipv4('34.223.21.0/25'),
      Port.udpRange(1024, 65535),
      'Allow Chime Voice Connector Media Access',
    );
  }
}
