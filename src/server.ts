/* eslint-disable import/no-extraneous-dependencies */
import { RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { GraphqlApi } from 'aws-cdk-lib/aws-appsync';
import {
  IUserPool,
  IUserPoolClient,
  CfnIdentityPool,
} from 'aws-cdk-lib/aws-cognito';
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
  Connections,
  Port,
} from 'aws-cdk-lib/aws-ec2';
import {
  ApplicationLoadBalancer,
  ApplicationTargetGroup,
  ApplicationProtocol,
  TargetType,
  Protocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { InstanceTarget } from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
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

interface ServerProps {
  serverEip: CfnEIP;
  vpc: Vpc;
  voiceSecurityGroup: SecurityGroup;
  sshSecurityGroup: SecurityGroup;
  phoneNumber: ChimePhoneNumber;
  voiceConnector: ChimeVoiceConnector;
  logLevel: string;
  albSecurityGroup: SecurityGroup;
  applicationLoadBalancer: ApplicationLoadBalancer;
  controlSageMakerApi: RestApi;
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
  userPoolRegion: string;
  identityPool: CfnIdentityPool;
  graphqlEndpoint: GraphqlApi;
  publicSshKey: string;
  recordingBucket: Bucket;
}

export class ServerResources extends Construct {
  public instanceId: string;

  constructor(scope: Construct, id: string, props: ServerProps) {
    super(scope, id);

    const assetBucket = new Bucket(this, 'assetBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      autoDeleteObjects: true,
    });

    new BucketDeployment(this, 'assetBucketDeployment', {
      sources: [
        Source.asset('src/resources/server/assets', {
          // exclude: ['**/node_modules/**', '**/dist/**'],
        }),
      ],
      destinationBucket: assetBucket,
      retainOnDelete: false,
      exclude: ['**/node_modules/**', '**/dist/**'],
      memoryLimit: 512,
    });

    const serverRole = new Role(this, 'serverEc2Role', {
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

    assetBucket.grantReadWrite(serverRole);
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
      'curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -',
      'while fuser /var/lib/dpkg/lock >/dev/null 2>&1 ; do sleep 1 ; done',
      'apt-get install -y python3-pip unzip jq asterisk nodejs nginx',
      'while fuser /var/lib/dpkg/lock >/dev/null 2>&1 ; do sleep 1 ; done',
      'corepack enable',
      'mkdir -p /var/lib/asterisk/sounds/en',
      'mkdir -p /opt/aws/bin',
      'pip3 install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-py3-latest.tar.gz',
      'ln -s /root/aws-cfn-bootstrap-latest/init/ubuntu/cfn-hup /etc/init.d/cfn-hup',
      'ln -s /usr/local/bin/cfn-* /opt/aws/bin/',
      'curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"',
      'unzip -q awscliv2.zip',
      './aws/install',
      'echo AWS CLI installed',
      'aws s3 cp s3://' +
        assetBucket.bucketName +
        '/audio/AGENT_Retail40.wav /var/lib/asterisk/sounds/en/AGENT_Retail40.wav',
      'echo Audio files copied',
      'mkdir -p /home/ubuntu/site',
      'aws s3 cp s3://' +
        assetBucket.bucketName +
        '/site /home/ubuntu/site --recursive',
      'usermod -a -G www-data ubuntu',
    );

    const ec2InstanceSecurityGroup = new SecurityGroup(
      this,
      'ec2InstanceSecurityGroup',
      { vpc: props.vpc, allowAllOutbound: true },
    );

    const ec2Instance = new Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T4G, InstanceSize.MEDIUM),
      machineImage: ubuntuAmi,
      instanceName: 'Amazon Chime SDK Recorder Server',
      securityGroup: ec2InstanceSecurityGroup,
      userData: userData,
      init: CloudFormationInit.fromConfigSets({
        configSets: {
          default: ['config'],
        },
        configs: {
          config: new InitConfig([
            InitFile.fromObject('/etc/config.json', {
              IP: props.serverEip.ref,
              REGION: Stack.of(this).region,
              PHONE_NUMBER: props.phoneNumber.phoneNumber,
              VOICE_CONNECTOR: props.voiceConnector.voiceConnectorId,
            }),
            InitFile.fromFileInline(
              '/etc/asterisk/pjsip.conf',
              'src/resources/server/config/pjsip.conf',
            ),
            InitFile.fromString(
              '/home/ubuntu/.ssh/authorized_keys',
              props.publicSshKey,
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/asterisk.conf',
              'src/resources/server/config/asterisk.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/http.conf',
              'src/resources/server/config/http.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/rtp.conf',
              'src/resources/server/config/rtp.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/logger.conf',
              'src/resources/server/config/logger.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/extensions.conf',
              'src/resources/server/config/extensions.conf',
            ),
            InitFile.fromFileInline(
              '/etc/asterisk/modules.conf',
              'src/resources/server/config/modules.conf',
            ),
            InitFile.fromFileInline(
              '/etc/config_asterisk.sh',
              'src/resources/server/config/config_asterisk.sh',
            ),
            InitFile.fromFileInline(
              '/etc/nginx/sites-available/default',
              'src/resources/server/nginx/default',
            ),
            InitFile.fromString(
              '/home/ubuntu/site/.env',
              `API_GATEWAY_URL=${props.controlSageMakerApi.url}
              PHONE_NUMBER=${props.phoneNumber.phoneNumber}
              USER_POOL_REGION=${props.userPoolRegion}
              USER_POOL_ID=${props.userPool.userPoolId}
              USER_POOL_CLIENT_ID=${props.userPoolClient.userPoolClientId}
              GRAPHQL_ENDPOINT=${props.graphqlEndpoint.graphqlUrl}
              S3_BUCKET=${props.recordingBucket.bucketName}
              IDENTITY_POOL_ID=${props.identityPool.ref}
              VOICE_CONNECTOR=${props.voiceConnector.voiceConnectorId}`,
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
      role: serverRole,
    });

    const targetGroup = new ApplicationTargetGroup(this, 'targetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.INSTANCE,
      targets: [new InstanceTarget(ec2Instance)],
      healthCheck: {
        path: '/healthcheck',
        protocol: Protocol.HTTP,
      },
    });

    const httpListener = props.applicationLoadBalancer.addListener(
      'httpListener',
      {
        port: 80,
        open: true,
      },
    );

    httpListener.addTargetGroups('targetGroup', {
      targetGroups: [targetGroup],
    });

    ec2Instance.addSecurityGroup(props.voiceSecurityGroup);
    ec2Instance.addSecurityGroup(props.sshSecurityGroup);

    ec2InstanceSecurityGroup.connections.allowFrom(
      new Connections({
        securityGroups: [props.albSecurityGroup],
      }),
      Port.tcp(80),
    );

    new CfnEIPAssociation(this, 'EIP Association', {
      eip: props.serverEip.ref,
      instanceId: ec2Instance.instanceId,
    });

    this.instanceId = ec2Instance.instanceId;
  }
}
