import {APIGateway, DynamoDB} from "aws-sdk";
import {DynamoDBClient, PutItemCommand, PutItemCommandOutput} from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

const ddb = new DynamoDBClient(); // to work faster  because dynamoDB client start before the containter


export const handler = async (event: APIGatewayProxyEvent)  => {
 console.log(JSON.stringify(event));
 const tableName = process.env.TABLE_NAME!;
 const topicsArn = process.env.TOPICS_ARN!;


 const putItemCommand = new PutItemCommand( {
  Item: {
      PK: {
        S: "ORDER#..."
   },
      SK: {
        S: "METADATA#..."
   },
      RandomNumber: {
        N: "4"
   },
    timestamp: {
        S: ""
      }

    },
  ReturnConsumedCapacity: "TOTAL",
  TableName: tableName
 });

 const clientResponse  = await ddb.send(PutItemCommand);

 return {
  statusCode: 200,
  body: JSON.stringify({
   message: "OK"

  })
 }
}