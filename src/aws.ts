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

export function initAws(options: IInitAwsOptions): IInitAwsReturn {
  aws.config.loadFromPath(options.pathToAwsConfig);

  const s3 = new aws.S3({
    apiVersion: '2006-03-01',
    params: {
      Bucket: options.s3.bucketName
    }
  });

  return {s3};
}
