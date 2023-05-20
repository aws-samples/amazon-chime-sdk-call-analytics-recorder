import { RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import {
  Vpc,
  SecurityGroup,
  CfnEIP,
  Instance,
  MachineImage,
  InstanceType,
  InstanceClass,
  InstanceSize,
  CloudFormationInit,
  InitConfig,
  InitFile,
  InitCommand,
  CfnEIPAssociation,
  UserData,
} from 'aws-cdk-lib/aws-ec2';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Source, BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  ChimePhoneNumber,
  ChimeVoiceConnector,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface AsteriskProps {
  asteriskEip: CfnEIP;
  vpc: Vpc;
  securityGroup: SecurityGroup;
  phoneNumber: ChimePhoneNumber;
  voiceConnector: ChimeVoiceConnector;
  logLevel: string;
}

export class AsteriskResources extends Construct {
  public instanceId: string;

  constructor(scope: Construct, id: string, props: AsteriskProps) {
    super(scope, id);

    const audioBucket = new Bucket(this, 'audioBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      autoDeleteObjects: true,
    });

    new BucketDeployment(this, 'audioBucketDeployment', {
      sources: [Source.asset('src/resources/asterisk/audio')],
      destinationBucket: audioBucket,
      retainOnDelete: false,
    });

    const asteriskRole = new Role(this, 'asteriskEc2Role', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    audioBucket.grantReadWrite(asteriskRole);
    const parameterName =
      '/aws/service/canonical/ubuntu/server/jammy/stable/current/arm64/hvm/ebs-gp2/ami-id';
    const ubuntuAmiId = StringParameter.valueForStringParameter(
      this,
      parameterName,
    );

    const ubuntuAmi = MachineImage.genericLinux({
      'us-east-1': ubuntuAmiId,
    });

    const userData = UserData.forLinux();
    userData.addCommands(
      'apt-get update',
      'while fuser /var/lib/dpkg/lock >/dev/null 2>&1 ; do sleep 1 ; done',
      'mkdir -p /opt/aws/bin',
      'apt-get install -y python3-pip unzip jq asterisk',
      'mkdir -p /var/lib/asterisk/sounds/en',
      'pip3 install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-py3-latest.tar.gz',
      'ln -s /root/aws-cfn-bootstrap-latest/init/ubuntu/cfn-hup /etc/init.d/cfn-hup',
      'ln -s /usr/local/bin/cfn-* /opt/aws/bin/',
      'curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"',
      'unzip -q awscliv2.zip',
      './aws/install',
      'echo AWS CLI installed',
      'aws s3 cp s3://' +
        audioBucket.bucketName +
        '/AGENT_Retail40.wav /var/lib/asterisk/sounds/en/AGENT_Retail40.wav',
      'echo Audio files copied',
    );

    const ec2Instance = new Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
      machineImage: ubuntuAmi,
      userData: userData,
      init: CloudFormationInit.fromConfigSets({
        configSets: {
          default: ['config'],
        },
        configs: {
          config: new InitConfig([
            InitFile.fromObject('/etc/config.json', {
              IP: props.asteriskEip.ref,
              REGION: Stack.of(this).region,
              PHONE_NUMBER: props.phoneNumber.phoneNumber,
              VOICE_CONNECTOR: props.voiceConnector.voiceConnectorId,
            }),
            InitFile.fromFileInline(
              '/etc/asterisk/pjsip.conf',
              'src/resources/asterisk/config/pjsip.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/asterisk.conf',
              'src/resources/asterisk/config/asterisk.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/http.conf',
              'src/resources/asterisk/config/http.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/rtp.conf',
              'src/resources/asterisk/config/rtp.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/logger.conf',
              'src/resources/asterisk/config/logger.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/extensions.conf',
              'src/resources/asterisk/config/extensions.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/modules.conf',
              'src/resources/asterisk/config/modules.conf',
            ),
            InitFile.fromFileInline(
              '/etc/config_asterisk.sh',
              'src/resources/asterisk/config/config_asterisk.sh',
            ),
            InitCommand.shellCommand('chmod +x /etc/config_asterisk.sh'),
            InitCommand.shellCommand('/etc/config_asterisk.sh'),
          ]),
        },
      }),
      initOptions: {
        timeout: Duration.minutes(10),
        includeUrl: true,
        includeRole: true,
        printLog: true,
      },
      securityGroup: props.securityGroup,
      role: asteriskRole,
    });

    new CfnEIPAssociation(this, 'EIP Association', {
      eip: props.asteriskEip.ref,
      instanceId: ec2Instance.instanceId,
    });

    this.instanceId = ec2Instance.instanceId;
  }
}
