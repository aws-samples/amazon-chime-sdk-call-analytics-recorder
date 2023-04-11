import { Duration } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface EventBridgeResourcesProps {
  checkStatus: Function;
}

export class EventBridgeResources extends Construct {
  constructor(scope: Construct, id: string, props: EventBridgeResourcesProps) {
    super(scope, id);

    const rule = new Rule(this, 'ScheduledRule', {
      schedule: Schedule.rate(Duration.minutes(5)),
    });

    rule.addTarget(new LambdaFunction(props.checkStatus));
  }
}
