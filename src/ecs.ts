/* eslint-disable @typescript-eslint/indent */
/* eslint-disable import/no-extraneous-dependencies */
import path from 'path';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  InstanceType,
  SubnetType,
  Vpc,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import {
  AwsLogDriver,
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  OperatingSystemFamily,
  Protocol,
} from 'aws-cdk-lib/aws-ecs';
import { AccessPoint, FileSystem } from 'aws-cdk-lib/aws-efs';
import {
  Role,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  ChimePhoneNumber,
  ChimeVoiceConnector,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface ECSResourcesProps {
  vpc: Vpc;
  securityGroup: SecurityGroup;
  phoneNumber: ChimePhoneNumber;
  voiceConnector: ChimeVoiceConnector;
  logLevel: string;
}
export class ECSResources extends Construct {
  public task: FargateTaskDefinition;
  public cluster: Cluster;

  constructor(scope: Construct, id: string, props: ECSResourcesProps) {
    super(scope, id);

    this.cluster = new Cluster(this, 'Cluster', {
      vpc: props.vpc,
    });

    const group = this.cluster.addCapacity('SingleDevice', {
      instanceType: new InstanceType('m5.large'),
      desiredCapacity: 1,
    });

    group.role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );

    const fileSystem = new FileSystem(this, 'fileSystem', {
      vpc: props.vpc,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const asteriskAccessPoint = new AccessPoint(this, 'asteriskAccessPoint', {
      fileSystem: fileSystem,
      path: '/asteriskLogs',
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '0750',
      },
    });

    const asteriskTaskRole = new Role(this, 'asteriskTaskRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        keysPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [fileSystem.fileSystemArn],
              actions: [
                'elasticfilesystem:ClientMount',
                'elasticfilesystem:ClientWrite',
                'elasticfilesystem:DescribeFileSystems',
              ],
            }),
          ],
        }),
        asteriskTaskPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:PutVoiceConnector*'],
            }),
          ],
        }),
        ecsTaskPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: [
                `arn:aws:ecs:${Stack.of(this).region}:${
                  Stack.of(this).account
                }:task/${this.cluster.clusterName}/*`,
              ],
              actions: ['ecs:DescribeTasks'],
            }),
          ],
        }),
        ec2TaskPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['ec2:DescribeNetworkInterfaces'],
            }),
          ],
        }),
      },
    });

    this.task = new FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      runtimePlatform: {
        operatingSystemFamily: OperatingSystemFamily.LINUX,
        cpuArchitecture: CpuArchitecture.ARM64,
      },
      taskRole: asteriskTaskRole,
      volumes: [
        {
          name: 'asteriskLogs',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: asteriskAccessPoint.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    });

    const asteriskContainer = this.task.addContainer('Container', {
      image: ContainerImage.fromAsset(
        path.resolve(__dirname, './resources/asterisk'),
      ),
      logging:
        props.logLevel.toLowerCase() === 'debug'
          ? new AwsLogDriver({
              logRetention: RetentionDays.THREE_DAYS,
              streamPrefix: 'asterisk',
            })
          : undefined,
      environment: {
        PHONE_NUMBER: props.phoneNumber.phoneNumber,
        VOICE_CONNECTOR: props.voiceConnector.voiceConnectorId,
        CLUSTER_NAME: this.cluster.clusterName,
      },
      portMappings: [{ containerPort: 5060, protocol: Protocol.UDP }],
    });

    asteriskContainer.addMountPoints({
      containerPath: '/var/log/asterisk',
      sourceVolume: 'asteriskLogs',
      readOnly: false,
    });

    const service = new FargateService(this, 'FargateService', {
      cluster: this.cluster,
      taskDefinition: this.task,
      assignPublicIp: true,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [props.securityGroup],
      enableExecuteCommand: true,
    });

    fileSystem.connections.allowDefaultPortFrom(service.connections);
  }
}
