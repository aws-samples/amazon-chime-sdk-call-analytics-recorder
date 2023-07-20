import { Expiration, Duration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  GraphqlApi,
  SchemaFile,
  MappingTemplate,
  FieldLogLevel,
} from 'aws-cdk-lib/aws-appsync';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
// import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface DatabaseProps {
  callTable: Table;
  userPool: IUserPool;
}

export class AppSyncResources extends Construct {
  public graphqlEndpoint: GraphqlApi;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.graphqlEndpoint = new GraphqlApi(this, 'graphqlAPI', {
      name: 'CallRecordingAPI',
      schema: SchemaFile.fromAsset('./src/resources/graphql/schema.graphql'),
      xrayEnabled: true,
      logConfig: {
        retention: RetentionDays.ONE_WEEK,
        fieldLogLevel: FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: props.userPool },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: AuthorizationType.API_KEY,
            apiKeyConfig: { expires: Expiration.after(Duration.days(365)) },
          },
        ],
      },
    });

    // const callTableRole = new Role(this, 'callTableRole', {
    //   assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
    //   managedPolicies: [
    //     ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
    //   ],
    // });

    // this.graphqlEndpoint.grantMutation(callTableRole, 'createCall');
    // this.graphqlEndpoint.grantMutation(callTableRole, 'updateCall');
    // this.graphqlEndpoint.grantMutation(callTableRole, 'deleteCall');

    const callTableDataSource = this.graphqlEndpoint.addDynamoDbDataSource(
      'callTable',
      props.callTable,
      {},
    );

    callTableDataSource.createResolver('CreateCall', {
      typeName: 'Mutation',
      fieldName: 'createCall',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.CreateCall.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.CreateCall.res.vtl',
      ),
    });

    callTableDataSource.createResolver('UpdateCall', {
      typeName: 'Mutation',
      fieldName: 'updateCall',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.UpdateCall.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.UpdateCall.res.vtl',
      ),
    });

    callTableDataSource.createResolver('DeleteCall', {
      typeName: 'Mutation',
      fieldName: 'deleteCall',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.DeleteCall.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.DeleteCall.res.vtl',
      ),
    });

    callTableDataSource.createResolver('AddQuery', {
      typeName: 'Mutation',
      fieldName: 'addQueryToCall',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.AddQuery.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Mutation.AddQuery.res.vtl',
      ),
    });

    callTableDataSource.createResolver('GetCall', {
      typeName: 'Query',
      fieldName: 'getCall',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Query.GetCall.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Query.GetCall.res.vtl',
      ),
    });

    callTableDataSource.createResolver('ListCalls', {
      typeName: 'Query',
      fieldName: 'listCalls',
      requestMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Query.ListCalls.req.vtl',
      ),
      responseMappingTemplate: MappingTemplate.fromFile(
        './src/resources/graphql/Query.ListCalls.res.vtl',
      ),
    });
  }
}
