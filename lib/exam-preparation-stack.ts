import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Bucket, EventType} from 'aws-cdk-lib/aws-s3';
import {Subscription, SubscriptionProtocol, Topic} from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import * as path from "node:path";
import {SnsDestination} from "aws-cdk-lib/aws-s3-notifications";
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";
import {PartitionKey} from "aws-cdk-lib/aws-appsync";
import {LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";
import {HttpMethod} from "aws-cdk-lib/aws-apigatewayv2";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import{NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import  { Runtime } from 'aws-cdk-lib/aws-lambda';
import {NEW_STYLE_STACK_SYNTHESIS_CONTEXT} from "aws-cdk-lib/cx-api";



export class ExamPreparationStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const  websiteBucket = new Bucket(this, 'StaticWebsiteBucket', {
            publicReadAccess: true,
            websiteIndexDocument: 'index.html',
            blockPublicAccess: {
                blockPublicAcls: false  ,
                blockPublicPolicy: false   ,
                ignorePublicAcls: false,
                restrictPublicBuckets: false,
            },
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        const bucketDeployment :cdk.aws_s3_deployment.BucketDeployment = new BucketDeployment(this, 'IndexDeployment', {
            sources: [Source.asset(path.join(__dirname, '../website-assets'))],
            destinationBucket: websiteBucket,
        });
        const FileUploadTopic= new Topic(this, 'FileUploadTopic');

        new Subscription(this, 'FileUploadSubscription', {
            topic: FileUploadTopic,
            protocol: SubscriptionProtocol.EMAIL,
            endpoint:'dimitarnikbodurov@gmail.com'
        })

        const FileUploadQueue = new sqs.Queue(this, 'FileUploadQueue', {
            visibilityTimeout: Duration.seconds(300)
        })

        const StorageBucket = new Bucket(this, 'StorageBucket', {
            lifecycleRules:[
                {
                    id:"deleteAfterOneday",
                    expiration: Duration.hours (24)
                }
            ]
        })

        StorageBucket.addEventNotification(EventType.OBJECT_CREATED,new SnsDestination(FileUploadTopic))
       //TABLE

        const table = new Table(this,'Audits', {
            partitionKey: {
                name: 'PK' ,
                type: AttributeType.STRING
            },
            sortKey: {
                name: 'SK' ,
                type: AttributeType.STRING
            }
            // single table design  with PK and SK
        });

        table.addGlobalSecondaryIndex( {
            partitionKey: {
                name:'randomNumber' ,
                type:AttributeType.NUMBER
            },
            indexName:'randomNumber-index'
            });
          //add Secondary index to the table (name.addGlbalSecondaryIndex = table name in this case "table"

         //LAMBDA  functions
             // POST function
        const fillTableFunction= new NodejsFunction(this,'FillTable',{
            runtime: Runtime.NODEJS_20_X,
            entry: __dirname + '/../src/fillTable.ts',
            handler: 'handler',
            environment: {
                TABLE_NAME: table.tableName,
                TOPICS_ARN: FileUploadTopic.topicArn,
            },
        });

        table.grantReadWriteData(fillTableFunction); // give permisions to the Lambda function to be able to write in the table
        FileUploadTopic.grantPublish(fillTableFunction);    // very Important to add !

             //Get Function
        const getOrderFunction = new NodejsFunction(this,'GetOrder',{
            runtime: Runtime.NODEJS_20_X,
            entry: __dirname + '/../src/getOrder.ts',
            handler: 'handler',
            environment: {
                TABLE_NAME: table.tableName,
            }
        });

        table.grantReadData(getOrderFunction);

        //Rest API

        const OrderApi= new RestApi(this,'Orders',{
            restApiName:'Orders'
        });

        const OrderResource :cdk.aws_apigateway.Resource = OrderApi.root.addResource('order');

        OrderResource.addMethod(HttpMethod.GET, new LambdaIntegration(getOrderFunction, {
            proxy: true,
        }));

        OrderResource.addMethod(HttpMethod.POST, new LambdaIntegration(fillTableFunction, {
            proxy: true,
        }));

        new CfnOutput(this, 'WebsiteURL', {
            value: websiteBucket.bucketWebsiteUrl + '/index.html'
        })

    }
}
