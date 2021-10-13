import _ from 'lodash'
import path from 'path';
import { Promise } from 'es6-promise';
import * as multer from 'multer';
import imageSize from 'image-size';
import * as fs from 'fs';
import * as aws from 'aws-sdk';
import moment from 'moment';
import { v4 as uuidV4 } from 'uuid';
import * as express from 'express';



export interface IImageConstraints {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxFileSizeKb?: number;
}



export function getUrlOfS3Object(region: string, bucketName: string, key: string) {
  return `https://s3.${region}.amazonaws.com/${bucketName}/${key}`;
}



export function getS3KeyFromUrl(url: string) {
  const postDomain = url.split('amazonaws.com/')[1];
  const indexOfFirstSlash = postDomain.indexOf('/');
  const key = postDomain.slice(indexOfFirstSlash+1);
  return key;
}



export function collapseRequestFilesIntoArray(requestFiles: Express.Request['files']) {
  let files: Express.Multer.File[] = [];

  if (!_.isArray(requestFiles)) {
    requestFiles = _.reduce(requestFiles, (allFiles, value) => {
      allFiles = allFiles.concat(value);
      return allFiles;
    }, [] as Express.Multer.File[]);

  } else {
    files = requestFiles as Express.Multer.File[];
  }

  return files;
}



/**
 * Given a URL to a resource in the `s3` bucket, will get the objects key from
 * that URL and attempt to delete it.
 * 
 * @param envConfigOptions 
 *  used to get the name of the bucket to delete from
 * @param s3 
 *  the S3 bucket object to delete from
 * @param url 
 *  the URL of the resource
 */
