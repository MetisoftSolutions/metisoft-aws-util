import * as aws from 'aws-sdk';
export interface IInitAwsOptions {
    pathToAwsConfig: string;
    s3: {
        bucketName: string;
    };
}
export interface IInitAwsReturn {
    s3: aws.S3;
}
export declare function initAws(options: IInitAwsOptions): IInitAwsReturn;
