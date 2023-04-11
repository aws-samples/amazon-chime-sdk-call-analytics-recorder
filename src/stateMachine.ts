import { Duration } from 'aws-cdk-lib';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  ManagedPolicy,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Runtime, Code, Function } from 'aws-cdk-lib/aws-lambda';
import { EventType, IBucket } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import {
  Choice,
  Wait,
  Pass,
  StateMachine,
  WaitTime,
  Condition,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

interface SummarizationStateMachineResourcesProps {
  startSagemakerLambda: Function;
  checkEndpointLambda: Function;
  startSummarizationLambda: Function;
  recordingBucket: IBucket;
  logLevel: string;
  endpointName: string;
}

export class SummarizationStateMachineResources extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: SummarizationStateMachineResourcesProps,
  ) {
    super(scope, id);

    const checkEndpointTask = new LambdaInvoke(this, 'CheckEndpointTask', {
      lambdaFunction: props.checkEndpointLambda,
    });

    const startSagemakerTask = new LambdaInvoke(this, 'StartSagemaker', {
      lambdaFunction: props.startSagemakerLambda,
    });

    const startSummarizationTask = new LambdaInvoke(
      this,
      'StartSummarization',
      {
        lambdaFunction: props.startSummarizationLambda,
      },
    );

    const definition = checkEndpointTask;

    const inService = new Pass(this, 'InService');
    const wait = new Wait(this, 'Wait', {
      time: WaitTime.duration(Duration.seconds(10)),
    });

    const checkEndpointChoice = new Choice(this, 'CheckEndpointChoice')
      .when(
        Condition.stringEquals('$.Payload.body.endpoint_status', 'InService'),
        inService.next(startSummarizationTask),
      )
      .otherwise(wait.next(startSagemakerTask).next(checkEndpointTask));

    definition.next(checkEndpointChoice);

    const stateMachine = new StateMachine(this, 'SagemakerStateMachine', {
      definition: definition,
    });

    const startStateMachineRole = new Role(this, 'StartStateMachineRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['stateMachinePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ['states:StartExecution'],
              resources: [stateMachine.stateMachineArn],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const startStateMachineLambda = new Function(
      this,
      'startStateMachineLambda',
      {
        code: Code.fromAsset('src/resources/startStateMachine'),
        handler: 'index.handler',
        role: startStateMachineRole,
        runtime: Runtime.PYTHON_3_9,
        environment: {
          LOG_LEVEL: props.logLevel,
          STATE_MACHINE_ARN: stateMachine.stateMachineArn,
        },
      },
    );

    props.recordingBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new LambdaDestination(startStateMachineLambda),
      { prefix: 'transcribeOutput' },
    );
  }
}