export function deleteObjectFromS3Bucket(s3: aws.S3, bucketName: string, url: string): Promise<aws.S3.DeleteObjectOutput | null> {
  const params: aws.S3.DeleteObjectRequest = {
    Bucket: bucketName,
    Key: getS3KeyFromUrl(url)
  };

  return new Promise((resolve, reject) => {
    s3.deleteObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



export function deleteObjectsFromS3Bucket(s3: aws.S3, bucketName: string, keys: string[]) {
  const request: aws.S3.DeleteObjectsRequest = {
    Bucket: bucketName,
    Delete: {
      Objects: _.map(keys, key => ({Key: key}))
    }
  };

  return new Promise((resolve, reject) => {
    s3.deleteObjects(request, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



export function configMulterUploadObject(
  destinationPath: string,
  fileNamePrefix: string
) {
  const storage = multer.diskStorage({
    destination: destinationPath,
    filename: (req, file, callback) => {
      callback(null, `${fileNamePrefix}-${uuidV4()}`);
    }
  });
  return multer.default({storage});
}



export function uploadMulterImagesToS3(
  s3: aws.S3,
  userId: string,
  constraints: IImageConstraints,
  s3DirectoryName: string,
  bucketName: string,
  files: Express.Multer.File[]
): Promise<string[]> {
  return Promise.all(
    _.map(files, _.partial(uploadMulterImageToS3, s3, userId, constraints, s3DirectoryName, bucketName))
  );
}



/**
 * 
 * @param userId 
 * @param constraints 
 * @param directoryName 
 * @param bucketName 
 * @param file 
 * 
 * @returns
 *    S3 object key used to store the file.
 */
export function uploadMulterImageToS3(
  s3: aws.S3,
  userId: string,
  constraints: IImageConstraints,
  s3DirectoryName: string,
  bucketName: string,
  file: Express.Multer.File
): Promise<string> {
  const filePath = path.join(file.destination, file.filename);
  const dimensions = imageSize(filePath);

  const error = getConstraintsError(dimensions, file.size, constraints);
  if (error) {
    fs.unlinkSync(filePath);
    throw error;
  }

  return uploadMulterFileToS3(s3, userId, 0, s3DirectoryName, bucketName, file);
}



export function uploadMulterFileToS3(
  s3: aws.S3,
  userId: string,
  maxFileSizeKb: number,
  s3DirectoryName: string,
  bucketName: string,
  file: Express.Multer.File
): Promise<string> {
  const filePath = path.join(file.destination, file.filename);

  if (maxFileSizeKb > 0 && (file.size / 1024 > maxFileSizeKb)) {
    fs.unlinkSync(filePath);
    throw new Error('FILE_SIZE_TOO_BIG');
  }

  const fileExtension = __getFileExtension(file.originalname);
  let s3ObjectKey = '';

  const timestamp = moment().utc().format('YYYYMMDDTHHmmss');
  s3ObjectKey = `${s3DirectoryName}/${userId}.${timestamp}.${uuidV4()}.${fileExtension}`;

  const s3Params: aws.S3.PutObjectRequest = {
    ACL: 'public-read',
    Bucket: bucketName,
    Key: s3ObjectKey,
    Body: fs.readFileSync(filePath)
  };

  return new Promise((resolve, reject) => {
      s3.putObject(s3Params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    })

    .then(() => {
      fs.unlinkSync(filePath);
      return s3ObjectKey;
    });
}



export interface IUploadFileToS3Args {
  s3: aws.S3;
  bucketName: string;
  key: string;
  acl?: aws.S3.PutObjectRequest['ACL'];

  /**
   * If both this and `textContents` are given, this argument takes precedence.
   */
  binaryContents?: Buffer;

  contentType?: string;
  textContents?: string;
}

export function uploadFileToS3(args: IUploadFileToS3Args): Promise<string> {
  const request: aws.S3.PutObjectRequest = {
    ACL: args.acl || 'private',
    Bucket: args.bucketName,
    Key: args.key,
    Body: args.binaryContents || args.textContents || "",
    ContentType: args.contentType
  };

  return new Promise((resolve, reject) => {
      args.s3.putObject(request, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    })

    .then(() => args.key);
}



export interface IDownloadFileFromS3Args {
  s3: aws.S3;
  bucketName: string;
  key: string;
}

export function downloadFileFromS3(args: IDownloadFileFromS3Args) {
  const request: aws.S3.GetObjectRequest = {
    Bucket: args.bucketName,
    Key: args.key
  };

  return new Promise<aws.S3.GetObjectOutput>((resolve, reject) => {
    args.s3.getObject(request, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  });
}



export interface IListFilesInDirectoryArgs {
  s3: aws.S3;
  bucketName: string;
  directoryName: string;
}

export function listFilesInDirectory(args: IListFilesInDirectoryArgs) {
  const request: aws.S3.ListObjectsV2Request = {
    Bucket: args.bucketName,
    Prefix: args.directoryName
  };

  return new Promise<aws.S3.ListObjectsV2Output>((resolve, reject) => {
      args.s3.listObjectsV2(request, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    })

    .then(retVal => _.compact(_.map(retVal.Contents, objectDescriptor => (objectDescriptor.Key || ''))))

    .then(fileList => _.compact(_.map(fileList, fileName => {
      if (fileName.startsWith(args.directoryName)) {
        return fileName.slice(args.directoryName.length);
      }
      return fileName;
    })));
}



export function getSizeOfObject(s3: aws.S3, bucketName: string, key: string) {
  const args: aws.S3.HeadObjectRequest = {
    Bucket: bucketName,
    Key: key
  };

  return new Promise<number>((resolve, reject) => {
    s3.headObject(args, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.ContentLength || 0);
      }
    });
  });
}



export function getRangeOfObject(s3: aws.S3, bucketName: string, key: string, startByte: number, endByte: number) {
  const args: aws.S3.GetObjectRequest = {
    Bucket: bucketName,
    Key: key,
    Range: `bytes=${startByte}-${endByte}`
  };

  return new Promise<aws.S3.GetObjectOutput>((resolve, reject) => {
    s3.getObject(args, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}



export interface IChunkRequest {
  start: number;
  end: number;
  chunkSize: number;
}

export function getChunkRequestFromRangeHeader(rangeHeader: string, fileSize: number): IChunkRequest {
  const pieces = rangeHeader.replace(/bytes=/, '').split('-')
  const start = parseInt(pieces[0], 10);
  const end = pieces[1] ?
    parseInt(pieces[1], 10) :
    fileSize - 1;
  const chunkSize = (end - start) + 1;

  return {
    start,
    end,
    chunkSize
  };
}



function __getFileExtension(fileName: string) {
  const namePieces = fileName.split('.');
  return namePieces[namePieces.length-1];
}



export function getConstraintsError(dimensions: {width: number, height: number}, fileSizeB: number, constraints: IImageConstraints): Error | null {
  if (constraints.minWidth && dimensions.width < constraints.minWidth) {
    return new Error('WIDTH_TOO_SMALL');
  } else if (constraints.maxWidth && dimensions.width > constraints.maxWidth) {
    return new Error('WIDTH_TOO_LARGE');
  } else if (constraints.minHeight && dimensions.height < constraints.minHeight) {
    return new Error('HEIGHT_TOO_SMALL');
  } else if (constraints.maxHeight && dimensions.height > constraints.maxHeight) {
    return new Error('HEIGHT_TOO_LARGE');
  } else if (constraints.maxFileSizeKb && (fileSizeB / 1024) > constraints.maxFileSizeKb) {
    return new Error('FILE_SIZE_TOO_LARGE');
  } else {
    return null;
  }
}



export function parseExtraArgs(req: express.Request) {
  let args: any;

  args = JSON.parse(req.body.extraArgs);
  if (!args) {
    throw new Error('NO_EXTRA_ARGS');
  }
  
  return args;
}
