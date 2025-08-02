import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Duration, Stack, StackProps} from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {Bucket, EventType} from 'aws-cdk-lib/aws-s3';
import {Subscription, SubscriptionProtocol, Topic} from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {Construct} from 'constructs';
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import * as path from "node:path";
import {SnsDestination} from "aws-cdk-lib/aws-s3-notifications";
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";



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

        const NRAAuditTable = new Table(this,'Audits', {
            partitionKey: {
                name: 'PK' ,
                type: AttributeType.STRING
            },
            sortKey: {
                name: 'SK' ,
                type: AttributeType.STRING
            }

        });


        new CfnOutput(this, 'WebsiteURL', {
            value: websiteBucket.bucketWebsiteUrl + '/index.html'
        })

    }
}
